(async function() {
'use strict';
const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n).toLocaleString('en-US');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const marginLabel=(m,digits=1)=>Math.abs(m)<.05?'Even':(m>=0?'D +':'R +')+Math.abs(m).toFixed(digits);
const PCT=x=>(100*x).toFixed(1)+'%';
let countyData=[],geo=null,config=null,mi=null;
const ui={source:'take',mode:'original',turnout:1,mapMode:'projection',county:'Wayne',filter:'',sort:'size'};
let prediction=null;
let mapCreated=false, extent=null;
const sources={rcp:.40,ddhq:.29,win270:.21,silver:.10};
const sourceCache=new Map(),correctionCache=new Map();
let turnoutFrame=0;

function inputSource(r,key) {
 if(key!=='take')return r.sources[key];
 if(sourceCache.has(r.code))return sourceCache.get(r.code);
 const found=[],seen=new Set();
 for(const [s,w] of Object.entries(sources)) {
  const o=r.sources[s];
  if(!o||o.proxy||!Number.isFinite(Number(o.value)))continue;
  const identity=String(o.publisherId||o.origin||s).trim().toLowerCase();
  if(seen.has(identity))continue;seen.add(identity);
  const rawDate=String(o.date||'').trim();
  const date=Date.parse(/\b20\d{2}\b/.test(rawDate)?rawDate:rawDate+', 2026');
  const age=Number.isFinite(date)?Math.max(0,(Date.now()-date)/86400000):21;
  const weight=w*Math.max(.50,Math.exp(-age/35));
  found.push({id:s,v:Number(o.value),weight});
 }
 const sum=found.reduce((x,y)=>x+y.weight,0);
 if(!sum){
  const fallback={...(r.sources.rcp||r.sources.average),proxy:true,nInputs:0,origin:'Proxy fallback'};
  sourceCache.set(r.code,fallback);return fallback;
 }
 const result={value:Math.round(found.reduce((x,y)=>x+y.v*y.weight,0)/sum*100)/100,
         nInputs:found.length,origin:'Ervin’s Take ('+found.map(x=>x.id).join(', ')+')',
         proxy:found.length<2,date:'current model inputs'};
 sourceCache.set(r.code,result);return result;
}
const correction=mode=>{
 if(mode==='raw')return 0;
 if(correctionCache.has(mode))return correctionCache.get(mode);
 let value=0;
 if(mode==='original')value=Number(mi.correction)||0;
 else if(mode==='shrink')value=(Number(mi.correction)||0)*mi.historical.length/(mi.historical.length+3);
 else value=window.ERVIN_ENGINE.forecast(config.calibrationEvents||[],mi,2026).correction;
 correctionCache.set(mode,value);
 return value;
};
function statewide(source,mode) {
 const p=inputSource(mi,source),offset=correction(mode);
 return {input:Number(p.value),correct:offset,margin:Number(p.value)-offset,poll:p};
}
function meanMargin(data) {return (data.d-data.r)/data.total;}
function otherShare(data){return Math.max(0,1-(data.d+data.r)/data.total);}
const safe=x=>Math.max(0,Math.min(1,x));

function simulate(source,mode,turnout){
 const statewideInput=statewide(source,mode);
 const target=statewideInput.margin/100;
 const counties=countyData.map(c=>{
  const sen=c.senate2024,gov=c.governor2022,pres=c.president2024;
  const base=0.55*meanMargin(sen)+.25*meanMargin(gov)+.20*meanMargin(pres);
  const oth=safe(.55*otherShare(sen)+.25*otherShare(gov)+.20*otherShare(pres));
  const total=Math.max(1,Math.round((.70*gov.total+.30*sen.total)*turnout));
  return {name:c.name,history:c,total,base,otherShare:oth};
 });
 const resultAt=offset=>{
  let net=0,votes=0;
  for(const c of counties){net+=c.total*Math.max(-1+c.otherShare,Math.min(1-c.otherShare,c.base+offset));votes+=c.total;}
  return net/votes;
 };
 let lo=-2,hi=2;for(let i=0;i<55;i++){const mid=(hi+lo)/2;if(resultAt(mid)<target)lo=mid;else hi=mid;}
 const swing=(hi+lo)/2;
 let D=0,R=0,O=0,ballots=0;
 for(const c of counties){
  const m=Math.max(-1+c.otherShare,Math.min(1-c.otherShare,c.base+swing));
  const other=Math.round(c.total*c.otherShare),two=c.total-other;
  const d=Math.round((two+c.total*m)/2);
  const r=two-d;
  Object.assign(c,{d,r,other,m,net:d-r,margin:100*(d-r)/c.total,
    historicMargin:100*meanMargin(c.history.senate2024),
    shift2024:100*(d-r)/c.total-100*meanMargin(c.history.senate2024)});
  D+=d;R+=r;O+=other;ballots+=c.total;
 }
 return {counties,ballots,D,R,O,actualMargin:100*(D-R)/ballots,target:statewideInput.margin,source,mode,swing:swing*100,details:statewideInput};
}
function updatePrediction(){
 if(turnoutFrame){cancelAnimationFrame(turnoutFrame);turnoutFrame=0;}
 prediction=simulate(ui.source,ui.mode,ui.turnout);
 $('stateMargin').textContent=marginLabel(prediction.actualMargin,2);
 $('stateMargin').className=prediction.actualMargin>=0?'blue':'red';
 $('stateMarginDesc').textContent=mi.dem+' vs '+mi.rep+' · '+prediction.details.poll.origin;
 $('stateVotes').textContent=fmt(prediction.ballots);
 $('stateDem').textContent=fmt(prediction.D);
 $('stateRep').textContent=fmt(prediction.R);
 $('turnoutRead').textContent=Math.round(ui.turnout*100)+'%';
 paintMap();paintCounty();paintTable();paintStrongholds();paintRegions();
}
function countyByName(name){return prediction?.counties.find(c=>c.name.toLowerCase()===String(name).toLowerCase());}
function setCounty(name){
 if(!countyByName(name))return;
 ui.county=countyByName(name).name;
 $('countyPicker').value=ui.county;
 paintCounty();paintSelection();
 document.querySelectorAll('#countyRows tr[data-county]').forEach(tr=>tr.classList.toggle('selected',tr.dataset.county===name));
}

function mapMargin(c){
 if(ui.mapMode==='senate2024')return 100*meanMargin(c.history.senate2024);
 if(ui.mapMode==='president2024')return 100*meanMargin(c.history.president2024);
 if(ui.mapMode==='governor2022')return 100*meanMargin(c.history.governor2022);
 if(ui.mapMode==='swing')return c.shift2024;
 if(ui.mapMode==='turnout')return c.total;
 return c.margin;
}
function fillColor(v){
 if(ui.mapMode==='turnout'){const scale=Math.max(0,Math.min(1,Math.log10(Math.max(1,v))/6));return 'hsl(208 53% '+(58-37*scale)+'%)';}
 const limit=ui.mapMode==='swing'?16:62,scale=Math.min(1,Math.abs(v)/limit),light=50-22*scale;
 return v>=0?'hsl(211 61% '+light+'%)':'hsl(353 58% '+light+'%)';
}
function geometryParts(g){if(!g)return [];return g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];}
function prepareMap(){
 if(mapCreated||!geo)return;
 const coords=[];const cos=Math.cos(44.5*Math.PI/180);
 for(const f of geo.features)for(const poly of geometryParts(f.geometry))for(const ring of poly)for(const [x,y] of ring)coords.push([x*cos,y]);
 const minX=Math.min(...coords.map(c=>c[0])),maxX=Math.max(...coords.map(c=>c[0]));
 const minY=Math.min(...coords.map(c=>c[1])),maxY=Math.max(...coords.map(c=>c[1]));
 const scale=Math.min(930/(maxX-minX),680/(maxY-minY)),offX=(1000-(maxX-minX)*scale)/2,offY=(750-(maxY-minY)*scale)/2;
 const xy=p=>[offX+(p[0]*cos-minX)*scale,offY+(maxY-p[1])*scale];
 const paths=geo.features.map(f=>{
  const name=f.properties.name;
  const d=geometryParts(f.geometry).map(poly=>poly.map(ring=>{
   return ring.map((p,i)=>{const pt=xy(p);return(i===0?'M':'L')+pt[0].toFixed(2)+','+pt[1].toFixed(2)}).join(' ')+' Z';
  }).join(' ')).join(' ');
  return '<path tabindex="0" role="button" aria-label="'+esc(name)+' County" data-county="'+esc(name)+'" d="'+d+'"><title>'+esc(name)+' County</title></path>';
 }).join('');
 $('map').innerHTML=paths;
 $('map').addEventListener('click',e=>{const el=e.target.closest('path[data-county]');if(el)setCounty(el.dataset.county)});
 $('map').addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const el=e.target.closest('path[data-county]');if(el){e.preventDefault();setCounty(el.dataset.county)}});
 $('map').style.display='block';$('mapStatus').style.display='none';
 mapCreated=true;
}
function paintSelection(){
 $('map').querySelectorAll('path[data-county]').forEach(el=>el.classList.toggle('active',el.dataset.county===ui.county));
}
function paintMap(){
 prepareMap();
 if(!mapCreated)return;
 for(const path of $('map').querySelectorAll('path[data-county]')){
  const c=countyByName(path.dataset.county);if(!c)continue;
  const m=mapMargin(c);
  path.setAttribute('fill',fillColor(m));
  path.setAttribute('aria-label',c.name+' County, '+(ui.mapMode==='turnout'?fmt(m)+' modeled ballots':marginLabel(m)) );
  path.querySelector('title').textContent=c.name+' County: '+(ui.mapMode==='turnout'?fmt(m)+' projected ballots':marginLabel(m));
 }
 paintSelection();
 $('mapCaption').textContent=ui.mapMode==='turnout'?'Blue shading indicates approximate county turnout volume, not a partisan margin.':ui.mapMode==='swing'?'Blue = more Democratic than 2024 Senate; red = more Republican.':(ui.mapMode==='projection'?'Forecast based on current statewide scenario · ':'Actual historical statewide county returns · ')+'Blue = Democratic lead, red = Republican lead.';
}
function paintCounty(){
 const c=countyByName(ui.county);if(!c)return;
 $('countyName').textContent=c.name+' County';
 $('countyCaption').textContent='2026 modeled votes · Source: '+prediction.details.poll.origin+' · '+(ui.mode==='weighted'?'Ervin +':ui.mode);
 $('countyDem').textContent=fmt(c.d);$('countyRep').textContent=fmt(c.r);
 $('countyMargin').textContent=marginLabel(c.margin,2);
 $('countyMargin').className=c.margin>=0?'blue':'red';
 $('countyTurnout').textContent=fmt(c.total);
 const history=[
  ['2020 President',c.history.president2020],['2020 Senate',c.history.senate2020],
  ['2022 Governor',c.history.governor2022],['2024 President',c.history.president2024],
  ['2024 Senate',c.history.senate2024]];
 const series=history.filter(x=>x[1]).map(([label,v])=>({label,margin:100*meanMargin(v)}));
 series.push({label:'2026 projected',margin:c.margin});
 $('countyTrend').innerHTML=series.map(x=>{
  const magnitude=Math.min(50,Math.abs(x.margin)/70*50),left=x.margin>=0?50:50-magnitude;
  return '<div class="trend-row"><span>'+esc(x.label)+'</span><div class="track"><i style="left:'+left+'%;width:'+Math.max(.7,magnitude)+'%;background:var(--'+(x.margin>=0?'blue':'red')+')"></i></div><strong class="'+(x.margin>=0?'blue':'red')+'">'+marginLabel(x.margin)+'</strong></div>';
 }).join('');
 const pres=100*meanMargin(c.history.president2024),sen=100*meanMargin(c.history.senate2024);
 const difference=sen-pres,change=c.shift2024;
 $('countyNote').innerHTML='In 2024, the Senate Democrat ran <strong>'+Math.abs(difference).toFixed(1)+' points '+(difference>=0?'ahead of':'behind')+'</strong> the Democratic presidential nominee here. This 2026 scenario is <strong>'+Math.abs(change).toFixed(1)+' points '+(change>=0?'more Democratic':'more Republican')+'</strong> than the county’s 2024 Senate result. County-specific turnout and campaign effects could produce substantially different outcomes.';
}
function cellMargin(m){return '<span class="'+(m>=0?'blue':'red')+'">'+marginLabel(m)+'</span>';}
function paintTable(){
 let arr=prediction.counties.filter(c=>c.name.toLowerCase().includes(ui.filter.toLowerCase()));
 if(ui.sort==='name')arr.sort((a,b)=>a.name.localeCompare(b.name));
 else if(ui.sort==='margin')arr.sort((a,b)=>Math.abs(b.net)-Math.abs(a.net));
 else if(ui.sort==='swing')arr.sort((a,b)=>Math.abs(b.shift2024)-Math.abs(a.shift2024));
 else arr.sort((a,b)=>b.total-a.total);
 $('countyRows').innerHTML=arr.map(c=>{
  const H=c.history;
  return '<tr data-county="'+esc(c.name)+'" class="'+(c.name===ui.county?'selected':'')+'"><td><strong>'+esc(c.name)+'</strong></td><td>'+cellMargin(100*meanMargin(H.senate2024))+'</td><td>'+cellMargin(100*meanMargin(H.president2024))+'</td><td>'+cellMargin(100*meanMargin(H.governor2022))+'</td><td>'+fmt(c.d)+'</td><td>'+fmt(c.r)+'</td><td>'+fmt(c.other)+'</td><td>'+cellMargin(c.margin)+'</td><td class="'+(c.net>=0?'blue':'red')+'">'+(c.net>0?'+':'')+fmt(c.net)+'</td><td>'+fmt(c.total)+'</td></tr>';
 }).join('');
}
const upperPeninsula=new Set(['Alger','Baraga','Chippewa','Delta','Dickinson','Gogebic','Houghton','Iron','Keweenaw','Luce','Mackinac','Marquette','Menominee','Ontonagon','Schoolcraft']);
function countyBloc(name){
 if(['Wayne','Oakland','Macomb'].includes(name))return 'Detroit three-county core';
 if(['Kent','Ottawa'].includes(name))return 'Kent + Ottawa';
 if(['Washtenaw','Ingham'].includes(name))return 'University-county pair';
 if(upperPeninsula.has(name))return 'Upper Peninsula';
 return 'All other Michigan counties';
}
function paintRegions(){
 const labels=['Detroit three-county core','Kent + Ottawa','University-county pair','Upper Peninsula','All other Michigan counties'];
 const total=prediction.ballots;
 const rows=labels.map(label=>{
  const cs=prediction.counties.filter(c=>countyBloc(c.name)===label);
  const project={d:0,r:0,total:0};
  const past={senate2024:{d:0,r:0,total:0},president2024:{d:0,r:0,total:0},governor2022:{d:0,r:0,total:0}};
  for(const c of cs){
   project.d+=c.d;project.r+=c.r;project.total+=c.total;
   for(const key of Object.keys(past))for(const k of ['d','r','total'])past[key][k]+=c.history[key][k];
  }
  return '<tr><td><strong>'+esc(label)+'</strong></td><td>'+cs.length+'</td><td>'+cellMargin(100*meanMargin(past.senate2024))+'</td><td>'+cellMargin(100*meanMargin(past.president2024))+'</td><td>'+cellMargin(100*meanMargin(past.governor2022))+'</td><td>'+fmt(project.d)+'</td><td>'+fmt(project.r)+'</td><td class="'+(project.d>=project.r?'blue':'red')+'">'+(project.d-project.r>0?'+':'')+fmt(project.d-project.r)+'</td><td>'+(100*project.total/total).toFixed(1)+'%</td></tr>';
 });
 $('regionalRows').innerHTML=rows.join('');
}
function paintStrongholds(){
 let d=[...prediction.counties].sort((a,b)=>b.net-a.net).slice(0,6),r=[...prediction.counties].sort((a,b)=>a.net-b.net).slice(0,6);
 const render=arr=>arr.map(c=>'<li><span>'+esc(c.name)+'</span><strong>'+((c.net>0)?'+':'')+fmt(c.net)+'</strong></li>').join('');
 $('demStrongholds').innerHTML=render(d);$('repStrongholds').innerHTML=render(r);
}
function paintScenario(){
 const rows=config.sourceList.map(x=>{
  const name=x.title,p=inputSource(mi,x.key);
  const values=['raw','original','shrink','weighted'].map(m=>statewide(x.key,m).margin);
  return '<tr data-source="'+esc(x.key)+'" style="cursor:pointer" title="Select '+esc(name)+'"><td>'+esc(name)+'</td>'+values.map(v=>'<td>'+cellMargin(v)+'</td>').join('')+'<td>'+esc(p.proxy?'Fallback / sparse':x.key==='take'?(p.nInputs+' publishers'):'Publisher average')+'</td></tr>';
 });
 $('scenarioRows').innerHTML=rows.join('');
}
function download(){
 const headings=['County','Source','Adjustment','Turnout multiplier','2024 Senate D','2024 Senate R','2024 Senate votes','2024 Presidential D','2024 Presidential R','2022 Governor D','2022 Governor R','2026 projected D','2026 projected R','2026 projected other','2026 projected ballots','2026 D-R margin percentage'];
 const rows=prediction.counties.map(c=>[c.name,ui.source,ui.mode,ui.turnout,c.history.senate2024.d,c.history.senate2024.r,c.history.senate2024.total,c.history.president2024.d,c.history.president2024.r,c.history.governor2022.d,c.history.governor2022.r,c.d,c.r,c.other,c.total,c.margin.toFixed(4)]);
 const txt=[headings,...rows].map(arr=>arr.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const u=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
 a.href=u;a.download='Michigan-county-projections-'+ui.source+'-'+ui.mode+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
function bind(){
 $('source').addEventListener('change',e=>{ui.source=e.target.value;updatePrediction();paintScenario()});
 $('mode').addEventListener('change',e=>{ui.mode=e.target.value;updatePrediction()});
 $('turnout').addEventListener('input',e=>{
  const t=Number(e.target.value)/100;
  if(!Number.isFinite(t)||t<=0)return;
  ui.turnout=t;
  $('turnoutRead').textContent=Math.round(t*100)+'%';
  if(!turnoutFrame)turnoutFrame=requestAnimationFrame(()=>{
   turnoutFrame=0;updatePrediction();
  });
 });
 $('mapMode').addEventListener('change',e=>{ui.mapMode=e.target.value;paintMap()});
 $('countyPicker').addEventListener('change',e=>{const c=countyData.find(c=>c.name.toLowerCase()===e.target.value.replace(/ county$/i,'').toLowerCase());if(c)setCounty(c.name)});
 $('countyFilter').addEventListener('input',e=>{ui.filter=e.target.value;paintTable()});
 $('countySort').addEventListener('change',e=>{ui.sort=e.target.value;paintTable()});
 $('countyRows').addEventListener('click',e=>{const row=e.target.closest('tr[data-county]');if(row){setCounty(row.dataset.county);$('countyDetail').scrollIntoView({behavior:'smooth',block:'nearest'})}});
 $('scenarioRows').addEventListener('click',e=>{const row=e.target.closest('tr[data-source]');if(row){ui.source=row.dataset.source;$('source').value=ui.source;updatePrediction();paintScenario()}});
 $('download').addEventListener('click',download);
 $('themeToggle').addEventListener('click',()=>document.body.classList.toggle('light'));
}
async function load(){
 const [histResponse,geoResponse,mainResponse]=await Promise.all([fetch('./county_history.json'),fetch('./counties.geojson'),fetch('../index.html')]);
 for(const [name,response] of [['County history',histResponse],['Geometries',geoResponse],['Model',mainResponse]])if(!response.ok)throw new Error(name+' resource was unavailable (HTTP '+response.status+')');
 const hist=await histResponse.json();geo=await geoResponse.json();
 const html=await mainResponse.text(),tag='window.ERVIN_DATA = ',pos=html.indexOf(tag),end=html.indexOf(';\n\n</script><script>',pos);
 if(pos<0||end<0)throw new Error('Current Ervin Model data could not be read');
 config=JSON.parse(html.slice(pos+tag.length,end));
 mi=config.states.find(x=>x.code==='MI');if(!mi)throw new Error('Michigan forecast is not available in the main model');
 countyData=hist.counties;
 if(countyData.length!==83||geo.features.length!==83||!countyData.every(c=>c.senate2024&&c.president2024&&c.governor2022))throw new Error('County history or county map is incomplete');
 const sum=key=>countyData.reduce((a,c)=>a+c.senate2024[key],0);
 if(sum('d')!==2712686||sum('r')!==2693680)throw new Error('Michigan 2024 Senate baseline did not validate');
 $('source').innerHTML=config.sourceList.map(s=>'<option value="'+esc(s.key)+'">'+esc(s.title)+'</option>').join('');
 $('source').value=ui.source;$('mode').value=ui.mode;
 $('countyOptions').innerHTML=countyData.map(c=>'<option value="'+esc(c.name)+'">').join('');
 $('countyPicker').value=ui.county;
 $('dataStatus').textContent='2020, 2022 & 2024 county history · '+hist.metadata.retrievedAt.slice(0,10)+' retrieval · '+(config.liveMeta?.checkedAt?'polls last checked '+config.liveMeta.checkedAt.slice(0,10):'source snapshot '+config.asof)+' · 83/83 counties verified';
 bind();updatePrediction();paintScenario();
}
try{await load()}catch(error){console.error(error);$('dataStatus').innerHTML='<span class="error">Michigan county data could not load: '+esc(error.message)+'. Check the data-generation build and reload.</span>';$('mapStatus').textContent='No verified county geometry available.'}
})();