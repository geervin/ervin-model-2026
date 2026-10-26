(async function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Math.round(n).toLocaleString("en-US");
const dateString=s=>{if(!s)return "Unknown";const d=new Date(s);return Number.isNaN(+d)?"Unknown":d.toLocaleString("en-US",{timeZone:"America/Detroit",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"})};
const liveStart=new Date("2026-11-03T20:00:00-05:00").getTime();
const lateClose=new Date("2026-11-03T21:00:00-05:00").getTime();
const centralCounties=new Set(["dickinson","gogebic","iron","menominee"]);
const demo=new URLSearchParams(location.search).get("demo")==="1";
const eDate="2026-11-03";
let lastFeed=null,lastFeedSignature="",counties=[],stateRow=null,lastStateAttempt=0,lastPrecinctAttempt=0,busy=false,stateBusy=false,checkDeadline=Date.now()+30000,search="",precinctSearch="",reportFilter="all",lastPreElectionMinute=-1,lastHealthAttempt=0,lastFreshnessMinute=-1;
const countyLookup=new Map(),countyCounted=new Map();
const officialCounty="https://www.michigan.gov/sos/elections/election-results-and-data/candidate-listings-and-election-results-by-county";
// Direct November 2026 links verified on the respective official county sites.
// All other counties fall back to the Michigan county-clerk directory.
const countyResultPages={
 oakland:"https://results.enr.clarityelections.com/MI/Oakland/127284/",
 kent:"https://app.enhancedvoting.com/results/public/kent-county-mi/elections/11032026_20261005115447",
 livingston:"https://milivcounty.gov/elections/election-results/"
};
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
  if(!demo&&(time<(centralCounties.has(p.county.toLowerCase())?lateClose:liveStart)||time>Date.now()+300000))
   throw Error("Precinct timestamp before local county poll closing or in the future");
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
 const term=search.toLowerCase(),parts=[...byCounty].filter(([name,p])=>name.toLowerCase().includes(term)&&(reportFilter==="all"||reportFilter==="reported"&&p.units>0||reportFilter==="awaiting"&&p.units===0)).sort((a,b)=>b[1].units-a[1].units||a[0].localeCompare(b[0]));
 $("countyRows").innerHTML=parts.map(([name,p])=>{
  const prev=p.history.senate2024,margin=(prev.d-prev.r)*100/prev.total;
  const direct=countyResultPages[name.toLowerCase()],url=direct||officialCounty;
  return "<tr><td><button type=\"button\" class=\"county-jump\" data-county=\""+esc(name)+"\">"+esc(name)+"</button></td><td>"+(p.units?fmt(p.dem):"—")+"</td><td>"+(p.units?fmt(p.rep):"—")+"</td><td>"+(p.units?fmt(p.units):"—")+"</td><td>"+(margin>=0?"D+":"R+")+Math.abs(margin).toFixed(1)+"</td><td><a href=\""+esc(url)+"\" target=\"_blank\" rel=\"noopener noreferrer\">"+(direct?"2026 county portal ↗":"Find clerk ↗")+"</a></td></tr>";
 }).join("")||'<tr><td colspan="6">No counties match the selected filters</td></tr>';
 const pterm=precinctSearch.toLowerCase(),filtered=rows.filter(x=>[x.county,x.precinct].some(t=>t.toLowerCase().includes(pterm))).sort((a,b)=>a.county.localeCompare(b.county)||a.precinct.localeCompare(b.precinct));
 $("precinctRows").innerHTML=filtered.map(p=>"<tr><td>"+esc(p.county)+"</td><td>"+esc(p.precinct)+"</td><td>"+fmt(p.dem)+"</td><td>"+fmt(p.rep)+"</td><td>"+fmt(p.other)+"</td><td>"+esc(dateString(p.asOf))+"</td><td><a target='_blank' rel='noopener noreferrer' href='"+esc(p.sourceUrl)+"'>County report</a></td></tr>").join("")||'<tr><td colspan="7">'+(any?"No matching precincts":"No verified precinct rows published to this site yet.")+"</td></tr>";
 if(lastFeed?.updatedAt)$("lastSource").textContent="Website feed published: "+dateString(lastFeed.updatedAt)+(rows.length?" · each row has its own clerk timestamp":" · no votes reported");
 else $("lastSource").textContent="No published precinct-feed timestamp yet.";
 $("exportReturns").disabled=!rows.length;
 $("sourceIngestionStatus").textContent=rows.length?fmt(rows.length)+" verified reporting units":"Verified county upload required";
 $("sourceIngestionNote").textContent=rows.length?"Most recent reviewed precinct snapshot is published; new county reports still require ingestion.":"The 30-second refresh checks this website\u0027s feed, but county clerk data must first be verified and uploaded.";
 updateFeedAge();
 $("precinctDescription").textContent=rows.length?"Reported precincts / absentee counting units only. Unreported precincts are not treated as zero-vote units.":"Only source-attributed precinct or absentee-counting-board returns are displayed. No results have been ingested yet.";
}
function updateFeedAge(){
 const el=$("feedFreshness");if(!el)return;
 if(!lastFeed?.updatedAt){el.textContent="No verified precinct feed has been published yet.";return;}
 const age=Math.round((Date.now()-Date.parse(lastFeed.updatedAt))/60000);
 if(!Number.isFinite(age)){el.textContent="Feed publication age unavailable.";return;}
 el.textContent="Website publication age: "+(age<1?"under 1 minute":age+" minutes")+(age>10?" · publication may be behind county sources":"")+".";
}
async function readHealth(){
 if(document.hidden||Date.now()-lastHealthAttempt<300000)return;
 lastHealthAttempt=Date.now();
 try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
   let response;
   try{response=await fetch("./source_health.json?t="+Date.now(),{cache:"no-store",signal:controller.signal});}finally{clearTimeout(timer);}
   if(!response.ok)throw Error("Health record HTTP "+response.status);
   const data=await response.json(),sources=Object.values(data.sources||{});
   if(!data.checkedAt||!sources.length){$("sourceHealthStatus").textContent="First connectivity audit pending";$("sourceHealthDetail").textContent="The scheduled source monitor has not yet published its first report.";return;}
   const successful=sources.filter(x=>x.status==="reachable").length;
   const uncertain=sources.filter(x=>x.status==="indeterminate").length;
   const failures=sources.filter(x=>x.status==="unavailable").length;
   $("sourceHealthStatus").textContent=successful+" / "+sources.length+" public endpoints reachable";
   $("sourceHealthDetail").textContent=(failures?failures+" unreachable · ":"")+(uncertain?uncertain+" blocked/uncertain · ":"")+"last probed "+dateString(data.checkedAt)+". Endpoint access is not verified vote delivery.";
   $("sourceMonitorCard").classList.toggle("good",successful===sources.length);
   $("sourceMonitorCard").classList.toggle("warn",uncertain>0);
   $("sourceMonitorCard").classList.toggle("fail",failures>0);
 }catch(err){
   $("sourceHealthStatus").textContent="Connectivity report unavailable";
   $("sourceHealthDetail").textContent="Source links remain available below; a failed monitor does not mean clerk results are zero.";
   $("sourceMonitorCard").classList.add("warn");
 }
}
function exportVerifiedCSV(){
 const rows=lastFeed?.precincts||[];if(!rows.length)return;
 const quote=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
 const cols=["county","precinct","dem","rep","other","asOf","sourceUrl"];
 const csv=[cols.join(","),...rows.map(row=>cols.map(k=>quote(row[k])).join(","))].join("\r\n")+"\r\n";
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const link=document.createElement("a");link.href=url;link.download="michigan-2026-verified-precinct-returns.csv";
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
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
  const published=payload.updatedAt==null?null:Date.parse(payload.updatedAt);
  if(!demo&&rows.length&&(!Number.isFinite(published)||published>Date.now()+300000))
    throw Error("Feed publication timestamp missing or invalid");
  const priorPublished=lastFeed?.updatedAt?Date.parse(lastFeed.updatedAt):null;
  if(!demo&&Number.isFinite(priorPublished)&&Number.isFinite(published)&&published<priorPublished)
    throw Error("An older precinct feed was served; previous verified snapshot retained");
  const signature=JSON.stringify(rows),changed=signature!==lastFeedSignature;
  const republished=payload.updatedAt!==lastFeed?.updatedAt;
  lastFeed={...payload,precincts:rows};lastFeedSignature=signature;
  if(demo)banner("demo","DEMONSTRATION DATA — NOT REAL VOTES","Synthetic test records are shown. No election data is being reported.");
  else if(!rows.length)banner("waiting","AWAITING PRECINCT RETURNS","No verified 2026 precinct-level results have reached this website. Official county clerks may already have newer information.");
  else banner("live","UNOFFICIAL PRECINCT RETURNS","Displaying "+rows.length+" directly sourced reporting units from "+new Set(rows.map(p=>p.county)).size+" counties, as last published by their source clerks.");
  if(changed||republished)updateUI();else updateFeedAge();
  // Do not redraw thousands of map polygons when the published votes are unchanged.
  if(changed)window.dispatchEvent(new CustomEvent("ervin:results",{detail:{precincts:rows}}));
 }catch(e){banner("waiting", "PRECINCT FEED UNAVAILABLE", "Latest precinct feed could not be verified: "+e.message+". Previous available data is retained and must be treated as potentially stale.");}
 finally{busy=false}
}
async function readState(){
 if(demo||Date.now()<liveStart||stateBusy)return;
 if(Date.now()-lastStateAttempt<60000)return;
 stateBusy=true;lastStateAttempt=Date.now();
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const url="https://openamerica.io/elections/results.json?year=2026&office=Senate";
  const res=await fetch(url,{mode:"cors",cache:"no-cache",credentials:"omit",signal:controller.signal});
  if(!res.ok)throw Error("Provider HTTP "+res.status);
  const data=await res.json();
  if(data?.api!==1||data.year!==2026||String(data.office).toLowerCase()!=="senate")
   throw Error("Provider sent a different election, office or API version");
  const race=data?.races?.MI;
  if(!race||!Array.isArray(race.cands)||!numeric(race.total)||race.total===0){
   $("externalStatus").textContent="Awaiting statewide results";
   $("externalVotes").textContent="No attributed 2026 Michigan Senate vote counts have been published by this feed.";
   $("externalAsOf").textContent="Michigan has not supplied results to this provider yet. Check county clerks for more recent local reports.";
   $("externalProgress").replaceChildren();
   return;
  }
  const ds=race.cands.find(c=>c.p==="D"),rs=race.cands.find(c=>c.p==="R");
  if(!ds||!rs||!numeric(ds.v)||!numeric(rs.v))throw Error("Missing or malformed D/R candidate tallies");
  const otherCands=race.cands.filter(c=>!["D","R"].includes(c.p));
  if(!otherCands.every(c=>numeric(c.v)))throw Error("Invalid other-candidate tally");
  const other=otherCands.reduce((n,c)=>n+c.v,0);
  const total=ds.v+rs.v+other;
  if(!numeric(total)||!total||Math.abs(total-race.total)>Math.max(10,race.total*.005))
   throw Error("State totals do not reconcile with candidate totals");
  const issued=Date.parse(data.as_of||"");
  if(!Number.isFinite(issued)||issued<liveStart||issued>Date.now()+300000)
   throw Error("Missing or out-of-window state result timestamp");
  const percent=race.pct_in==null?null:Number(race.pct_in);
  if(percent!==null&&(!Number.isFinite(percent)||percent<0||percent>100))
   throw Error("Invalid precinct reporting percentage");
  stateRow={d:ds.v,r:rs.v,other,sourceTime:data.as_of,pct:percent,updatedAt:Date.now(),names:[ds.n,rs.n]};
  $("externalVotes").innerHTML="<strong>"+esc(ds.n)+": "+fmt(ds.v)+" · "+esc(rs.n)+": "+fmt(rs.v)+"</strong> · other: "+fmt(other);
  $("externalAsOf").textContent="Provider's latest update across its states: "+dateString(data.as_of)+" · Michigan precinct share "+(percent===null?"not reported":percent.toFixed(1)+"%")+" · independent of partial local reports.";
  $("externalProgress").innerHTML='<div class="d" style="width:'+(ds.v/total*100)+'%"></div><div class="r" style="width:'+(rs.v/total*100)+'%"></div><div class="o" style="width:'+(other/total*100)+'%"></div>';
  $("externalStatus").textContent=data.stale?"Source marked stale":data.live?"Unofficial feed · live":data.final?"Precinct reports complete":"Unofficial state tally";
 }catch(e){
  $("externalStatus").textContent=stateRow?"Statewide feed interrupted":"Statewide feed unavailable";
  $("externalAsOf").textContent="Unable to verify a fresh statewide response: "+(e.name==="AbortError"?"request timed out":e.message)+". Check the official county links below.";
  if(!stateRow)$("externalVotes").textContent="No independently retrieved statewide tally available.";
 }finally{clearTimeout(timeout);stateBusy=false}
}
function tick(){
 const now=Date.now(),active=demo||now>=liveStart;
 if(Math.floor(now/60000)!==lastFreshnessMinute){lastFreshnessMinute=Math.floor(now/60000);updateFeedAge();readHealth();}
 if(!active){
  const minute=Math.floor(now/60000);
  if(minute!==lastPreElectionMinute){
   lastPreElectionMinute=minute;
   $("refreshCountdown").textContent="Starts election night";
  }
  return;
 }
 const seconds=Math.max(0,Math.ceil((checkDeadline-now)/1000));
 $("refreshCountdown").textContent=seconds+" seconds";
 if(now>=checkDeadline){checkDeadline=now+30000;readPrecinct();}
 if(!document.hidden&&!demo&&now-lastStateAttempt>=60000)readState();
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
  $("refreshNow").addEventListener("click",()=>{
    if(!demo&&Date.now()<liveStart)return;
    if(Date.now()-lastPrecinctAttempt>=5000)readPrecinct();
    if(!demo)readState();
    checkDeadline=Date.now()+30000;
  });
  if(!demo&&Date.now()<liveStart)$("refreshNow").disabled=true;
  $("countySearch").addEventListener("input",e=>{search=e.target.value;updateUI()});
  $("countyReportFilter").addEventListener("change",e=>{reportFilter=e.target.value;updateUI()});
  $("precinctSearch").addEventListener("input",e=>{precinctSearch=e.target.value;updateUI()});
  $("countyRows").addEventListener("click",e=>{const button=e.target.closest("button[data-county]");if(!button)return;const shape=[...document.querySelectorAll("#countyBoundaryMap [data-county]")].find(p=>p.dataset.county===button.dataset.county);if(shape){shape.dispatchEvent(new MouseEvent("click",{bubbles:true}));document.getElementById("electionGeography").scrollIntoView({block:"start",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});}});
  $("exportReturns").addEventListener("click",exportVerifiedCSV);
  readHealth();
  updateUI();
  if(demo){$("externalStatus").textContent="Disabled for demo";$("externalVotes").textContent="Synthetic fixture mode: no live statewide source is polled.";await readPrecinct();}
  else if(Date.now()>=liveStart)await Promise.all([readPrecinct(),readState()]);
  else banner("waiting","PRE-ELECTION · AWAITING NOVEMBER 3","No actual 2026 Michigan Senate results exist yet. County clerk links below lead directly to the official reporting sources.");
  setInterval(tick,1000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&(demo||Date.now()>=liveStart)){checkDeadline=Date.now()+30000;readPrecinct();if(!demo)readState()}});
 }catch(e){banner("waiting","DASHBOARD LOAD ERROR",e.message);console.error(e);}
}
await initialize();
})();