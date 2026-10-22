// Executed in GitHub Actions with Node 22's built-in TypeScript stripping.
// Ensures the fresh 11-v-11 engine is tested, not just TypeScript compiled.
import assert from "node:assert/strict";
import {generateMatch,atTime,eventsUntil,validateMatch} from "../src/footballEngine.ts";
const match=generateMatch();
assert.deepEqual(validateMatch(match),[]);
assert.equal(match.players.length,22);
assert.equal(match.players.filter(p=>p.team===0).length,11);
assert.equal(match.players.filter(p=>p.team===1).length,11);
assert.equal(match.duration,5400);
assert.equal(match.frames,10801);
assert.equal(match.players[9].role,"ST");
const kickoff=atTime(match,0);
assert.ok(Math.abs(kickoff.ball.x-52.5)<.001);
assert.ok(Math.abs(kickoff.ball.y-34)<.001);
assert.ok(match.players.filter(p=>p.team===0).every(p=>kickoff.people[p.id].x<=52.5));
assert.ok(match.players.filter(p=>p.team===1).every(p=>kickoff.people[p.id].x>=52.5));
assert.equal(eventsUntil(match,0)[0].type,"kickoff");
assert.ok(match.events.some(e=>e.type==="pass"));
assert.ok(match.events.some(e=>e.type==="shot"));
assert.ok(match.events.some(e=>e.type==="interception"));
assert.ok(match.events.every(e=>e.time>=0 && e.time<=5400));
assert.ok(match.events.every((e,i)=>i===0||match.events[i-1].time<=e.time));
assert.ok(match.events.every(e=>e.player>=0&&e.player<22&&match.players[e.player].team===e.team));
assert.deepEqual(match.events,generateMatch().events);
assert.ok(eventsUntil(match,300).every(e=>e.time<=300));
assert.ok(!eventsUntil(match,300).some(e=>e.time>300));
for(const t of [0,1,2,5,30,90,450,1200,2700,3600,5400]){
  const frame=atTime(match,t);
  assert.equal(frame.people.length,22);
  for(const p of frame.people) assert.ok(p.x>=0&&p.x<=105&&p.y>=0&&p.y<=68);
  assert.ok(frame.ball.x>=0&&frame.ball.x<=105);
  assert.ok(frame.ball.y>=0&&frame.ball.y<=68);
}
console.log("Fresh 11v11 simulation checks passed",{
  players:match.players.length,frames:match.frames,
  events:match.events.length,passes:match.events.filter(e=>e.type==="pass").length,
  shots:match.events.filter(e=>e.type==="shot").length});
