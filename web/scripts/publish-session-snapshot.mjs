// Mirror a completed, public, READ-ONLY Azure session into the GitHub Pages
// build. This tool cannot invoke models and never uses function keys.
// Run during Pages deployment, and reject any tampered or unavailable feed.
// The snapshot is deliberately not committed to Git or made from fabricated JSON.
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {generateMatch} from '../src/footballEngine.ts';
import {validateSessionFeed} from '../src/sessionIntelligence.ts';

const sid=process.env.VITE_LIVE_SESSION_ID;
const origin=process.env.VITE_LIVE_SESSION_READ_ORIGIN;
if(!sid||!origin)throw Error('Deployment requires configured read-only session ID and origin');
if(!/^[-a-zA-Z0-9_]{8,80}$/.test(sid))throw Error('Invalid session ID');
const base=new URL(origin);
if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||base.pathname!=='/')
 throw Error('Session feed must use clean HTTPS origin');
const url=new URL('/api/session-feed/'+encodeURIComponent(sid),base);
const response=await fetch(url,{signal:AbortSignal.timeout(20000),method:'GET',headers:{Accept:'application/json'}});
if(!response.ok)throw Error('Read-only Azure session feed HTTP '+response.status);
const body=await response.text();
if(body.length>750000)throw Error('Session feed unexpectedly large');
const raw=JSON.parse(body);
const match=generateMatch(82,{version:'formations-v2'});
const feed=validateSessionFeed(raw,match,sid);
if(!feed)throw Error('Azure session history failed independent browser evidence verification');
if(feed.status==='running')throw Error('Refusing to freeze an unfinished live session');
const count=feed.records.filter(r=>r.state==='verified').length;
if(count<9)throw Error('Completed public session has fewer than nine verified moments');
const directory=new URL('../public/data/',import.meta.url);
mkdirSync(directory,{recursive:true});
const target=new URL('./session-'+sid+'.json',directory);
writeFileSync(target,JSON.stringify(feed));
console.log('Mirrored read-only completed session:',sid,'verified:',count,
 'status:',feed.status,'clock:',feed.clock,'bytes:',body.length,
 'no Azure generation calls');
