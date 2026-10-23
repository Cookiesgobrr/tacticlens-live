import {useEffect,useState} from 'react';
import type {EventLog,Timeline} from './footballEngine';
import {ANGLES,AUDIENCES,validateAIPack,type AIPack,type AICard,type Audience} from './momentIntelligence';
import {compileCommentary,commentaryExport} from './editorialCommentary';
import {vttTimestamp} from './matchEvidence';
const matchClock=(s:number)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
export function useVerifiedMatchAI(match:Timeline){
  const [feed,setFeed]=useState<{matchId:string;pack:AIPack|null;state:string}>({matchId:'',pack:null,state:'loading'});
  useEffect(()=>{
    if(match.seed!==82){setFeed({matchId:match.matchId,pack:null,state:'other-seed'});return;}
    const control=new AbortController();let active=true;
    const timer=setTimeout(()=>control.abort(),8000);
    fetch(`${import.meta.env.BASE_URL}data/foundry-sim82.json`,{signal:control.signal})
      .then(r=>{if(!r.ok)throw Error('Cache unavailable');return r.json()})
      .then(value=>{const pack=validateAIPack(value,match);if(active)setFeed({matchId:match.matchId,pack,state:pack?'ready':'rejected'})})
      .catch(()=>{if(active)setFeed({matchId:match.matchId,pack:null,state:'unavailable'})})
      .finally(()=>clearTimeout(timer));
    return()=>{active=false;clearTimeout(timer);control.abort()};
  },[match]);
  return feed.matchId===match.matchId?feed:{matchId:match.matchId,pack:null,state:'loading'};
}

/** Event-derived UI heading, separate from the agents' cached evidence composition. */
export function momentHeadline(card:AICard,match:Timeline){
  const c=card.moment.checks;
  if(card.moment.atSecond===5400)return 'The full-time verdict';
  if(card.moment.atSecond===2700)return 'The story at half-time';
  const goal=match.events.find(e=>e.id===c.goalId&&e.time===card.moment.atSecond);
  if(!goal)return ANGLES[card.angle];
  const club=goal.team===0?'Northport':'Southbridge',own=c.score[goal.team],other=c.score[1-goal.team];
  return own===other?`${club} draw level`:own<other?`${club} pull one back`:own+other===1?`${club} strike first`:own-other===1?`${club} take the lead`:`${club} extend the lead`;
}

export default function FoundryMoment({card,pack,audience,match,time,onSeek,onReplay}:{card:AICard;pack:AIPack;audience:Audience;match:Timeline;time:number;onSeek:(e:EventLog)=>void;onReplay:(e:EventLog)=>void}){
  const narrative=compileCommentary(match,card,audience);
  const ids=[...new Set(narrative.lines.flatMap(line=>line.evidenceIds))];
  const primary=[...new Set([card.moment.checks.shotId,card.moment.checks.goalId,...ids.slice(-4)].filter((s):s is string=>!!s))];
  const label=audience==='club_home'?'Northport supporters':audience==='club_away'?'Southbridge supporters':audience==='player'?match.players[card.moment.player].name:audience==='analyst'?'Analyst view':'Fan view';
  function download(format:'json'|'vtt'){
    const edition=format==='vtt'?compileCommentary(match,card,'broadcast'):narrative;
    const text=edition.text;
    const end=Math.floor(Math.min(time,card.moment.atSecond+8)*1000)/1000;
    const payload=format==='json'?JSON.stringify({...commentaryExport(match,card,audience,time),provider:pack.provider,model:pack.model,generatedAt:pack.generatedAt,card,trace:pack.trace},null,2):
      `WEBVTT\n\nNOTE Precomputed Foundry evidence plan; authored Broadcast grammar | ${pack.matchId}\nEvidence: ${[...new Set(edition.lines.flatMap(l=>l.evidenceIds))].join(' · ')}\n\n`+(end>card.moment.atSecond?`${card.moment.id}\n${vttTimestamp(card.moment.atSecond)} --> ${vttTimestamp(end)}\n${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}\n`:'');
    const url=URL.createObjectURL(new Blob([payload],{type:format==='json'?'application/json':'text/vtt'}));
    const a=document.createElement('a');a.href=url;a.download=`${pack.matchId}-AI-${card.moment.atSecond}-${format==='vtt'?'broadcast':audience}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <div className="new-foundry-moment" data-testid="foundry-moment" data-moment-time={card.moment.atSecond}>
    <div className="new-ai-context"><span>{label}</span><span>Evidence at {matchClock(card.moment.atSecond)}</span></div>
    <h4 title="Event-derived headline; narrative evidence selected by Foundry">{momentHeadline(card,match)}</h4><div className="ai-narrative" data-testid="editorial-commentary"><p className="editorial-lead">{narrative.lines[0]?.text}</p>{narrative.lines.length>1&&<p>{narrative.lines.slice(1).map(l=>l.text).join(" ")}</p>}</div>
    <div className="ai-metrics"><span><b>{card.moment.checks.score.join('–')}</b> Score</span><span><b>{card.moment.checks.shots.reduce((a,b)=>a+b,0)}</b> Shots</span><span><b>{card.moment.checks.xg.reduce((a,b)=>a+b,0).toFixed(2)}</b> xG</span></div>
    <button className="replay-insight" onClick={()=>onReplay(match.events.find(e=>e.id===(card.moment.checks.goalId??card.moment.checks.shotId??ids.at(-1)))!)}>Replay this evidence ↗</button>
    <div className="new-evidence-links">{primary.map(id=>{const e=match.events.find(e=>e.id===id)!;return <button key={id} onClick={()=>onSeek(e)}>{matchClock(e.time)} · {e.type}<small>{id}</small></button>})}</div>
    <details className="new-ai-audit"><summary>Agent trace, all evidence & broadcast exports</summary>
      <p className="new-muted">Three separate Microsoft Agent Framework agents select, verify and compose the evidence plan. Original editorial grammar now turns that plan into audience-specific coverage; the model did not author these full paragraphs. Every clause is bound to independently checked source claims. No new model calls were made for this rendering upgrade or during replay.</p>
      {pack.trace.map(t=><div className="new-ai-stage" key={t.stage}><strong>{t.stage} ✓</strong><span>{t.agent} · {t.inputTokens+t.outputTokens} tokens · {(t.elapsedMs/1000).toFixed(1)} s</span><code>{t.responseId}</code></div>)}
      <details className="editorial-contract"><summary>Sentence-by-sentence evidence</summary>{narrative.lines.map(l=><div key={l.id}><p>{l.text}</p><small>{l.id} · {l.claimIds.join(', ')} · {l.evidenceIds.join(' · ')}{l.rosterIds?.length?' · Roster: '+l.rosterIds.join(', '):''}</small></div>)}</details>
      <p className="new-muted">JSON matches the selected commentary. Broadcast captions use a shorter, source-linked Broadcast edition.</p>
      <div className="new-evidence-links">{ids.map(id=>{const e=match.events.find(e=>e.id===id)!;return <button key={id} onClick={()=>onSeek(e)}>{id}</button>})}</div>
      <div className="new-export-actions"><button onClick={()=>download('json')}>Export AI moment JSON</button><button onClick={()=>download('vtt')}>Export AI broadcast VTT</button></div>
      <small className="new-muted">{AUDIENCES.length} evidence compositions · Generated {pack.generatedAt.slice(0,10)} · Match-clock captions, bounded by the replay time.</small>
    </details>
  </div>;
}
