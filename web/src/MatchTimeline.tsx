import {useMemo,useState} from 'react';
import type {EventLog,Timeline,Side} from './footballEngine';
import {matchHighlights,type HighlightFilter} from './matchHighlights';
import type {Lens} from './matchAnalysis';
const clock=(s:number)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
export default function MatchTimeline({match,time,lens,team,player,onReplay}:{match:Timeline;time:number;lens:Lens;team:Side|2;player:number;onReplay:(e:EventLog,ids:string[])=>void}){
  const [filter,setFilter]=useState<HighlightFilter>('All'),[review,setReview]=useState(false);
  const highlights=useMemo(()=>matchHighlights(match,time,filter,review).filter(h=>lens==='club'&&team!==2?h.event.team===team:lens==='player'?h.event.player===player||h.event.target===player:true),[match,time,filter,review,lens,team,player]);
  return <section className="match-highlights" aria-label="Match highlights">
    <div className="highlights-heading"><h2>Key moments</h2><label><input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)}/> Full-match review <span>(reveals results)</span></label></div>
    <div className="highlight-filters" aria-label="Event filters">{(['All','Goals','Chances','Defensive actions'] as HighlightFilter[]).map(f=><button key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f}</button>)}</div>
    <div className="highlight-track">{highlights.length?highlights.slice(-80).reverse().map(h=><button key={h.event.id} className={`highlight-${h.kind}`} data-event-id={h.event.id} onClick={()=>onReplay(h.event,h.evidenceIds)} aria-label={`Replay ${h.label} at ${clock(h.event.time)}`}><span className="highlight-time">{clock(h.event.time)} <b aria-hidden="true">{h.kind==='goal'?'●':h.kind==='defence'?'◇':h.kind==='sequence'?'↗':'○'}</b></span><strong>{h.label}{h.event.shotXg!==undefined&&<small> · {(h.event.shotXg*100).toFixed(1)}% xG</small>}</strong><span>{match.players[h.event.player].name}</span><small>{h.event.team===0?'Northport':'Southbridge'}</small></button>):<p>{review?'No events match this perspective.':'Moments appear as play unfolds. Enable full-match review to replay any highlight.'}</p>}</div>
    {highlights.length>80&&<small className="highlight-note">Showing the latest 80 moments. Use a filter to explore earlier actions.</small>}{filter==='All'&&<small className="highlight-note">Big chance: ≥20% synthetic xG. Passing sequences: five consecutive completed passes. All actions retain their logged evidence.</small>}
  </section>;
}
