// OFFLINE event/source parity and public-reader mutation gates, no network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateMatch} from '../src/footballEngine.ts';
import {liveCandidates,liveFacts,validateSessionFeed,edition,stable} from '../src/sessionIntelligence.ts';
const match=generateMatch(82),feed=JSON.parse(readFileSync(new URL('../../artifacts/offline-session-feed.json',import.meta.url)));
assert.ok(validateSessionFeed(feed,match,feed.sessionId));
const copy=()=>structuredClone(feed);
for(const mutate of [f=>f.seed=2027,f=>f.matchId='SIM-2027-F2',f=>f.engineSha256='a'.repeat(64),f=>f.records[0].facts.stats.score[0]=99,
 f=>f.records[0].facts.actor.id=21,f=>f.records[0].candidate.player=21,f=>f.records[0].facts.claims.event=['SIM-82-99999'],
 f=>f.records[0].facts.seed=2027,f=>f.records[0].facts.stats.shots[0]=100,f=>f.records[0].plan.modes.player=['team1'],
 f=>f.records[0].plan.modes.fan=['unknown'],f=>f.records[0].trace[0].inputTokens=99999,f=>f.clock=0,
 f=>f.records.push(structuredClone(f.records[0])),f=>f.records[0].plan.modes.analyst=f.records[0].plan.modes.fan]){
 const bad=copy();mutate(bad);assert.equal(validateSessionFeed(bad,match,feed.sessionId),null,'Mutated identity/evidence must be rejected');
}
assert.equal(validateSessionFeed(feed,generateMatch(2027,{version:'formations-v2'}),feed.sessionId),null);
for(const r of feed.records){
 const fan=edition(r.facts,'fan',r.plan),analyst=edition(r.facts,'analyst',r.plan);
 assert.notEqual(fan.map(x=>x.text).join(' '),analyst.map(x=>x.text).join(' '));
 const before=match.events.filter(e=>e.time<=r.candidate.atSecond).map(e=>e.id);
 assert.ok(fan.flatMap(x=>x.evidenceIds).every(id=>before.includes(id)));
}
const samples=JSON.parse(readFileSync(new URL('../../artifacts/session-parity.json',import.meta.url)));
for(const sample of samples){
 const m=generateMatch(sample.seed,{version:'formations-v2'});
 assert.equal(stable(liveCandidates(m)),stable(sample.candidates),'Python/JS candidate parity');
 for(let i=0;i<sample.candidates.length;i++)assert.equal(stable(liveFacts(m,sample.candidates[i])),stable(sample.facts[i]),`Python/JS facts parity ${sample.seed} ${i}`);
}
let min=Infinity,max=0,total=0;
for(let seed=1;seed<=100;seed++){
 const m=generateMatch(seed,{version:'formations-v2'}),c=liveCandidates(m);
 min=Math.min(min,c.length);max=Math.max(max,c.length);total+=c.length;
 assert.ok(c.length>=2);assert.equal(c.filter(x=>x.kind==='goal').length,m.events.filter(e=>e.type==='goal').length);
 assert.ok(c.every(x=>x.eventId===null||m.events.some(e=>e.id===x.eventId&&e.time===x.atSecond)));
}
console.log(JSON.stringify({mode:'offline-only',fixtureMoments:feed.records.length,fixtureCalls:feed.reservedCalls,paritySeeds:samples.length,detectionSeeds:100,eligibleRange:[min,max],eligibleMean:total/100}));
