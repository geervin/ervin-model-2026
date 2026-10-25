(async function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Math.round(n).toLocaleString("en-US");
const dateString=s=>{if(!s)return "Unknown";const d=new Date(s);return Number.isNaN(+d)?"Unknown":d.toLocaleString("en-US",{timeZone:"America/Detroit",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"})};
const liveStart=new Date("2026-11-03T20:00:00-05:00").getTime();
const demo=new URLSearchParams(location.search).get("demo")==="1";
const eDate="2026-11-03";
let lastFeed=null,counties=[],stateRow=null,lastStateAttempt=0,lastPrecinctAttempt=0,busy=false,checkDeadline=Date.now()+30000,search="",precinctSearch="";
const countyLookup=new Map(),countyCounted=new Map();
const officialCounty="https://www.michigan.gov/sos/elections/election-results-and-data/candidate-listings-and-election-results-by-county";
function banner(mode,title,detail){const el=$("statusBanner");el.dataset.mode=mode;$("statusHeading").textContent=title;$("statusDetail").textContent=detail}
function numeric(n){return Number.isSafeInteger(n)&&n>=0&&n<=12000000}
function validHttp(url){try{const u=new URL(url);return u.protocol==="https:"||u.protocol==="http:"&&u.hostname==="localhost"}catch{return false}}
function verifyFeed(payload){
 if(!payload||payload.version!==1||payload.election!==eDate||payload.office!=="US Senate"||!Array.isArray(payload.precincts)||payload.precincts.length>15000)throw Error("Unrecognized election-night precinct dataset");
 const seen=new Set(),clean=[];
 for(const p of payload.precincts){
  if(!p||!countyLookup.has(String(p.county||"").toLowerCase()))throw Error("Unknown precinct county");
  if(typeof p.precinct!=="string"||!p.precinct.trim()||p.precinct.length>180)throw Error("Invalid precinct identifier");
  if(![p.dem,p.rep,p.other].every(numeric))throw Error("Invalid precinct vote count");
  if(!validHttp(p.sourceUrl)||Number.isNaN(Date.parse(p.asOf)))throw Error("Missing attributed precinct source and timestamp");
  const time=new Date(p.asOf).getTime();
  if(time<liveStart||time>Date.now()+300000)throw Error("Precinct timestamp outside valid election period");
  const key=p.county.toLowerCase()+"|"+p.precinct.trim().toLowerCase();
  if(seen.has(key))throw Error("Duplicate precinct or absentee counting board");
  seen.add(key);clean.push({...p,precinct:p.precinct.trim()});
 }
 if(!demo&&Date.now()<liveStart&&clean.length)throw Error("Pre-election results cannot be displayed");
 return clean;
}
function countySummary(rows){
 const sums=new Map(counties.map(c=>[c.name,{dem:0,rep:0,other:0,units:0,history:c}]));
 for(const row of rows){const key=countyLookup.get(row.county.toLowerCase());const obj=sums.get(key);obj.dem+=row.dem;obj.rep+=row.rep;obj.other+=row.other;obj.units++;}
 return sums;
}
function updateUI(){
 const rows=lastFeed?.precincts||[],byCounty=countySummary(rows);
 const totals=rows.reduce((t,p)=>({dem:t.dem+p.dem,rep:t.rep+p.rep,other:t.other+p.other}),{dem:0,rep:0,other:0});
 const any=rows.length>0;
 $("reportedD").textContent=any?fmt(totals.dem):"—";
 $("reportedR").textContent=any?fmt(totals.rep):"—";
 $("reportedMargin").textContent=any?fmt(Math.abs(totals.dem-totals.rep))+" "+(totals.dem>=totals.rep?"D":"R"):"—";
 $("precinctCount").textContent=any?fmt(rows.length):"—";
 $("coverage").textContent=any?byCounty.size+" county summaries · denominator not confirmed":"No precinct return is available";
 if(any){const n=[...byCounty.values()].filter(c=>c.units).length;$("coverage").textContent=n+" of 83 counties have precinct rows; not a statewide precinct reporting percentage";}
 const term=search.toLowerCase(),parts=[...byCounty].filter(([name])=>name.toLowerCase().includes(term)).sort((a,b)=>b[1].units-a[1].units||a[0].localeCompare(b[0]));
 $("countyRows").innerHTML=parts.map(([name,p])=>{
  const prev=p.history.senate2024,margin=(prev.d-prev.r)*100/prev.total;
  return "<tr><td>"+esc(name)+"</td><td>"+(p.units?fmt(p.dem):"—")+"</td><td>"+(p.units?fmt(p.rep):"—")+"</td><td>"+(p.units?fmt(p.units):"—")+"</td><td>"+(margin>=0?"D+":"R+")+Math.abs(margin).toFixed(1)+"</td></tr>";
 }).join("")||'<tr><td colspan="5">No matching counties</td></tr>';
 const pterm=precinctSearch.toLowerCase(),filtered=rows.filter(x=>[x.county,x.precinct].some(t=>t.toLowerCase().includes(pterm))).sort((a,b)=>a.county.localeCompare(b.county)||a.precinct.localeCompare(b.precinct));
 $("precinctRows").innerHTML=filtered.map(p=>"<tr><td>"+esc(p.county)+"</td><td>"+esc(p.precinct)+"</td><td>"+fmt(p.dem)+"</td><td>"+fmt(p.rep)+"</td><td>"+fmt(p.other)+"</td><td>"+esc(dateString(p.asOf))+"</td><td><a target='_blank' rel='noopener noreferrer' href='"+esc(p.sourceUrl)+"'>County report</a></td></tr>").join("")||'<tr><td colspan="7">'+(any?"No matching precincts":"No verified precinct rows published to this site yet.")+"</td></tr>";
 if(lastFeed?.updatedAt)$("lastSource").textContent="Newest precinct-feed publication: "+dateString(lastFeed.updatedAt)+(rows.length?" (report times vary by precinct)":" (no votes reported)");
 else $("lastSource").textContent="Precinct feed contains no reported source timestamp.";
 $("precinctDescription").textContent=rows.length?"Reported precincts / absentee counting units only. Unreported precincts are not treated as zero-vote units.":"Only source-attributed precinct or absentee-counting-board returns are displayed. No results have been ingested yet.";
}
async function readPrecinct(){
 if(busy||document.hidden)return;
 if(!demo&&Date.now()<liveStart)return;
 busy=true;lastPrecinctAttempt=Date.now();$("lastCheck").textContent="Last site-feed check: "+dateString(new Date().toISOString());
 try{
  const path=demo?"../../tests/fixtures/michigan_election_night.json":"./results.json";
  const res=await fetch(path+"?t="+Date.now(),{cache:"no-store"});
  if(!res.ok)throw Error("Feed HTTP "+res.status);
  const payload=await res.json(),rows=verifyFeed(payload);
  lastFeed={...payload,precincts:rows};
  if(demo)banner("demo","DEMONSTRATION DATA — NOT REAL VOTES","Synthetic test records are shown. No election data is being reported.");
  else if(!rows.length)banner("waiting","AWAITING PRECINCT RETURNS","No verified 2026 precinct-level results have reached this website. Official county clerks may already have newer information.");
  else banner("live","UNOFFICIAL PRECINCT RETURNS","Displaying "+rows.length+" directly sourced reporting units from "+new Set(rows.map(p=>p.county)).size+" counties, as last published by their source clerks.");
  updateUI();
 }catch(e){banner("waiting", "PRECINCT FEED UNAVAILABLE", "Latest precinct feed could not be verified: "+e.message+". Previous available data is retained and must be treated as potentially stale.");}
 finally{busy=false}
}
async function readState(){
 if(!demo&&Date.now()<liveStart)return;
 if(Date.now()-lastStateAttempt<60000)return;
 lastStateAttempt=Date.now();
 try{
  const url="https://openamerica.io/elections/results.json?year=2026&office=Senate";
  const res=await fetch(url,{mode:"cors",cache:"no-store",credentials:"omit"});
  if(!res.ok)throw Error("HTTP "+res.status);
  const data=await res.json(),race=data?.races?.MI;
  if(data.year!==2026||String(data.office).toLowerCase()!=="senate"||!race||!Array.isArray(race.cands)||!race.total){$("externalStatus").textContent="No MI count supplied";$("externalVotes").textContent="The independent feed has not published Michigan Senate totals yet.";return}
  const ds=race.cands.find(c=>c.p==="D"),rs=race.cands.find(c=>c.p==="R"),other=race.cands.filter(c=>!["D","R"].includes(c.p)).reduce((n,c)=>n+c.v,0);
  if(!ds||!rs||!numeric(ds.v)||!numeric(rs.v))throw Error("No valid D/R candidate tallies");
  if(data.as_of&&new Date(data.as_of).getTime()<liveStart)throw Error("2026 result appears earlier than polls closing");
  stateRow={d:ds.v,r:rs.v,other,sourceTime:data.as_of,pct:race.pct_in,updatedAt:Date.now(),names:[ds.n,rs.n]};
  $("externalVotes").innerHTML="<strong>"+esc(ds.n)+": "+fmt(ds.v)+" · "+esc(rs.n)+": "+fmt(rs.v)+"</strong> · other: "+fmt(other);
  $("externalAsOf").textContent="Provider source time: "+dateString(data.as_of)+" · precinct share "+(race.pct_in==null?"not provided":Number(race.pct_in).toFixed(1)+"%")+" · may not match partial local precinct rows.";
  const total=ds.v+rs.v+other;
  $("externalProgress").innerHTML='<div class="d" style="width:'+(ds.v/total*100)+'%"></div><div class="r" style="width:'+(rs.v/total*100)+'%"></div><div class="o" style="width:'+(other/total*100)+'%"></div>';
  $("externalStatus").textContent=data.stale?"Feed possibly stale":"Unofficial state tally";
 }catch(e){$("externalStatus").textContent="Statewide feed unavailable";$("externalAsOf").textContent="The independent external feed could not be checked: "+e.message+". County reports remain the authoritative election-night reference.";if(!stateRow)$("externalVotes").textContent="No independently retrieved statewide tally available."}
}
function tick(){
 const now=Date.now(),active=demo||now>=liveStart;
 if(!active){const wait=Math.ceil((liveStart-now)/86400000);banner("waiting","PRE-ELECTION · NO VOTES YET","Michigan precinct counting begins after polls close November 3, generally at 8 p.m. local time (some western U.P. counties are Central Time). The board does not publish candidate returns before polls close.");$("refreshCountdown").textContent="Starts election night";return;}
 const seconds=Math.max(0,Math.ceil((checkDeadline-now)/1000));
 $("refreshCountdown").textContent=seconds+" seconds";
 if(now>=checkDeadline){checkDeadline=now+30000;readPrecinct();}
 if(!document.hidden&&now-lastStateAttempt>=60000)readState();
}
async function initialize(){
 try{
  const [countiesRes,mainRes]=await Promise.all([fetch("../county_history.json"),fetch("../../index.html")]);
  if(!countiesRes.ok||!mainRes.ok)throw Error("Michigan baseline was unavailable");
  const history=await countiesRes.json(),html=await mainRes.text();
  if(!Array.isArray(history.counties)||history.counties.length!==83)throw Error("Expected all 83 county baselines");
  counties=history.counties;
  for(const county of counties)countyLookup.set(county.name.toLowerCase(),county.name);
  const marker="window.ERVIN_DATA = ",start=html.indexOf(marker)+marker.length,end=html.indexOf(";\n\n</script><script>",start);
  if(start>=marker.length&&end>start){const model=JSON.parse(html.slice(start,end));const mi=model.states.find(r=>r.code==="MI");if(mi){$("demName").textContent=mi.dem;$("repName").textContent=mi.rep}}
  $("countySearch").addEventListener("input",e=>{search=e.target.value;updateUI()});
  $("precinctSearch").addEventListener("input",e=>{precinctSearch=e.target.value;updateUI()});
  updateUI();
  if(demo||Date.now()>=liveStart)await Promise.all([readPrecinct(),readState()]);
  else banner("waiting","PRE-ELECTION · AWAITING NOVEMBER 3","The board is ready. No 2026 Senate votes are available before polling closes.");
  setInterval(tick,1000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&Date.now()>=liveStart){checkDeadline=Date.now()+30000;readPrecinct();readState()}});
 }catch(e){banner("waiting","DASHBOARD LOAD ERROR",e.message);console.error(e);}
}
await initialize();
})();