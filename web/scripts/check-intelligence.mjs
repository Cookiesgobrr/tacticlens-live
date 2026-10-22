import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {generateMatch} from '../src/footballEngine.ts';
import {momentFacts,validateAIPack,visibleAICard,aiText,aiAudience} from '../src/momentIntelligence.ts';
const match=generateMatch(82);
const times=[...match.events.filter(e=>e.type==='goal').map(e=>e.time),2700,5400].sort((a,b)=>a-b);
// Clearly synthetic in-memory test fixture, never written to public data.
const fixture={schemaVersion:'tacticlens.foundry11.v1',status:'verified',provider:'microsoft-foundry',model:'gpt-4.1-mini',matchId:'SIM-82',seed:82,generatedAt:'2026-10-22T00:00:00Z',
  cards:times.map(t=>{const moment=momentFacts(match,t);return {moment,angle:'score',selectedClaimIds:moment.claims.map(c=>c.id),
    modes:{fan:['score'],analyst:['activity'],club_home:['team0'],club_away:['team1'],player:['player'],broadcast:['score','goal']}}}),
  trace:['Insight','Verification','Presentation'].map(stage=>({stage,agent:'TacticLens11'+stage,status:'complete',responseId:'test-only-'+stage,inputTokens:1,outputTokens:1,elapsedMs:1}))};
assert.ok(validateAIPack(fixture,match));
assert.equal(visibleAICard(fixture,0,'fan',2,9),null);
assert.equal(visibleAICard(fixture,4680,'fan',2,9).moment.checks.score.join('-'),'2-2');
assert.equal(visibleAICard(fixture,4680.25,'fan',2,9).moment.checks.score.join('-'),'3-2');
assert.equal(visibleAICard(fixture,2343.75,'player',2,9),null,'Player view must not reuse another player\'s AI');
assert.equal(visibleAICard(fixture,2701,'player',2,20).moment.player,20);
assert.equal(visibleAICard(fixture,5400,'player',2,20),null,'Old player moments must not masquerade as current analysis');
assert.equal(visibleAICard(fixture,1500,'fan',2,9),null,'Uncovered moments use the live deterministic fallback');
assert.equal(aiAudience('club',1),'club_away');
assert.ok(aiText(fixture.cards.at(-1),'club_home').includes('Northport'));
for(const mutate of [
 p=>p.seed=2027,
 p=>p.cards[0].moment.checks.score[0]=99,
 p=>p.cards[0].moment.claims[0].evidenceIds.push('SIM-82-01629'),
 p=>p.cards[0].moment.claims[0].text='Northport win 99–0.',
 p=>p.cards[0].modes.fan=['EVT-ARCHIVED'],
 p=>p.cards[0].selectedClaimIds.push('made-up'),
 p=>p.cards[0].moment.atSecond=5400,
 p=>p.trace[1].status='rejected',
 p=>p.cards[0].modes.unknown=['score']
]){const broken=structuredClone(fixture);mutate(broken);assert.equal(validateAIPack(broken,match),null);}
const file=new URL('../public/data/foundry-sim82.json',import.meta.url);
assert.ok(existsSync(file),'A genuine audited publication is required for the final milestone');
const real=JSON.parse(readFileSync(file,'utf8'));
assert.ok(validateAIPack(real,match));
assert.ok(real.trace.every(t=>!t.responseId.startsWith('test-')));
console.log('11v11 AI gates passed: genuine cache parity, timing, 3–2 score, player/team scope and fabricated/future/archived mutations.');
