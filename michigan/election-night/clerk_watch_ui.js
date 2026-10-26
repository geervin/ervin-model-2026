/* County clerk source monitor. All values are public-source URL/status metadata,
   not election votes. Never use this dataset to color the result maps. */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const text=(value)=>String(value??"");
const esc=v=>text(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safe=v=>{try{let url=new URL(v,location.href);return ["https:","http:"].includes(url.protocol)?url.href:"#"}catch{return"#"}};
const when=v=>{const d=new Date(v);return v&&!Number.isNaN(+d)?d.toLocaleString("en-US",{timeZone:"America/Detroit",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}):"Not checked"};
let watch=null,events=[],search="",filter="all",busy=false;
function facts(){
 const node=$("clerkWatchFacts");
 if(!watch){node.innerHTML="<span>County audit not yet available</span>";return}
 const s=watch.summary||{};
 node.innerHTML=[
  ["Counties","83"],
  ["Reachable",s.reachable??0],
  ["Blocked / inconclusive",s.indeterminate??0],
  ["Unavailable",s.unavailable??0],
  ["2026 report links",s.resultLinks??0],
  ["Changes on last check",s.changedCounties??0],
 ].map(([label,value])=>'<span><b>'+esc(value)+'</b>'+esc(label)+'</span>').join("");
 $("clerkWatchTimestamp").textContent="Last automatic county check: "+when(watch.checkedAt)+" · this is a public-source availability audit, not a vote feed.";
}
function eventPanel(){
 const latest=events.slice(-6).reverse(),node=$("clerkWatchEvents");
 if(!latest.length){
  node.textContent="No source changes detected since the checker began collecting baselines. This does not mean every county has published its results.";
  return;
 }
 node.innerHTML='<strong>Recent source changes · verify with county clerk before relying on a report</strong><div>'+
  latest.map(e=>{
   const link=(e.newLinks||[]).find(x=>safe(x.url)!="#");
   return '<div style="margin-top:7px"><b>'+esc(e.county)+'</b> · '+esc(e.kind?.replace(/_/g," ")||"source change")+
    ' · '+esc(when(e.at))+(link?' · <a href="'+esc(safe(link.url))+'" target="_blank" rel="noopener noreferrer">Open new report ↗</a>':'')+'</div>';
  }).join("")+'</div>';
}
function rows(){
 const tbody=$("clerkWatchRows");
 if(!watch?.counties){
  tbody.innerHTML='<tr><td colspan="5">No county audit has been published yet. Use the official clerk directory above.</td></tr>';
  return;
 }
 const selections=Object.values(watch.counties)
  .filter(c=>c.county.toLowerCase().includes(search))
  .filter(c=>filter==="all"||(filter==="changed"&&c.changed)||(filter==="reports"&&c.reportLinks?.length)||
    (filter==="reachable"&&c.status==="reachable")||(filter==="problems"&&c.status!=="reachable"))
  .sort((a,b)=>Number(b.changed)-Number(a.changed)||a.county.localeCompare(b.county));
 tbody.innerHTML=selections.map(c=>{
  const label=c.status==="reachable"?"Accessible":c.status==="indeterminate"?"Inconclusive":"Unavailable";
  const className=c.status==="reachable"?"ok":c.status==="indeterminate"?"maybe":"down";
  const link=(c.reportLinks||[]).find(x=>safe(x.url)!="#");
  const url=link?.url||c.inspectedUrl||c.sourceUrl;
  const title=link?.title||"Open county source ↗";
  return '<tr><td>'+esc(c.county)+(c.changed?' <small style="color:var(--gold)">NEW</small>':'')+'</td>'+
   '<td><span class="watch-flag '+className+'">'+esc(label)+'</span></td>'+
   '<td>'+((c.reportLinks||[]).length?'Possible reports: '+esc(c.reportLinks.length):'—')+'</td>'+
   '<td><a href="'+esc(safe(url))+'" target="_blank" rel="noopener noreferrer">'+esc(title.slice(0,85))+'</a></td>'+
   '<td><span class="tiny">'+esc((c.note||"").slice(0,160))+'</span></td></tr>';
 }).join("")||'<tr><td colspan="5">No counties match the selected filter.</td></tr>';
}
async function update(){
 if(busy||document.hidden)return;busy=true;
 $("reloadClerkWatch").disabled=true;
 try{
  const stamp="?v="+Date.now();
  const r=await fetch("./clerk_watch.json"+stamp,{cache:"no-store"});
  if(!r.ok)throw Error("County audit HTTP "+r.status);
  const json=await r.json();
  if(json.coverage!==83||!json.counties||Object.keys(json.counties).length!==83)throw Error("Incomplete all-county audit");
  watch=json;
  try{
   const q=await fetch("./clerk_watch_events.json"+stamp,{cache:"no-store"});
   if(q.ok){const log=await q.json();events=Array.isArray(log.events)?log.events:[]}
  }catch{}
  facts();eventPanel();rows();
 }catch(error){
  if(!watch)$("clerkWatchTimestamp").textContent="County monitor snapshot unavailable ("+error.message+"). Direct official clerk links remain accessible above.";
  rows();
 }finally{busy=false;$("reloadClerkWatch").disabled=false}
}
function start(){
 if(!$("clerkWatchRows"))return;
 $("clerkWatchSearch").addEventListener("input",e=>{search=e.target.value.toLowerCase().trim();rows()});
 $("clerkWatchFilter").addEventListener("change",e=>{filter=e.target.value;rows()});
 $("reloadClerkWatch").addEventListener("click",update);
 update();
 // GitHub Pages source audit is periodically published; this UI checks at most every 3 min.
 setInterval(()=>{if(!document.hidden)update()},180000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)update()});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
else start();
})();
