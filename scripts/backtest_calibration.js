/* Past-only evaluation of pooled 2016–2024 polling-error model. */
const fs=require("node:fs"),path=require("node:path");
const {calibrate}=require("./calibration_engine.js");
const root=path.join(__dirname,".."),data=JSON.parse(fs.readFileSync(path.join(root,"research/calibration_events_2016_2024.json"),"utf8")).events;
const sample=[];
for(const e of data){
 if(e.year<2018)continue;
 const model=calibrate(data,e.state,e.year);
 const delta=e.error-model.correction;
 sample.push({year:e.year,state:e.state,office:e.office,nPollsters:e.nPollsters??"curated",observedError:e.error,priorCorrection:+model.correction.toFixed(3),rawAbsError:+Math.abs(e.error).toFixed(3),correctedAbsError:+Math.abs(delta).toFixed(3),rawSqError:+(e.error*e.error).toFixed(3),correctedSqError:+(delta*delta).toFixed(3)});
}
function metrics(rows){const n=rows.length;if(!n)return {n:0};const sum=(key)=>rows.reduce((z,r)=>z+r[key],0);return {n,rawMAE:sum("rawAbsError")/n,pooledMAE:sum("correctedAbsError")/n,rawRMSE:Math.sqrt(sum("rawSqError")/n),pooledRMSE:Math.sqrt(sum("correctedSqError")/n)}}
const report={createdAt:"2026-10-23",eventsAvailable:data.length,backtest:metrics(sample),byYear:Object.fromEntries([2018,2020,2022,2024].map(y=>[y,metrics(sample.filter(e=>e.year===y))])),byOffice:Object.fromEntries(["Senate","President"].map(office=>[office,metrics(sample.filter(e=>e.office===office))])),note:"Conservative pre-year training; common-cycle poll error and repeated polling sources are correlated; no 2024 curated presidential polling for every state; no promise of calibrated 80/90% forecast intervals. Candidate-specific Alaska, Nebraska, South Dakota overlays are NOT validated by this general D/R test."};
const enc=x=>'"'+String(x).replaceAll('"','""')+'"';
const keys=["year","state","office","nPollsters","observedError","priorCorrection","rawAbsError","correctedAbsError","rawSqError","correctedSqError"];
fs.writeFileSync(path.join(root,"research/calibration_walkforward_2016_2024.csv"),[keys.map(enc).join(","),...sample.map(r=>keys.map(k=>enc(r[k])).join(","))].join("\n")+"\n");
fs.writeFileSync(path.join(root,"research/calibration_backtest_summary.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
