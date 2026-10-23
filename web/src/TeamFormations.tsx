import {useMemo,useState} from 'react';
import {atTime,type Timeline,type Side,type EventLog} from './footballEngine';
import {formationBriefing} from './formationIntelligence';
import {clock} from './editorialCommentary';
import type {AICard} from './momentIntelligence';
export default function TeamFormations({match,time,card,onReplay}:{match:Timeline;time:number;card:AICard|null;onReplay:(e:EventLog)=>void}){
 const [open,setOpen]=useState(false),kickoff=useMemo(()=>atTime(match,0),[match]);
 // Observation updates once per second, while retaining an exact new AI timestamp.
 const boundary=Math.min(time,Math.max(Math.floor(time),card?.moment.atSecond??0));
 const briefs=useMemo(()=>open?([0,1] as Side[]).map(team=>formationBriefing(match,team,boundary,card)):[],[match,boundary,card,open]);
 return <details className="formation-diagrams" onToggle={e=>setOpen(e.currentTarget.open)}><summary>Team formations · {match.formations.join(' / ')}</summary>
  <div className="formation-grid">{briefs.map((brief,team)=>{const t=team as Side,f=brief.facts;return <article className="formation-team" key={team} data-testid={`formation-team-${team}`}>
   <header><h3>{team===0?'Northport FC':'Southbridge Athletic'}</h3><strong>{f.formation}</strong></header>
   <figure><svg viewBox="0 0 180 170" role="img" aria-label={`${team===0?'Northport':'Southbridge'} kickoff formation ${f.formation}`}><rect x="5" y="5" width="170" height="160" fill="#174130"/><path d="M5 165H175 M65 5V25H115V5" fill="none" stroke="#88a593"/>{match.players.filter(p=>p.team===team).map(p=>{const point=kickoff.people[p.id];return <g key={p.id}><circle cx={5+point.y/68*170} cy={5+(team===0?point.x:105-point.x)/52.5*160} r="7" fill={team===0?'#00ff85':'#77aaff'}/><text x={5+point.y/68*170} y={8+(team===0?point.x:105-point.x)/52.5*160} textAnchor="middle" fontSize="7" fill="#15121b">{p.number}</text></g>})}</svg><figcaption>Kickoff positions · nominal {f.formation}</figcaption></figure>
   <h4>{brief.headline}</h4><p>{brief.paragraphs[0]}</p>
   <div className="formation-observed"><span>Observed · {clock(f.window.fromSecond)}–{clock(f.atSecond)}</span><p>{brief.paragraphs[1]}</p></div>
   {brief.context&&<div className="formation-foundry"><span>Microsoft Foundry · match context at {clock(brief.context.atSecond)}</span><p>{brief.context.lines.map(l=>l.text).join(' ')}</p></div>}
   <details className="formation-evidence"><summary>Positioning, transitions & evidence</summary><p>{brief.paragraphs[2]}</p><ul>{f.anchors.map(a=><li key={a.id}>#{match.players[a.id].number} {match.players[a.id].name} · {a.role} · nominal {a.nominalX} m / {a.nominalY} m</li>)}</ul>
   <div className="new-evidence-links">{f.exampleIds.map(id=>{const e=match.events.find(e=>e.id===id)!;return <button key={id} onClick={()=>onReplay(e)}>{clock(e.time)} · {e.type}<small>{id}</small></button>})}</div>
   <p className="new-muted">Shape and position analysis is deterministic. The marked match context uses genuine cached Foundry evidence selection and authored editorial grammar; it is not a new model-written tactical report. Samples exclude stoppages, are five seconds apart and do not establish intent or causation.</p>
   {brief.context&&<small>Foundry sources: {[...new Set(brief.context.lines.flatMap(l=>l.evidenceIds))].join(' · ')}</small>}
   <button className="formation-download" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({facts:f,context:brief.context},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${match.matchId}-${t===0?'Northport':'Southbridge'}-formation-${f.atSecond}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Export formation evidence JSON</button>
   </details>
  </article>})}</div>
 </details>;
}
