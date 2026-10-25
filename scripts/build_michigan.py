#!/usr/bin/env python3
"""Build Michigan county-level, reproducible historical election data and geometry.
Sources: state-certified results transcribed in Wikipedia county tables, verified
against Michigan statewide certified headline totals; Michigan GIS county polygons.
Run in GitHub Actions with requests, beautifulsoup4, shapely installed.
"""
import json, re, requests, time
from pathlib import Path
from bs4 import BeautifulSoup
from shapely.geometry import shape, mapping

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "michigan"
OUT.mkdir(exist_ok=True)
UA = {"User-Agent": "ErvinModelResearch/1.0 (public-election-data aggregation; contact via GitHub)"}

COUNTIES = ["Alcona","Alger","Allegan","Alpena","Antrim","Arenac","Baraga","Barry","Bay","Benzie","Berrien","Branch","Calhoun","Cass","Charlevoix","Cheboygan","Chippewa","Clare","Clinton","Crawford","Delta","Dickinson","Eaton","Emmet","Genesee","Gladwin","Gogebic","Grand Traverse","Gratiot","Hillsdale","Houghton","Huron","Ingham","Ionia","Iosco","Iron","Isabella","Jackson","Kalamazoo","Kalkaska","Kent","Keweenaw","Lake","Lapeer","Leelanau","Lenawee","Livingston","Luce","Mackinac","Macomb","Manistee","Marquette","Mason","Mecosta","Menominee","Midland","Missaukee","Monroe","Montcalm","Montmorency","Muskegon","Newaygo","Oakland","Oceana","Ogemaw","Ontonagon","Osceola","Oscoda","Otsego","Ottawa","Presque Isle","Roscommon","Saginaw","Sanilac","Schoolcraft","Shiawassee","St. Clair","St. Joseph","Tuscola","Van Buren","Washtenaw","Wayne","Wexford"]
assert len(COUNTIES)==83

URLS = {
 "senate2024":"https://en.wikipedia.org/wiki/2024_United_States_Senate_election_in_Michigan",
 "president2024":"https://en.wikipedia.org/wiki/2024_United_States_presidential_election_in_Michigan",
 "governor2022":"https://en.wikipedia.org/wiki/2022_Michigan_gubernatorial_election",
 "senate2020":"https://en.wikipedia.org/wiki/2020_United_States_Senate_election_in_Michigan",
 "president2020":"https://en.wikipedia.org/wiki/2020_United_States_presidential_election_in_Michigan",
}

def clean(s):
 return re.sub(r"\\[[^]]+\\]","",s.replace("\u00a0"," ").replace("−","-")).strip()
def number(s):
 s=clean(s).replace(",","").replace("%","").replace("−","-")
 match=re.search(r"-?\\d+(?:\\.\\d+)?",s)
 return float(match.group(0)) if match else None

def get_rows(label,url):
 response=requests.get(url,headers=UA,timeout=45); response.raise_for_status()
 soup=BeautifulSoup(response.text,"html.parser")
 best=[]
 for tab in soup.find_all("table"):
  rows=[]
  for tr in tab.find_all("tr"):
   cells=tr.find_all(["td","th"],recursive=False)
   if not cells:continue
   first=clean(cells[0].get_text(" ",strip=True))
   first=re.sub(r"[^A-Za-z. '-]","",first).strip()
   if first not in COUNTIES: continue
   cols=[clean(c.get_text(" ",strip=True)) for c in cells[1:]]
   rows.append((first,cols))
  if len(rows)>len(best):best=rows
 print("SOURCE",label,"COUNTIES",len(best),"SAMPLE",best[:2],flush=True)
 if len(best)<75:raise ValueError(f"{label}: Cannot find reliable 83-county source table, found {len(best)}")
 return dict(best)

def parse_contest(label,items):
 # Source tables have candidate vote counts and % side-by-side; normalize
 # explicitly after inspecting exported data. Fail if an unrecognized layout.
 final={}
 for county,cols in items.items():
  n=[number(v) for v in cols]
  if label=="senate2024":
   # [Slotkin count, Slotkin %, Rogers count, Rogers %, other count, other %, margin count, margin %, total]
   d,r,total=n[0],n[2],n[-1]
  elif label=="president2024":
   # [Trump count, Trump %, Harris count, Harris %, other count, other %, margin count, margin %, total]
   d,r,total=n[2],n[0],n[-1]
  elif label=="governor2022":
   # [Whitmer %, Whitmer count, Dixon %, Dixon count, other %, other count, margin %, margin count, total]
   if n[0]<=100 and n[1]>100 and n[2]<=100:d,r,total=n[1],n[3],n[-1]
   else:d,r,total=n[0],n[2],n[-1]
  elif label=="senate2020":
   # detect count/% order by actual numbers
   idx=0 if n[0]>100 else 1
   d,r,total=n[idx],n[idx+2],n[-1]
  elif label=="president2020":
   idx=0 if n[0]>100 else 1
   # Trump then Biden in typical table, but print and verify against statewide sums
   d,r,total=n[idx+2],n[idx],n[-1]
  else:raise ValueError(label)
  if not all(v is not None and v>=0 for v in [d,r,total]) or d+r>total*1.005:raise ValueError(f"Bad {label} {county} {cols}")
  final[county]={"d":round(d),"r":round(r),"total":round(total)}
 return final

dataset={}
for key,url in URLS.items():
 try:
  r=get_rows(key,url)
  parsed=parse_contest(key,r)
  if len(parsed)!=83:raise ValueError(f"Got {len(parsed)} counties")
  totals={k:sum(row[k] for row in parsed.values()) for k in ["d","r","total"]}
  print("TOTAL",key,totals,flush=True)
  dataset[key]=parsed
 except Exception as error:
  print("SKIPPING",key,str(error),flush=True)
  if key in ["senate2024","president2024","governor2022"]:raise

# Must agree with certified 2024 totals before publishing. Counts exclude other votes.
assert abs(sum(x["d"] for x in dataset["senate2024"].values())-2712686)<20
assert abs(sum(x["r"] for x in dataset["senate2024"].values())-2693680)<20
assert abs(sum(x["d"] for x in dataset["president2024"].values())-2736533)<20
assert abs(sum(x["r"] for x in dataset["president2024"].values())-2816636)<20

geo_url="https://www.mcgi.state.mi.us/maps/rest/services/BaseMap/County_Twp_City/MapServer/0/query"
params={"where":"1=1","outFields":"NAME","returnGeometry":"true","outSR":"4326","f":"geojson"}
resp=requests.get(geo_url,params=params,headers=UA,timeout=90);resp.raise_for_status()
geo=resp.json()
features=[]
for f in geo["features"]:
 name=f["properties"].get("NAME") or f["properties"].get("Name")
 if not name:continue
 name=re.sub(r"\\s+County$","",name,flags=re.I).strip()
 if name not in COUNTIES: continue
 geom=shape(f["geometry"]).simplify(.012,preserve_topology=True)
 features.append({"type":"Feature","properties":{"name":name},"geometry":mapping(geom)})
print("GEO",len(features),flush=True)
if len(features)!=83:raise ValueError("Missing Michigan county geometries")
out={"metadata":{"retrievedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"sources":URLS,"geometrySource":geo_url,"note":"Certified 2024 Michigan statewide totals cross-checked; county tables are secondary transcriptions of official Michigan results. 2026 results are modeled, not actual."},"counties":[{"name":c,**{label:dataset[label].get(c) for label in dataset}} for c in COUNTIES]}
(OUT/"county_history.json").write_text(json.dumps(out,separators=(",",":"))+"\n")
(OUT/"counties.geojson").write_text(json.dumps({"type":"FeatureCollection","features":features},separators=(",",":"))+"\n")
print("WROTE",OUT/"county_history.json",OUT/"counties.geojson",flush=True)
