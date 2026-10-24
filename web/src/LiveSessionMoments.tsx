import {useEffect,useState} from 'react';
import type {EventLog,Timeline} from './footballEngine';
import {AUDIENCES,type Audience} from './momentIntelligence';
import {edition,liveClock,liveHeadline,validateSessionFeed,type SessionFeed,type SessionRecord} from './sessionIntelligence';

function endpoint(sid:string){
 const configured=import.meta.env.VITE_LIVE_SESSION_READ_ORIGIN;
 if(!configured||!/^[-a-zA-Z0-9_]{8,80}$/.test(sid))return null;
 try{const u=new URL(configured);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')return null;
  return `${u.origin}/api/session-feed/${encodeURIComponent(sid)}`;}catch{return null;}
}
/** The completed, verified Azure session is mirrored as a same-origin read-only
 * asset during Pages deployment. It must never generate or reserve AI work. */
function snapshotEndpoint(sid:string){
 const approved=import.meta.env.VITE_LIVE_SESSION_ID;
 if(!approved||sid!==approved||!/^[-a-zA-Z0-9_]{8,80}$/.test(sid))return null;
 return `${import.meta.env.BASE_URL}data/session-${sid}.json`;
}
export function useSessionFeed(match:Timeline,sid:string){
 const [result,setResult]=useState<{feed:SessionFeed|null;state:string;matchId:string;sid:string}>({feed:null,state:'waiting',matchId:'',sid:''});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const remote=endpoint(sid),snapshot=snapshotEndpoint(sid);
  let active=true,failures=0,timer:ReturnType<typeof setTimeout>|undefined;
  let control:AbortController|undefined;
  setResult({feed:null,state:remote||snapshot?'connecting':'unavailable',matchId:match.matchId,sid});
  if(!remote&&!snapshot)return;
  async function read(url:string):Promise<SessionFeed>{
    const next=new AbortController();control=next;
    const deadline=setTimeout(()=>next.abort(),8000);
    try{
      const response=await fetch(url,{method:'GET',signal:next.signal,credentials:'omit',
        referrerPolicy:'no-referrer',headers:{Accept:'application/json'}});
      if(!response.ok)throw Error('Read-only feed unavailable');
      const raw=await response.text();
      if(raw.length>750000)throw Error('Feed too large');
      const feed=validateSessionFeed(JSON.parse(raw),match,sid);
      if(!feed)throw Error('Feed did not pass evidence verification');
      return feed;
    }finally{clearTimeout(deadline);}
  }
  async function poll(){
    try{
      // Read the same-origin historical snapshot first. For an active session
      // continue on the dedicated read-only Azure endpoint, never a model POST.
      const feed=!failures&&snapshot?await read(snapshot).catch(()=>{
        if(!remote)throw Error('No verified snapshot');return read(remote);
      }):remote?await read(remote):await read(snapshot!);
      if(!active)return;
      failures=0;setResult({feed,state:'ready',matchId:match.matchId,sid});
      if(feed.status==='running'&&feed.generationEnabled&&remote){
        // The server owns the accelerated simulated clock. Never set the
        // browser's video playback speed to feed.speed.
        timer=setTimeout(()=>{void pollRemote();},3000);
      }
    }catch{if(active){failures++;setResult(previous=>previous.feed?previous:
      {...previous,state:'unavailable'});
      if(failures<3)timer=setTimeout(()=>{void poll();},Math.min(15000,3000*2**failures));
    }}
  }
  async function pollRemote(){
    if(!remote||!active)return;
    try{
      const feed=await read(remote);
      if(!active)return;
      failures=0;setResult({feed,state:'ready',matchId:match.matchId,sid});
      if(feed.status==='running'&&feed.generationEnabled)
        timer=setTimeout(()=>{void pollRemote();},3000);
    }catch{if(active){failures++;
      setResult(previous=>previous.feed?previous:{...previous,state:'unavailable'});
      if(failures<3)timer=setTimeout(()=>{void pollRemote();},Math.min(15000,3000*2**failures));
    }}
  }
  void poll();
  return()=>{active=false;if(timer)clearTimeout(timer);control?.abort();};
 },[match,sid,retry]);
 const valid=result.matchId===match.matchId&&result.sid===sid;
 return {feed:valid?result.feed:null,state:valid?result.state:'waiting',retry:()=>setRetry(n=>n+1)};
}
function recordStatus(r:SessionRecord,generating:boolean){
 if(r.state==='verified')return 'Verified insight available';
 if(r.state==='fallback')return 'Factual fallback for this event';
 if(!generating)return 'Factual-only moment · AI generation disabled';
 if(r.state==='identified')return 'Event identified';
 if(r.state==='processing')return 'AI processing';
 return 'Evidence verification';
}
export default function LiveSessionMoments({match,time,onReplay,onJoin}:{match:Timeline;time:number;onReplay:(e:EventLog)=>void;onJoin:(time:number,isActive:boolean)=>void}){
 const sid=new URLSearchParams(location.search).get('session')??import.meta.env.VITE_LIVE_SESSION_ID??'';
 const {feed,state,retry}=useSessionFeed(match,sid);
 const [audience,setAudience]=useState<Audience>('fan'),[player,setPlayer]=useState(9);
 const records=(feed?.records??[]).filter(r=>r.candidate.atSecond<=time).sort((a,b)=>b.candidate.atSecond-a.candidate.atSecond);
 const latest=records[0];
 const verifiedCount=feed?.records.filter(r=>r.state==='verified').length??0;
 const completed=!!feed&&feed.status!=='running';
 const generating=!!feed?.generationEnabled&&state==='ready'&&feed.status==='running'&&feed.serviceAvailable!==false;
 const status=!feed
  ?state==='unavailable'?'Session history unavailable · original showcase still works':'Connecting to verified session history…'
  :!latest
   ?verifiedCount>0?`${verifiedCount} verified AI insights available · open completed history`:'Waiting for match events'
   :latest.state==='verified'
    ?`Verified insight available · ${verifiedCount} verified moment${verifiedCount===1?'':'s'}`
    :`${recordStatus(latest,generating)} · ${verifiedCount} verified moment${verifiedCount===1?'':'s'} in history`;
 return <details className="live-session-preview" open={!!sid} data-testid="live-session">
  <summary>AI Moments · <span>{completed?'Verified session history':'Event-driven preview'}</span></summary>
  <div className="live-session-state" role="status" data-testid="session-status">{status}</div>
  {feed&&<div className="live-session-controls"><span>Server clock {liveClock(feed.clock)} · {feed.status.replaceAll('_',' ')}</span>
   <button onClick={()=>onJoin(feed.clock,generating)}>{completed?'View completed AI history':'Join session clock (1× playback)'}</button></div>}
  {!sid&&<p className="new-muted">An authorized session is required. The verified showcase remains available below.</p>}
  {state==='unavailable'&&sid&&!feed&&<><p className="new-muted">The protected session feed could not be read. The original seven-moment Foundry showcase remains available. No AI generation is attempted here.</p><button onClick={retry}>Retry verified history</button></>}
  {!!records.length&&<>
   <label>AI moment perspective<select aria-label="AI moment perspective" value={audience} onChange={e=>setAudience(e.target.value as Audience)}>
    {AUDIENCES.map(a=><option key={a} value={a}>{({fan:'Fan',analyst:'Analyst',club_home:'Northport supporter',club_away:'Southbridge supporter',player:'Player',broadcast:'Broadcast'})[a]}</option>)}
   </select></label>
   {audience==='player'&&<label>AI moment player<select aria-label="AI moment player" value={player} onChange={e=>setPlayer(+e.target.value)}>{match.players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
   <ol className="live-session-history" aria-label="AI Moments history">{records.map((r,index)=>{
    const verified=r.state==='verified',wrongPlayer=audience==='player'&&r.facts.actor?.id!==player;
    const lines=edition(r.facts,audience,verified&&!wrongPlayer?r.plan:undefined);
    const ids=[...new Set(lines.flatMap(l=>l.evidenceIds))];
    const event=match.events.find(e=>e.id===r.candidate.eventId)??match.events.filter(e=>e.time<=r.candidate.atSecond).at(-1);
    return <li key={r.candidate.id} data-event-id={r.candidate.id} data-state={r.state}>
     <details open={index===0}>
      <summary><time>{liveClock(r.candidate.atSecond)}</time><strong>{liveHeadline(r.facts)}</strong></summary>
      <span className="live-session-provenance">{verified?'Cached verified insight':recordStatus(r,generating)}{r.providerMode==='offline-mock'?' · Offline test':''}</span>
      {wrongPlayer?<p>No verified analysis for the selected player at this moment.</p>:lines.map((line,i)=><p className={i===0?'editorial-lead':''} key={line.id}>{line.text}</p>)}
      {event&&<button onClick={()=>onReplay(event)}>Replay AI moment</button>}
      <details><summary>Sources & verification</summary>
       <p className="new-muted">{verified?'Three-agent evidence selection passed independent deterministic checks. Audience prose uses audited editorial composition.':'Instant factual coverage from the simulation. No verified AI interpretation is being published.'}</p>
       {ids.map(id=>{const e=match.events.find(e=>e.id===id);return e?<button className="live-source" key={id} onClick={()=>onReplay(e)}>{liveClock(e.time)} · {e.type}<small>{id}</small></button>:null;})}
       {r.trace?.map(t=><p key={t.stage}><strong>{t.stage}</strong> · {t.inputTokens+t.outputTokens} tokens · {(t.elapsedMs/1000).toFixed(1)}s <code>{t.responseId}</code></p>)}
       {verified&&<p className="new-muted">Event-to-publication: {((r.eventToPublicationMs??0)/1000).toFixed(1)}s. Workflow: {((r.elapsedMs??0)/1000).toFixed(1)}s. Late results remain in history.</p>}
      </details>
     </details>
    </li>;
   })}</ol>
  </>}
 </details>;
}
