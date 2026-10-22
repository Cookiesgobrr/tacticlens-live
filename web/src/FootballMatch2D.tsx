import { useEffect, useMemo, useState } from "react";
import { generateMatch, atTime, eventsUntil, validateMatch, type Side, type EventLog } from "./footballEngine";
import {matchStory, placeLabels, shotExplanation, pulse, type Lens} from "./matchAnalysis";
import { Pause, Play, RotateCcw, FastForward, ShieldCheck, Crosshair, Activity } from "lucide-react";
const mtime=(v:number)=>String(Math.floor(v/60)).padStart(2,"0")+":"+String(Math.floor(v%60)).padStart(2,"0");
type View="fan"|"analyst"|"player";
export default function FootballMatch2D({onLegacy}:{onLegacy:()=>void}){
  const [seed,setSeed]=useState(()=>{const value=new URLSearchParams(location.search).get("seed");return value!==null&&/^\d+$/.test(value)&&+value<=4294967295?+value:2927;});
  const [seedInput,setSeedInput]=useState(String(seed));
  const [time,setTime]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(1);
  const [zoom,setZoom]=useState(1);
  const [mode,setMode]=useState<View>("fan");
  const [selected,setSelected]=useState(9);
  const [followTeam,setFollowTeam]=useState<Side|2>(()=>{try{const n=localStorage.getItem("tacticlens.followTeam");return n==="0"?0:n==="1"?1:2;}catch{return 2;}});
  useEffect(()=>{try{localStorage.setItem("tacticlens.followTeam",String(followTeam));}catch{}},[followTeam]);
  const [showPlayerStats,setShowPlayerStats]=useState(false);
  const [lens,setLens]=useState<Lens>("fan");
  const [inspected,setInspected]=useState<EventLog|null>(null);
  const match=useMemo(()=>generateMatch(seed),[seed]);
  const issues=useMemo(()=>validateMatch(match),[match]);
  const current=atTime(match,time);
  const visible=eventsUntil(match,time);
  const recent=visible.slice(-8).reverse();
  const score:[number,number]=[0,0];
  for(const e of visible)if(e.type==="goal")score[e.team]++;
  const passes:[number,number]=[0,0],completions:[number,number]=[0,0],shots:[number,number]=[0,0],tackles:[number,number]=[0,0],expectedGoals:[number,number]=[0,0];
  for(const e of visible){
    if(e.type==="pass") passes[e.team]++;
    if(e.type==="receive")completions[e.team]++;
    if(e.type==="shot"){shots[e.team]++;expectedGoals[e.team]+=e.shotXg??0;}
    if(e.type==="tackle"||e.type==="interception"||e.type==="recovery")tackles[e.team]++;
  }
  useEffect(()=>{
    if(!playing)return;
    let raf=0,previous=performance.now();
    const tick=(now:number)=>{
      const elapsed=(now-previous)/1000;
      previous=now;
      setTime(t=>Math.min(match.duration,t+elapsed*speed));
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[playing,speed,match.duration]);
  useEffect(()=>{if(time>=match.duration)setPlaying(false)},[time,match.duration]);
  const px=(v:number)=>20+v/105*960;
  const py=(v:number)=>20+v/68*620;
  const x=px(current.ball.x),y=py(current.ball.y);
  const nearest=match.players.find(p=>p.id===current.owner);
  const individual=match.players.map(p=>{
    const own=visible.filter(e=>e.player===p.id);
    const attempted=own.filter(e=>e.type==="pass").length;
    const completed=visible.filter(e=>e.type==="receive"&&e.target===p.id).length;
    const receipts=own.filter(e=>e.type==="receive").length;
    const wins=own.filter(e=>e.type==="interception"||e.type==="tackle"||e.type==="recovery").length;
    const shots=own.filter(e=>e.type==="shot").length;
    const goals=own.filter(e=>e.type==="goal").length;
    return {attempted,completed,receipts,wins,shots,goals,
      speed:current.speed[p.id]??0,distance:current.distance[p.id]??0};
  });
  const last=visible.at(-1);
  const lastShot=[...visible].reverse().find(e=>e.type==="shot");
  const selectedXg=(lastShot?.shotXg??0)*100;
  const pastShots=visible.filter(e=>e.type==="shot");
  const story=matchStory(match,visible,lens,followTeam,selected);
  const seekEvent=(e:EventLog)=>{setTime(e.time);setPlaying(false);setInspected(e);setSelected(e.player);};
  const screenPeople=current.people.map(p=>({x:px(p.x),y:py(p.y)}));
  const nearby=match.players.filter(p=>p.id!==selected).sort((a,b)=>Math.hypot(current.people[a.id].x-current.ball.x,current.people[a.id].y-current.ball.y)-Math.hypot(current.people[b.id].x-current.ball.x,current.people[b.id].y-current.ball.y)).slice(0,4).map(p=>p.id);
  const labels=showPlayerStats?placeLabels([...screenPeople,{x,y}],[selected,...nearby]):[];
  const zoomX=Math.max(0,Math.min(1000-1000/zoom,screenPeople[selected].x-500/zoom));
  const zoomY=Math.max(0,Math.min(660-660/zoom,screenPeople[selected].y-330/zoom));
  const inspectedVisible=inspected&&inspected.time<=time?inspected:null;
  const latestAction=[...visible].reverse().find(e=>e.type==="pass"||e.type==="shot");
  const totals=pulse(visible);
  const xgPath=(team:Side)=>{
    let total=0;const parts=["M 25 130"];
    for(const e of pastShots.filter(e=>e.team===team)){const x=25+e.time/5400*550;parts.push(`H ${x}`);total+=e.shotXg??0;parts.push(`V ${130-total*30}`);}
    parts.push(`H ${25+time/5400*550}`);return parts.join(" ");
  };
  return <div className="new-match">
    <div className="new-topbar">
      <div className="new-brand"><span>TL</span><strong>TACTICLENS</strong><small>11v11 MATCH STUDIO</small></div>
      <div className="new-topbar-right"><span><i className="new-live-dot"/> SYNTHETIC LIVE SIMULATION</span>
        <button onClick={onLegacy}>Archived AI evidence demo ↗</button></div>
    </div>
    <div className="new-scorebar">
      <div className="new-club new-north"><span className="new-crest">N</span><div><small>HOME · 4-3-3</small><strong>Northport FC</strong></div></div>
      <div className="new-score"><strong>{score[0]} <span>:</span> {score[1]}</strong><small>{mtime(time)} <span>/ 90:00</span></small></div>
      <div className="new-club new-south"><div><small>AWAY · 4-3-3</small><strong>Southbridge Athletic</strong></div><span className="new-crest">S</span></div>
    </div>
    <div className="new-layout">
      <main className="new-main">
        <div className="new-pitchhead">
          <div><span className="new-kicker"><Activity size={13}/> MATCH ENGINE</span><h2>Match studio</h2>
            <p>22 players · One match clock · Every action traceable</p></div>
          <div className="new-view-controls">
            <label className="new-stats-toggle"><input type="checkbox" checked={showPlayerStats}
              onChange={e=>setShowPlayerStats(e.target.checked)} aria-label="Player stats"/> Nearby player stats</label>
          <select className="new-zoom" aria-label="Pitch zoom" value={zoom} onChange={e=>setZoom(+e.target.value)}><option value="1">Full pitch</option><option value="1.5">Focus 1.5×</option><option value="2">Focus 2×</option></select>
          <div className="new-mode"><button className={mode==="fan"?"chosen":""} onClick={()=>setMode("fan")}>Match</button><button className={mode==="analyst"?"chosen":""} onClick={()=>setMode("analyst")}>Tactical</button><button className={mode==="player"?"chosen":""} onClick={()=>setMode("player")}>Player focus</button></div></div>
        </div>
        <div className="new-pitchwrap">
          <svg className="new-pitch" viewBox={`${zoomX} ${zoomY} ${1000/zoom} ${660/zoom}`} role="img" aria-label="Interactive two dimensional 11 versus 11 football match">
            <rect width="1000" height="660" fill="#0b352c"/>
            {Array.from({length:12},(_,i)=><rect key={i} x={20+i*80} y="20" width="80" height="620" fill={i%2===0?"#15553c":"#124a38"}/>)}
            <g stroke="#e2ffec" strokeWidth="1.7" fill="none" opacity=".85">
              <rect x="20" y="20" width="960" height="620"/><path d="M500 20V640"/>
              <circle cx="500" cy="330" r="84"/><circle cx="500" cy="330" r="2.5" fill="#e2ffec"/>
              <path d="M20 159H172V501H20 M980 159H828V501H980 M20 249H70V411H20 M980 249H930V411H980"/>
              <path d="M20 292H11V368H20 M980 292H989V368H980"/>
              <path d="M118 313L118 347 M882 313L882 347" opacity=".6"/>
            </g>
            {mode==="analyst" && [0,1].flatMap(team=>[[1,2,3,4],[5,6,7],[8,9,10]].map((roles,i)=><polyline key={`${team}-${i}`} points={roles.map(role=>{const p=screenPeople[team*11+role];return `${p.x},${p.y}`}).join(" ")} fill="none" stroke={team===0?"#c6fa65":"#77aaff"} strokeWidth="1.5" strokeDasharray="6 5" opacity=".35"/>))}
            {latestAction&&time-latestAction.time<2.5&&<line x1={px(latestAction.x)} y1={py(latestAction.y)} x2={x} y2={y} stroke="#fff4ac" strokeWidth="2" opacity=".65" strokeDasharray="4 5"/>}
            {mode==="analyst" && match.players.map((p,i)=>{
              const pt=current.people[i];
              return <g key={p.id}><line x1={px(pt.x)} y1={py(pt.y)} x2={px(p.team===0?pt.x+8:pt.x-8)} y2={py(pt.y)} stroke={p.team===0?"#c6fa65":"#77aaff"} strokeWidth="1" opacity=".45"/></g>;
            })}
            {match.players.map((p,i)=>{
              const pt=current.people[i],isSelected=p.id===selected;
              const isOwner=p.id===current.owner;
              const isMuted=followTeam!==2&&p.team!==followTeam;
              return <g key={p.id} data-player-id={p.id} role="button" tabIndex={0} aria-label={`Track ${p.name}`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(p.id);setMode("player");}}} onClick={()=>{setSelected(p.id);setMode("player")}} style={{cursor:"pointer"}} opacity={isMuted?.45:1}>
                {inspectedVisible&&(inspectedVisible.player===p.id||inspectedVisible.target===p.id)&&<circle cx={px(pt.x)} cy={py(pt.y)} r="26" fill="none" stroke="#ffd66f" strokeWidth="2" strokeDasharray="3 3"/>}
                {isSelected && <circle cx={px(pt.x)} cy={py(pt.y)} r="21" fill="none" stroke="#ffef9b" strokeWidth="2.8"/>}
                {isOwner && <circle cx={px(pt.x)} cy={py(pt.y)} r="17" stroke="white" strokeWidth="1.5" opacity=".75" fill="none"/>}
                <circle cx={px(pt.x)} cy={py(pt.y)} r={p.role==="GK"?12:11.5} fill={p.team===0?"#c6fa65":"#77aaff"} stroke={p.team===0?"#0d2d1c":"#0b2236"} strokeWidth="2"/>
                <text x={px(pt.x)} y={py(pt.y)+3.9} fill="#0a1515" textAnchor="middle" fontSize="11" fontWeight="800">{p.number}</text>
                {!showPlayerStats&&(mode==="analyst"||(mode==="player"&&isSelected))&&
                  <text x={px(pt.x)} y={py(pt.y)-20} fill="#f1ffea" textAnchor="middle" fontSize="10" fontWeight="600">{p.name}</text>}
              </g>;
            })}
            {labels.map(label=>{const p=match.players[label.id],detail=individual[label.id],pt=screenPeople[label.id];return <g key={label.id} pointerEvents="none" data-stat-label={label.id}>
              <line x1={pt.x} y1={pt.y} x2={label.x+61} y2={label.y+24} stroke={p.team===0?"#c6fa65":"#77aaff"} opacity=".4"/>
              <g transform={`translate(${label.x} ${label.y})`}><rect width={label.width} height={label.height} rx="5" fill="#081e1cf5" stroke={p.team===0?"#c6fa65":"#77aaff"}/>
              <text x="7" y="14" fill="#ecf9ef" fontSize="11" fontWeight="700">#{p.number} {p.role} · {(detail.speed*3.6).toFixed(0)} km/h</text>
              <text x="7" y="28" fill="#c6fa65" fontSize="10">PASS {detail.completed}/{detail.attempted}</text>
              <text x="7" y="41" fill="#c2d8cb" fontSize="10">WIN {detail.wins} · {(detail.distance/1000).toFixed(2)} km</text></g>
            </g>})}
            {lastShot && time-lastShot.time<5 && <g pointerEvents="none">
              <circle cx={px(lastShot.x)} cy={py(lastShot.y)} r={17+selectedXg*.35}
                fill="none" stroke="#ffd66f" strokeWidth="2" strokeDasharray="5 4" opacity=".8"/>
              <g transform={`translate(${Math.max(40,Math.min(840,px(lastShot.x)+25))} ${Math.max(35,py(lastShot.y)-44)})`}>
                <rect width="123" height="42" rx="7" fill="#13251eed" stroke="#e9c76c"/>
                <text x="8" y="15" fill="#fff2c2" fontSize="10" fontWeight="700">GOAL PROBABILITY</text>
                <text x="8" y="33" fill="#ffe18a" fontSize="19" fontWeight="800">{selectedXg.toFixed(1)}%</text>
              </g>
            </g>}
            {[.32,.24,.16,.08].filter(dt=>time>=dt&&current.phase!==3).map(dt=>{const p=atTime(match,time-dt).ball;return <circle key={dt} cx={px(p.x)} cy={py(p.y)} r="3" fill="#fff" opacity={.35-dt*.7}/>;})}
            <circle data-testid="match-ball" cx={x} cy={y} r="5.8" fill="#fff" stroke="#182c2a" strokeWidth="2.3"/>
            {current.phase===1&&<circle cx={x} cy={y} r="11" stroke="#a6e4fa" opacity=".7" fill="none"/>}
            {current.phase===2&&<circle cx={x} cy={y} r="14" stroke="#ffca7c" opacity=".8" fill="none"/>}
          </svg>
          <div className="new-pitchoverlay"><span><i className="new-live-dot"/> LIVE SIMULATION</span><span>{current.owner>=0?nearest?.name+" ON THE BALL":current.phase===1?"PASS IN FLIGHT":current.phase===2?"SHOT IN FLIGHT":current.phase===3?"RESTART":current.phase===4?"LOOSE BALL":"MATCH ACTIVE"}</span></div>
          {last&&<div className="new-eventbanner"><span>{mtime(last.time)}</span><strong>{last.text}</strong></div>}
        </div>
        <div className="new-playback">
          <button aria-label="Restart" onClick={()=>{setTime(0);setPlaying(false)}}><RotateCcw size={18}/></button>
          <button className="new-play" aria-label={playing?"Pause":"Play"} onClick={()=>{if(time>=match.duration)setTime(0);setInspected(null);setPlaying(p=>!p)}}>{playing?<Pause fill="currentColor" size={18}/>:<Play fill="currentColor" size={18}/>}</button>
          <span>{mtime(time)}</span>
          <input aria-label="Match timeline" type="range" min="0" max={match.duration} step=".25" value={time}
            onChange={e=>{setTime(+e.target.value);setInspected(null)}}/>
          <span>90:00</span>
          <button onClick={()=>setSpeed(v=>v===1?2:v===2?4:v===4?8:1)} className="new-speed"><FastForward size={15}/>{speed}×</button>
        </div>
        {showPlayerStats&&<div className="new-mobile-stats"><strong>#{match.players[selected].number} {match.players[selected].name}</strong><span>{(individual[selected].speed*3.6).toFixed(0)} km/h · Pass {individual[selected].completed}/{individual[selected].attempted} · Wins {individual[selected].wins}</span><small>Tap a player to inspect their stats.</small></div>}
        <div className="new-moment-controls"><button onClick={()=>{const next=match.events.find(e=>e.type==="shot"&&e.time>time+2);if(next){setTime(Math.max(0,next.time-8));setPlaying(true);setInspected(null);}}}>Next chance →</button><span>{match.matchId} · {playing?"Playing":"Paused"} · {showPlayerStats?`${labels.length} clear stat labels`:"Select a player for detail"}</span></div>
        {inspectedVisible&&<section className="new-inspection"><span className="new-kicker">REPLAY EVIDENCE · {inspectedVisible.id}</span><p>{inspectedVisible.text}</p>{inspectedVisible.type==="shot"&&<p>{shotExplanation(inspectedVisible)}</p>}{inspectedVisible.sourceId&&<button onClick={()=>{const source=visible.find(e=>e.id===inspectedVisible.sourceId);if(source)seekEvent(source);}}>Inspect source {inspectedVisible.sourceId} →</button>}</section>}
        <section className="new-analysis"><div className="new-analysis-heading"><div><span className="new-kicker">EVENT-GROUNDED INTELLIGENCE</span><h3>Follow the match story</h3></div><span className="new-rule-tag">RULE-BASED · SYNTHETIC</span></div>
          <div className="new-lenses" aria-label="Audience perspective">{(["fan","analyst","club","player"] as Lens[]).map(view=><button key={view} aria-pressed={lens===view} onClick={()=>setLens(view)}>{view[0].toUpperCase()+view.slice(1)}</button>)}</div>
          <h4>{story.headline}</h4><p>{story.text}</p><div className="new-evidence-links">{story.evidence.map(e=><button key={e.id} onClick={()=>seekEvent(e)}>{mtime(e.time)} · {e.type} <small>{e.id}</small></button>)}</div>
          <p className="new-muted">{mtime(time)} recap · {totals.score[0]}–{totals.score[1]} · {totals.shots[0]+totals.shots[1]} shots · {(totals.xg[0]+totals.xg[1]).toFixed(2)} xG. Calculated from events at or before the replay time.</p>
        </section>
        <section className="new-analysis"><div className="new-analysis-heading"><div><span className="new-kicker">CHANCE DEVELOPMENT</span><h3>Shot map & expected goals</h3></div><span className="new-muted">Northport → · ← Southbridge</span></div>
          <div className="new-shot-workspace"><svg viewBox="0 0 360 230" role="img" aria-label="Shots up to the replay time" className="new-shotmap"><rect x="5" y="5" width="350" height="220" rx="3" fill="#153e31" stroke="#5b8169"/><path d="M180 5V225 M5 60H60V170H5 M355 60H300V170H355" fill="none" stroke="#5b8169"/><circle cx="180" cy="115" r="29" fill="none" stroke="#5b8169"/>{pastShots.map(e=>{const goal=visible.some(r=>r.type==="goal"&&r.sourceId===e.id);return <g key={e.id} role="button" tabIndex={0} aria-label={`Inspect shot ${e.id}`} onKeyDown={k=>{if(k.key==="Enter")seekEvent(e)}} onClick={()=>seekEvent(e)} style={{cursor:"pointer"}}><title>{mtime(e.time)} · {((e.shotXg??0)*100).toFixed(1)}% xG{goal?" · Goal":""}</title><circle cx={5+e.x/105*350} cy={5+e.y/68*220} r={3+(e.shotXg??0)*22} fill={e.team===0?"#c6fa65":"#77aaff"} fillOpacity={goal?1:.35} stroke={e.team===0?"#c6fa65":"#77aaff"} strokeWidth={goal?2:1}/></g>})}</svg>
          <div><svg viewBox="0 0 600 160" role="img" aria-label="Cumulative xG up to replay time" className="new-xgchart"><path d="M25 10V130H575" fill="none" stroke="#486455"/>{[0,1,2,3,4].map(v=><g key={v}><text x="5" y={134-v*30} fill="#9eb9a9" fontSize="10">{v}</text><path d={`M25 ${130-v*30}H575`} stroke="#486455" opacity=".25"/></g>)}<path d={xgPath(0)} fill="none" stroke="#c6fa65" strokeWidth="2.5"/><path d={xgPath(1)} fill="none" stroke="#77aaff" strokeWidth="2.5"/><text x="25" y="152" fill="#9eb9a9" fontSize="11">00:00</text><text x="540" y="152" fill="#9eb9a9" fontSize="11">90:00</text></svg><p className="new-muted">Circle size indicates chance quality; solid circles are scored goals. Click a shot to inspect its frame. Simplified synthetic xG model, not real-world calibrated.</p><div className="new-xg-totals"><span>Northport <b>{expectedGoals[0].toFixed(2)} xG</b></span><span>Southbridge <b>{expectedGoals[1].toFixed(2)} xG</b></span></div></div></div>
        </section>
        <div className="new-footnote"><ShieldCheck size={13}/> This is a newly simulated 11-v-11 match. Statistics and events come from the same simulation—not the archived Foundry evidence match.</div>
      </main>
      <aside className="new-sidebar">
        <section className="new-card"><span className="new-kicker">MATCH CONTROL</span><h3>Viewing preferences</h3>
          <label>Follow team<select value={followTeam} onChange={e=>setFollowTeam(+e.target.value as Side|2)}><option value="2">Both teams</option><option value="0">Northport FC</option><option value="1">Southbridge Athletic</option></select></label>
          <label>Track a player<select value={selected} onChange={e=>{setSelected(+e.target.value);setMode("player")}}>
            {match.players.map(p=><option key={p.id} value={p.id}>{p.team===0?"NOR":"SOU"} · #{p.number} {p.name} ({p.role})</option>)}
          </select></label>
          <p className="new-muted">Select anyone on the pitch to track their contribution.</p>
          <div className="new-player-stats">
            <strong>#{match.players[selected].number} {match.players[selected].name}</strong>
            <div><span>Pass completion</span><b>{individual[selected].completed}/{individual[selected].attempted}</b></div>
            <div><span>Receptions</span><b>{individual[selected].receipts}</b></div>
            <div><span>Recoveries / tackles</span><b>{individual[selected].wins}</b></div>
            <div><span>Shots / goals</span><b>{individual[selected].shots} / {individual[selected].goals}</b></div>
            <div><span>Modeled speed</span><b>{(individual[selected].speed*3.6).toFixed(1)} km/h</b></div>
            <div><span>Modeled distance</span><b>{(individual[selected].distance/1000).toFixed(2)} km</b></div>
          </div></section>
        <section className="new-card"><span className="new-kicker">LIVE STATISTICS</span><h3>Match pulse</h3>
          <div className="new-statrow"><span>Completed passes</span><strong>{completions[0]} – {completions[1]}</strong></div>
          <div className="new-statrow"><span>Attempts</span><strong>{passes[0]} – {passes[1]}</strong></div>
          <div className="new-statrow"><span>Shots</span><strong>{shots[0]} – {shots[1]}</strong></div>
          <div className="new-statrow"><span>Expected goals (xG)</span><strong>{expectedGoals[0].toFixed(2)} – {expectedGoals[1].toFixed(2)}</strong></div>
          <div className="new-statrow"><span>Goal conversion</span><strong>{shots[0]?Math.round(score[0]/shots[0]*100):0}% – {shots[1]?Math.round(score[1]/shots[1]*100):0}%</strong></div>
          <div className="new-statrow"><span>Ball recoveries</span><strong>{tackles[0]} – {tackles[1]}</strong></div>
        </section>
        <section className="new-card"><span className="new-kicker">CHANCE QUALITY</span><h3>Goal probabilities</h3>
          <p className="new-muted">Every shot receives a model-derived probability from shot distance, angle and defensive pressure.</p>
          {lastShot ? <div className="new-player-stats">
            <strong>{match.players[lastShot.player].name} · {mtime(lastShot.time)}</strong>
            <div><span>Scoring probability</span><b>{((lastShot.shotXg??0)*100).toFixed(1)}%</b></div>
            <div><span>Distance</span><b>{lastShot.shotDistance?.toFixed(1) ?? "—"} m</b></div>
            <div><span>Angle</span><b>{lastShot.shotAngle?.toFixed(1) ?? "—"}°</b></div>
            <div><span>Defender proximity</span><b>{lastShot.shotPressure?.toFixed(1) ?? "—"} m</b></div>
            <div><span>Match xG</span><b>{(expectedGoals[0]+expectedGoals[1]).toFixed(2)}</b></div>
          </div> : <p className="new-muted">Shot probabilities will appear after the first attempt.</p>}
          <p className="new-muted">Synthetic xG model, not calibrated to real match data.</p>
        </section>
        <section className="new-card new-events"><span className="new-kicker">LIVE EVENT LOG</span><h3>On-pitch actions</h3>
          <div className="new-loglist">{recent.length?recent.map(e=><button key={e.id} onClick={()=>seekEvent(e)}>
            <span>{mtime(e.time)}</span><div><strong>{e.type.toUpperCase()}</strong><small>{e.text}</small><small className="new-event-id">{e.id}</small></div></button>):
            <p className="new-muted">Kickoff underway.</p>}</div>
          <small className="new-muted">Click any action to inspect its exact simulation frame.</small>
        </section>
        <section className="new-card new-validation">
          <span className="new-kicker"><Crosshair size={12}/> ENGINE CHECK</span>
          {issues.length===0?<p className="new-ok">22 players · Ownership, movement, kickoffs and event sources validated</p>:
            <p className="new-error">{issues.join("; ")}</p>}
          <form className="new-seed-form" onSubmit={e=>{e.preventDefault();if(/^\d+$/.test(seedInput)&&+seedInput<=4294967295){setSeed(+seedInput);setTime(0);setPlaying(false);setInspected(null);}}}><label htmlFor="match-seed">Reproducible match seed</label><div><input id="match-seed" type="number" min="0" max="4294967295" value={seedInput} onChange={e=>setSeedInput(e.target.value)} required/><button>Load</button></div></form>
          <button onClick={()=>{setSeed(n=>n+1);setSeedInput(String(seed+1));setTime(0);setPlaying(false);setInspected(null)}}>Generate another match</button>
        </section>
      </aside>
    </div>
  </div>;
}
