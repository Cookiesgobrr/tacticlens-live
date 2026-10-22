import assert from 'node:assert/strict';
import {generateMatch,validateMatch,atTime} from '../src/footballEngine.ts';
import {FORMATIONS,formationsFor} from '../src/formations.ts';
const v2={version:'formations-v2'},seen=new Set(),rows=[];
assert.deepEqual(generateMatch(82,v2).events,generateMatch(82).events);
assert.equal(generateMatch(82,v2).engineVersion,'classic-v1');
for(const f of FORMATIONS){assert.equal(f.roles.length,11);assert.equal(f.lines.filter(x=>x>0).length,10);assert.equal(f.lines.filter(x=>x===1).length,+(f.name[0]));}
for(const seed of [...Array.from({length:50},(_,i)=>i+1),...Array.from({length:50},(_,i)=>1001+i)]){
  const m=generateMatch(seed,v2);assert.deepEqual(validateMatch(m),[],`F2 invariants ${seed}`);
  assert.ok(m.matchId.endsWith('-F2'));assert.equal(m.engineVersion,'formations-v2');m.formations.forEach(f=>seen.add(f));
  if(seed<6){
    const again=generateMatch(seed,v2);assert.deepEqual(m.events,again.events);assert.deepEqual(m.positions,again.positions);
    assert.notDeepEqual(m.events,generateMatch(seed).events,'Shape must affect play, not just the label');
    const shape=formationsFor(seed,'formations-v2')[0],f=atTime(m,0);
    for(let p=0;p<11;p++){assert.ok(Math.abs(f.people[p].y-(p===9?34:shape.y[p]))<.01);assert.equal(m.players[p].role,shape.roles[p]);}
  }
  for(const e of m.events.filter(e=>e.type==='shot'||e.type==='pass')){
    const f=atTime(m,e.time);assert.ok(Math.hypot(e.x-f.people[e.player].x,e.y-f.people[e.player].y)<.001);
  }
  const shots=m.events.filter(e=>e.type==='shot'),goals=m.events.filter(e=>e.type==='goal');
  rows.push({seed,formations:m.formations,shots:shots.length,goals:goals.length,xg:shots.reduce((s,e)=>s+e.shotXg,0)});
}
assert.equal(seen.size,5);
const avg=k=>rows.reduce((s,r)=>s+r[k],0)/rows.length;
assert.ok(avg('shots')>10&&avg('shots')<40);assert.ok(avg('goals')<6);assert.ok(avg('xg')>1&&avg('xg')<5);
console.log(JSON.stringify({engine:'formations-v2',matches:rows.length,formations:[...seen],meanShots:avg('shots'),meanGoals:avg('goals'),meanXg:avg('xg'),rows}));
console.log('Formation gates passed: all five shapes, 100 seeded matches, movement/ownership/source invariants, reproducibility and genuine changed play.');
