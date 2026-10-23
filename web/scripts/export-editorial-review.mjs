// Operator/CI evidence manifest. No inference and no public cache replacement.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {generateMatch} from '../src/footballEngine.ts';
import {AUDIENCES,validateAIPack} from '../src/momentIntelligence.ts';
import {compileCommentary} from '../src/editorialCommentary.ts';
import {formationFacts,formationBriefing} from '../src/formationIntelligence.ts';
const match=generateMatch(82),pack=JSON.parse(readFileSync(process.argv[3]??new URL('../public/data/foundry-sim82.json',import.meta.url),'utf8'));
if(!validateAIPack(pack,match))throw Error('Invalid source cache');
const times=pack.cards.map(c=>c.moment.atSecond),seconds=[...new Set(times.flatMap(t=>{const r=[];for(let s=Math.ceil(Math.max(0,t-300)/5)*5;s<=t;s+=5)r.push(s);return r;}))].sort((a,b)=>a-b);
const sampleFrames=seconds.map(second=>{const f=second/match.frameSeconds;return {second,phase:match.ballPhases[f],owner:match.owners[f],people:match.players.map(p=>({x:match.positions[(f*22+p.id)*2],y:match.positions[(f*22+p.id)*2+1]}))};});
const manifest={schemaVersion:'tacticlens.editorial-review.v1',source:{schemaVersion:'tacticlens.source11.v1',matchId:match.matchId,seed:match.seed,players:match.players,events:match.events,moments:pack.cards.map(c=>c.moment)},
 pack,sampleFrames,narratives:pack.cards.flatMap(c=>AUDIENCES.map(a=>compileCommentary(match,c,a))),formationNarratives:pack.cards.flatMap(c=>[0,1].map(team=>formationBriefing(match,team,c.moment.atSecond,c))),formations:times.flatMap(t=>[0,1].map(team=>formationFacts(match,team,t)))};
const target=process.argv[2]??new URL('../../artifacts/editorial-review.json',import.meta.url).pathname;mkdirSync(new URL('../../artifacts/',import.meta.url),{recursive:true});writeFileSync(target,JSON.stringify(manifest)+'\n');console.log(`Exported 42 editorial contracts, 14 formation boundaries and ${sampleFrames.length} sampled frames.`);
