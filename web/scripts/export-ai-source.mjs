import {mkdirSync,writeFileSync} from 'node:fs';
import {generateMatch,validateMatch} from '../src/footballEngine.ts';
import {momentFacts} from '../src/momentIntelligence.ts';
const flag=process.argv.find(a=>a.startsWith('--seed='));
const seed=flag?Number(flag.slice('--seed='.length)):82;
if(!Number.isInteger(seed)||seed<1||seed>4294967295)throw Error('Invalid seed');
const match=seed===82?generateMatch(82):generateMatch(seed,{version:'formations-v2'});
if(validateMatch(match).length)throw Error('Source simulation failed invariants');
const moments=[...match.events.filter(e=>e.type==='goal').map(e=>e.time),2700,5400].sort((a,b)=>a-b);
const payload={schemaVersion:'tacticlens.source11.v1',matchId:match.matchId,seed:match.seed,duration:match.duration,
  players:match.players,events:match.events,moments:moments.map(t=>momentFacts(match,t))};
const target=process.argv.find((arg,i)=>i>=2&&!arg.startsWith('--'))??`../artifacts/sim${seed}-source.json`;
mkdirSync(new URL('../../artifacts/',import.meta.url),{recursive:true});
writeFileSync(target,JSON.stringify(payload,null,2)+'\n');
console.log(`Exported ${payload.moments.length} moments and ${match.events.length} actual match events to ${target}`);
