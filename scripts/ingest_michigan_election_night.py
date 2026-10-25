#!/usr/bin/env python3
"""Import *attributed* Michigan 2026 Senate precinct CSV reports into a stable JSON feed.

Nothing is scraped or inferred. Each CSV is reviewed before committing it to
michigan/election-night/imports/<county>.csv. This importer rejects missing,
duplicate, malformed, undated or pre-close precinct votes, and will not invent
reporting percentages when precinct denominator data is missing.
"""
from __future__ import annotations
import csv, json, re, sys
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
NIGHT = ROOT / "michigan" / "election-night"
CSV_DIR = NIGHT / "imports"
OUTPUT = NIGHT / "results.json"
ELECTION_DAY = "2026-11-03"
CUTOFF = datetime(2026, 11, 3, 20, 0, tzinfo=ZoneInfo("America/Detroit")).astimezone(timezone.utc)
CENTRAL_COUNTIES = frozenset({"Dickinson", "Gogebic", "Iron", "Menominee"})
CENTRAL_CUTOFF = datetime(2026, 11, 3, 20, 0, tzinfo=ZoneInfo("America/Chicago")).astimezone(timezone.utc)
REQUIRED = {"county", "precinct", "dem", "rep", "other", "as_of", "source_url"}
COUNTIES = {
    c["name"].casefold(): c["name"]
    for c in json.loads((ROOT / "michigan" / "county_history.json").read_text())["counties"]
}
assert len(COUNTIES) == 83

def value(v, field, file, line):
    if v is None or not re.fullmatch(r"\d+", str(v).strip()):
        raise ValueError(f"{file}:{line}: {field} must be a nonnegative whole vote count")
    n = int(v)
    if n > 10_000_000:
        raise ValueError(f"{file}:{line}: absurdly large vote count")
    return n

def parse_time(v, file, line, county=None):
    try:
        t = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        raise ValueError(f"{file}:{line}: as_of must be ISO 8601 with offset") from None
    if t.tzinfo is None:
        raise ValueError(f"{file}:{line}: as_of must include timezone")
    utc = t.astimezone(timezone.utc)
    close = CENTRAL_CUTOFF if county in CENTRAL_COUNTIES else CUTOFF
    if utc < close:
        raise ValueError(f"{file}:{line}: vote counts for {county or 'Michigan'} cannot predate the county's 8pm local poll closing")
    if utc > datetime.now(timezone.utc):
        raise ValueError(f"{file}:{line}: timestamp is in the future")
    return utc.isoformat().replace("+00:00", "Z")

def build():
    entries, seen, sources = [], set(), set()
    files = sorted(CSV_DIR.glob("*.csv"))
    for file in files:
        with file.open(newline="", encoding="utf-8-sig") as stream:
            reader = csv.DictReader(stream)
            if not REQUIRED.issubset(reader.fieldnames or []):
                raise ValueError(f"{file}: required columns: {sorted(REQUIRED)}")
            for line, row in enumerate(reader, 2):
                county = COUNTIES.get(str(row["county"] or "").strip().casefold())
                if not county:
                    raise ValueError(f"{file}:{line}: unknown Michigan county {row['county']!r}")
                precinct = str(row["precinct"] or "").strip()
                if not precinct or len(precinct) > 180:
                    raise ValueError(f"{file}:{line}: invalid precinct/counting unit")
                key = (county.casefold(), precinct.casefold())
                if key in seen:
                    raise ValueError(f"{file}:{line}: duplicated precinct/counting unit {key}")
                seen.add(key)
                url = str(row["source_url"] or "").strip()
                uri = urlparse(url)
                if uri.scheme != "https" or not uri.netloc or uri.username or uri.password:
                    raise ValueError(f"{file}:{line}: official source URL must be an HTTPS page")
                dem, rep, other = (value(row[x], x, file, line) for x in ("dem","rep","other"))
                if dem + rep + other == 0:
                    raise ValueError(f"{file}:{line}: zero-vote rows are unreported, not returns")
                as_of = parse_time(row["as_of"], file, line, county)
                sources.add(url)
                entries.append({"county": county, "precinct": precinct, "dem": dem, "rep": rep,
                                "other": other, "asOf": as_of, "sourceUrl": url})
    if not entries:
        print("No reviewed precinct CSV files supplied; preserving existing election-night feed.")
        return 0
    entries.sort(key=lambda p: (p["county"], p["precinct"]))
    result = {"version":1,"election":ELECTION_DAY,"office":"US Senate",
              "status":"unofficial_partial_precinct_reports",
              "updatedAt":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
              "precincts":entries,"sourceCount":len(sources),
              "sourcePolicy":"County clerk precinct/absentee unit vote reports; source URL and timestamp required."}
    OUTPUT.write_text(json.dumps(result,indent=2)+"\n")
    print(f"PASS: {len(entries)} unique precinct/counting-board rows across {len(set(p['county'] for p in entries))} counties, {len(sources)} source reports")
    return 0

if __name__ == "__main__":
    try: sys.exit(build())
    except (ValueError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr);sys.exit(1)
