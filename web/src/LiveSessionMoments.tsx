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
export function useSessionFeed(match:Timeline,sid:string){
 const [result,setResult]=useState<{feed:SessionFeed|null;state:string;matchId:string;sid:string}>({feed:null,state:'waiting',matchId:'',sid:''});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const url=endpoint(sid);let active=true,failures=0,timer:ReturnType<typeof setTimeout>,control:AbortController;
  setResult({feed:null,state:url?'connecting':'unavailable',matchId:match.matchId,sid});
  if(!url)return;
  async function poll(){
   control=new AbortController();const deadline=setTimeout(()=>control.abort(),8000);
   try{
    const response=await fetch(url!,{signal:control.signal,credentials:'omit',referrerPolicy:'no-referrer',headers:{Accept:'application/json'}});
    if(!response.ok)throw Error('Unavailable');
    const feed=validateSessionFeed(await response.json(),match,sid);
    if(!feed)throw Error('Evidence rejected');
    if(!active)return;
    failures=0;setResult({feed,state:'ready',matchId:match.matchId,sid});
    if(feed.status==='running'&&feed.generationEnabled)timer=setTimeout(poll,3000);
   }catch{if(active){failures++;setResult(previous=>({...previous,state:'unavailable'}));if(failures<6)timer=setTimeout(poll,Math.min(30000,3000*2**failures));}}
   finally{clearTimeout(deadline);}
  }
  void poll();return()=>{active=false;clearTimeout(timer);control?.abort();};
 },[match,sid,retry]);
 const valid=result.matchId===match.matchId&&result.sid===sid;
 return {feed:valid?result.feed:null,state:valid?result.state:'waiting',retry:()=>setRetry(n=>n+1)};
}
function recordStatus(r:SessionRecord,enabled:boolean){
 if(r.state==='verified')return 'Verified insight available';
 if(r.state==='fallback'||!enabled)return 'Fallback / unavailable';
 if(r.state==='identified')return 'Event identified';
 if(r.state==='processing')return 'AI processing';
 return 'Evidence verification';
}
export default function LiveSessionMoments({match,time,onReplay,onJoin}:{match:Timeline;time:number;onReplay:(e:EventLog)=>void;onJoin:(time:number,speed:number)=>void}){
 const sid=new URLSearchParams(location.search).get('session')??import.meta.env.VITE_LIVE_SESSION_ID??'';
 const {feed,state,retry}=useSessionFeed(match,sid);
 const [audience,setAudience]=useState<Audience>('fan'),[player,setPlayer]=useState(9);
 const records=(feed?.records??[]).filter(r=>r.candidate.atSecond<=time).sort((a,b)=>b.candidate.atSecond-a.candidate.atSecond);
 const latest=records[0];
 const status=state==='unavailable'?'Fallback / unavailable':!latest?'Waiting for match events':recordStatus(latest,!!feed?.generationEnabled);
 return <details className="live-session-preview" open={!!sid} data-testid="live-session">
  <summary>AI Moments <span>Event-driven preview</span></summary>
  <div className="live-session-state" role="status" data-testid="session-status">{status}</div>
  {feed&&<div className="live-session-controls"><span>Server clock {liveClock(feed.clock)} · {feed.status.replaceAll('_',' ')}</span>
   <button onClick={()=>onJoin(feed.clock,feed.speed)}>Join live clock</button></div>}
  {!sid&&<p className="new-muted">An authorized session is required. The verified showcase remains available below.</p>}
  {state==='unavailable'&&sid&&<button onClick={retry}>Reconnect read-only feed</button>}
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
      <span className="live-session-provenance">{verified?'Cached verified insight':recordStatus(r,!!feed?.generationEnabled)}{r.providerMode==='offline-mock'?' · Offline test':''}</span>
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
