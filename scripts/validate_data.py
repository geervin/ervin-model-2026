"""Validate the snapshot and its historical election audit before Pages deployment."""
from pathlib import Path
import csv
import json

site = Path(__file__).resolve().parent.parent
html = (site / "index.html").read_text(encoding="utf-8")
prefix = "window.ERVIN_DATA = "
start = html.index(prefix) + len(prefix)
end = html.index(";\n\n</script><script>", start)
model = json.loads(html[start:end])
states = model["states"]
assert len(states) == 17, f"Expected 17 races, found {len(states)}"
total = 0
for race in states:
    history = race["historical"]
    assert len(history) >= 3, f"{race['code']}: only {len(history)} comparisons"
    for observation in history:
        assert 2018 <= observation["year"] <= 2024, (race["code"], observation)
        assert observation["office"] in ("Senate", "President")
        assert abs(observation["poll"] - observation["actual"] - observation["err"]) < 0.011
        assert 0 < observation["weight"] <= 1
        assert observation["url"].startswith("https://")
        assert observation["kind"], (race["code"], observation)
    assert len(race["sources"]) == 5, race["code"]
    if race["party"] == "I":
        assert race.get("history_mode") in ("not_comparable", "candidate_repeat"), (
            race["code"], "Independent matchups should not import D/R error shifts"
        )
    if race.get("history_mode") == "candidate_repeat":
        assert any(x["office"] == "Senate" for x in history)
        assert race["code"] in ("NE", "SD")
    total += len(history)
with (site / "historical_error_audit.csv").open(encoding="utf-8", newline="") as file:
    audit = list(csv.DictReader(file))
assert len(audit) == total, (len(audit), total)
with (site / "source_snapshot.csv").open(encoding="utf-8", newline="") as file:
    sources = list(csv.DictReader(file))
assert len(sources) == len(states) * 5
print(f"PASS: {len(states)} races, {total} historical election comparisons, {len(sources)} polling-source records")
