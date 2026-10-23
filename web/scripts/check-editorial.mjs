import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateMatch} from '../src/footballEngine.ts';
import {AUDIENCES,visibleAICard,validateAIPack} from '../src/momentIntelligence.ts';
import {compileCommentary,auditCommentary,commentaryExport,auditCommentaryExport} from '../src/editorialCommentary.ts';
import {formationFacts,formationBriefing,auditFormationFacts} from '../src/formationIntelligence.ts';
import {FORMATIONS} from '../src/formations.ts';
const match=generateMatch(82),pack=JSON.parse(readFileSync(new URL('../public/data/foundry-sim82.json',import.meta.url),'utf8'));
assert.ok(validateAIPack(pack,match));
for(const card of pack.cards){
 const texts=AUDIENCES.map(audience=>{
  const n=compileCommentary(match,card,audience),at=card.moment.atSecond;
  assert.ok(auditCommentary(match,card,audience,n,at));
  assert.equal(n.method,'foundry-plan/authored-grammar');
  assert.equal(n.text,n.lines.map(l=>l.text).join(' '));
  assert.ok(n.lines.every(l=>l.claimIds.length&&l.evidenceIds.length));
  for(const l of n.lines)for(const id of l.evidenceIds)assert.ok(match.events.some(e=>e.id===id&&e.time<=at));
  assert.ok(!/undefined|\bNaN\b|all two|one unanswered goals|\b1 shots|EVT-|crowd|roar|assist|world.class/i.test(n.text));
  if(audience==='fan')assert.ok(n.lines.length>=2&&n.lines.length<=4&&n.text.split(' ').length>=35);
  if(audience==='analyst')assert.ok(n.lines.length>=4&&n.text.includes('synthetic xG')&&n.text.includes('possession window'));
  if(audience==='broadcast')assert.ok(n.lines.length===1&&n.text.length<170);
  const json=commentaryExport(match,card,audience,at);
  assert.equal(json.text,n.text);assert.ok(auditCommentaryExport(match,card,audience,json));
  assert.ok(!auditCommentary(match,card,audience,n,at-.25));
  assert.ok(!auditCommentary(match,card,audience,n,at+120.25));
  if(audience==='player')assert.ok(!auditCommentary(match,card,audience,n,at,(n.player+1)%22));
  for(const mutate of [
   x=>x.lines[0].text+=' A roaring crowd celebrates.',x=>x.lines[0].evidenceIds.push('EVT-001'),
   x=>x.lines[0].claimIds.push('invented-pressing-cause'),x=>x.audience='unknown',
   x=>x.lines[0].rosterIds=[99],x=>x.text=x.text.replace('Northport','Fake Club'),x=>x.atSecond+=1,
  ]){const bad=structuredClone(n);mutate(bad);assert.ok(!auditCommentary(match,card,audience,bad,at));}
  const bad=structuredClone(json);bad.text+=' Unverified extra sentence.';assert.ok(!auditCommentaryExport(match,card,audience,bad));
  return n.text;
 });
 assert.equal(new Set(texts).size,AUDIENCES.length,'Every audience must have its own editorial treatment');
 for(const team of [0,1]){
  const b=formationBriefing(match,team,card.moment.atSecond,card),f=b.facts;
  assert.equal(f.formation,'4-3-3');assert.ok(b.context);assert.ok(auditFormationFacts(match,team,f.atSecond,f));
  assert.ok(f.window.sampledSeconds.every(t=>t<=f.atSecond&&t>=f.window.fromSecond));
  assert.ok(f.exampleIds.every(id=>f.evidenceIds.includes(id)));
  assert.ok(!auditFormationFacts(match,team,f.atSecond-.25,f));
  for(const mutate of [x=>x.observed.widthM+=1,x=>x.evidenceIds.push('SIM-82-99999'),x=>x.team=1-team,x=>x.anchors[1].role='ST']){const bad=structuredClone(f);mutate(bad);assert.ok(!auditFormationFacts(match,team,f.atSecond,bad));}
 }
}
const winner=pack.cards.find(c=>c.moment.atSecond===4680.25),fan=compileCommentary(match,winner,'fan').text;
assert.ok(fan.includes('Northport are ahead!')&&fan.includes('95 seconds later')&&fan.includes('all three'));
assert.ok(compileCommentary(match,pack.cards.at(-1),'fan').text.includes('22 shots'));
assert.ok(!compileCommentary(match,pack.cards.at(-1),'club_away').text.includes('must now recover'));
assert.equal(visibleAICard(pack,4680,'fan',2,9).moment.atSecond,4585.25);
assert.equal(visibleAICard(pack,0,'fan',2,9),null);
assert.equal(formationFacts(match,0,0).observed,null);
for(let seed=2025;seed<2030;seed++){
 const m=generateMatch(seed,{version:'formations-v2'}),b=formationBriefing(m,0,5400,winner);
 assert.equal(b.facts.formation,FORMATIONS[seed%5].name);assert.equal(b.context,null);
 assert.deepEqual(b.facts.anchors.map(a=>a.role),FORMATIONS[seed%5].roles);
 assert.ok(!b.paragraphs.join(' ').includes('undefined'));assert.throws(()=>compileCommentary(m,winner,'fan'));
}
for(const at of [-1,5401,Infinity,NaN])assert.throws(()=>formationFacts(match,0,at));
console.log('Editorial gates passed: 42 distinct audience contracts, 14 source-bound formation profiles, five nominal shapes, player/time scope, exact rendered/export parity and tampered English/IDs/metrics rejected.');
