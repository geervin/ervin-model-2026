"""Conservative recent individual-poll extraction from 2026 Senate race tables.

Only the exact candidate pairing in the site's published race config is accepted.
Survey rows are informational context; aggregators are used in the model.
"""
import datetime as dt
import re
from bs4 import BeautifulSoup

MONTHS={m.lower():i for i,m in enumerate(
 ["January","February","March","April","May","June",
  "July","August","September","October","November","December"],1)}
MONTH_RX=re.compile(r"\b("+"|".join(MONTHS)+r")\b",re.I)
def norm(s):
 return re.sub(r"[^a-z0-9]+"," ",s.lower()).strip()
def clean(s):
 return re.sub(r"\s+"," ",re.sub(r"\[[^\]]{1,18}\]","",s.replace("−","-"))).strip()
def percent(s):
 m=re.search(r"(?<!\d)(\d{1,2}(?:\.\d+)?)\s*%",s)
 return float(m.group(1)) if m else None
def extract_end_date(s):
 if "2026" not in s:return None
 months=list(MONTH_RX.finditer(s))
 if not months:return None
 last=months[-1]
 earlier=s[last.end():s.find("2026")]
 days=re.findall(r"\b([0-3]?\d)\b",earlier)
 if not days:return None
 try:return dt.date(2026,MONTHS[last.group(1).lower()],int(days[-1]))
 except ValueError:return None
def parse_recent_polls(html,race,today=None):
 today=today or dt.datetime.now(dt.timezone.utc).date()
 soup=BeautifulSoup(html,"html.parser")
 dem=norm(race["dem"].split()[-1])
 rep=norm(race["rep"].split()[-1])
 records=[];seen=set()
 for table in soup.find_all("table"):
  if "wikitable" not in table.get("class",[]):continue
  rows=table.find_all("tr")
  header=None
  for j,row in enumerate(rows[:4]):
   cells=[clean(c.get_text(" ",strip=True)) for c in row.find_all(["th","td"],recursive=False)]
   if not cells or "poll source" not in norm(cells[0]):continue
   ns=[norm(c) for c in cells]
   if "sample" not in " ".join(ns):continue
   di=next((i for i,c in enumerate(ns) if dem in c.split()),None)
   ri=next((i for i,c in enumerate(ns) if rep in c.split()),None)
   ti=next((i for i,c in enumerate(ns) if "administered" in c or c.startswith("dates")),None)
   si=next((i for i,c in enumerate(ns) if "sample" in c),None)
   if None not in (di,ri,ti,si) and di!=ri:header=(j,len(cells),di,ri,ti,si);break
  if not header:continue
  start,ncols,di,ri,ti,si=header
  for row in rows[start+1:]:
   cells=[clean(c.get_text(" ",strip=True)) for c in row.find_all(["th","td"],recursive=False)]
   if len(cells)!=ncols:continue
   pollster=cells[0];end=extract_end_date(cells[ti]);sample=cells[si]
   if not end or end>today or (today-end).days>90:continue
   if not re.search(r"\b\d{2,6}\b",sample):continue
   if not pollster or len(pollster)>95 or norm(pollster) in {"poll source","average"}:continue
   a,b=percent(cells[di]),percent(cells[ri])
   if a is None or b is None or not 5<=a<=90 or not 5<=b<=90 or a+b>102:continue
   key=(norm(pollster),end,a,b)
   if key in seen:continue
   seen.add(key)
   records.append({"pollster":pollster,"dates":cells[ti],"fieldEnd":end.isoformat(),
                   "sample":sample,"dem":a,"rep":b,"margin":round(a-b,1)})
 return sorted(records,key=lambda r:r["fieldEnd"],reverse=True)[:12]
