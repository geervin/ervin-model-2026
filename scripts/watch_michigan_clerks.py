#!/usr/bin/env python3
"""Monitor Michigan county clerk public websites for new 2026 general-election reports.

This checker only discovers changes and source links. It NEVER derives or posts vote
counts. A webpage change is not a precinct return. Actual results are imported via
the separate, reviewed county CSV pipeline.

Source seeds: State of Michigan SOS election-night county website directory.
"""
from __future__ import annotations
import concurrent.futures
import hashlib
import html
import json
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NIGHT = ROOT / "michigan" / "election-night"
REGISTRY = NIGHT / "county_watch_sources.json"
OUT = NIGHT / "clerk_watch.json"
HISTORY = NIGHT / "clerk_watch_events.json"
COUNTIES = ROOT / "michigan" / "county_history.json"
UA = "ErvinModelCountyWatcher/1.0 (public election source monitor; github.com/geervin/ervin-model-2026)"
MAX_BYTES = 600_000
REPORT_TERMS = re.compile(r"(election results?|unofficial results?|statement of votes cast|precinct results?|results? report|vote totals?|results? portal|election night)", re.I)
CURRENT_ELECTION = re.compile(r"(nov(?:ember)?[\s./_-]*0?3[\s./,_-]*(?:20)?26|(?:20)?26[\s./_-]*11[\s./_-]*0?3|11032026|20261103|nov(?:ember)?[\s./_-]*2026|2026[\s./_-]*(?:nov(?:ember)?|general)|general(?: election)?.{0,18}2026)", re.I)
EXCLUDE = re.compile(r"(202[0-57-9]|aug(?:ust)?\W*0?4|aug(?:ust)?\W*2026|primary|may\W*\d|20260[58]|05[-_/]26|08[-_/]26|candidate list|canvass|logic and accuracy|training|past elections|archive|registration|proposals only|polling places)", re.I)
PUBLIC_HOST = re.compile(r"^[a-z0-9.-]+\.[a-z]{2,}$", re.I)
PORTAL_HOSTS = ("clarityelections.com", "enhancedvoting.com")

class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links, self.href, self.text, self.visible = [], None, [], []
        self.hidden = 0
        self.heading_tag, self.heading_text, self.period = None, [], ""
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "svg"):
            self.hidden += 1
        if tag in ("h1","h2","h3","h4","h5"):
            self.heading_tag,self.heading_text=tag,[]
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.text = []
    def handle_endtag(self, tag):
        if tag == "a" and self.href is not None:
            self.links.append((self.href, " ".join(self.text), self.period))
            self.href, self.text = None, []
        if tag == self.heading_tag:
            header = " ".join(self.heading_text).strip()
            if re.search(r"202[0-9]", header):self.period=header[:100]
            self.heading_tag,self.heading_text=None,[]
        if tag in ("script", "style", "svg") and self.hidden:
            self.hidden -= 1
    def handle_data(self, data):
        if self.heading_tag:self.heading_text.append(data)
        if self.href is not None:
            self.text.append(data)
        if not self.hidden:
            self.visible.append(data)

def canonical(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("https", "http") or parsed.username or parsed.password:
        raise ValueError("Unsupported destination URL")
    host = (parsed.hostname or "").lower()
    if not PUBLIC_HOST.fullmatch(host) or host in ("localhost", "127.0.0.1"):
        raise ValueError("Non-public URL")
    if parsed.port not in (None, 80, 443):
        raise ValueError("Unexpected network port")
    # Preserve ordinary reporting parameters but discard analytics fragments.
    args = [(k,v) for k,v in urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
            if not k.lower().startswith(("utm_", "fbclid", "gclid", "_ga"))]
    return urllib.parse.urlunparse((parsed.scheme, parsed.netloc.lower(),parsed.path or "/",
                                   "", urllib.parse.urlencode(args), ""))

class PublicRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # No redirects to internal IPs, localhost, credential URLs, custom ports.
        canonical(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

OPENER = urllib.request.build_opener(PublicRedirects())

def report_links(base_url, text):
    parser = Links()
    parser.feed(text)
    results = {}
    for href, label, period in parser.links:
        label = " ".join(label.split())[:130]
        try:
            target = canonical(urllib.parse.urljoin(base_url, html.unescape(href)))
        except (ValueError, TypeError):
            continue
        path=urllib.parse.urlparse(target).path
        descriptor=label+" "+path
        election_context=descriptor+" "+period
        if not REPORT_TERMS.search(descriptor):
            continue
        if EXCLUDE.search(election_context):
            continue
        # Require unambiguous year/election context in the URL or link label.
        if not CURRENT_ELECTION.search(election_context):
            continue
        results[target] = {"title":label or "Potential November 2026 result report", "url":target}
    return sorted(results.values(), key=lambda x:x["url"])[:12], parser

def inspect_county(name, url, prior=None, fetch=None):
    """Single public source. Test injection allows offline deterministic unit tests."""
    old = prior or {}
    old_links = old.get("reportLinks") or []
    item = {"county":name,"sourceUrl":url,"status":"unavailable","checkedAt":datetime.now(timezone.utc).isoformat(),
            "reportLinks":old_links, "newLinks":[], "changed":False,
            "changeKind":"none","lastChanged":old.get("lastChanged"),"note":"Not checked"}
    try:
        origin = canonical(url)
        def get_html(target):
            if fetch is not None:
                content=fetch(target)
                if not isinstance(content,str):raise ValueError("Source returned no HTML text")
                if len(content)>MAX_BYTES:raise ValueError("Website response over size limit")
                return content,target
            request=urllib.request.Request(target,headers={"User-Agent":UA,"Accept":"text/html,application/xhtml+xml;q=0.9,*/*;q=0.5"})
            with OPENER.open(request,timeout=10) as resp:
                if resp.status!=200:raise ValueError("HTTP "+str(resp.status))
                effective=canonical(resp.url)
                ctype=resp.headers.get("Content-Type","").lower()
                if "text/html" not in ctype and "application/xhtml+xml" not in ctype:
                    raise ValueError("Not an HTML page")
                payload=resp.read(MAX_BYTES+1)
            if len(payload)>MAX_BYTES:raise ValueError("Website response over size limit")
            return payload.decode("utf-8","replace"),effective

        data,effective=get_html(origin)
        links,parser=report_links(effective,data)
        inspected=effective
        # Follow at most one public election-results hub from the county site.
        # Do not crawl unrelated destinations, and never extract numeric returns.
        if not links and not any(x in urllib.parse.urlparse(effective).hostname for x in PORTAL_HOSTS):
            hubs=[]
            for href,label,_ in parser.links:
                if not re.search(r"(election results|results &? data|unofficial results|elections?/voting)",label,re.I):
                    continue
                if re.search(r"(archive|past|20[012][0-9]|primary)",label+" "+href,re.I):
                    continue
                try:dest=canonical(urllib.parse.urljoin(effective,href))
                except (TypeError,ValueError):continue
                host=urllib.parse.urlparse(dest).hostname
                root_host=urllib.parse.urlparse(effective).hostname
                if host!=root_host and not any(host.endswith("."+x) for x in PORTAL_HOSTS):
                    continue
                if dest!=effective:hubs.append((dest,label))
            hubs.sort(key=lambda x:(0 if "results" in x[1].lower() else 1,len(x[0])))
            if hubs:
                try:
                    data2,effective2=get_html(hubs[0][0])
                    nextlinks,nextparser=report_links(effective2,data2)
                    inspected=effective2
                    if nextlinks:links=nextlinks
                    data,parser=data2,nextparser
                except Exception:
                    pass
        texts=re.sub(r"\s+"," "," ".join(parser.visible))[:30000]
        # A page hash is a *watch signal*, never evidence that vote totals exist.
        fingerprint = hashlib.sha256(texts.encode("utf-8")).hexdigest()[:20]
        now = item["checkedAt"]
        prior_fingerprint = old.get("fingerprint")
        known = {x["url"] for x in old_links}
        new = [x for x in links if x["url"] not in known]
        direct = any(domain in urllib.parse.urlparse(origin).hostname for domain in PORTAL_HOSTS) or (
            "results" in urllib.parse.urlparse(inspected).path.lower())
        kind = "new_result_links" if new and prior_fingerprint else (
            "page_modified" if direct and prior_fingerprint and fingerprint != prior_fingerprint else "none")
        item.update(status="reachable",sourceUrl=origin,inspectedUrl=inspected,reportLinks=links,
                    newLinks=new if prior_fingerprint else [],fingerprint=fingerprint,
                    changed=kind!="none",changeKind=kind,
                    lastChanged=now if kind!="none" else old.get("lastChanged"),
                    note=("2026 result links discovered; vote totals unverified" if links else
                          "Public page responds; no qualifying 2026 result links exposed"))
    except urllib.error.HTTPError as err:
        item.update(status="indeterminate" if err.code in (401,403,429) else "unavailable",
                    note="HTTP "+str(err.code)+"; automated access may differ from a browser")
    except (urllib.error.URLError,TimeoutError,socket.timeout) as err:
        item["note"]="Connection/timeout: "+str(getattr(err,"reason",err))[:100]
    except Exception as err:
        item.update(status="indeterminate",note=type(err).__name__+": "+str(err)[:110])
    return item

def monitor(now=None, workers=10, fetch=None):
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))["counties"]
    county_data = json.loads(COUNTIES.read_text(encoding="utf-8"))["counties"]
    required = {x["name"] for x in county_data}
    if set(registry) != required or len(registry)!=83:
        raise RuntimeError("Clerk registry must cover exactly all 83 Michigan counties")
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    old_items = old.get("counties",{})
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        jobs = {county:executor.submit(inspect_county,county,registry[county],old_items.get(county),fetch)
                for county in sorted(registry)}
        rows = {county:future.result() for county,future in jobs.items()}
    stamp = (now or datetime.now(timezone.utc)).isoformat()
    active = [v for v in rows.values() if v["status"]=="reachable"]
    changed = [v["county"] for v in rows.values() if v["changed"]]
    new_links = sum(len(v["newLinks"]) for v in rows.values())
    report = {
        "checkedAt":stamp,"coverage":83,"purpose":"Clerk webpage and report discovery only; NOT automatic precinct vote ingestion",
        "summary":{"reachable":len(active),"indeterminate":sum(v["status"]=="indeterminate" for v in rows.values()),
                   "unavailable":sum(v["status"]=="unavailable" for v in rows.values()),
                   "resultLinks":sum(len(v["reportLinks"]) for v in rows.values()),
                   "changedCounties":len(changed),"newReportLinks":new_links},
        "changedCounties":changed,"counties":rows
    }
    OUT.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    history = json.loads(HISTORY.read_text()) if HISTORY.exists() else {"events":[]}
    events = history.get("events",[])
    for county in changed:
        row = rows[county]
        events.append({"at":stamp,"county":county,"kind":row["changeKind"],
                       "newLinks":row["newLinks"],"sourceUrl":row["sourceUrl"],
                       "notice":"Source change is not an election return"})
    HISTORY.write_text(json.dumps({"updatedAt":stamp,"events":events[-150:]},indent=2)+"\n",encoding="utf-8")
    print("Clerk watch",stamp, report["summary"])
    # Every run is a *check*. Do not fail the entire monitor because a clerk blocks probes.
    return report

if __name__ == "__main__":
    monitor()
