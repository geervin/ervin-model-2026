/* Michigan 2026 election-night geography. No speculative votes.
 * Counties: site-hosted 83-county historical boundary dataset.
 * Precincts: Michigan BOE's 2026 hosted ArcGIS polygons (NOT 2024 precincts).
 * Geography is loaded independently of election results, on idle.
 */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const GIS="https://services3.arcgis.com/dxRQUfTDNtfqZ301/arcgis/rest/services/2026_Voting_Precincts/FeatureServer/0";
const SOURCE="https://www.arcgis.com/home/item.html?id=c349bc2bb6c2468594d341a09f520ea8";
const W=880,H=680,BOUNDS=[-90.85,41.4,-81.8,48.75];
let counties=[],features=[],selected="",results=[],officialCountyResults=[],outlooks=new Map(),outlookAt="",precinctLayer="outlook",loaded=false,loading=false,lastRender=0,precinctJoin=null,activePrecinct=null,hitAreas=[],selectedGeometry=null,hoverFrame=0;
const normalize=x=>String(x||"").trim().toLowerCase().replace(/\b(precinct|pct|ward|city|township|town|charter)\b/g,"").replace(/[^a-z0-9]/g,"");
const byCounty=new Map(),byFips=new Map();
const fmt=x=>Number(x||0).toLocaleString("en-US");
const pct=x=>(x*100).toFixed(1)+"%";
function countyOfFeature(f){
 const p=f.properties||{},fips=String(p.COUNTYFIPS||p.CountyFips||p.countyfips||"").padStart(3,"0");
 return byFips.get(fips)||"";
}
function displayName(f){
 const p=f.properties||{};
 return String(p.Precinct_Long_Name||p.Precinct_Short_Name||p.NAME||p.Precinct||"Unnamed precinct");
}
function constructJoin(){
 const lib=window.ERVIN_PRECINCT_HISTORY;
 if(!lib||!loaded)return;
 precinctJoin=lib.build(features,lib.counties,countyOfFeature);
 const d=precinctJoin.diagnostics;
 $("precinctGeometryCount").textContent=fmt(features.length)+" precinct boundaries · "+fmt(d.matched)+" uniquely matched to 2024 returns";
 $("precinctInspectSummary").textContent="Historical source matched "+fmt(d.matched)+" of "+fmt(d.features)+" current precinct polygons by unique names in both datasets. Different-year boundaries can change; unmatched precincts fall back to a county-level estimate.";
 if(activePrecinct)showPrecinct(activePrecinct);
 drawPrecincts();
}
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
 // Clerk county-wide totals OVERRIDE any precinct subtotal (never add).
 for(const row of officialCountyResults){
   map.set(String(row.county||"").toLowerCase(),{d:row.dem,r:row.rep,n:0,countyWide:true});
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
  const title=document.createElementNS(ns,"title");title.textContent=name+(reported?` · ${reported.countyWide?"County-wide clerk tally":fmt(reported.n)+" precinct units"}; D ${fmt(reported.d)}, R ${fmt(reported.r)}`:" · not yet reported");
  el.append(title);
  const onSelect=()=>chooseCounty(name);
  el.addEventListener("click",onSelect);
  el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect();}});
  fragment.append(el);
 }
 svg.append(fragment);
 $("countyMapStatus").textContent=`${counties.length} Michigan counties · ${counted.size} with verified county or precinct figures · select a county for source and candidates`;
}
function chooseCounty(name){
 if(selected!==name){activePrecinct=null;}
 selected=name;
 $("mapCountySelection").textContent=name||"Statewide";
 $("countyAll").disabled=!name;
 drawCounties();drawPrecincts();
 refreshPrecinctPicker();
 if(!activePrecinct)clearPrecinctInspector();
 try{
  const url=new URL(location.href);
  if(name)url.searchParams.set("county",name);else url.searchParams.delete("county");
  history.replaceState(null,"",url.pathname+url.search+url.hash);
 }catch{}
 window.dispatchEvent(new CustomEvent("ervin:county-select",{detail:{county:name}}));
}
function uniqueActualRecord(f){
 const countyName=countyOfFeature(f),p=f.properties||{};
 const options=[p.Precinct_Short_Name,p.Precinct_Long_Name,p.PRECINCTID,p.Precinct,p.NAME]
  .filter(Boolean).map(v=>countyName.toLowerCase()+"|"+normalize(v));
 const hits=[];
 for(const row of results){
  if(row.county.toLowerCase()!==countyName.toLowerCase())continue;
  if(options.includes(row.county.toLowerCase()+"|"+normalize(row.precinct)))hits.push(row);
 }
 return hits.length===1?hits[0]:null;
}
function precinctModel(f,layer=precinctLayer){
 const countyName=countyOfFeature(f),record=outlooks.get(countyName),history=precinctJoin?.records.get(f)||null,
       source=outlookFor(countyName,layer);
 if(!source)return {share:null,history,source:null,tier:"No validated county outlook"};
 let share=source.share,tier=source.kind;
 if(layer==="baseline"){
  if(history){share=history.historicTwoPartyDem;tier="Matched 2024 precinct history";}
  else{tier="2024 county baseline · unmatched precinct";}
 }else if(layer==="outlook"){
  if(history&&record&&window.ERVIN_PRECINCT_HISTORY){
   share=window.ERVIN_PRECINCT_HISTORY.project(history,{...record,demShare:source.share});
   tier=source.kind.includes("clerk")?"2024 precinct pattern + reported county swing":"2024 precinct pattern + 2026 county outlook";
  }else tier=source.kind+" · county-only fallback";
 }
 return {share,history,source,tier};
}
function clearPrecinctInspector(){
 $("precinctInspectTitle").textContent="Click a precinct to inspect";
 $("precinctMatchTier").textContent=precinctJoin?"SELECT A PRECINCT":"2024 HISTORY MATCH PENDING";
 $("precinctProjectDem").textContent="—";$("precinctProjectRep").textContent="—";
 $("precinctHistoryDem").textContent="—";$("precinctHistoryRep").textContent="—";
 $("precinctDataMethod").textContent=precinctJoin?"Select a 2026 boundary to inspect matched history and model assumptions.":"Historical precinct matching has not finished.";
}
function showPrecinct(f){
 if(!f)return;
 activePrecinct=f;
 const county=countyOfFeature(f),historic=precinctJoin?.records.get(f)||null;
 const p=f.properties||{},name=displayName(f);
 const record=precinctModel(f,"outlook"),actual=uniqueActualRecord(f);
 $("precinctInspectTitle").textContent=(county?county+" · ":"")+name;
 $("precinctMatchTier").textContent=historic?"2024 HISTORY · UNIQUE MATCH":"COUNTY-ONLY MODEL · NO MATCH";
 const share=record.share;
 $("precinctProjectDem").textContent=share==null?"—":pct(share);
 $("precinctProjectRep").textContent=share==null?"—":pct(1-share);
 $("precinctHistoryDem").textContent=historic?fmt(historic.historicDem):"—";
 $("precinctHistoryRep").textContent=historic?fmt(historic.historicRep):"—";
 const extra=actual?" Verified 2026 precinct return: El-Sayed "+fmt(actual.dem)+", Rogers "+fmt(actual.rep)+" (reported, separate from projection).":" No verified 2026 result for this individual precinct.";
 $("precinctInspectSummary").textContent=historic?
  "Matched to 2024 reporting unit “"+historic.historicalPrecinct+"”. Its 2024 Slotkin–Rogers pattern is shifted toward the county’s 2026 model or verified county-wide two-party share. This is a modeled percentage—not actual 2026 precinct votes."+extra:
  "No defensible one-to-one match to 2024 results was found. Only the county-wide share is available. It is a proxy, not an individual precinct prediction."+extra;
 $("precinctDataMethod").textContent=(historic?"2024 major-party votes: "+fmt(historic.historyVotes)+" · unique-name match; unallocated absentee/early votes may make this incomplete.":"2024 crosswalk unmatched or changed boundaries; county fallback.")+
  (record.source?" · "+record.tier:" · no county share available");
 $("precinctHistorySource").href=window.ERVIN_PRECINCT_HISTORY?.source||
   "https://github.com/openelections/openelections-data-mi/blob/master/2024/20241105__mi__general__precinct.csv";
 const picker=$("precinctPicker");if(picker){
  const idx=features.indexOf(f);
  if(idx>=0&&[...picker.options].some(o=>o.value===String(idx)))picker.value=String(idx);
 }
 // A small outline is drawn on the 2026 geometry; no synthetic votes are written.
 drawPrecincts();
}
function refreshPrecinctPicker(){
 const control=$("precinctPicker");if(!control)return;
 control.replaceChildren(new Option(selected?"Select a precinct in "+selected:"Select a county first, or click a precinct",""));
 if(!loaded)return;
 const listing=[];
 for(let i=0;i<features.length;i++){
  if(selected&&countyOfFeature(features[i])!==selected)continue;
  if(!selected)continue; // 4K worldwide dropdown is unusable; select county first
  listing.push({idx:i,name:displayName(features[i])});
 }
 listing.sort((a,b)=>a.name.localeCompare(b.name));
 for(const x of listing)control.add(new Option(x.name,String(x.idx)));
 control.value=activePrecinct?String(features.indexOf(activePrecinct)):"";
}
function coordinate(e,canvas){
 const rect=canvas.getBoundingClientRect();
 return [(e.clientX-rect.left)*W/rect.width,(e.clientY-rect.top)*H/rect.height];
}
function precinctAt(e){
 const canvas=$("precinctBoundaryMap"),ctx=canvas.getContext("2d");
 const [x,y]=coordinate(e,canvas);
 for(let i=hitAreas.length-1;i>=0;i--){
  const hit=hitAreas[i];
  if(ctx.isPointInPath(hit.path,x,y))return hit.feature;
 }
 return null;
}
function canvasClick(e){
 if(!loaded)return;
 const hit=precinctAt(e);if(!hit)return;
 const county=countyOfFeature(hit);
 if(county!==selected)chooseCounty(county);
 showPrecinct(hit);
 const tip=$("precinctHoverLabel");if(tip)tip.hidden=true;
}
function canvasHover(e){
 if(!loaded||!selected||e.pointerType==="touch")return;
 const hover=$("precinctHoverLabel");if(!hover)return;
 const f=precinctAt(e);
 if(!f){hover.hidden=true;return;}
 const h=precinctJoin?.records.get(f),name=displayName(f);
 hover.textContent=name+" · "+(h?"2024 precinct match · click for local projection":"County-only estimate · click for detail");
 hover.hidden=false;
 const box=$("precinctBoundaryMap").getBoundingClientRect(),parent=$("precinctBoundaryMap").parentElement.getBoundingClientRect();
 hover.style.left=Math.min(parent.width-210,Math.max(7,e.clientX-parent.left+12))+"px";
 hover.style.top=Math.min(parent.height-42,Math.max(7,e.clientY-parent.top+12))+"px";
}

function outlookFor(name,layer=precinctLayer){
 const record=outlooks.get(name);
 const official=officialCountyResults.find(x=>x.county===name);
 if(layer==="baseline")return record?{share:record.baselineDemShare,kind:"2024 historic county baseline"}:null;
 if(official&&official.dem+official.rep>0)return{share:official.dem/(official.dem+official.rep),kind:"2026 clerk county-wide share proxy"};
 return record?{share:record.demShare,kind:"2026 county forecast proxy"}:null;
}
function shareFill(share){
 const strength=Math.min(1,Math.abs(share-.5)/.34),light=48-19*strength;
 return share>=.5?`hsl(211 60% ${light}%)`:`hsl(351 56% ${light}%)`;
}
function layerCaption(){
 const label=$("precinctDisplayLabel"),legend=$("precinctLegend"),method=$("precinctModelMethod");
 if(precinctLayer==="actual"){
  label.textContent="ACTUAL · VERIFIED PRECINCT UNITS";
  method.textContent="VERIFIED RETURNS: Grey polygons have no exact unique reporting-unit match. Other polygons show votes actually attributed to that precinct.";
  legend.innerHTML='<span><b></b>No matched result</span><span><b class="dem"></b>Verified D lead</span><span><b class="rep"></b>Verified R lead</span>';
 }else if(precinctLayer==="baseline"){
  label.textContent="HISTORY · 2024 COUNTY SENATE";
  method.textContent="HISTORICAL COUNTY PROXY: All precinct polygons within a county receive its 2024 county Senate two-party share. These are NOT the actual results of each precinct.";
  legend.innerHTML='<span><b></b>County data unavailable</span><span><b class="dem"></b>2024 county D share</span><span><b class="rep"></b>2024 county R share</span>';
 }else{
  label.textContent="MODEL · NOT PRECINCT RETURNS";
  method.textContent="COUNTY PROXY: Each precinct polygon inherits the county-level 2026 Ervin outlook (or its newer verified county-wide share). No individualized precinct totals or winner predictions are made.";
  legend.innerHTML='<span><b></b>County information unavailable</span><span><b class="dem"></b>County-based D outlook</span><span><b class="rep"></b>County-based R outlook</span>';
 }
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
  ctx.lineWidth=.9;ctx.strokeStyle="#5c7185";
  for(const c of visibleCounties){
    const estimate=precinctLayer!=="actual"?outlookFor(c.properties.name):null;
    ctx.fillStyle=estimate?shareFill(estimate.share):"#172c3e";
    const shape=new Path2D(path(c.geometry,box));ctx.fill(shape);ctx.stroke(shape);
  }
  tip.textContent=loading?"Loading official 2026 precinct geometry…":(precinctLayer==="actual"?
    "Exact reporting-unit polygons unavailable; neutral county boundaries are shown.":
    "Displaying county-level shares while precinct geometry loads. County color is a proxy, not a precinct result.");
  return;
 }
 let drawn=0,reported=0,projected=0,historicalMatched=0;
 hitAreas=[];
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
  const model=precinctLayer==="actual"?null:precinctModel(f);
  const estimate=model?.share==null?null:{share:model.share};
  if(model?.history)historicalMatched++;
  ctx.fillStyle=precinctLayer==="actual"?
    (matched?(matched.dem>matched.rep?"#275d9b":matched.rep>matched.dem?"#993e50":"#65596b"):"#1b3346"):
    (estimate?shareFill(estimate.share):"#1b3346");
  ctx.strokeStyle=selected?"#89a0b1":"#7690a3";
  ctx.lineWidth=selected?.62:.28;
  ctx.fill(shape);ctx.stroke(shape);drawn++;
  hitAreas.push({feature:f,path:shape});
  if(matched)reported++;
  if(estimate)projected++;
 }
 // Outline the pinned precinct on top of county boundaries.
 if(activePrecinct&&hitAreas.some(x=>x.feature===activePrecinct)){
  const poly=hitAreas.find(x=>x.feature===activePrecinct);
  ctx.strokeStyle="#ffe5a8";ctx.lineWidth=2.25;
  ctx.stroke(poly.path);
 }
 // Draw selected county outline prominently, or statewide boundaries softly.
 ctx.strokeStyle="#d9bd85";ctx.lineWidth=selected?2:1.1;
 for(const c of visibleCounties)ctx.stroke(new Path2D(path(c.geometry,box)));
 if(precinctLayer==="actual"){
  tip.textContent=`${fmt(drawn)} precinct polygons displayed${selected?" in "+selected:" statewide"} · ${reported} exact reporting-unit matches · ${results.length-reported} return rows not uniquely mapped. Grey does not mean zero votes.`;
 }else{
  const county=selected?outlookFor(selected):null;
  const selectedContext=county?" · "+selected+" county-based Democratic two-party share "+(county.share*100).toFixed(1)+"% ("+county.kind+")":"";
  tip.textContent=`${fmt(projected)} of ${fmt(drawn)} precinct polygons shaded · ${fmt(historicalMatched)} with uniquely matched 2024 precinct history · ${fmt(projected-historicalMatched)} county-only fallbacks. ${precinctLayer==="baseline"?"2024 observed precinct share where matched":"2026 county-adjusted precinct outlook where matched"}.${selectedContext} Model percentages are not counted ballots.`;
 }
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
   constructJoin();refreshPrecinctPicker();
   $("precinctGeometryCount").textContent=fmt(features.length)+" precinct boundaries · 2026"+(precinctJoin?" · "+fmt(precinctJoin.diagnostics.matched)+" matched to 2024":" · loading historical match");
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
 $("precinctDisplayMode").addEventListener("change",e=>{
  precinctLayer=e.target.value;layerCaption();drawPrecincts();if(activePrecinct)showPrecinct(activePrecinct);
 });
 const canvas=$("precinctBoundaryMap");
 canvas.addEventListener("click",canvasClick);
 canvas.addEventListener("pointermove",e=>{
  if(hoverFrame)cancelAnimationFrame(hoverFrame);
  hoverFrame=requestAnimationFrame(()=>canvasHover(e));
 });
 canvas.addEventListener("pointerleave",()=>{$("precinctHoverLabel").hidden=true});
 $("precinctPicker").addEventListener("change",e=>{
  const i=Number(e.target.value);
  if(e.target.value!==""&&features[i])showPrecinct(features[i]);
 });
 canvas.addEventListener("keydown",e=>{
  if(e.key!=="Enter"&&e.key!==" ")return;
  e.preventDefault();
  if(activePrecinct)showPrecinct(activePrecinct);
  else $("precinctPicker").focus();
 });
 layerCaption();
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
  const countyParam=new URLSearchParams(location.search).get("county");
  if(countyParam){const found=counties.find(c=>c.properties.name.toLowerCase()===countyParam.toLowerCase());if(found)chooseCounty(found.properties.name)}
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
window.addEventListener("ervin:county-totals",e=>{
 officialCountyResults=Array.isArray(e.detail?.counties)?e.detail.counties:[];
 drawCounties();
 if(precinctLayer==="outlook")drawPrecincts();
 // In the MODEL layer a reported county updates the displayed *county share*
 // for every polygon in that county. This does not create precinct votes.
 // The ACTUAL layer never paints county-wide votes as precinct results.
});
window.addEventListener("ervin:county-outlook",e=>{
 outlooks=new Map((e.detail?.counties||[]).map(c=>[c.county,c]));
 outlookAt=e.detail?.asOf||"";
 if(precinctLayer!=="actual")drawPrecincts();
});
window.addEventListener("ervin:precinct-history-ready",()=>{
 constructJoin();refreshPrecinctPicker();
});
window.addEventListener("ervin:precinct-history-error",e=>{
 $("precinctMatchTier").textContent="NO PRECINCT HISTORY AVAILABLE";
 $("precinctInspectSummary").textContent="Historical precinct source unavailable: "+e.detail?.reason+". County proxy remains available.";
});
window.addEventListener("ervin:county-outlook-error",e=>{
 if(precinctLayer!=="actual")$("precinctMapStatus").textContent="County forecast currently unavailable · switch to verified precinct results or retry. "+e.detail?.reason;
});
document.addEventListener("DOMContentLoaded",start,{once:true});
})();
