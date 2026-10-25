/* Michigan 2026 election-night geography. No speculative votes.
 * Counties: site-hosted 83-county historical boundary dataset.
 * Precincts: Michigan BOE's 2026 hosted ArcGIS polygons (NOT 2024 precincts).
 * Geography is loaded independently of election results, on idle.
 */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const GIS="https://services3.arcgis.com/dxRQUfTDNtfqZ301/arcgis/rest/services/2026_Voting_Precincts/FeatureServer/0";
const SOURCE="https://www.arcgis.com/home/item.html?id=c349bc2bb6c2468594d341a09f520ea8";
const W=880,H=595,BOUNDS=[-90.85,41.4,-81.8,48.75];
let counties=[],features=[],selected="",results=[],loaded=false,loading=false,lastRender=0;
const normalize=x=>String(x||"").trim().toLowerCase().replace(/\b(precinct|pct|ward|city|township|town|charter)\b/g,"").replace(/[^a-z0-9]/g,"");
const byCounty=new Map(),byFips=new Map();
const fmt=x=>Number(x||0).toLocaleString("en-US");
const project=(p,b=BOUNDS)=>[(p[0]-b[0])/(b[2]-b[0])*W,(b[3]-p[1])/(b[3]-b[1])*H];
function rings(g){
 if(!g)return[];
 if(g.type==="Polygon")return g.coordinates||[];
 if(g.type==="MultiPolygon")return(g.coordinates||[]).flat();
 return[];
}
function path(g,b=BOUNDS){
 return rings(g).map(r=>r.map((p,i)=>{const [x,y]=project(p,b);return(i?"L":"M")+x.toFixed(1)+" "+y.toFixed(1)}).join("")+"Z").join("");
}
function extent(g){
 let bb=[Infinity,Infinity,-Infinity,-Infinity];
 for(const ring of rings(g))for(const [x,y] of ring){bb[0]=Math.min(bb[0],x);bb[1]=Math.min(bb[1],y);bb[2]=Math.max(bb[2],x);bb[3]=Math.max(bb[3],y);}
 return bb;
}
function resultsByCounty(){
 const map=new Map();
 for(const row of results){
  const c=String(row.county||"").toLowerCase(),o=map.get(c)||{d:0,r:0,n:0};
  o.d+=row.dem;o.r+=row.rep;o.n++;map.set(c,o);
 }
 return map;
}
function drawCounties(){
 const svg=$("countyBoundaryMap");if(!svg||!counties.length)return;
 const counted=resultsByCounty(),ns="http://www.w3.org/2000/svg";
 svg.replaceChildren();svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
 const fragment=document.createDocumentFragment();
 for(const c of counties){
  const name=c.properties.name,reported=counted.get(name.toLowerCase()),el=document.createElementNS(ns,"path");
  el.setAttribute("d",path(c.geometry));
  el.setAttribute("data-county",name);
  el.setAttribute("tabindex","0");el.setAttribute("role","button");
  el.setAttribute("aria-label",name+(reported?" · partial reports received":" · awaiting results"));
  el.classList.add("county-shape");
  if(reported)el.classList.add(reported.d>reported.r?"reported-d":reported.r>reported.d?"reported-r":"reported-tie");
  if(name===selected)el.classList.add("selected");
  const title=document.createElementNS(ns,"title");title.textContent=name+(reported?` · ${fmt(reported.n)} reporting units; D ${fmt(reported.d)}, R ${fmt(reported.r)}`:" · not yet reported");
  el.append(title);
  const onSelect=()=>chooseCounty(name);
  el.addEventListener("click",onSelect);
  el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect();}});
  fragment.append(el);
 }
 svg.append(fragment);
 $("countyMapStatus").textContent=`${counties.length} Michigan counties · ${counted.size} with ingested returns · select a county to inspect its precincts`;
}
function chooseCounty(name){
 selected=name;
 $("mapCountySelection").textContent=name||"Statewide";
 $("countyAll").disabled=!name;
 drawCounties();drawPrecincts();
}
function drawPrecincts(){
 const canvas=$("precinctBoundaryMap"),tip=$("precinctMapStatus");if(!canvas||!tip)return;
 const dpr=Math.min(2,window.devicePixelRatio||1);
 if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}
 const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
 ctx.clearRect(0,0,W,H);
 ctx.fillStyle="#0d1c2b";ctx.fillRect(0,0,W,H);
 const county=selected?counties.find(x=>x.properties.name===selected):null;
 let box=county?extent(county.geometry):BOUNDS;
 if(county){
   const dx=Math.max(.20,box[2]-box[0]),dy=Math.max(.17,box[3]-box[1]);
   box=[box[0]-dx*.13,box[1]-dy*.13,box[2]+dx*.13,box[3]+dy*.13];
 }
 // A neutral county outline is immediately available even without ArcGIS.
 const visibleCounties=county?[county]:counties;
 if(!loaded){
  ctx.lineWidth=.9;ctx.strokeStyle="#5c7185";ctx.fillStyle="#172c3e";
  for(const c of visibleCounties){
    const shape=new Path2D(path(c.geometry,box));ctx.fill(shape);ctx.stroke(shape);
  }
  tip.textContent=loading?"Loading official 2026 precinct geography…":"2026 precinct boundaries are not loaded. County outlines shown as a neutral fallback.";
  return;
 }
 let drawn=0,reported=0;
 const matching=new Map();
 for(const row of results){
   const key=row.county.toLowerCase()+"|"+normalize(row.precinct);
   const candidates=matching.get(key)||[];
   candidates.push(row);matching.set(key,candidates);
 }
 // Substantial polygon count is painted only on data change/selection,
 // never on the 30-second network timer unless new returns arrive.
 for(const f of features){
  const p=f.properties||{},countyFips=String(p.COUNTYFIPS||p.CountyFips||p.countyfips||"").padStart(3,"0");
  const countyName=byFips.get(countyFips)||"";
  if(selected&&countyName!==selected)continue;
  const bbox=extent(f.geometry);
  if(bbox[2]<box[0]||bbox[0]>box[2]||bbox[3]<box[1]||bbox[1]>box[3])continue;
  const shape=new Path2D(path(f.geometry,box));
  const keys=[p.Precinct_Short_Name,p.Precinct_Long_Name,p.PRECINCTID,p.Precinct,p.NAME]
     .filter(Boolean).map(v=>countyName.toLowerCase()+"|"+normalize(v));
  const matches=keys.flatMap(k=>matching.get(k)||[]);
  const unique=[...new Set(matches)];
  const matched=unique.length===1?unique[0]:null;
  ctx.fillStyle=matched?(matched.dem>matched.rep?"#275d9b":matched.rep>matched.dem?"#993e50":"#65596b"):"#1b3346";
  ctx.strokeStyle=selected?"#89a0b1":"#7690a3";
  ctx.lineWidth=selected?.62:.28;
  ctx.fill(shape);ctx.stroke(shape);drawn++;
  if(matched)reported++;
 }
 // Draw selected county outline prominently, or statewide boundaries softly.
 ctx.strokeStyle="#d9bd85";ctx.lineWidth=selected?2:1.1;
 for(const c of visibleCounties)ctx.stroke(new Path2D(path(c.geometry,box)));
 tip.textContent=`${fmt(drawn)} precinct polygons displayed${selected?" in "+selected:" statewide"} · ${reported} exactly matched to ingested return IDs · ${results.length-reported} return rows not uniquely mapped. Grey = no verified match; no zeros implied.`;
}
async function fetchPrecinctGeography(){
 if(loading||loaded)return;
 loading=true;$("precinctMapStatus").textContent="Loading 2026 Michigan precinct geometry from the Bureau of Elections…";
 $("reloadPrecinctMap").disabled=true;drawPrecincts();
 try{
   const assembled=[];const pages=8;
   for(let offset=0;offset<8000;offset+=1000){
     const args=new URLSearchParams({where:"1=1",outFields:"*",returnGeometry:"true",outSR:"4326",geometryPrecision:"4",maxAllowableOffset:"0.00035",f:"geojson",resultOffset:String(offset),resultRecordCount:"1000",orderByFields:"OBJECTID ASC"});
     const control=new AbortController();const timeout=setTimeout(()=>control.abort(),22000);
     let r;
     try{r=await fetch(GIS+"/query?"+args,{signal:control.signal,cache:"force-cache",mode:"cors"});}finally{clearTimeout(timeout);}
     if(!r.ok)throw Error("GIS HTTP "+r.status);
     const j=await r.json();
     if(j.error||j.type!=="FeatureCollection"||!Array.isArray(j.features))throw Error(j.error?.message||"GIS did not supply a GeoJSON feature collection");
     assembled.push(...j.features.filter(f=>f.geometry&&rings(f.geometry).length));
     $("precinctMapStatus").textContent=`${fmt(assembled.length)} precinct polygons received · loading…`;
     if(j.features.length<1000&&!j.exceededTransferLimit)break;
   }
   if(assembled.length<2500)throw Error("Incomplete statewide 2026 geometry ("+assembled.length+" polygons)");
   features=assembled;loaded=true;
   $("precinctGeometryCount").textContent=fmt(features.length)+" precinct boundaries · 2026";
   $("precinctMapStatus").textContent="Rendering official precinct outlines…";
   drawPrecincts();
 }catch(e){
   $("precinctGeometryCount").textContent="2026 GIS temporarily unavailable";
   $("precinctMapStatus").textContent="Official 2026 precinct outlines could not be retrieved ("+e.message+"). The neutral county boundaries remain visible. Retry or open the state's source.";
 }finally{loading=false;$("reloadPrecinctMap").disabled=false;if(!loaded)drawPrecincts();}
}
async function start(){
 const [canvas,svg]=[$("precinctBoundaryMap"),$("countyBoundaryMap")];
 if(!canvas||!svg)return;
 $("precinctGISLink").href=SOURCE;
 $("countyAll").addEventListener("click",()=>chooseCounty(""));
 $("reloadPrecinctMap").addEventListener("click",fetchPrecinctGeography);
 try{
  const r=await fetch("../counties.geojson",{cache:"force-cache"});
  if(!r.ok)throw Error("County GeoJSON "+r.status);
  const data=await r.json();
  if(data.type!=="FeatureCollection"||data.features?.length!==83)throw Error("County file did not contain 83 regions");
  counties=data.features;
  // Michigan county FIPS: 001,003,...165 in alphabetical order.
  const sorted=counties.slice().sort((a,b)=>a.properties.name.localeCompare(b.properties.name));
  // Michigan's FIPS sequence puts "St." immediately after Saginaw, before
  // Sanilac (not the position produced by ordinary JavaScript collation).
  const saint=sorted.filter(c=>c.properties.name.startsWith("St."));
  const other=sorted.filter(c=>!c.properties.name.startsWith("St."));
  const insert=other.findIndex(c=>c.properties.name==="Sanilac");
  if(saint.length!==2||insert<0)throw Error("Unexpected Michigan county order");
  other.splice(insert,0,...saint);
  other.forEach((c,i)=>byFips.set(String(1+2*i).padStart(3,"0"),c.properties.name));
  drawCounties();drawPrecincts();
  const idle=window.requestIdleCallback||((fn)=>setTimeout(fn,1200));
  idle(()=>fetchPrecinctGeography(),{timeout:4000});
 }catch(e){
  $("countyMapStatus").textContent="County boundary file unavailable: "+e.message;
  $("precinctMapStatus").textContent="Waiting for the county boundary map.";
 }
}
window.addEventListener("ervin:results",e=>{
 results=Array.isArray(e.detail?.precincts)?e.detail.precincts:[];
 drawCounties();
 if(loaded)drawPrecincts();
});
document.addEventListener("DOMContentLoaded",start,{once:true});
})();
