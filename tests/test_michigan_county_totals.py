"""Safety tests for manual verified county-wide Michigan Senate reports."""
import importlib.util
import unittest
from datetime import datetime,timezone
from pathlib import Path

FILE=Path(__file__).resolve().parents[1]/"scripts"/"ingest_michigan_county_totals.py"
spec=importlib.util.spec_from_file_location("county_import",FILE)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
VALID={"county":"Oakland","dem":"1234","rep":"1122","other":"27",
       "as_of":"2026-11-04T01:25:00Z","source_url":"https://www.oakgov.com/elections/2026-results",
       "reporting_status":"partial"}
AFTER=datetime(2026,11,4,3,0,tzinfo=timezone.utc)

class CountyTotalsTests(unittest.TestCase):
    def test_83_county_registry(self):
        self.assertEqual(len(m.COUNTIES),83)
        self.assertIn("oakland",m.COUNTIES)
    def test_accept_attributed_postclose(self):
        row=m.parse_row(VALID,"test",1,AFTER)
        self.assertEqual(row["dem"],1234)
        self.assertEqual(row["county"],"Oakland")
        self.assertEqual(row["sourceType"],"county_clerk")
    def test_eastern_before_close_rejected(self):
        with self.assertRaisesRegex(ValueError,"before 8pm"):
            m.parse_row({**VALID,"as_of":"2026-11-04T00:59:59Z"},"test",1,AFTER)
    def test_central_before_close_rejected(self):
        with self.assertRaisesRegex(ValueError,"before 8pm"):
            m.parse_row({**VALID,"county":"Iron","as_of":"2026-11-04T01:50:00Z"},"test",1,AFTER)
    def test_bad_counts_status_and_http_source(self):
        for field,val in [("dem","-1"),("rep","2.5"),("reporting_status","maybe"),("source_url","http://example.com")]:
            with self.subTest(field=field):
                with self.assertRaises(ValueError):m.parse_row({**VALID,field:val},"test",1,AFTER)
    def test_future_timestamp_rejected(self):
        with self.assertRaisesRegex(ValueError,"future"):
            m.parse_row({**VALID,"as_of":"2026-11-06T00:00:00Z"},"test",1,AFTER)
    def test_old_snapshot_cannot_drop_county_or_roll_back(self):
        prior=m.parse_row(VALID,"test",1,AFTER)
        with self.assertRaisesRegex(ValueError,"disappear"):m.guard_new_snapshot([], [prior])
        earlier={**prior,"asOf":"2026-11-04T01:24:00Z"}
        with self.assertRaisesRegex(ValueError,"Older"):m.guard_new_snapshot([earlier],[prior])
    def test_changed_vote_counts_without_older_timestamp_allowed(self):
        prior=m.parse_row(VALID,"test",1,AFTER)
        replacement={**prior,"dem":1235,"asOf":"2026-11-04T01:26:00Z"}
        self.assertTrue(m.guard_new_snapshot([replacement],[prior]))

if __name__=="__main__":unittest.main()
