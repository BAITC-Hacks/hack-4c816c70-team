import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8080';
const result = { base, tests: [], samples: { valid: 0, invalid: 0 }, failures: [], observations: {} };
async function req(path, payload, options = {}) {
  const started = performance.now();
  const r = await fetch(base + path, { method: payload === undefined ? 'GET' : 'POST', ...options,
    headers: { 'Content-Type':'application/json', ...options.headers },
    body: payload === undefined ? undefined : typeof payload === 'string' ? payload : JSON.stringify(payload), signal: AbortSignal.timeout(85000) });
  const text = await r.text(); let body; try { body=JSON.parse(text); } catch { body=text; }
  return { status:r.status, body, headers:Object.fromEntries(r.headers), ms:Math.round(performance.now()-started) };
}
async function test(name, fn) { try { await fn(); result.tests.push({name,pass:true}); } catch(e) { result.tests.push({name,pass:false,error:e.message}); result.failures.push({name,error:e.message}); } }
const scenarioResponse = await req('/api/scenario');
const s = scenarioResponse.body;
const measures = new Map(s.measures.map(m=>[m.id,m]));
const districts = new Map(s.districts.map(d=>[d.id,d]));
const valid = [{measureId:'M7',districtId:'nura'},{measureId:'M8',districtId:'nura'},{measureId:'M10',districtId:'nura'},{measureId:'M12'},{measureId:'M5',districtId:'saryarka'}];
function round(n,d=1) { const neg=n<0; let a=BigInt(Math.abs(n)),b=BigInt(d); return (neg?-1:1)*Number((a*100n+b/2n)/b)/100; }
function validation(cs) {
  const cost=cs.reduce((n,c)=>n+measures.get(c.measureId).cost,0);
  if(cost>s.budget) return [422,'BUDGET_EXCEEDED'];
  const counts={}; for(const c of cs) { const cat=measures.get(c.measureId).category; counts[cat]=(counts[cat]||0)+1; }
  if(Object.values(counts).some(x=>x>2)) return [400,'CATEGORY_LIMIT_EXCEEDED'];
  for(const p of s.incompatibilities) { const a=cs.find(c=>c.measureId===p.firstMeasureId), b=cs.find(c=>c.measureId===p.secondMeasureId); if(a&&b&&(!p.sameDistrictOnly||a.districtId===b.districtId)) return [400,'INCOMPATIBLE_MEASURES']; }
  return null;
}
function calc(cs) {
  // Integer arithmetic in eighths; weights/populations are hundredths. No API calculation code is imported.
  const states=s.districts.map(d=>({ id:d.id, vals:Object.fromEntries(Object.entries(d.indicators).map(([k,v])=>[k,v*8])) }));
  const targets=c=>measures.get(c.measureId).scope==='city'?s.districts.map(d=>d.id):[c.districtId];
  for(const c of cs) { const m=measures.get(c.measureId); for(const d of states.filter(d=>targets(c).includes(d.id))) for(const [k,v] of Object.entries(m.effects)) d.vals[k]+=v*(8-m.lagQuarters); }
  const synergies=[];
  for(const p of s.synergies) { const a=cs.find(c=>c.measureId===p.firstMeasureId),b=cs.find(c=>c.measureId===p.secondMeasureId); if(!a||!b) continue; for(const d of states.filter(d=>targets(a).includes(d.id)&&targets(b).includes(d.id))) { d.vals[p.indicatorId]+=p.bonus*8; synergies.push({measureIds:[a.measureId,b.measureId],districtId:d.id,indicatorId:p.indicatorId,delta:p.bonus}); } }
  for(const d of states) { for(const k in d.vals) d.vals[k]=Math.max(0,Math.min(800,d.vals[k])); d.num=s.indicators.reduce((n,i)=>n+d.vals[i.id]*Math.round(i.weight*100),0); }
  const averageNum=states.reduce((n,d)=>n+d.num*Math.round(districts.get(d.id).populationShare*100),0);
  const minNum=Math.min(...states.map(d=>d.num)), critical=states.flatMap(d=>Object.values(d.vals)).filter(v=>v<40*8).length;
  const scoreNum=7*averageNum+3*minNum*100-critical*800000;
  return { score:round(scoreNum,800000), scoreNum, average:round(averageNum,80000), min:round(minNum,800), critical,
    states:states.map(d=>({id:d.id,score:round(d.num,800),indicators:Object.fromEntries(Object.entries(d.vals).map(([k,v])=>[k,round(v,8)]))})),synergies };
}
const baseline=calc([]);
function compare(cs,body) {
  const x=calc(cs),spent=cs.reduce((n,c)=>n+measures.get(c.measureId).cost,0);
  assert.equal(body.score,x.score,'city score'); assert.equal(body.baselineScore,baseline.score,'baseline score'); assert.equal(body.spent,spent); assert.equal(body.remaining,100-spent);
  assert.deepEqual(body.breakdown,{averageScore:x.average,minDistrictScore:x.min,criticalCount:x.critical});
  assert.deepEqual(body.baselineBreakdown,{averageScore:baseline.average,minDistrictScore:baseline.min,criticalCount:baseline.critical});
  assert.equal(body.districts.length,5);
  const roundingErrors=[];
  for(const d of body.districts) {const e=x.states.find(v=>v.id===d.id),b=baseline.states.find(v=>v.id===d.id); if(d.scoreAfter!==e.score)roundingErrors.push(`${d.id} scoreAfter: ${d.scoreAfter} != ${e.score}`); if(d.scoreBefore!==b.score)roundingErrors.push(`${d.id} scoreBefore: ${d.scoreBefore} != ${b.score}`); assert.deepEqual(d.indicatorsAfter,e.indicators,`district ${d.id} indicatorsAfter`); assert.deepEqual(d.indicatorsBefore,b.indicators);}
  assert.deepEqual(body.appliedSynergies,x.synergies);
  const expectedEffects=cs.flatMap(c=>{ const m=measures.get(c.measureId); return (m.scope==='city'?s.districts.map(d=>d.id):[c.districtId]).flatMap(districtId=>Object.entries(m.effects).map(([indicatorId,effect])=>({measureId:m.id,districtId,indicatorId,delta:round(effect*(8-m.lagQuarters),8)}))); });
  const effectKey=e=>[e.measureId,e.districtId,e.indicatorId].join('/');
  const sortedEffects=es=>[...es].sort((a,b)=>effectKey(a).localeCompare(effectKey(b)));
  assert.deepEqual(sortedEffects(body.appliedEffects),sortedEffects(expectedEffects),'lag-adjusted effects');
  assert.equal(body.explanationSource,'mock'); assert.ok(body.explanation.summary.length>0);
  for(const key of ['strengths','risks','recommendations']) assert.ok(Array.isArray(body.explanation[key]));
  assert.equal(roundingErrors.length,0,'district rounding: '+roundingErrors.join('; '));
}
await test('scenario invariants and exact baseline',()=>{ assert.equal(scenarioResponse.status,200); assert.equal(s.budget,100); assert.equal(s.horizonQuarters,8); assert.equal(s.districts.length,5); assert.equal(s.indicators.length,10); assert.equal(s.measures.length,14); assert.equal(s.districts.reduce((n,d)=>n+Math.round(d.populationShare*100),0),100); assert.equal(s.indicators.reduce((n,i)=>n+Math.round(i.weight*100),0),100); assert.equal(baseline.score,52.56); assert.equal(s.baselineScore,baseline.score); });
const control=await req('/api/simulations/evaluate',{choices:valid});
result.observations.control=control;
await test('control, all 50 indicators and district scores',()=>{assert.equal(control.status,200);compare(valid,control.body);assert.equal(control.body.score,56.54);});
await test('localized explanations preserve all numeric results and identify the selected language',async()=>{
  const summaries=new Set();
  for(const [requested,expected] of [['ru-RU','ru-RU'],['kk-KZ','kk-KZ'],['en-US','en-US'],['kk;q=0.9,en;q=0.5','kk-KZ'],['de-DE','ru-RU']]) {
    const r=await req('/api/simulations/evaluate',{choices:valid},{headers:{'Accept-Language':requested}});
    assert.equal(r.status,200); compare(valid,r.body);
    assert.equal(r.headers['content-language'],expected); assert.equal(r.body.explanationLocale,expected);
    if(requested===expected) summaries.add(r.body.explanation.summary);
  }
  assert.equal(summaries.size,3,'the three languages must not return the same explanation');
});
const invalids=[['empty object',{},400,'INVALID_REQUEST'],['null body','null',400,'INVALID_REQUEST'],['malformed JSON','{',400,'INVALID_REQUEST'],['wrong choices type',{choices:{}},400,'INVALID_REQUEST'],['null item',{choices:[null,...valid.slice(1)]},400,'INVALID_REQUEST'],['numeric measure',{choices:[{measureId:7,districtId:'nura'},...valid.slice(1)]},400,'INVALID_REQUEST'],['unknown measure',{choices:[{measureId:'M999',districtId:'nura'},...valid.slice(1)]},400,'UNKNOWN_MEASURE'],['empty measure',{choices:[{measureId:' '},...valid.slice(1)]},400,'INVALID_REQUEST'],['duplicate across districts',{choices:[valid[0],{measureId:'M7',districtId:'yesil'},...valid.slice(2)]},400,'DUPLICATE_MEASURE'],['district missing',{choices:[{measureId:'M7'},...valid.slice(1)]},400,'DISTRICT_REQUIRED'],['unknown district',{choices:[{measureId:'M7',districtId:'new'},...valid.slice(1)]},400,'UNKNOWN_DISTRICT'],['city assigned district',{choices:valid.map(c=>c.measureId==='M12'?{...c,districtId:'nura'}:c)},400,'DISTRICT_NOT_ALLOWED']];
for(const count of [0,1,4,6]) invalids.push([`count ${count}`,{choices:count===6?[...valid,{measureId:'M11',districtId:'yesil'}]:valid.slice(0,count)},400,'WRONG_CHOICE_COUNT']);
for(const [name,body,status,code] of invalids) await test(name,async()=>{const r=await req('/api/simulations/evaluate',body);assert.equal(r.status,status);assert.equal(r.body.error?.code,code);assert.equal(typeof r.body.error.message,'string');assert.ok(!('score' in r.body));});
const examples=[
 ['budget exact 100',[['M7','nura'],['M8','nura'],['M10','nura'],['M12'],['M3','nura']]],
 ['budget 101',[['M1','yesil'],['M2'],['M7','nura'],['M5','almaty'],['M10','nura']]],
 ['global conflict',[['M1','nura'],['M3','yesil'],['M10','nura'],['M11','nura'],['M12']]],
 ['same district land conflict',[['M4','nura'],['M7','nura'],['M10','nura'],['M11','nura'],['M12']]],
 ['different district land allowed',[['M4','yesil'],['M7','nura'],['M10','nura'],['M11','nura'],['M12']]],
 ['same district utilities conflict',[['M5','saryarka'],['M13','saryarka'],['M9','nura'],['M10','nura'],['M12']]],
 ['different district utilities allowed',[['M5','saryarka'],['M13','almaty'],['M9','nura'],['M10','nura'],['M12']]],
 ['two synergies and negative T1',[['M1','yesil'],['M2'],['M10','nura'],['M11','nura'],['M12']]],
 ['ecology synergy',[['M5','saryarka'],['M6'],['M9','nura'],['M10','nura'],['M12']]],
 ['three social measures',[['M7','nura'],['M8','nura'],['M9','nura'],['M10','nura'],['M12']]],
];
for(const [name,items] of examples) await test(name,async()=>{const cs=items.map(([measureId,districtId])=>({measureId,...districtId?{districtId}:{}})),exp=validation(cs),r=await req('/api/simulations/evaluate',{choices:cs}); if(exp){assert.equal(r.status,exp[0]);assert.equal(r.body.error?.code,exp[1]);}else{assert.equal(r.status,200);compare(cs,r.body);}});
let seed=20260923; const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
const timings=[];
result.observations.sampleFailures=[];
await test('400 deterministic randomized sets: independent rules and exact calculation',async()=>{
  for(let i=0;i<400;i++) { const pool=[...s.measures],cs=[];for(let j=0;j<5;j++){const m=pool.splice(rand(pool.length),1)[0];cs.push({measureId:m.id,...m.scope==='district'?{districtId:s.districts[rand(5)].id}:{}});}
    const exp=validation(cs),r=await req('/api/simulations/evaluate',{choices:cs}); timings.push(r.ms);
    try{if(exp){result.samples.invalid++;assert.equal(r.status,exp[0]);assert.equal(r.body.error?.code,exp[1]);assert.ok(!('score' in r.body));}else{result.samples.valid++;assert.equal(r.status,200);compare(cs,r.body);}}catch(e){result.observations.sampleFailures.push({sample:i,choices:cs,error:e.message,actual:r.body,expected:calc(cs)});}
    if(i%100===99) console.log(`checked ${i+1}/400 sets`);
  }
  assert.equal(result.observations.sampleFailures.length,0,`${result.observations.sampleFailures.length} sample discrepancies; first: ${result.observations.sampleFailures[0]?.error}`);
});
await test('all 120 permutations of control preserve numeric result and synergies',async()=>{
  function* perms(a){if(!a.length){yield [];return;}for(let i=0;i<a.length;i++)for(const p of perms(a.filter((_,j)=>i!==j)))yield[a[i],...p];}
  for(const cs of perms(valid)){const r=await req('/api/simulations/evaluate',{choices:cs});assert.equal(r.status,200); compare(cs,r.body); assert.equal(r.body.score,control.body.score);}
});
const swagger=(await req('/swagger/v1/swagger.json')).body;
result.observations.swagger={routes:Object.keys(swagger.paths),requestSchema:swagger.paths['/api/simulations/evaluate'].post.requestBody,responses:swagger.paths['/api/simulations/evaluate'].post.responses,exampleFields:(JSON.stringify(swagger).match(/"examples?"\s*:/g)||[]).length};
await test('Swagger contains explicit response examples required by task',()=>assert.ok(result.observations.swagger.exampleFields>0,'No example or examples fields anywhere in Swagger'));
await test('Swagger successful examples match real responses and errors have stable codes',async()=>{
  const getExample=swagger.paths['/api/scenario'].get.responses['200'].content['application/json'].examples.baseline.value;
  assert.deepEqual(getExample,s);
  const post=swagger.paths['/api/simulations/evaluate'].post;
  const requestExample=post.requestBody.content['application/json'].examples.control.value;
  const exampleResponse=post.responses['200'].content['application/json'].examples.control.value;
  const actual=await req('/api/simulations/evaluate',requestExample);
  assert.equal(actual.status,200); assert.deepEqual(actual.body,exampleResponse);
  for(const [name,code] of [['wrongCount','WRONG_CHOICE_COUNT'],['duplicate','DUPLICATE_MEASURE'],['unknownDistrict','UNKNOWN_DISTRICT'],['incompatible','INCOMPATIBLE_MEASURES']])
    assert.equal(post.responses['400'].content['application/json'].examples[name].value.error.code,code);
  assert.equal(post.responses['422'].content['application/json'].examples.overBudget.value.error.code,'BUDGET_EXCEEDED');
});
await test('evaluation contains applied effects required by task',()=>assert.ok(Array.isArray(control.body.appliedEffects),'appliedEffects absent in successful response'));
await test('CORS allowed vs foreign origin',async()=>{for(const [origin,allow] of [[process.env.TEST_FRONTEND_ORIGIN||'http://localhost:3000',true],['https://untrusted.invalid',false]]){const r=await req('/api/simulations/evaluate',undefined,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});assert.equal(r.headers['access-control-allow-origin'],allow?origin:undefined);}});
await test('API does not expose .env',async()=>{const r=await req('/.env'); assert.ok(r.status>=400);assert.ok(!String(r.body).includes('OPENAI_API_KEY='));});
timings.sort((a,b)=>a-b);result.observations.timings={p50:timings[Math.floor(timings.length*.5)],p95:timings[Math.floor(timings.length*.95)],max:timings.at(-1)};
console.log(JSON.stringify({tests:result.tests.length,passed:result.tests.filter(t=>t.pass).length,samples:result.samples,failures:result.failures,timings:result.observations.timings},null,2));
if (process.env.AUDIT_OUTPUT) writeFileSync(process.env.AUDIT_OUTPUT,JSON.stringify(result,null,2));
process.exitCode=result.failures.length?1:0;
