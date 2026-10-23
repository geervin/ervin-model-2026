/* Ervin + 2016–24 partially pooled calibration. Reusable in browser & Node.
   Historical events come from research/calibration_events_2016_2024.json.
   Past-only training for any target year; no target-year data used. */
(function(root){
 "use strict";
 const REGIONS={ME:"Northeast",NH:"Northeast",MI:"Midwest",OH:"Midwest",IA:"Midwest",KS:"Midwest",MN:"Midwest",NE:"Midwest",SD:"Midwest",TX:"South",GA:"South",NC:"South",SC:"South",MS:"South",FL:"South",AK:"West",MT:"West"};
 const clip=(v,a,b)=>Math.max(a,Math.min(b,v));
 function groups(events,year){
  const by=new Map();
  for(const e of events){
   if(e.year>=year||!REGIONS[e.state]||!Number.isFinite(e.error))continue;
   const kind=e.office==="Senate"?1:e.office==="President"?.65:.5;
   const quality=e.nPollsters==null?.55:clip(Math.sqrt(e.nPollsters/6),.45,1);
   const recency=Math.exp(-(year-e.year)/7);
   const k=e.state+"|"+e.year;
   const item={state:e.state,year:e.year,err:e.error,w:kind*quality*recency};
   if(!by.has(k))by.set(k,[]);
   by.get(k).push(item);
  }
  const result=[];
  for(const [k,parts] of by){
   // Each state and election year is one cluster irrespective of concurrent offices.
   const sw=parts.reduce((z,x)=>z+x.w,0);
   if(!sw)continue;
   const combined=parts.reduce((z,x)=>z+x.err*x.w,0)/sw;
   const [state,cycle]=k.split("|");
   result.push({state,year:+cycle,error:combined,weight:Math.min(1,sw/parts.length),region:REGIONS[state]});
  }
  return result;
 }
 const mean=(groups, fallback=0)=>{
   let sw=groups.reduce((z,x)=>z+x.weight,0);
   return sw?groups.reduce((z,x)=>z+x.error*x.weight,0)/sw:fallback;
 };
 function calibrate(events, code,year=2026){
   const all=groups(events,year);
   // Equalize state contributions to the national baseline, rather than letting
   // highly polled or unusually frequent Senate states dominate.
   const states=[...new Set(all.map(e=>e.state))];
   const perState=states.map(st=>{
     const es=all.filter(e=>e.state===st),v=mean(es);
     return {state:st,region:REGIONS[st],error:v,weight:1};
   });
   // Exclude target state from the common-state prior to avoid reusing its
   // estimate as both prior and likelihood.
   const others=perState.filter(e=>e.state!==code);
   const national=mean(others,0),sameRegion=others.filter(e=>e.region===REGIONS[code]);
   const regional=sameRegion.length>=2?mean(sameRegion,national):national;
   const prior=.75*national+.25*regional;
   const own=all.filter(e=>e.state===code);
   const stateMean=mean(own,prior);
   const cycles=new Set(own.map(e=>e.year)).size;
   const shrink=cycles/(cycles+4);
   const pooled=prior+shrink*(stateMean-prior);
   // Attenuate retrospective error because out-of-sample tests across cycles
   // show full-strength state corrections are volatile.
   const correction=clip(.40*pooled,-6,6);
   return {correction,pooled,prior,national,regional,stateMean,cycles,shrink,events:own.length};
 }
 function candidateCorrection(r,standard){
   const code=r.code;
   if(code==="MT"&&r.history_mode==="not_comparable")return {...standard,correction:0,method:"Incomparable independent-versus-party matchup; no transferred D/R correction"};
   if(code==="AK"){
     // Include Peltola House 2022/24 and Sullivan Senate 2020 + 2024 presidential
     // candidate-specific evidence; the website's existing audited weighted
     // estimate is still a separate signal.
     const old=Array.isArray(r.historical)?r.historical:[];
     const hs=old.map(h=>{
       const kind=String(h.kind||"").toLowerCase();
       const q=/partisan|campaign/.test(kind)?.55:/single|one poll/.test(kind)?.68:/aggregate|average/.test(kind)?1:.82;
       const off=h.office==="Senate"?1:h.office==="House"?.78:.52;
       const cc=h.office==="House"?1.35:h.office==="Senate"?.60:.35;
       return {...h,w:(Number(h.weight)||0)*q*off*cc};
     });
     const per={};for(const h of hs)per[h.year]=(per[h.year]||0)+1;
     for(const h of hs)h.w/=per[h.year]||1;
     const total=hs.reduce((z,x)=>z+x.w,0);
     const baseline=total?hs.reduce((z,x)=>z+x.err*x.w,0)/total:0;
     const recent=hs.filter(h=>h.year>=2022);
     const sw=recent.reduce((z,x)=>z+x.w,0);
     const trend=sw?recent.reduce((z,x)=>z+x.err*x.w,0)/sw:baseline;
     const direct=.7*baseline+.3*trend;
     return {...standard,correction:clip(.7*direct+.3*standard.correction,-6,6),candidateComponent:direct,method:"70% repeat-candidate / incumbency evidence, 30% pooled statewide baseline; RCV caution"};
   }
   if(code==="NE"&&r.history_mode==="candidate_repeat")
     return {...standard,correction:clip(.55*Number(r.correction)+.45*standard.correction,-6,6),candidateComponent:Number(r.correction),method:"55% Osborn's 2024 Senate error, 45% pooled statewide baseline; different opponent"};
   if(code==="SD"&&r.history_mode==="candidate_repeat")
     return {...standard,correction:clip(.35*clip(Number(r.correction),-8,8)+.65*standard.correction,-6,6),candidateComponent:Number(r.correction),method:"35% capped 2022 Bengs error, 65% pooled baseline; new party label and opponent"};
   return {...standard,method:"Partial pooling across state, region and national baselines"};
 }
 function forecast(events,r,year=2026){return candidateCorrection(r,calibrate(events,r.code,year));}
 const engine={calibrate,forecast,groups,REGIONS};
 if(typeof module!=="undefined"&&module.exports)module.exports=engine;
 root.ERVIN_ENGINE=engine;
})(typeof window!=="undefined"?window:globalThis);
