#!/usr/bin/env python3
"""Experimental, fail-closed Kent County official 2026 Senate result adapter.

Only publishes an independently attributed county-wide total if the original
November 2026 Enhanced Voting page has a valid post-close timestamp, the
exact Senate candidates, an unambiguous reported-unit fraction, and positive
vote counts. Never promotes test data, projections or other contests.

Adapter is intentionally narrow. This is not an assertion that all 83 Michigan
county websites have machine-readable election-night APIs.
"""
from __future__ import annotations
import datetime as dt
import json
import re
import sys
import shutil
import subprocess
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"michigan/election-night/county_auto.json"
URL="https://app.enhancedvoting.com/results/public/kent-county-mi/elections/11032026_20261005115447"
CLOSE=dt.datetime(2026,11,3,20,0,tzinfo=ZoneInfo("America/Detroit")).astimezone(dt.timezone.utc)
CANDIDATES=(("Abdul El-Sayed","Democrat","dem"),("Mike Rogers","Republican","rep"),
            ("Lydia Christensen","Libertarian","other"),("Tim Long","U.S. Taxpayers","other"),
            ("Douglas P. Marsh","Green","other"),("Walter P. Kristy","Natural Law","other"))

def normalize_text(html):
    soup=BeautifulSoup(html,"html.parser")
    for tag in soup(["script","style","noscript","svg"]):tag.decompose()
    text=soup.get_text("\n",strip=True)
    return "\n".join(" ".join(line.split()) for line in text.splitlines() if line.strip())

def parse_report(content,now=None):
    now=now or dt.datetime.now(dt.timezone.utc)
    txt=normalize_text(content)
    if not re.search(r"Kent County",txt,re.I) or not re.search(r"November\s+3,?\s+2026\s+General Election",txt,re.I):
        raise ValueError("Not the November 3, 2026 Kent general-election page")
    timestamp=re.search(r"Last Updated\s+(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,?\s+"
                        r"([A-Z][a-z]+\s+\d{1,2},\s+2026\s+at\s+\d{1,2}:\d{2}:\d{2}\s*[AP]M)",txt,re.I)
    if not timestamp:raise ValueError("Publisher timestamp missing or changed schema")
    published=dt.datetime.strptime(timestamp.group(1),"%B %d, %Y at %I:%M:%S %p")
    published=published.replace(tzinfo=ZoneInfo("America/Detroit")).astimezone(dt.timezone.utc)
    if published<CLOSE:raise ValueError("Pre-election test data: publisher timestamp predates closing")
    if published>now+dt.timedelta(minutes=5):raise ValueError("Future source timestamp")
    start=re.search(r"^United States Senator\s*$",txt,re.M|re.I)
    if not start:raise ValueError("Senate contest not found in the source page")
    after=txt[start.end():]
    end=re.search(r"^Representative in Congress\b",after,re.M|re.I)
    if not end:raise ValueError("Senate contest boundary not found")
    section=after[:end.start()]
    # Vote for 1, not a primary, with both November nominees.
    if not re.search(r"Vote for 1",section,re.I):raise ValueError("Unexpected Senate vote-for format")
    # Parse a candidate as name -> party -> zero or more percentage tokens -> final vote count.
    # Exact labels prevent confusing straight-ticket totals with US Senate totals.
    clean=[line.strip() for line in section.splitlines() if line.strip()]
    counted={}
    for i,name_party in enumerate(CANDIDATES):
        name,party,kind=name_party
        places=[j for j,line in enumerate(clean) if line.casefold()==name.casefold()]
        if len(places)!=1:raise ValueError("Candidate missing or repeated: "+name)
        idx=places[0]
        if idx+1>=len(clean) or clean[idx+1].casefold()!=party.casefold():
            raise ValueError("Candidate party mismatch: "+name)
        numeric=[]
        for line in clean[idx+2:idx+7]:
            if line in [x[0] for x in CANDIDATES] or line.startswith("Precincts reporting"):break
            if re.fullmatch(r"\d{1,3}(?:,\d{3})*|\d+",line):numeric.append(int(line.replace(",","")))
        if not numeric:raise ValueError("No unambiguous vote figure: "+name)
        counted[name]=numeric[-1]
    fraction=re.search(r"Precincts reporting\s+(\d+)\s*/\s*(\d+)",section,re.I)
    if not fraction:raise ValueError("No verified reporting-unit fraction")
    reported,total=map(int,fraction.groups())
    if not 0<reported<=total<=2000:raise ValueError("No precincts reported or invalid denominator")
    dem=counted["Abdul El-Sayed"];rep=counted["Mike Rogers"]
    other=sum(v for name,v in counted.items() if name not in ("Abdul El-Sayed","Mike Rogers"))
    if not (dem or rep):raise ValueError("No US Senate vote totals available yet")
    if dem+rep+other>2_000_000:raise ValueError("Implausible county US Senate totals")
    record={"county":"Kent","dem":dem,"rep":rep,"other":other,
            "asOf":published.isoformat().replace("+00:00","Z"),
            "sourceUrl":URL,"reportingStatus":"complete" if reported==total else "partial",
            "sourceType":"county_clerk"}
    return record,reported,total

def fetch_html():
    request=urllib.request.Request(URL,headers={"User-Agent":"ErvinModelPublicResultReader/1.0 (source verification; github.com/geervin/ervin-model-2026)",
                                                "Accept":"text/html,application/xhtml+xml;q=0.9"})
    with urllib.request.urlopen(request,timeout=17) as response:
        if response.status!=200:raise ValueError("Kent HTTP "+str(response.status))
        data=response.read(2_500_000)
    html=data.decode("utf-8","replace")
    # Enhanced Voting is client-rendered. Render only the original official
    # portal when the initial HTML lacks real contest text.
    if "United States Senator" in normalize_text(html):
        return html
    browser=next((shutil.which(n) for n in ("google-chrome","google-chrome-stable","chromium") if shutil.which(n)),None)
    if not browser:raise ValueError("Kent results are client-rendered; no browser installed")
    cmd=[browser,"--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
         "--no-first-run","--virtual-time-budget=14000","--dump-dom",URL]
    run=subprocess.run(cmd,text=True,capture_output=True,timeout=48)
    rendered=run.stdout
    if run.returncode!=0 or "United States Senator" not in normalize_text(rendered):
        raise ValueError("Official Kent Senate results unavailable in rendered browser; no figures published")
    return rendered

def main():
    previous=json.loads(OUT.read_text()) if OUT.exists() else {}
    try:
        kent,n,total=parse_report(fetch_html())
    except Exception as error:
        print("NO LIVE KENT UPDATE: "+str(error)[:220])
        return 0  # No change is not a successful live vote report.
    old=(previous.get("counties") or [{}])[0]
    if old.get("county")=="Kent" and kent["asOf"]<=old.get("asOf","") and kent["dem"]==old.get("dem") and kent["rep"]==old.get("rep"):
        print("Kent unchanged from previous accepted snapshot")
        return 0
    if old.get("county")=="Kent" and kent["asOf"]<old.get("asOf",""):
        print("Rejecting Kent source timestamp rollback")
        return 0
    snapshot={"version":1,"election":"2026-11-03","office":"US Senate","updatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),
              "status":"unofficial_automatically_validated_county_report",
              "counties":[kent],"adapter":"kent_official_enhanced_voting",
              "sourcePolicy":"Automatically parsed ONLY after 8 p.m. local, from directly attributed November 2026 Senate contest and positive precinct-reported fraction. Verify against clerk's original page."}
    OUT.write_text(json.dumps(snapshot,indent=2)+"\n")
    print(f"KENT verified candidate-count snapshot accepted: precincts {n}/{total}; timestamp {kent['asOf']}")
    return 0

if __name__=="__main__":sys.exit(main())
