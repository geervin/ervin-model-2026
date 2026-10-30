import datetime as dt
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from recent_poll_parser import parse_recent_polls,extract_end_date

RACE={"dem":"Abdul El-Sayed","rep":"Mike Rogers"}
HTML="""<html>
<table class="wikitable">
<tr><th>Poll source</th><th>Date(s) administered</th><th>Sample size</th>
<th>Abdul El-Sayed (D)</th><th>Haley Stevens (D)</th></tr>
<tr><td>Primary poll</td><td>October 29, 2026</td><td>900 (LV)</td><td>52%</td><td>45%</td></tr>
</table>
<table class="wikitable">
<tr><th>Poll source</th><th>Date(s) administered</th><th>Sample size</th>
<th>Margin of error</th><th>Abdul El-Sayed (D)</th><th>Mike Rogers (R)</th><th>Undecided</th></tr>
<tr><td>Mitchell Research</td><td>October 26–27, 2026</td><td>636 (LV)</td><td>±3.9%</td><td>51%</td><td>44%</td><td>5%</td></tr>
<tr><td>SSRS</td><td>October 20–27, 2026</td><td>768 (LV)</td><td>±4.7%</td><td>49%</td><td>42%</td><td>9%</td></tr>
<tr><td>Future Survey</td><td>November 4, 2026</td><td>600 (LV)</td><td>±3.0%</td><td>50%</td><td>46%</td><td>4%</td></tr>
<tr><td>Bad Survey</td><td>October 25, 2026</td><td>600 (LV)</td><td>±3.0%</td><td>99%</td><td>99%</td><td>0%</td></tr>
<tr><td>Undated</td><td>recently</td><td>700 (LV)</td><td>±3%</td><td>45%</td><td>42%</td><td>13%</td></tr>
</table>
</html>"""

class RecentPollParserTest(unittest.TestCase):
 def test_general_election_matched_and_future_rejected(self):
  rows=parse_recent_polls(HTML,RACE,dt.date(2026,10,30))
  self.assertEqual(len(rows),2)
  self.assertEqual({x["pollster"] for x in rows},{"SSRS","Mitchell Research"})
  self.assertTrue(all(x["margin"]==7 for x in rows))
  self.assertTrue(all(x["fieldEnd"]=="2026-10-27" for x in rows))
 def test_date_ranges(self):
  self.assertEqual(extract_end_date("September 22 – October 4, 2026"),dt.date(2026,10,4))
  self.assertEqual(extract_end_date("October 26–27, 2026"),dt.date(2026,10,27))
 def test_never_accept_wrong_matchup(self):
  other={"dem":"Graham Platner","rep":"Susan Collins"}
  self.assertEqual(parse_recent_polls(HTML,other,dt.date(2026,10,30)),[])
 def test_reject_stale(self):
  self.assertEqual(parse_recent_polls(HTML,RACE,dt.date(2027,3,1)),[])

if __name__=="__main__":unittest.main()
