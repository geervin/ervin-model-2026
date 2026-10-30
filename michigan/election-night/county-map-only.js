/* County-only Michigan 2026 election night map.
 * Source geometry: locally verified 83 Michigan counties. Reported votes only:
 * county-wide clerk tallies replace, never add to, precinct subtotals.
 * Equirectangular lon*cos(44.5 deg) scale preserves Michigan proportions.
 */
(()=>{"use strict";
const $=id=>document.getElementById(id),NS="http://www.w3.org/2000/svg";
const W=880,H=650,PAD=32,LON_SCALE=Math.cos(44.5*Math.PI/180);
let counties=[],selected="",precinctRows=[],officialRows=[],positions=new Map();
const fmt=x=>Number(x||0).toLocaleString("en-US");
function rings(g){if(!g)return[];return g.type==="Polygon"?g.coordinates||[]:g.type==="MultiPolygon"?(g.coordinates||[]).flat():[]}
function computeProjection(features){
 const pts=features.flatMap(f=>rings(f.geometry)).flat();
 const xs=pts.map(p=>p[0]*LON_SCALE),ys=pts.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min((W-2*PAD)/(maxX-minX),(H-2*PAD)/(maxY-minY));
 const ox=(W-(maxX-minX)*scale)/2,oy=(H-(maxY-minY)*scale)/2;
 return p=>[(p[0]*LON_SCALE-minX)*scale+ox,(maxY-p[1])*scale+oy];
}
function asPath(g,project){
 return rings(g).map(r=>r.map((p,i)=>{const [x,y]=project(p);return(i?"L":"M")+x.toFixed(2)+","+y.toFixed(2)}).join("")+"Z").join("");
}
function tally(){
 const result=new Map();
 for(const row of precinctRows){
  const key=String(row.county||"").toLowerCase(),c=result.get(key)||{d:0,r:0,n:0};
  c.d+=Number(row.dem)||0;c.r+=Number(row.rep)||0;c.n++;result.set(key,c);
 }
 for(const row of officialRows){
  result.set(String(row.county||"").toLowerCase(),{d:Number(row.dem)||0,r:Number(row.rep)||0,n:0,countyWide:true});
 }
 return result;
}
function repaint(){
 const svg=$("countyBoundaryMap");if(!svg||!positions.size)return;
 const byCounty=tally();
 for(const el of svg.querySelectorAll("path[data-county]")){
  const name=el.dataset.county,row=byCounty.get(name.toLowerCase());
  el.classList.remove("reported-d","reported-r","reported-tie","selected");
  if(row)el.classList.add(row.d>row.r?"reported-d":row.d<row.r?"reported-r":"reported-tie");
  if(name===selected)el.classList.add("selected");
  const detail=row?(row.countyWide?"County-wide clerk tally":row.n+" partial reporting units")+
   " · El-Sayed "+fmt(row.d)+" · Rogers "+fmt(row.r):"No verified returns";
  el.setAttribute("aria-label",name+" County · "+detail);
  el.querySelector("title").textContent=name+" County · "+detail;
 }
 $("countyMapStatus").textContent=positions.size+" counties displayed with native geographic proportions · "+
   byCounty.size+" reporting · select or hover for attributed results";
 $("countyAll").disabled=!selected;
}
function select(name){
 if(name&&!positions.has(name))return;
 selected=name;
 repaint();
 const button=$("countyAll");button.setAttribute("aria-label",name?"Clear selected county":"No county selected");
 try{
  const url=new URL(location.href);
  if(name)url.searchParams.set("county",name);else url.searchParams.delete("county");
  history.replaceState(null,"",url.pathname+url.search+url.hash);
 }catch{}
 window.dispatchEvent(new CustomEvent("ervin:county-select",{detail:{county:name}}));
}
async function init(){
 const svg=$("countyBoundaryMap");if(!svg)return;
 $("countyAll").addEventListener("click",()=>select(""));
 try{
  const r=await fetch("../counties.geojson",{cache:"force-cache"});
  if(!r.ok)throw Error("HTTP "+r.status);
  const data=await r.json();if(data.type!=="FeatureCollection"||data.features?.length!==83)throw Error("Expected 83 counties");
  counties=data.features;const project=computeProjection(counties);
  const fragment=document.createDocumentFragment();
  for(const feature of counties){
   const name=feature.properties?.name;if(!name)continue;
   const el=document.createElementNS(NS,"path");el.classList.add("county-shape");
   el.dataset.county=name;el.setAttribute("d",asPath(feature.geometry,project));
   el.setAttribute("tabindex","0");el.setAttribute("role","button");
   const title=document.createElementNS(NS,"title");el.append(title);
   el.addEventListener("click",()=>select(name));
   el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(name)}});
   positions.set(name,el);fragment.append(el);
  }
  svg.setAttribute("viewBox","0 0 "+W+" "+H);
  svg.setAttribute("preserveAspectRatio","xMidYMid meet");
  svg.replaceChildren(fragment);
  const current=new URLSearchParams(location.search).get("county");
  if(current){const hit=[...positions.keys()].find(n=>n.toLowerCase()===current.toLowerCase());if(hit)selected=hit;}
  repaint();
  if(selected)window.dispatchEvent(new CustomEvent("ervin:county-select",{detail:{county:selected}}));
 }catch(err){$("countyMapStatus").textContent="County geometry unavailable: "+err.message;}
}
window.addEventListener("ervin:results",e=>{precinctRows=Array.isArray(e.detail?.precincts)?e.detail.precincts:[];repaint()});
window.addEventListener("ervin:county-totals",e=>{officialRows=Array.isArray(e.detail?.counties)?e.detail.counties:[];repaint()});
document.addEventListener("DOMContentLoaded",init,{once:true});
window.ERVIN_COUNTY_MAP={get countyCount(){return positions.size},get selected(){return selected},select};
})();
