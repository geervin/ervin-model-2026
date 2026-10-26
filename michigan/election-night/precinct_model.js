/* Verified historical 2024 Michigan Senate precinct returns.
 * Matches MUST be unique on both sides of a 2024 -> 2026 name crosswalk.
 * County fallback is deliberately disclosed as a different accuracy tier.
 */
(()=>{"use strict";
const SOURCE="./precinct_history_2024.json";
const norm = raw=>{
 let x=String(raw||"").toLowerCase().replace(/[’']/g,"").replace(/\bprecinct\b|\bpct\b/g," pct ");
 x=x.replace(/\bcharter township of\s+([a-z0-9 -]+?)(?=,| pct | ward |$)/g,"$1 twp")
  .replace(/\btownship of\s+([a-z0-9 -]+?)(?=,| pct | ward |$)/g,"$1 twp")
  .replace(/\bcity of\s+([a-z0-9 -]+?)(?=,| pct | ward |$)/g,"$1 city")
  .replace(/\bvillage of\s+([a-z0-9 -]+?)(?=,| pct | ward |$)/g,"$1 village")
  .replace(/\bcharter township\b|\btownship\b|\btwp\b/g," twp ")
  .replace(/\bcity\b/g," city ").replace(/\bvillage\b/g," village ")
  .replace(/\bward\b/g," ward ");
 // Geographic terms must remain present: ward/pct numbers protect split precincts.
 x=x.replace(/[^a-z0-9]+/g," ").replace(/\b0+([1-9]\d*)\b/g,"$1").replace(/\s+/g," ").trim();
 return x;
};
const clamp=x=>Math.max(.01,Math.min(.99,x));
const logit=x=>Math.log(clamp(x)/(1-clamp(x)));
const logistic=x=>1/(1+Math.exp(-x));
const isSpecial=p=>/\b(absentee|avcb|early voting|early vote|provisional|central count|mail in)\b/i.test(p||"");
function build(featureRows, byCounty2024, countyForFeature) {
 const historic=new Map(),geometry=new Map(),recs=new Map(),diagnostics={features:featureRows.length,matched:0,unmatched:0,ambiguous:0,lowSample:0,countyUnavailable:0,countiesMatched:[],source:"OpenElections 2024 Michigan U.S. Senate precinct compilation"};
 const uniqueNames=new Set(),counties=new Set();
 for(const [county, precincts] of Object.entries(byCounty2024||{})){
  for(const record of precincts){
   if(isSpecial(record.p)||!Number.isInteger(record.d)||!Number.isInteger(record.r)||record.d<0||record.r<0)continue;
   const key=county.toLowerCase()+"|"+norm(record.p);
   const values=historic.get(key)||[];
   values.push(record);historic.set(key,values);
  }
 }
 const aliases=f=>{
  const p=f.properties||{};
  return [...new Set([p.Precinct_Long_Name,p.Precinct_Short_Name,p.NAME,p.Precinct].filter(Boolean).map(norm).filter(Boolean))];
 };
 for(const f of featureRows){
  const county=countyForFeature(f);
  if(!county)continue;
  for(const alias of aliases(f)){
   const key=county.toLowerCase()+"|"+alias;
   const matches=geometry.get(key)||[];matches.push(f);geometry.set(key,matches);
  }
 }
 for(const f of featureRows){
  const county=countyForFeature(f),p=f.properties||{};
  if(!county){diagnostics.countyUnavailable++;continue;}
  const keys=aliases(f).map(alias=>county.toLowerCase()+"|"+alias);
  // A historical precinct may be identified by more than one alias, but it
  // cannot attach to more than one new geometry or one ambiguous historical row.
  let candidates=new Map(),ambiguous=false;
  for(const key of keys){
   const old=historic.get(key)||[],current=geometry.get(key)||[];
   if(old.length>1||current.length>1){ambiguous=true;continue;}
   if(old.length===1&&current.length===1)candidates.set(old[0].p,old[0]);
  }
  if(candidates.size!==1){diagnostics[candidates.size>1||ambiguous?"ambiguous":"unmatched"]++;continue;}
  const historical=[...candidates.values()][0],total=historical.d+historical.r;
  if(total<60){diagnostics.lowSample++;continue;}
  const record={county,precinctName:String(p.Precinct_Long_Name||p.Precinct_Short_Name||historical.p),
    historicalPrecinct:historical.p,historicDem:historical.d,historicRep:historical.r,
    historicTwoPartyDem:historical.d/total,historyVotes:total,matchType:"unique_normalized_name",
    historySource:"OpenElections 2024 Michigan U.S. Senate"};
  recs.set(f,record);diagnostics.matched++;counties.add(county);
 }
 diagnostics.countiesMatched=[...counties].sort();
 return {records:recs,diagnostics};
}
function project(historic,countyModel){
 const prior=clamp(countyModel.baselineDemShare);
 const target=clamp(countyModel.demShare);
 // Limit any singular precinct's 2024 deviation for unstable small samples.
 const n=historic.historyVotes,weight=n/(n+180);
 const smoothed=(historic.historicDem+prior*80)/(n+80);
 const deviation=Math.max(-2.3,Math.min(2.3,logit(smoothed)-logit(prior)));
 return clamp(logistic(logit(target)+weight*deviation));
}
async function download(){
 const response=await fetch(SOURCE,{cache:"force-cache"});
 if(!response.ok)throw Error("Historical precinct source HTTP "+response.status);
 const data=await response.json();
 if(data.version!==1||data.election!=="2024-11-05"||data.office!=="U.S. Senate"||Object.keys(data.counties||{}).length!==83)
  throw Error("Precinct historical election data failed validation");
 window.ERVIN_PRECINCT_HISTORY={build,project,norm,source:data.sourceUrl,diagnostics:data.diagnostics,counties:data.counties};
 window.dispatchEvent(new CustomEvent("ervin:precinct-history-ready",{detail:{source:data.sourceUrl}}));
}
download().catch(error=>{
 window.dispatchEvent(new CustomEvent("ervin:precinct-history-error",{detail:{reason:String(error.message)}}));
});
})();