/* Validate historical evidence synchronization and live 2026 calibration outputs. */
const assert=require("node:assert/strict");
const fs=require("node:fs"), path=require("node:path");
const {forecast,calibrate}=require("./calibration_engine.js");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const tag="window.ERVIN_DATA = ",start=html.indexOf(tag)+tag.length;
assert(start>=tag.length);
const stop=html.indexOf(";\n\n</script><script>",start);
assert(stop>start);
const site=JSON.parse(html.slice(start,stop));
const archive=JSON.parse(fs.readFileSync(path.join(root,"research/calibration_events_2016_2024.json"),"utf8"));
assert.equal(site.calibrationEvents.length,archive.events.length);
assert.deepEqual(site.calibrationEvents,archive.events,"Embedded calibration diverges from published evidence");
assert.equal(site.states.length,17);
assert.equal(archive.events.length,88);
assert(html.includes('<script src="scripts/calibration_engine.js"></script>'));
const seen=new Set();
for(const race of site.states){
  assert(!seen.has(race.code));
  seen.add(race.code);
  const output=forecast(site.calibrationEvents,race,2026);
  assert(Number.isFinite(output.correction),race.code+" produced nonfinite correction");
  assert(Math.abs(output.correction)<=6.00001,race.code+" violated correction cap");
  assert(Number.isInteger(output.cycles)&&output.cycles>=0);
  if(race.code==="MT")assert.equal(output.correction,0);
  if(["AK","NE","SD"].includes(race.code))assert(output.method.includes("candidate")||output.method.includes("Bengs")||output.method.includes("Osborn")||output.method.includes("RCV")||output.method.includes("incumbency"));
  const prev=calibrate(site.calibrationEvents,race.code,2024);
  assert(Number.isFinite(prev.correction));
}
console.log("PASS: 17 forecast calibrations; 88 synchronized historical events; repeat-candidate safeguards.");
