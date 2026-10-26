#!/usr/bin/env python3
"""Publish reviewed Michigan US Senate county-wide returns, independently of precinct rows.

A county report replaces (never adds to) precinct subtotals for its county. No
scraping, projections, early results, or unsigned / unattributed numbers.
"""
from __future__ import annotations
import csv, json, re, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
NIGHT=ROOT/"michigan"/"election-night"
IMPORTS=NIGHT/"county-imports"
OUT=NIGHT/"county_totals.json"
COUNTIES={c["name"].casefold():c["name"] for c in json.loads((ROOT/"michigan"/"county_history.json").read_text())["counties"]}
CENTRAL={"Dickinson","Gogebic","Iron","Menominee"}
FIELDS={"county","dem","rep","other","as_of","source_url","reporting_status"}
CLOSE_E=datetime(2026,11,3,20,0,tzinfo=ZoneInfo("America/Detroit")).astimezone(timezone.utc)
CLOSE_C=datetime(2026,11,3,20,0,tzinfo=ZoneInfo("America/Chicago")).astimezone(timezone.utc)

def parse_row(row, source, line, now=None):
    county=COUNTIES.get(str(row.get("county") or "").strip().casefold())
    if not county:raise ValueError(f"{source}:{line}: unknown Michigan county")
    nums=[]
    for k in ("dem","rep","other"):
        raw=str(row.get(k) if row.get(k) is not None else "").strip()
        if not re.fullmatch(r"\d+",raw):raise ValueError(f"{source}:{line}: invalid {k} vote count")
        val=int(raw)
        if val>2_000_000:raise ValueError(f"{source}:{line}: implausible {k} county total")
        nums.append(val)
    if not sum(nums):raise ValueError(f"{source}:{line}: zero votes is not a reported county tally")
    url=str(row.get("source_url") or "").strip()
    parsed=urlparse(url)
    if parsed.scheme!="https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError(f"{source}:{line}: HTTPS county report attribution required")
    try:date=datetime.fromisoformat(str(row.get("as_of") or "").replace("Z","+00:00"))
    except ValueError:raise ValueError(f"{source}:{line}: invalid source as_of timestamp") from None
    if date.tzinfo is None:raise ValueError(f"{source}:{line}: source as_of needs timezone")
    utc=date.astimezone(timezone.utc)
    if utc<(CLOSE_C if county in CENTRAL else CLOSE_E):
        raise ValueError(f"{source}:{line}: before 8pm local county closing")
    if utc>(now or datetime.now(timezone.utc)):
        raise ValueError(f"{source}:{line}: future source publication time")
    status=str(row.get("reporting_status") or "").strip().lower()
    if status not in ("partial","complete"):
        raise ValueError(f"{source}:{line}: reporting_status must be partial or complete")
    return {"county":county,"dem":nums[0],"rep":nums[1],"other":nums[2],
            "asOf":utc.isoformat().replace("+00:00","Z"),"sourceUrl":url,
            "reportingStatus":status,"sourceType":"county_clerk"}

def guard_new_snapshot(new, old):
    before={r["county"]:r for r in old}
    incoming={r["county"]:r for r in new}
    missing=before.keys()-incoming.keys()
    if missing:raise ValueError("Previously verified county results would disappear: "+", ".join(sorted(missing)))
    for key, prior in before.items():
        r=incoming[key]
        if r["asOf"]<prior["asOf"]:raise ValueError("Older county report timestamp: "+key)
    return True

def build(now=None):
    entries,seen=[],set()
    for file in sorted(IMPORTS.glob("*.csv")):
        with file.open(newline="",encoding="utf-8-sig") as stream:
            reader=csv.DictReader(stream)
            if not FIELDS.issubset(set(reader.fieldnames or [])):
                raise ValueError(f"{file}: required columns are {sorted(FIELDS)}")
            for line, row in enumerate(reader,2):
                record=parse_row(row,file.name,line,now)
                if record["county"] in seen:raise ValueError(f"{file}:{line}: duplicate county across imports")
                seen.add(record["county"]);entries.append(record)
    if not entries:
        print("No verified county-wide reports supplied; preserve existing feed.")
        return 0
    old=json.loads(OUT.read_text()) if OUT.exists() else {}
    guard_new_snapshot(entries,old.get("counties",[]))
    entries.sort(key=lambda r:r["county"])
    snapshot={"version":1,"election":"2026-11-03","office":"US Senate",
              "status":"unofficial_county_clerk_returns",
              "updatedAt":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
              "counties":entries,
              "sourcePolicy":"Verified county-wide reports only. If also receiving precinct rows, count the county-wide tally INSTEAD of its precinct subtotal, never in addition."}
    OUT.write_text(json.dumps(snapshot,indent=2)+"\n")
    print(f"PASS: {len(entries)} attributed Michigan Senate county-wide reports")
    return 0

if __name__=="__main__":
    try:sys.exit(build())
    except (ValueError,OSError) as err:print("ERROR:",err,file=sys.stderr);sys.exit(1)
