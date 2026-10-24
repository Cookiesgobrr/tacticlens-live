// Operator-only export. Never loaded by the public browser or sent by viewers.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {generateMatch,validateMatch} from '../src/footballEngine.ts';
const seed=Number(process.argv.find(x=>x.startsWith('--seed='))?.slice(7)??82);
if(!Number.isInteger(seed)||seed<1||seed>4294967295)throw Error('Invalid seed');
const match=generateMatch(seed,{version:'formations-v2'});
if(validateMatch(match).length)throw Error('Invalid engine source');
const engineSha256=createHash('sha256').update(readFileSync(new URL('../src/footballEngine.ts',import.meta.url)))
  .update(readFileSync(new URL('../src/formations.ts',import.meta.url))).digest('hex');
const source={schemaVersion:'tacticlens.session-source.v1',seed,matchId:match.matchId,
  engineVersion:match.engineVersion,engineSha256,duration:match.duration,players:match.players,events:match.events};
const target=process.argv.find((x,i)=>i>=2&&!x.startsWith('--'));
if(target)writeFileSync(target,JSON.stringify(source)+'\n');else process.stdout.write(JSON.stringify(source));
