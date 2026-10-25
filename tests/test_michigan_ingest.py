"""Regression tests for Michigan election-night timestamps and source guards."""
import unittest
from datetime import datetime, timezone
from pathlib import Path
import importlib.util

FILE=Path(__file__).resolve().parents[1]/"scripts"/"ingest_michigan_election_night.py"
spec=importlib.util.spec_from_file_location("mi_ingest",FILE)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class MichiganResultsSafetyTests(unittest.TestCase):
    def test_expected_counties_present(self):
        self.assertEqual(len(m.COUNTIES),83)
        self.assertEqual(m.CENTRAL_COUNTIES,{"Dickinson","Gogebic","Iron","Menominee"})
    def test_eastern_closes_at_8pm_local(self):
        self.assertEqual(m.CUTOFF.isoformat(),"2026-11-04T01:00:00+00:00")
    def test_central_closes_an_hour_later(self):
        self.assertEqual(m.CENTRAL_CUTOFF.isoformat(),"2026-11-04T02:00:00+00:00")
    def test_eastern_preclose_rejected(self):
        with self.assertRaisesRegex(ValueError,"local poll closing"):
            m.parse_time("2026-11-04T00:59:00Z","test",1,"Oakland")
    def test_central_preclose_rejected(self):
        with self.assertRaisesRegex(ValueError,"local poll closing"):
            m.parse_time("2026-11-04T01:30:00Z","test",1,"Gogebic")
    def test_naive_time_rejected(self):
        with self.assertRaisesRegex(ValueError,"timezone"):
            m.parse_time("2026-11-03T20:10:00","test",1,"Oakland")
    def test_invalid_votes_rejected(self):
        for bad in ("-1","1.2","NaN",""):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    m.value(bad,"dem","test",1)

if __name__=="__main__": unittest.main()
