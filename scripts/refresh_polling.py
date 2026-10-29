#!/usr/bin/env python3
"""Conservative 2026 Senate poll-aggregate checker.

Only updates a tracked race when a Wikipedia general-election aggregate row
explicitly identifies the same two candidates and the publisher source.
Never invents polls, substitutes primary polling, or changes candidate lists.
"""
from __future__ import annotations
import csv
import datetime as dt
import json
import re
import urllib.request
from pathlib import Path
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parent.parent
HTML=ROOT/"index.html"
AUDIT=ROOT/"refresh_log.json"
CSV=ROOT/"source_snapshot.csv"
PREFIX="window.ERVIN_DATA = "
ENDING=";\n\n</script><script>"
SOURCES={
    "rcp": ("realclearpolling","realclearpolitics"),
    "ddhq": ("decision desk hq",),
    "win270": ("270towin",),
    "silver": ("silver bulletin",),
    "average": ("average",),
}
CANDIDATES_SAFE=re.compile(r"[^a-z0-9]+")
def norm(s):
    return CANDIDATES_SAFE.sub(" ",s.lower()).strip()
def page_html(state):
    title="2026_United_States_Senate_election_in_"+state.replace(" ","_")
    if state=="Alaska": title="2026_United_States_Senate_election_in_Alaska"
    url="https://en.wikipedia.org/wiki/"+title
    req=urllib.request.Request(url,headers={"User-Agent":"ErvinModelResearch/1.0 (poll-data public source audit; GitHub geervin/ervin-model-2026)","Accept":"text/html"})
    with urllib.request.urlopen(req,timeout=25) as response:
        return response.read(4500000).decode("utf-8","replace"),url

def identify_source(row):
    n=norm(row)
    if n=="average": return "average"
    for key,names in SOURCES.items():
        if key=="average":continue
        if any(n.startswith(alias) for alias in names):
            return key
    return None

def clean_value(raw):
    raw=raw.replace("−","-").replace("–","-")
    raw=re.sub(r"\[[^\]]{1,18}\]","",raw)
    return re.sub(r"\s+"," ",raw).strip()

def parse_state(html,race):
    soup=BeautifulSoup(html,"html.parser")
    dem=race["dem"].split()[-1].lower()
    rep=race["rep"].split()[-1].lower()
    # Keep the 2026 candidate pair: specific name matching prevents mixing
    # primaries, hypotheticals, and unrelated general election candidates.
    updates={}
    for table in soup.find_all("table"):
        if "wikitable" not in " ".join(table.get("class",[])): continue
        headers=[clean_value(x.get_text(" ",strip=True)).lower() for x in table.select("tr")[:2]]
        top=" ".join(headers)
        if "source of poll" not in top and "source of polling" not in top and "poll source" not in top:
            continue
        if "aggregation" not in top and "aggregate" not in top:
            continue
        if dem not in top or rep not in top: continue
        # Candidate-column names are also checked against the header.
        rows=table.find_all("tr")
        header_cells=[clean_value(x.get_text(" ",strip=True)) for x in rows[0].find_all(["th","td"],recursive=False)]
        hnorm=[norm(x) for x in header_cells]
        di=next((i for i,s in enumerate(hnorm) if dem in s.split()),None)
        ri=next((i for i,s in enumerate(hnorm) if rep in s.split()),None)
        if di is None or ri is None or di==ri:continue
        # Avoid accepting a primary table by checking both nominees.
        for row in rows[1:]:
            cells=[clean_value(x.get_text(" ",strip=True)) for x in row.find_all(["th","td"],recursive=False)]
            if len(cells)!=len(header_cells):continue
            key=identify_source(cells[0])
            if not key or key in updates:continue
            try:
                dm=float(re.search(r"\d+(?:\.\d+)?",cells[di]).group())
                rp=float(re.search(r"\d+(?:\.\d+)?",cells[ri]).group())
            except (ValueError,AttributeError):continue
            if not 10<=dm<=90 or not 10<=rp<=90 or dm+rp>102:continue
            margin=round(dm-rp,2)
            date=" ".join(cells[1:min(di,ri)])
            # Only accept tables that report current-year aggregates.
            if "2026" not in date:continue
            # Extract latest publication date when displayed.
            dates=re.findall(r"(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+2026",date,re.I)
            if not dates:continue
            last=dates[-1]
            try:
                stamp=dt.datetime.strptime(last.replace(",",""),"%B %d %Y").date()
            except ValueError:continue
            if stamp>dt.datetime.now(dt.timezone.utc).date():continue
            updates[key]={"value":margin,"date":stamp.strftime("%b %d"),"origin":{"rcp":"RealClearPolling","ddhq":"Decision Desk HQ","win270":"270toWin","silver":"Silver Bulletin","average":"Wikipedia aggregator average"}[key],"proxy":False}
        if updates:break
    return updates

def main():
    contents=HTML.read_text(encoding="utf-8")
    a=contents.index(PREFIX)+len(PREFIX)
    b=contents.index(ENDING,a)
    data=json.loads(contents[a:b])
    checked=dt.datetime.now(dt.timezone.utc)
    report={"checkedAt":checked.isoformat(),"pagesParsed":0,"checkedRaceCount":len(data["states"]),"changes":0,"observationsFound":0,"errors":[],"updated":[],"sourceCoverage":[],"stalePublisherRaces":[],"sources":"Wikipedia 2026 general-election aggregate tables; matching candidate pair required"}
    for race in data["states"]:
        try:
            html,url=page_html(race["state"])
            rows=parse_state(html,race)
            if rows: report["pagesParsed"]+=1
            report["sourceCoverage"].append({"state":race["code"],"verifiedPublisherRows":len(rows),"result":"matched" if rows else "no matching current-year aggregate"})
            report["observationsFound"]+=len(rows)
            for key,entry in rows.items():
                old=race["sources"][key]
                old_date=old.get("date","")
                # Do not rewrite newer source dates with older aggregator snapshots.
                def date_key(value):
                    try:return dt.datetime.strptime(value.strip()+" 2026","%b %d %Y").date()
                    except ValueError:return dt.date(2026,1,1)
                if date_key(entry["date"])<date_key(old_date):continue
                if abs(entry["value"]-float(old["value"]))>30:
                    report["errors"].append(race["code"]+"/"+key+": suspicious >30-point swing")
                    continue
                if old.get("value")!=entry["value"] or old.get("date")!=entry["date"] or old.get("proxy"):
                    old.update(entry)
                    old["url"]=url
                    old["note"]="Verified from Wikipedia general-election aggregator table; individual underlying polls may overlap."
                    report["changes"]+=1
                    report["updated"].append({"state":race["code"],"source":key,"margin":entry["value"],"published":entry["date"]})
        except Exception as exc:
            report["errors"].append(race["code"]+": "+str(exc)[:180])
            report["sourceCoverage"].append({"state":race["code"],"verifiedPublisherRows":0,"result":"source check failed"})
    # The source-check time and actual published-aggregate dates are different.
    # Expose stale rows and missing sources without silently assigning current dates.
    for race in data["states"]:
        eligible=[]
        for key,entry in race["sources"].items():
            if key not in ("rcp","ddhq","win270","silver") or entry.get("proxy"):continue
            try: stamp=dt.datetime.strptime(str(entry.get("date","")).strip()+" 2026","%b %d %Y").date()
            except ValueError:continue
            eligible.append(stamp)
        if eligible:
            days=(checked.date()-max(eligible)).days
            if days>7:report["stalePublisherRaces"].append({"state":race["code"],"daysOld":days,"latestDate":max(eligible).isoformat()})
        else:report["stalePublisherRaces"].append({"state":race["code"],"daysOld":None,"latestDate":None,"reason":"No independently attributed publisher averages"})
    # Count successful checks, never report zero parsed as successful freshness.
    data["liveMeta"]=report
    if report["changes"]:
        data["asof"]=checked.strftime("%B %d, %Y")
    replacement=json.dumps(data,ensure_ascii=False,indent=2)
    new_html=contents[:a]+replacement+contents[b:]
    if new_html!=contents:HTML.write_text(new_html,encoding="utf-8")
    with CSV.open("w",newline="",encoding="utf-8") as out:
        writer=csv.writer(out)
        writer.writerow(["As of","State","Code","2026 non-R candidate","2026 Republican candidate","Source tab","Poll lead (non-R minus R)","Publisher or proxy","Field date","Proxy","Notes","Source link"])
        for r in data["states"]:
            for key,v in r["sources"].items():
                writer.writerow([data["asof"],r["state"],r["code"],r["dem"],r["rep"],key,v["value"],v["origin"],v["date"],v["proxy"],v.get("note",""),v["url"]])
    AUDIT.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(f"Checked {len(data['states'])} states; parsed {report['pagesParsed']} matching aggregates; changed {report['changes']} inputs; errors {len(report['errors'])}")
if __name__=="__main__":main()
