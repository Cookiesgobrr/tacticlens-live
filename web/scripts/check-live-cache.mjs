import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {generateMatch} from '../src/footballEngine.ts';
import {validateAIPack,visibleAICard} from '../src/momentIntelligence.ts';
import {compileCommentary} from '../src/editorialCommentary.ts';
import {LIVE_SECOND,LIVE_SOURCE_SHA256,LIVE_ENGINE_SHA256,validateLivePublication,liveEligible} from '../src/liveMomentCache.ts';
const match=generateMatch(82),showcase=JSON.parse(readFileSync(new URL('../public/data/foundry-sim82.json',import.meta.url),'utf8'));
assert.ok(validateAIPack(showcase,match));
assert.equal(createHash('sha256').update(readFileSync(new URL('../src/footballEngine.ts',import.meta.url))).digest('hex'),LIVE_ENGINE_SHA256,'Approved source engine must remain unchanged');
assert.equal(createHash('sha256').update(readFileSync(new URL('../public/data/foundry-sim82.json',import.meta.url))).digest('hex'),'ea1982c5730bd29060ec99416033d636152020e69081487ef8411d1b653d8c1d','Original genuine showcase must remain unchanged');
// Explicitly synthetic, in-memory transport/contract fixture. Never published.
const fixture={schemaVersion:'tacticlens.live-publication.v1',authorizationId:'issue40-seed82-winner',sourceSha256:LIVE_SOURCE_SHA256,engineSha256:LIVE_ENGINE_SHA256,
 generationStartedAt:'2026-10-23T12:00:00Z',generationFinishedAt:'2026-10-23T12:00:10Z',generationDisabledVerifiedAt:'2026-10-23T12:00:20Z',authorizationExhausted:true,
 limits:{modelCalls:3,outputTokensPerCall:1000,inputBytesPerCall:16000,automaticRetries:0},pack:{...showcase,generatedAt:'2026-10-23T12:00:10Z',
 cards:[showcase.cards.find(c=>c.moment.atSecond===LIVE_SECOND)],trace:showcase.trace.map(t=>({...t,responseId:'offline-fixture-'+t.stage,outputTokens:1}))}};
assert.ok(validateLivePublication(fixture,match));
for(const mutate of [
 p=>p.sourceSha256='a'.repeat(64),p=>p.engineSha256='b'.repeat(64),p=>p.authorizationExhausted=false,
 p=>p.limits.modelCalls=4,p=>p.limits.automaticRetries=1,p=>p.limits.outputTokensPerCall=6000,
 p=>delete p.generationDisabledVerifiedAt,p=>p.generationFinishedAt='2026-10-23T13:00:00Z',
 p=>p.pack.cards[0].moment.checks.score[0]=99,p=>p.pack.cards[0].moment.player=20,
 p=>p.pack.cards[0].moment.claims[0].evidenceIds.push('EVT-ARCHIVED'),p=>p.pack.cards[0].moment.atSecond=4680,
 p=>p.pack.trace[0].outputTokens=1001,p=>p.pack.trace[0].responseId=p.pack.trace[1].responseId,
 p=>p.pack.cards.push(showcase.cards.at(-1)),
]){const bad=structuredClone(fixture);mutate(bad);assert.equal(validateLivePublication(bad,match),null);}
assert.equal(liveEligible(match,4680),false);assert.equal(liveEligible(match,LIVE_SECOND),true);assert.equal(liveEligible(match,LIVE_SECOND+120.25),false);
assert.equal(validateLivePublication(fixture,generateMatch(2027,{version:'formations-v2'})),null);
assert.equal(visibleAICard(fixture.pack,4680,'fan',2,9),null);assert.equal(visibleAICard(fixture.pack,LIVE_SECOND,'player',2,20),null);
assert.ok(compileCommentary(match,fixture.pack.cards[0],'fan').text.includes('95 seconds later'));
const file=process.argv[2]??new URL('../public/data/live-sim82-4680.25.json',import.meta.url);
if(existsSync(file)){
 const actual=JSON.parse(readFileSync(file,'utf8'));assert.ok(validateLivePublication(actual,match),'Actual protected test must pass the production browser contract');
 assert.ok(actual.pack.trace.every(t=>!t.responseId.startsWith('offline-')&&!showcase.trace.some(old=>old.responseId===t.responseId)),'Live test needs fresh provider executions');
 console.log('Genuine live publication verified: fresh three-agent trace, exact original winning moment, disabled generation and source/engine hash.');
}
console.log('Read-only live-cache gates passed: provenance, one-moment budget, no future/wrong-player/cross-seed leakage, mutation rejection and unchanged verified fallback.');
