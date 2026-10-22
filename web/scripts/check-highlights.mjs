import assert from 'node:assert/strict';
import {generateMatch} from '../src/footballEngine.ts';
import {matchHighlights} from '../src/matchHighlights.ts';
const match=generateMatch(82),expected=[['SIM-82-00282',809,'Goal · 0–1'],['SIM-82-00826',2343.75,'Goal · 0–2'],['SIM-82-01053',3010,'Goal · 1–2'],['SIM-82-01597',4585.25,'Goal · 2–2'],['SIM-82-01629',4680.25,'Goal · 3–2']];
assert.deepEqual(matchHighlights(match,0,'Goals',true).map(h=>[h.event.id,h.event.time,h.label]),expected);
for(const t of [0,808.99,2343.5,4585,4680,5400])for(const filter of ['All','Goals','Chances','Defensive actions']){
  const hs=matchHighlights(match,t,filter);
  assert.ok(hs.every(h=>h.event.time<=t));
  assert.ok(hs.every(h=>h.evidenceIds.every(id=>match.events.find(e=>e.id===id&&e.time<=t))));
  if(filter==='Goals')assert.ok(hs.every(h=>h.event.type==='goal'));
}
const sequences=matchHighlights(match,5400,'All').filter(h=>h.kind==='sequence');assert.ok(sequences.length>0);
for(const h of sequences){assert.equal(h.evidenceIds.length,10);assert.equal(new Set(h.evidenceIds.map(id=>match.events.find(e=>e.id===id).team)).size,1);}
console.log('Highlight gates passed: original five goal IDs/times/scores, prefix-only filters and sourced five-pass sequences.');
