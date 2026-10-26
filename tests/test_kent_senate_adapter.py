"""Synthetic 2026 Kent election portal fixtures: never publish pre-close/test votes."""
import importlib.util
import unittest
from datetime import datetime,timezone
from pathlib import Path
FILE=Path(__file__).resolve().parents[1]/"scripts"/"poll_kent_senate.py"
spec=importlib.util.spec_from_file_location("kent",FILE)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
AFTER=datetime(2026,11,4,4,0,tzinfo=timezone.utc)
def page(date="Tuesday, November 3, 2026 at 8:25:45 PM",reported="18/202",dem="12,345",rep="11,987"):
    return f"""<h1>Kent County</h1><h2>November 3, 2026 General Election</h2>
<p>UNOFFICIAL RESULTS</p><div>Last Updated {date}</div>
<h2>United States Senator</h2><p>Vote for 1</p>
<div>Vote Method Follow</div><p>Candidate</p><p>Percentage</p><p>Votes</p>
<div>Abdul El-Sayed</div><div>Democrat</div><div>{dem}</div>
<div>Mike Rogers</div><div>Republican</div><div>{rep}</div>
<div>Lydia Christensen</div><div>Libertarian</div><div>92</div>
<div>Tim Long</div><div>U.S. Taxpayers</div><div>34</div>
<div>Douglas P. Marsh</div><div>Green</div><div>76</div>
<div>Walter P. Kristy</div><div>Natural Law</div><div>21</div>
<div>Precincts reporting {reported} As of 1 minute ago</div>
<h2>Representative in Congress 2nd District</h2>
"""
class KentAdapterTests(unittest.TestCase):
    def test_valid_general_election_report(self):
        rec,count,total=m.parse_report(page(),AFTER)
        self.assertEqual((rec["dem"],rec["rep"],rec["other"]),(12345,11987,223))
        self.assertEqual(rec["reportingStatus"],"partial")
        self.assertEqual((count,total),(18,202))
    def test_complete_explicit_count(self):
        rec,*_=m.parse_report(page(reported="202/202"),AFTER)
        self.assertEqual(rec["reportingStatus"],"complete")
    def test_reject_prepoll_test_or_zero(self):
        with self.assertRaises(ValueError):m.parse_report(page(date="Tuesday, October 13, 2026 at 2:10:47 PM"),AFTER)
        with self.assertRaises(ValueError):m.parse_report(page(reported="0/202"),AFTER)
        with self.assertRaises(ValueError):m.parse_report(page(dem="0",rep="0"),AFTER)
    def test_wrong_contest_and_missing_candidacy(self):
        with self.assertRaises(ValueError):m.parse_report(page().replace("United States Senator","Governor"),AFTER)
        with self.assertRaises(ValueError):m.parse_report(page().replace("Mike Rogers","Somebody Else"),AFTER)
        with self.assertRaises(ValueError):m.parse_report(page().replace("Mike Rogers</div><div>Republican","Mike Rogers</div><div>Democrat"),AFTER)
    def test_future_clock_rejected(self):
        with self.assertRaises(ValueError):m.parse_report(page(),datetime(2026,11,3,20,0,tzinfo=timezone.utc))
if __name__=="__main__":unittest.main()
