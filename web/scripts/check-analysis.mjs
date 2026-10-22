import assert from 'node:assert/strict';
import {generateMatch,eventsUntil} from '../src/footballEngine.ts';
import {matchStory,pulse,placeLabels} from '../src/matchAnalysis.ts';
const match=generateMatch(2027);
for(const time of [0,45,300,2700,5399,5400]){
  const visible=eventsUntil(match,time);
  for(const lens of ['fan','analyst','club','player']){
    const story=matchStory(match,visible,lens,0,9);
    assert.ok(story.evidence.every(e=>e.time<=time&&visible.includes(e)));
    assert.equal(new Set(story.evidence.map(e=>e.id)).size,story.evidence.length);
  }
  const p=pulse(visible);
  assert.equal(p.shots.reduce((a,b)=>a+b),visible.filter(e=>e.type==='shot').length);
  assert.equal(p.score.reduce((a,b)=>a+b),visible.filter(e=>e.type==='goal').length);
}
const empty=pulse(eventsUntil(match,0));assert.deepEqual(empty.xg,[0,0]);assert.deepEqual(empty.score,[0,0]);
const people=Array.from({length:22},(_,i)=>({x:100+(i%5)*140,y:100+Math.floor(i/5)*110}));
const boxes=placeLabels(people,[9,1,2,3,4]);
for(const [i,b] of boxes.entries()){
  assert.ok(b.x>=25&&b.y>=55&&b.x+b.width<=975&&b.y+b.height<=610);
  for(const q of boxes.slice(i+1))assert.ok(b.x+b.width+5<=q.x||q.x+q.width+5<=b.x||b.y+b.height+5<=q.y||q.y+q.height+5<=b.y);
}
console.log('Analysis gates passed: evidence time boundary, source identity, exact counts, label placement.');
