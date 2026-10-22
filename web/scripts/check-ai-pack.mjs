import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateMatch} from '../src/footballEngine.ts';
import {validateAIPack} from '../src/momentIntelligence.ts';
const pack=JSON.parse(readFileSync(process.argv[2]??new URL('../public/data/foundry-sim82.json',import.meta.url),'utf8'));
assert.ok(validateAIPack(pack,generateMatch(82)),'Published AI must match the current production engine and completed agent trace');
console.log(`Verified real Foundry cache: ${pack.cards.length} SIM-82 moments, ${pack.trace.length} agent responses.`);
