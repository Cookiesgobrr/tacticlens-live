// Node 22+; no cloud calls. All assertions concern the actual simulation.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {generateMatch,atTime,eventsUntil,validateMatch,goalProbability} from '../src/footballEngine.ts';
const match=generateMatch();
assert.deepEqual(validateMatch(match),[]);
assert.equal(match.players.length,22);
assert.equal(match.frames,match.duration/match.frameSeconds+1);
const kickoff=atTime(match,0);
assert.equal(kickoff.ball.x,52.5);
assert.equal(kickoff.ball.y,34);
assert.ok(match.players.filter(p=>p.team===0).every(p=>kickoff.people[p.id].x<=52.5));
assert.ok(match.players.filter(p=>p.team===1).every(p=>kickoff.people[p.id].x>=52.5));
assert.deepEqual(match.events,generateMatch().events);
for(const time of [0,.125,3.375,30,900,2700,5399.875,5400]){
  const frame=atTime(match,time);
  assert.equal(frame.people.length,22);
  assert.ok(eventsUntil(match,time).every(e=>e.time<=time));
}
assert.ok(goalProbability(10,0,8)>goalProbability(30,.6,1));
// Mutation tests prove the gate detects broken possession and source leakage.
const ownerFrame=match.owners.findIndex((p,i)=>p>=0&&i>20);
const oldBall=match.ball[ownerFrame*3];
match.ball[ownerFrame*3]=0;
assert.ok(validateMatch(match).includes('Carrier separated from ball'));
match.ball[ownerFrame*3]=oldBall;
const shot=match.events.find(e=>e.type==='shot'), originalXg=shot.shotXg;
shot.shotXg=.99;
assert.ok(validateMatch(match).includes('xG does not match pre-outcome geometry'));
shot.shotXg=originalXg;
const receipt=match.events.find(e=>e.type==='receive'), originalSource=receipt.sourceId;
receipt.sourceId='ARCHIVED-UNRELATED-EVENT';
assert.ok(validateMatch(match).includes('Invalid source event'));
receipt.sourceId=originalSource;
assert.deepEqual(validateMatch(match),[]);

// Predeclared sequential population (not hand-picked showcase seeds).
// 100 held-out seeds use the same gates when --holdout is supplied.
const holdout=process.argv.includes('--holdout');
const seeds=Array.from({length:100},(_,i)=>i+1+(holdout?1000:0));
const rows=[];
for(const seed of seeds){
  const m=generateMatch(seed);
  assert.deepEqual(validateMatch(m),[],`invariants seed ${seed}`);
  const count=type=>m.events.filter(e=>e.type===type).length;
  const shots=m.events.filter(e=>e.type==='shot');
  const xg=shots.reduce((sum,e)=>sum+e.shotXg,0);
  const goals=count('goal');
  assert.ok(goals<=shots.length);
  assert.equal(count('receive')+count('interception')+count('loose'),count('pass')-(m.events.at(-1)?.type==='pass'?1:0),`pass outcomes seed ${seed}`);
  const pendingShots=shots.filter(s=>!m.events.some(e=>e.sourceId===s.id));
  assert.ok(pendingShots.every(s=>s.time>m.duration-2));
  // Every logged action origin is the real actor location at its frame.
  for(const e of m.events.filter(e=>e.type==='pass'||e.type==='shot')){
    const k=(Math.round(e.time/m.frameSeconds)*22+e.player)*2;
    assert.ok(Math.hypot(m.positions[k]-e.x,m.positions[k+1]-e.y)<.001);
  }
  rows.push({seed,shots:shots.length,goals,xg,passes:count('pass'),completion:count('receive')/count('pass'),
    shotVariance:shots.reduce((a,e)=>a+e.shotXg*(1-e.shotXg),0)});
  if(rows.length%25===0)console.log(`Validated ${rows.length}/${seeds.length} seeds`);
}
const summarize=key=>{
  const values=rows.map(r=>r[key]).sort((a,b)=>a-b);
  const q=p=>values[Math.floor((values.length-1)*p)];
  return {min:values[0],p05:q(.05),median:q(.5),mean:values.reduce((a,b)=>a+b,0)/values.length,p95:q(.95),max:values.at(-1)};
};
const typicalShots=rows.filter(r=>r.shots>=15&&r.shots<=35).length/rows.length;
const typicalGoals=rows.filter(r=>r.goals<=6).length/rows.length;
const typicalXg=rows.filter(r=>r.xg>=1&&r.xg<=5).length/rows.length;
const totalXg=rows.reduce((s,r)=>s+r.xg,0),totalGoals=rows.reduce((s,r)=>s+r.goals,0);
const conversionZ=(totalGoals-totalXg)/Math.sqrt(rows.reduce((s,r)=>s+r.shotVariance,0));
const summary={seeds:`${seeds[0]}–${seeds.at(-1)}`,matches:rows.length,frameSeconds:match.frameSeconds,
  shots:summarize('shots'),goals:summarize('goals'),xg:summarize('xg'),passCompletion:summarize('completion'),
  typicalShots,typicalGoals,typicalXg,conversionZ};
console.log(JSON.stringify(summary,null,2));
// Population tolerances, never inputs to or branches inside the simulator.
assert.ok(typicalShots>=.75,'At least 75% of matches have 15–35 shots');
assert.ok(typicalGoals>=.94,'At least 94% have 0–6 goals');
assert.ok(typicalXg>=.85,'At least 85% have total xG 1–5');
assert.ok(summary.passCompletion.mean>=.75&&summary.passCompletion.mean<=.96,'Plausible short-pass completion');
assert.ok(Math.abs(conversionZ)<4,'Realized goals must be consistent with pre-outcome probabilities');
if(process.argv.includes('--write'))writeFileSync(new URL(`../../docs/evaluation/${holdout?'holdout':'calibration'}.json`,import.meta.url),JSON.stringify({summary,rows},null,2)+'\n');
console.log('Simulation, evidence and population gates passed.');
