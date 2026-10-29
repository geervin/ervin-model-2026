/* Senate-control scenario simulator. Uses the currently selected Ervin-adjusted
 * margins; probabilities are HEURISTIC sensitivity indicators, not fitted or
 * independently calibrated election win probabilities. No poll outcomes inferred.
 */
(function(root){"use strict";
const BASE_D=47,BASE_R=53;
const HOLD_D=new Set(["MI","GA","NH","MN"]);
const INDEPENDENT=new Set(["NE","SD","MT"]);
const THREE_WAY=["D","R","I"];
function randomGenerator(seed){let x=(seed|0)||2463534242;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function normal(next){const u=Math.max(1e-12,next()),v=next();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function percentile(sorted,p){return sorted[Math.min(sorted.length-1,Math.max(0,Math.floor(p*(sorted.length-1))))];}
function project(entries,opts={}){
 const N=opts.trials||14000, common=opts.commonSigma??2.8, uncertain=opts.uncertaintyMultiplier??1;
 if(!Array.isArray(entries)||entries.length!==17)throw Error("The 17-state race board is required for the seat forecast");
 const codes=entries.map(x=>x.code);
 if(new Set(codes).size!==17||entries.some(x=>!Number.isFinite(x.margin)))throw Error("Missing or invalid Senate race inputs");
 const races=entries.map(e=>({code:e.code,margin:e.margin,
   residual:Math.sqrt(Math.max(1,Math.pow(Math.min(11.5,Math.max(5.2,e.sigma||7))*uncertain,2)-Math.pow(common*uncertain,2)))}));
 const next=randomGenerator(1772026+Math.round(uncertain*100)+(opts.sourceSeed||0));
 const ds=[],rs=[],ind=[],totals={D:0,R:0,I:0},wins=new Map(codes.map(c=>[c,0]));
 for(let iteration=0;iteration<N;iteration++){
  let dem=BASE_D,rep=BASE_R,independent=0;
  const national=normal(next)*common*uncertain;
  for(const r of races){
   const score=r.margin+national+normal(next)*r.residual;
   const nonR=score>0;
   if(nonR)wins.set(r.code,wins.get(r.code)+1);
   if(HOLD_D.has(r.code)){if(!nonR){dem--;rep++;}}
   else if(nonR){
    rep--;
    if(INDEPENDENT.has(r.code))independent++;
    else dem++;
   }
  }
  if(dem+rep+independent!==100)throw Error("Senate seat totals did not conserve 100 seats");
  ds.push(dem);rs.push(rep);ind.push(independent);
  if(dem>=51)totals.D++;
  else if(rep>=50)totals.R++; // Republican vice president breaks a 50/50 tie
  else totals.I++; // Independent caucus decisions unresolved
 }
 const average=x=>x.reduce((a,b)=>a+b,0)/x.length;
 const interval=x=>{const sorted=[...x].sort((a,b)=>a-b);return [percentile(sorted,.10),percentile(sorted,.90)];};
 return {partyD:totals.D/N,partyR:totals.R/N,uncertain:totals.I/N,
  demSeats:average(ds),repSeats:average(rs),otherSeats:average(ind),
  demRange:interval(ds),repRange:interval(rs),otherRange:interval(ind),
  chanceByRace:Object.fromEntries([...wins].map(([code,count])=>[code,count/N])),
  assumptions:{baseDem:BASE_D,baseRep:BASE_R,tracked:17,unmodeledSeats:18,commonSigma:common*uncertain,
  label:"Heuristic 14,000-draw national-swing plus state residual simulation; untracked seats presumed held; unknown new independent caucuses not allocated."}};
}
root.ERVIN_SENATE_CONTROL=Object.freeze({project});
})(window);
