/* County-informed precinct outlook — same Original Ervin county model inputs
   as Michigan dashboard.js. This does NOT estimate individual precinct votes:
   all 2026 precinct polygons inherit their COUNTY's modeled two-party share.
   A verified county-wide tally overrides that county's scenario share.
   Absence of historical current-boundary precinct votes forbids local variation.
*/
(()=>{"use strict";
const KEY="window.ERVIN_DATA = ";
const clamp=x=>Math.max(0,Math.min(1,x));
const mean=x=>(x.d-x.r)/x.total;
const other=x=>Math.max(0,1-(x.d+x.r)/x.total);
const dateText=x=>String(x||"");
function sourceValue(mi){
 // Match Michigan dashboard's four-publisher Ervin Take weighted blend.
 const weights={rcp:.40,ddhq:.29,win270:.21,silver:.10};
 const found=[],seen=new Set();
 for(const [id,weight] of Object.entries(weights)){
  const o=mi.sources?.[id];
  if(!o||o.proxy||!Number.isFinite(Number(o.value)))continue;
  const identity=String(o.publisherId||o.origin||id).trim().toLowerCase();
  if(seen.has(identity))continue;seen.add(identity);
  const raw=String(o.date||"");
  const date=Date.parse(/\b20\d{2}\b/.test(raw)?raw:raw+", 2026");
  const age=Number.isFinite(date)?Math.max(0,(Date.now()-date)/86400000):21;
  found.push({v:Number(o.value),w:weight*Math.max(.50,Math.exp(-age/35))});
 }
 const w=found.reduce((sum,x)=>sum+x.w,0);
 if(!w)throw Error("No attributable current Michigan statewide polling average");
 return Math.round(found.reduce((sum,x)=>sum+x.v*x.w,0)/w*100)/100;
}
function derive(counties,mi){
 const target=(sourceValue(mi)-(Number(mi.correction)||0))/100; // Original Ervin
 const base=counties.map(c=>{
  const sen=c.senate2024,gov=c.governor2022,pres=c.president2024;
  if(!sen||!gov||!pres||!sen.total||!gov.total||!pres.total)throw Error("Missing historical county data");
  const m=.55*mean(sen)+.25*mean(gov)+.20*mean(pres);
  const o=clamp(.55*other(sen)+.25*other(gov)+.20*other(pres));
  const turnout=Math.max(1,Math.round(.70*gov.total+.30*sen.total));
  return {county:c.name,total:turnout,base:m,other:o,
          lastSenateMargin:100*mean(sen)};
 });
 function weighted(offset){
  let net=0,total=0;
  for(const x of base){net+=x.total*Math.max(-1+x.other,Math.min(1-x.other,x.base+offset));total+=x.total;}
  return net/total;
 }
 let lo=-2,hi=2;
 for(let i=0;i<55;i++){const mid=(lo+hi)/2;if(weighted(mid)<target)lo=mid;else hi=mid;}
 const swing=(hi+lo)/2;
 return base.map(x=>{
  const margin=Math.max(-1+x.other,Math.min(1-x.other,x.base+swing));
  // Two-party margin excludes modeled other voters. This is ONLY a geographic
  // share visualization, not a prediction of precinct vote counts.
  const share=clamp((1+margin/(1-x.other))/2);
  return {county:x.county,demShare:share,margin:100*margin,
          twoPartyMargin:100*(2*share-1),lastSenateMargin:x.lastSenateMargin,
          method:"original_ervin_county_model",year:2026};
 });
}
async function load(){
 const [historyResponse,modelResponse]=await Promise.all([
  fetch("../county_history.json",{cache:"force-cache"}),
  fetch("../../index.html",{cache:"no-store"})]);
 if(!historyResponse.ok||!modelResponse.ok)throw Error("Current county model inputs unavailable");
 const history=await historyResponse.json(),html=await modelResponse.text();
 if(history.counties?.length!==83)throw Error("County baseline does not cover 83 counties");
 const sum=k=>history.counties.reduce((n,c)=>n+c.senate2024[k],0);
 if(sum("d")!==2712686||sum("r")!==2693680)throw Error("Historical Senate statewide audit mismatch");
 const pos=html.indexOf(KEY),end=html.indexOf(";\n\n</script><script>",pos);
 if(pos<0||end<pos)throw Error("Could not resolve national model data");
 const config=JSON.parse(html.slice(pos+KEY.length,end));
 const mi=config.states?.find(x=>x.code==="MI");
 if(!mi)throw Error("Michigan statewide forecast unavailable");
 const forecasts=derive(history.counties,mi);
 window.dispatchEvent(new CustomEvent("ervin:county-outlook",{
  detail:{counties:forecasts,asOf:dateText(config.liveMeta?.checkedAt||config.asof),
          method:"Original Ervin / historical 2024 Senate, 2024 President, 2022 Governor"}}));
}
load().catch(error=>{
 const status=document.getElementById("precinctMapStatus");
 if(status)status.textContent="County-informed outlook unavailable: "+error.message+" · verified precinct mode remains available.";
 window.dispatchEvent(new CustomEvent("ervin:county-outlook-error",{detail:{reason:String(error.message)}}));
});
})();
