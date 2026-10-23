import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateMatch} from '../src/footballEngine.ts';
import {AUDIENCES,validateAIPack} from '../src/momentIntelligence.ts';
import {momentFacts} from '../src/momentIntelligence.ts';
import {auditCommentary} from '../src/editorialCommentary.ts';
import {auditFormationFacts,formationBriefing} from '../src/formationIntelligence.ts';
const p=JSON.parse(readFileSync(process.argv[2],'utf8')),match=generateMatch(82);
assert.equal(p.schemaVersion,'tacticlens.editorial-review.v1');assert.ok(validateAIPack(p.pack,match));
assert.equal(p.narratives.length,p.pack.cards.length*AUDIENCES.length);
let index=0;for(const card of p.pack.cards)for(const audience of AUDIENCES)assert.ok(auditCommentary(match,card,audience,p.narratives[index++],card.moment.atSecond),`Editorial contract: ${card.moment.id}/${audience}`);
assert.equal(p.formations.length,p.pack.cards.length*2);index=0;for(const card of p.pack.cards)for(const team of [0,1])assert.ok(auditFormationFacts(match,team,card.moment.atSecond,p.formations[index++]),'Formation source mismatch');


assert.deepEqual(p.source,{schemaVersion:'tacticlens.source11.v1',matchId:match.matchId,seed:match.seed,players:match.players,events:match.events,moments:p.pack.cards.map(c=>momentFacts(match,c.moment.atSecond))});
const wanted=[...new Set(p.formations.flatMap(f=>{const a=[];for(let s=Math.ceil(f.window.fromSecond/5)*5;s<=f.atSecond;s+=5)a.push(s);return a;}))].sort((a,b)=>a-b);
assert.deepEqual(p.sampleFrames.map(f=>f.second),wanted);
for(const f of p.sampleFrames){const i=f.second/match.frameSeconds;assert.deepEqual(f,{second:f.second,phase:match.ballPhases[i],owner:match.owners[i],people:match.players.map(p=>({x:match.positions[(i*22+p.id)*2],y:match.positions[(i*22+p.id)*2+1]}))});}

assert.deepEqual(p.formationNarratives,p.pack.cards.flatMap(c=>[0,1].map(team=>formationBriefing(match,team,c.moment.atSecond,c))));

console.log('Canonical editorial language, all audiences and formation contracts verified against the authoritative engine.');
