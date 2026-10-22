import {useEffect,useState} from 'react';
import type {EventLog,Timeline} from './footballEngine';
import {ANGLES,AUDIENCES,aiText,validateAIPack,type AIPack,type AICard,type Audience} from './momentIntelligence';
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

export default function FoundryMoment({card,pack,audience,match,time,onSeek,onReplay}:{card:AICard;pack:AIPack;audience:Audience;match:Timeline;time:number;onSeek:(e:EventLog)=>void;onReplay:(e:EventLog)=>void}){
  const claims=card.modes[audience].map(id=>card.moment.claims.find(c=>c.id===id)!);
  const ids=[...new Set(claims.flatMap(c=>c.evidenceIds))];
  const primary=[...new Set([card.moment.checks.shotId,card.moment.checks.goalId,...ids.slice(-4)].filter((s):s is string=>!!s))];
  const label=audience==='club_home'?'Northport supporters':audience==='club_away'?'Southbridge supporters':audience==='player'?match.players[card.moment.player].name:audience==='analyst'?'Analyst view':'Fan view';
  function download(format:'json'|'vtt'){
    const text=aiText(card,audience);
    const end=Math.floor(Math.min(time,card.moment.atSecond+8)*1000)/1000;
    const payload=format==='json'?JSON.stringify({schemaVersion:'tacticlens.ai-moment.v1',matchId:pack.matchId,seed:pack.seed,asOfSecond:time,
      provider:pack.provider,model:pack.model,generatedAt:pack.generatedAt,narrativeMethod:'AI-selected canonical evidence sentences',audience,text,card,trace:pack.trace},null,2):
      `WEBVTT\n\nNOTE Precomputed Foundry editorial selection | ${pack.matchId}\n\n`+(end>card.moment.atSecond?`${card.moment.id}\n${vttTimestamp(card.moment.atSecond)} --> ${vttTimestamp(end)}\n${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}\n${ids.join(' · ')}\n`:'');
    const url=URL.createObjectURL(new Blob([payload],{type:format==='json'?'application/json':'text/vtt'}));
    const a=document.createElement('a');a.href=url;a.download=`${pack.matchId}-AI-${card.moment.atSecond}-${audience}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <div className="new-foundry-moment" data-testid="foundry-moment" data-moment-time={card.moment.atSecond}>
    <div className="new-ai-context"><span>{label}</span><span>Evidence at {matchClock(card.moment.atSecond)}</span></div>
    <h4>{ANGLES[card.angle]}</h4><p className="ai-narrative">{aiText(card,audience)}</p>
    <div className="ai-metrics"><span><b>{card.moment.checks.score.join('–')}</b> Score</span><span><b>{card.moment.checks.shots.reduce((a,b)=>a+b,0)}</b> Shots</span><span><b>{card.moment.checks.xg.reduce((a,b)=>a+b,0).toFixed(2)}</b> xG</span></div>
    <button className="replay-insight" onClick={()=>onReplay(match.events.find(e=>e.id===(card.moment.checks.goalId??card.moment.checks.shotId??ids.at(-1)))!)}>Replay this evidence ↗</button>
    <div className="new-evidence-links">{primary.map(id=>{const e=match.events.find(e=>e.id===id)!;return <button key={id} onClick={()=>onSeek(e)}>{matchClock(e.time)} · {e.type}<small>{id}</small></button>})}</div>
    <p className="new-muted">Precomputed GPT-4.1-mini editorial selection · Factual sentences rendered from verified synthetic events.</p>
    <details className="new-ai-audit"><summary>Agent trace, all evidence & broadcast exports</summary>
      <p className="new-muted">Three separate Microsoft Agent Framework agents select, review and compose the evidence. Code independently verifies the event prefix and restricts factual wording. No model calls occur while you watch.</p>
      {pack.trace.map(t=><div className="new-ai-stage" key={t.stage}><strong>{t.stage} ✓</strong><span>{t.agent} · {t.inputTokens+t.outputTokens} tokens · {(t.elapsedMs/1000).toFixed(1)} s</span><code>{t.responseId}</code></div>)}
      <div className="new-evidence-links">{ids.map(id=>{const e=match.events.find(e=>e.id===id)!;return <button key={id} onClick={()=>onSeek(e)}>{id}</button>})}</div>
      <div className="new-export-actions"><button onClick={()=>download('json')}>Export AI moment JSON</button><button onClick={()=>download('vtt')}>Export AI broadcast VTT</button></div>
      <small className="new-muted">{AUDIENCES.length} evidence compositions · Generated {pack.generatedAt.slice(0,10)} · Match-clock captions, bounded by the replay time.</small>
    </details>
  </div>;
}
