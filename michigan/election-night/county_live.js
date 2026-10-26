/* Michigan election-night county vote center.
 * County-wide clerk totals override (never add to) partial precinct totals.
 * Everything is verified locally and remains blank before poll closing.
 */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const DATE="2026-11-03",CLOSE_E=Date.parse("2026-11-03T20:00:00-05:00"),CLOSE_C=Date.parse("2026-11-03T21:00:00-05:00");
const CENTRAL=new Set(["Dickinson","Gogebic","Iron","Menominee"]);
const DIRECTORY="https://www.michigan.gov/sos/elections/election-results-and-data/candidate-listings-and-election-results-by-county";
const format=n=>Number(n).toLocaleString("en-US");
const pretty=t=>{const x=new Date(t);return Number.isNaN(+x)?"Not available":x.toLocaleString("en-US",{timeZone:"America/Detroit",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"})};
const isVote=n=>Number.isSafeInteger(n)&&n>=0&&n<=2_000_000;
const isURL=u=>{try{const x=new URL(u);return x.protocol==="https:"&&!x.username&&!x.password}catch{return false}};
const demo=new URLSearchParams(location.search).get("demo")==="1";
let official=new Map(),precincts=new Map(),names=new Set(),selected="",hovered="",lastUpdate=null,lastPublished=null,lastRead=0,reading=false,clock=null;
let lastStatus="Awaiting verified county returns";
const countySources=new Map();
async function indexCounties(){
 try{
   const response=await fetch("../county_history.json");
   if(!response.ok)throw Error("Michigan county index unavailable");
   const data=await response.json();
   names=new Set((data.counties||[]).map(c=>c.name));
 }catch(e){$("countyLiveFeedStatus").textContent="County index unavailable; county totals are not displayed";}
}
function accept(payload){
 if(!payload||payload.version!==1||payload.election!==DATE||payload.office!=="US Senate"||!Array.isArray(payload.counties)||payload.counties.length>83)
   throw Error("Unexpected county election feed");
 if(payload.counties.length){
   if(!payload.updatedAt||!Number.isFinite(Date.parse(payload.updatedAt))||Date.parse(payload.updatedAt)>Date.now()+300000)
     throw Error("Invalid county feed publication timestamp");
 }
 if(lastPublished&&payload.updatedAt&&Date.parse(payload.updatedAt)<Date.parse(lastPublished))
   throw Error("Older county snapshot; retaining last validated data");
 const seen=new Set(),result=new Map();
 for(const x of payload.counties){
   if(!names.has(x.county)||seen.has(x.county))throw Error("Unknown or duplicated county");
   seen.add(x.county);
   if(![x.dem,x.rep,x.other].every(isVote)||x.dem+x.rep+x.other===0||!isURL(x.sourceUrl))
     throw Error("Missing attributed county results or invalid vote totals");
   if(x.reportingStatus!=="partial"&&x.reportingStatus!=="complete")throw Error("Invalid county reporting status");
   if(!x.asOf||Number.isNaN(Date.parse(x.asOf)))throw Error("County source timestamp missing");
   if(!demo){
     if(Date.now()<CLOSE_E)throw Error("County votes cannot appear before polls close");
     if(Date.parse(x.asOf)<(CENTRAL.has(x.county)?CLOSE_C:CLOSE_E)||Date.parse(x.asOf)>Date.now()+300000)
       throw Error("Results before local poll closing or dated in future");
   }
   result.set(x.county,x);
 }
 return result;
}
function partialPrecincts(rows){
 const map=new Map();
 for(const x of rows){
   const c=map.get(x.county)||{county:x.county,dem:0,rep:0,other:0,units:0,asOf:null,sourceUrl:null};
   c.dem+=x.dem;c.rep+=x.rep;c.other+=x.other;c.units++;
   if(!c.asOf||Date.parse(x.asOf)>Date.parse(c.asOf)){c.asOf=x.asOf;c.sourceUrl=x.sourceUrl;}
   map.set(x.county,c);
 }
 precincts=map;
 publish();
}
function countyRecord(name){
 if(official.has(name))return {...official.get(name),scope:"county",units:null};
 const value=precincts.get(name);
 if(value)return {...value,scope:"precinct"};
 return null;
}
function publish(){
 window.dispatchEvent(new CustomEvent("ervin:county-totals",{detail:{counties:[...official.values()]}}));
 render();
}
function render(){
 let label=hovered||selected;
 if(!label){
   label="Michigan";
   $("countyCardTitle").textContent="Select a county";
 }else $("countyCardTitle").textContent=label+" County";
 const rec=countyRecord(label),d=rec?.dem||0,r=rec?.rep||0;
 $("countyCardDem").textContent=rec?format(d):"—";
 $("countyCardRep").textContent=rec?format(r):"—";
 const share=d+r?d/(d+r)*100:0;
 $("countyCardDemBar").style.width=rec?share.toFixed(2)+"%":"0%";
 $("countyCardRepBar").style.width=rec?(100-share).toFixed(2)+"%":"0%";
 $("countyCardStatus").textContent=!rec?"Awaiting verified results":rec.scope==="county"?
   (rec.reportingStatus==="complete"?"County clerk · complete":"County clerk · partial"):"Partial precinct subtotal";
 $("countyCardContext").textContent=!rec?
   "No verified November 2026 Senate vote figures have been published to this site for this county. Unreported does not mean zero votes.":
   rec.scope==="county"?
   "Officially attributed county-wide clerk subtotal. Not added to any precinct figures. 'Complete' means the county source designated its report complete.":
   format(rec.units)+" verified precinct/counting-board rows only. This is not a complete county result unless all local units are reported; do not infer reporting percentage.";
 $("countyCardTimestamp").textContent=rec?"Clerk report: "+pretty(rec.asOf):"No valid county return timestamp";
 $("countyCardSource").href=rec?.sourceUrl||countySources.get(label)||DIRECTORY;
 $("countyCardSource").textContent=rec?"Open original result ↗":"County election website ↗";
}
function positionTip(e){
 const tip=$("countyHoverTip");if(tip.hidden)return;
 const left=Math.min(window.innerWidth-tip.offsetWidth-12,Math.max(10,e.clientX+18));
 const top=Math.min(window.innerHeight-tip.offsetHeight-12,Math.max(10,e.clientY+15));
 tip.style.left=left+"px";tip.style.top=top+"px";
}
function renderTip(name){
 const rec=countyRecord(name);
 $("hoverCountyName").textContent=name+" County";
 $("hoverDem").textContent=rec?format(rec.dem):"—";
 $("hoverRep").textContent=rec?format(rec.rep):"—";
 $("hoverCountyStatus").textContent=!rec?"Awaiting verified county totals":rec.scope==="county"?
   "Verified county clerk · "+rec.reportingStatus+" · "+pretty(rec.asOf):
   "Partial precinct reports only · "+pretty(rec.asOf);
}
function hoverCounty(name,e){
 if(!names.has(name))return;
 hovered=name;render();renderTip(name);
 if(e?.pointerType==="touch")return;
 $("countyHoverTip").hidden=false;
 if(e)positionTip(e);
}
function unhover(){
 hovered="";$("countyHoverTip").hidden=true;render();
}
function expand(){
 const el=$("countyMapPanel"),button=$("expandCountyMap");
 const next=!el.classList.contains("is-expanded");
 el.classList.toggle("is-expanded",next);
 button.setAttribute("aria-expanded",String(next));button.textContent=next?"✕ Close expanded map":"⛶ Expand map";
 if(next)button.focus();
 else $("countyHoverTip").hidden=true;
}
async function loadClerkLinks(){
 try{
  const r=await fetch("./county_watch_sources.json",{cache:"force-cache"});
  if(!r.ok)return;
  const data=await r.json();
  for(const [name,url] of Object.entries(data.counties||{}))if(isURL(url))countySources.set(name,url);
  render();
 }catch{}
}
async function readCounty(force=false){
 if(reading||document.hidden||!names.size)return;
 if(!force&&!demo&&Date.now()<CLOSE_E)return;
 if(!force&&Date.now()-lastRead<25000)return;
 reading=true;lastRead=Date.now();
 try{
   const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),10500);
   let response;
   try{response=await fetch("./county_totals.json?t="+Date.now(),{cache:"no-store",signal:ctrl.signal})}
   finally{clearTimeout(timeout)}
   if(!response.ok)throw Error("HTTP "+response.status);
   const payload=await response.json(),next=accept(payload);
   // Ensure later refreshes can't erase previously confirmed counties.
   for(const [name,prior] of official){
     if(!next.has(name))throw Error("County "+name+" disappeared from the published snapshot");
     if(Date.parse(next.get(name).asOf)<Date.parse(prior.asOf))throw Error("Older "+name+" source was served");
   }
   const changed=JSON.stringify([...next.values()])!==JSON.stringify([...official.values()]);
   official=next;lastPublished=payload.updatedAt||null;
   lastStatus=official.size?
     official.size+" of 83 counties have verified county-wide reports":
     "Awaiting verified county-wide results; no county totals have been supplied";
   $("countyLiveFeedStatus").textContent=(demo?"DEMONSTRATION · ":"")+lastStatus;
   $("countyLiveFeedAge").textContent=lastPublished?"Feed published "+pretty(lastPublished):
     "Checked "+pretty(new Date().toISOString())+" · updates need verified clerk reports";
   if(changed)publish();else render();
 }catch(e){
   $("countyLiveFeedStatus").textContent=official.size?lastStatus+" · refresh interrupted":
     "County feed unavailable or awaiting publication";
   $("countyLiveFeedAge").textContent="Last check "+pretty(new Date().toISOString())+" · "+e.message;
 }finally{reading=false}
}
function init(){
 const svg=$("countyBoundaryMap");
 if(!svg)return;
 $("expandCountyMap").addEventListener("click",expand);
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("countyMapPanel").classList.contains("is-expanded"))expand()});
 svg.addEventListener("pointerover",e=>{const el=e.target.closest?.("path[data-county]");if(el)hoverCounty(el.dataset.county,e)});
 svg.addEventListener("pointermove",e=>{const el=e.target.closest?.("path[data-county]");if(!el){if(hovered)unhover();return}
   if(el.dataset.county!==hovered)hoverCounty(el.dataset.county,e);
   else positionTip(e);
 });
 svg.addEventListener("pointerleave",unhover);
 svg.addEventListener("focusin",e=>{const el=e.target.closest?.("path[data-county]");if(el){hoverCounty(el.dataset.county);$("countyHoverTip").hidden=true}});
 svg.addEventListener("focusout",unhover);
 window.addEventListener("ervin:county-select",e=>{selected=e.detail?.county||"";hovered="";$("countyHoverTip").hidden=true;render()});
 window.addEventListener("ervin:results",e=>partialPrecincts(e.detail?.precincts||[]));
 $("refreshCountyTotals").addEventListener("click",()=>readCounty(true));
 indexCounties().then(()=>{loadClerkLinks();render();if(Date.now()>=CLOSE_E||demo)readCounty(true)});
 const next=()=>{if(Date.now()>=CLOSE_E)readCounty()};
 clock=setInterval(next,30000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden&&Date.now()>=CLOSE_E)readCounty(true)});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();