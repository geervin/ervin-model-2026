"""Offline regression tests for the public 83-county source monitor."""
import importlib.util
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location("mi_clerk_watch",ROOT/"scripts"/"watch_michigan_clerks.py")
watch=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(watch)

BASE="https://county.example.gov/elections/results"
HTML_2026='''<!doctype html><main>
<h1>November 3, 2026 General Election</h1>
<a href="/elections/2024/results">2024 Election Results</a>
<a href="/elections/2026/november/statement-of-votes-cast.pdf">2026 Statement of Votes Cast</a>
<a href="javascript:alert(1)">2026 Results</a>
</main>'''

class ClerkSourceTests(unittest.TestCase):
    def test_registry_covers_83_actual_counties(self):
        county_names={x["name"] for x in json.loads((ROOT/"michigan"/"county_history.json").read_text())["counties"]}
        sources=json.loads(watch.REGISTRY.read_text())["counties"]
        self.assertEqual(set(sources),county_names)
        self.assertEqual(len(sources),83)
        for url in sources.values():
            self.assertTrue(watch.canonical(url).startswith("https://"))
    def test_only_same_election_report_links(self):
        links,_=watch.report_links(BASE,HTML_2026)
        self.assertEqual(len(links),1)
        self.assertTrue(links[0]["url"].endswith("statement-of-votes-cast.pdf"))
    def test_rejects_primary_results_and_unrelated_2026_links(self):
        html='''<h2>2026 Elections</h2>
        <a href="/2026/08/04/results">August 2026 Primary Election Results</a>
        <a href="/2026/05/05/results">May 2026 Special Election Results</a>
        <a href="https://www.facebook.com/">Election Results</a>
        <a href="/2024/11/05/results">November 2024 Results</a>'''
        links,_=watch.report_links(BASE,html)
        self.assertEqual(links,[])

    def test_november_heading_provides_attribution(self):
        html='''<h3>November 3, 2026 - General Election</h3>
        <a href="/public/statement.pdf">Unofficial Statement of Votes Cast</a>
        <h3>August 4, 2026 - Primary Election</h3>
        <a href="/primary/results.pdf">Official Election Results</a>'''
        links,_=watch.report_links(BASE,html)
        self.assertEqual(len(links),1)
        self.assertTrue(links[0]["url"].endswith("statement.pdf"))

    def test_first_check_sets_baseline_without_false_change(self):
        got=watch.inspect_county("Oakland",BASE,fetch=lambda _:HTML_2026)
        self.assertEqual(got["status"],"reachable")
        self.assertFalse(got["changed"])
        self.assertEqual(got["newLinks"],[])
        self.assertEqual(len(got["reportLinks"]),1)
    def test_new_report_link_is_not_a_vote(self):
        first=watch.inspect_county("Oakland",BASE,fetch=lambda _:HTML_2026)
        second=watch.inspect_county("Oakland",BASE,prior=first,fetch=lambda _:HTML_2026.replace("</main>",'<a href="/2026/november/results-general-election.csv">2026 Results Report</a></main>'))
        self.assertEqual(second["changeKind"],"new_result_links")
        self.assertEqual(len(second["newLinks"]),1)
        self.assertNotIn("votes",second)
    def test_direct_portal_change_is_only_page_change(self):
        first=watch.inspect_county("Kent",BASE,fetch=lambda _:"<html>Previous</html>")
        second=watch.inspect_county("Kent",BASE,prior=first,fetch=lambda _:"<html>Updated</html>")
        self.assertTrue(second["changed"])
        self.assertEqual(second["changeKind"],"page_modified")
    def test_outage_retains_last_known_links(self):
        first=watch.inspect_county("Oakland",BASE,fetch=lambda _:HTML_2026)
        result=watch.inspect_county("Oakland",BASE,prior=first,fetch=lambda _: (_ for _ in ()).throw(TimeoutError("no response")))
        self.assertEqual(result["reportLinks"],first["reportLinks"])
        self.assertFalse(result["changed"])
    def test_guard_unsafe_urls(self):
        for url in ["file:///etc/passwd","http://localhost/","https://127.0.0.1/","https://valid.example:444/"]:
            with self.subTest(url=url):
                with self.assertRaises(ValueError):
                    watch.canonical(url)

if __name__=="__main__": unittest.main()
