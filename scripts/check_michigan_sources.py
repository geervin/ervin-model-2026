#!/usr/bin/env python3
"""Public endpoint preflight for Michigan election-night reporting.

This is a CONNECTIVITY check, not proof that an endpoint has real 2026 returns
or that a county has a licensed machine-readable precinct feed. Never ingest
votes here. The JSON is safe for a static public GitHub Pages site.
"""
from __future__ import annotations
import json
import socket
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"michigan"/"election-night"/"source_health.json"
UA="ErvinModel/1.0 (public election night source readiness; github.com/geervin/ervin-model-2026)"
URLS={
 "oakland":{"label":"Oakland · 2026 results portal","url":"https://results.enr.clarityelections.com/MI/Oakland/127284/","kind":"page"},
 "kent":{"label":"Kent · 2026 results portal","url":"https://app.enhancedvoting.com/results/public/kent-county-mi/elections/11032026_20261005115447","kind":"page"},
 "livingston":{"label":"Livingston · county results","url":"https://milivcounty.gov/elections/election-results/","kind":"page"},
 "state_directory":{"label":"Michigan · official county directory","url":"https://www.michigan.gov/sos/elections/election-results-and-data/candidate-listings-and-election-results-by-county","kind":"page"},
 "precinct_geometry":{"label":"Michigan BOE · 2026 precinct geography","url":"https://services3.arcgis.com/dxRQUfTDNtfqZ301/arcgis/rest/services/2026_Voting_Precincts/FeatureServer/0/query?where=1%3D1&returnCountOnly=true&f=json","kind":"gis"},
 "statewide_replay":{"label":"Open America · 2024 API replay","url":"https://openamerica.io/elections/results.json?year=2024&office=Senate","kind":"replay"},
 "statewide_current":{"label":"Open America · 2026 Senate API contract","url":"https://openamerica.io/elections/results.json?year=2026&office=Senate","kind":"current"}
}

def inspect(key,entry,opener=urllib.request.urlopen):
    result={"label":entry["label"],"url":entry["url"],"status":"unavailable",
            "note":"Not tested","role":entry["kind"]}
    try:
        request=urllib.request.Request(entry["url"],headers={"User-Agent":UA,"Accept":"application/json,text/html;q=0.8,*/*;q=0.5","Origin":"https://geervin.github.io"})
        with opener(request,timeout=12) as response:
            code=getattr(response,"status",200)
            body=response.read(2_000_000)
            cors=response.headers.get("Access-Control-Allow-Origin", "")
        if code!=200: raise ValueError("HTTP "+str(code))
        if entry["kind"]=="gis":
            data=json.loads(body)
            count=data.get("count")
            if not isinstance(count,int) or count<2500:raise ValueError("GIS feature count not established")
            result.update(status="reachable",note=f"{count:,} precinct polygons reported; geometry only")
        elif entry["kind"]=="current":
            data=json.loads(body)
            races=data.get("races")
            if data.get("api")!=1 or data.get("year")!=2026 or str(data.get("office","")).lower()!="senate" or not isinstance(races,dict):
                raise ValueError("2026 Senate API does not match expected contract")
            result.update(status="reachable",note="2026 API contract responds; this is not evidence of Michigan vote reporting")
        elif entry["kind"]=="replay":
            data=json.loads(body)
            races=data.get("races") or {}
            if data.get("api")!=1 or data.get("year")!=2024 or str(data.get("office","")).lower()!="senate" or not isinstance(races,dict) or not races:
                raise ValueError("2024 Senate API replay did not match expected schema")
            result.update(status="reachable",note="Historical API contract responds; 2026 Michigan coverage unconfirmed")
        elif body:
            result.update(status="reachable",note="Portal responds; precinct feed and actual returns unverified")
        else:
            result.update(status="indeterminate",note="HTTP 200 but no readable response body")
        if entry["kind"] in ("gis","replay","current"):
            if cors not in ("*", "https://geervin.github.io"):
                result.update(status="indeterminate",note="Server responds, but browser CORS permission was not confirmed")
            else:
                result["note"] += " · browser CORS allowed"
    except urllib.error.HTTPError as e:
        if e.code in (401,403,429):
            result.update(status="indeterminate",note=f"HTTP {e.code} to automated probe; browser access may still work")
        else: result["note"]=f"HTTP {e.code}"
    except (urllib.error.URLError, TimeoutError, socket.timeout) as e:
        result["note"]="Network connection/timeout: "+str(getattr(e,"reason",e))[:95]
    except (ValueError, json.JSONDecodeError) as e:
        result.update(status="indeterminate",note=str(e)[:130])
    except Exception as e:
        result.update(status="indeterminate",note=type(e).__name__+": "+str(e)[:90])
    return result

def main():
    geometry=json.loads((ROOT/"michigan"/"counties.geojson").read_text())
    features=geometry.get("features",[])
    county_ok=(geometry.get("type")=="FeatureCollection" and len(features)==83
               and len({f.get("properties",{}).get("name") for f in features})==83)
    report={"checkedAt":datetime.now(timezone.utc).isoformat(),"purpose":"Public connectivity only; no automatic county return ingestion",
            "localCounties":{"status":"ready" if county_ok else "unavailable","count":len(features)},
            "precinctIngestion":"reviewed_county_csv_required",
            "sources":{key:inspect(key,item) for key,item in URLS.items()}}
    OUT.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("Michigan source preflight:",", ".join(f"{k}={v['status']}" for k,v in report["sources"].items()))
    if not county_ok: raise SystemExit("Local 83-county map integrity FAILED")

if __name__=="__main__":main()
