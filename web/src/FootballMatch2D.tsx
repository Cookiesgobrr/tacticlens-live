import { useEffect, useMemo, useState } from "react";
import { generateMatch, atTime, eventsUntil, validateMatch, type Side, type EventLog } from "./footballEngine";
import { Pause, Play, RotateCcw, FastForward, ShieldCheck, Crosshair, Activity } from "lucide-react";
const mtime=(v:number)=>String(Math.floor(v/60)).padStart(2,"0")+":"+String(Math.floor(v%60)).padStart(2,"0");
type View="fan"|"analyst"|"player";
export default function FootballMatch2D({onLegacy}:{onLegacy:()=>void}){
  const [seed,setSeed]=useState(2927);
  const [time,setTime]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(2);
  const [mode,setMode]=useState<View>("fan");
  const [selected,setSelected]=useState(9);
  const [followTeam,setFollowTeam]=useState<Side|2>(2);
  const match=useMemo(()=>generateMatch(seed),[seed]);
  const issues=useMemo(()=>validateMatch(match),[match]);
  const current=atTime(match,time);
  const visible=eventsUntil(match,time);
  const recent=visible.slice(-8).reverse();
  const score:[number,number]=[0,0];
  for(const e of visible)if(e.type==="goal")score[e.team]++;
  const passes:[number,number]=[0,0],completions:[number,number]=[0,0],shots:[number,number]=[0,0],tackles:[number,number]=[0,0];
  for(const e of visible){
    if(e.type==="pass"){passes[e.team]++;if(e.completed)completions[e.team]++;}
    if(e.type==="shot")shots[e.team]++;
    if(e.type==="tackle"||e.type==="interception")tackles[e.team]++;
  }
  useEffect(()=>{
    if(!playing)return;
    let raf=0,previous=performance.now();
    const tick=(now:number)=>{
      const elapsed=Math.min(.08,(now-previous)/1000);
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
  const last=visible.at(-1);
  return <div className="new-match">
    <div className="new-topbar">
      <div className="new-brand"><span>TL</span><strong>TACTICLENS</strong><small>2D MATCH ENGINE / V1</small></div>
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
          <div><span className="new-kicker"><Activity size={13}/> MATCH ENGINE</span><h2>Live 2D match</h2>
            <p>22 active players · Coordinated movement · Simulated possession and play</p></div>
          <div className="new-mode"><button className={mode==="fan"?"chosen":""} onClick={()=>setMode("fan")}>Match</button><button className={mode==="analyst"?"chosen":""} onClick={()=>setMode("analyst")}>Tactical</button><button className={mode==="player"?"chosen":""} onClick={()=>setMode("player")}>Player focus</button></div>
        </div>
        <div className="new-pitchwrap">
          <svg className="new-pitch" viewBox="0 0 1000 660" role="img" aria-label="Interactive two dimensional 11 versus 11 football match">
            <rect width="1000" height="660" fill="#0b352c"/>
            {Array.from({length:12},(_,i)=><rect key={i} x={20+i*80} y="20" width="80" height="620" fill={i%2===0?"#15553c":"#124a38"}/>)}
            <g stroke="#e2ffec" strokeWidth="1.7" fill="none" opacity=".85">
              <rect x="20" y="20" width="960" height="620"/><path d="M500 20V640"/>
              <circle cx="500" cy="330" r="84"/><circle cx="500" cy="330" r="2.5" fill="#e2ffec"/>
              <path d="M20 159H172V501H20 M980 159H828V501H980 M20 249H70V411H20 M980 249H930V411H980"/>
              <path d="M20 292H11V368H20 M980 292H989V368H980"/>
              <path d="M118 313L118 347 M882 313L882 347" opacity=".6"/>
            </g>
            {mode==="analyst" && match.players.map((p,i)=>{
              const pt=current.people[i];
              return <g key={p.id}><line x1={px(pt.x)} y1={py(pt.y)} x2={px(p.team===0?pt.x+8:pt.x-8)} y2={py(pt.y)} stroke={p.team===0?"#c6fa65":"#77aaff"} strokeWidth="1" opacity=".45"/></g>;
            })}
            {match.players.map((p,i)=>{
              const pt=current.people[i],isSelected=p.id===selected;
              const isOwner=p.id===current.owner;
              const isMuted=followTeam!==2&&p.team!==followTeam;
              return <g key={p.id} onClick={()=>{setSelected(p.id);setMode("player")}} style={{cursor:"pointer"}} opacity={isMuted?.45:1}>
                {isSelected && <circle cx={px(pt.x)} cy={py(pt.y)} r="21" fill="none" stroke="#ffef9b" strokeWidth="2.8"/>}
                {isOwner && <circle cx={px(pt.x)} cy={py(pt.y)} r="17" stroke="white" strokeWidth="1.5" opacity=".75" fill="none"/>}
                <circle cx={px(pt.x)} cy={py(pt.y)} r={p.role==="GK"?12:11.5} fill={p.team===0?"#c6fa65":"#77aaff"} stroke={p.team===0?"#0d2d1c":"#0b2236"} strokeWidth="2"/>
                <text x={px(pt.x)} y={py(pt.y)+3.9} fill="#0a1515" textAnchor="middle" fontSize="11" fontWeight="800">{p.number}</text>
                {(mode==="analyst"||(mode==="player"&&isSelected))&&
                  <text x={px(pt.x)} y={py(pt.y)-20} fill="#f1ffea" textAnchor="middle" fontSize="10" fontWeight="600">{p.name}</text>}
              </g>;
            })}
            <circle cx={x} cy={y} r="5.8" fill="#fff" stroke="#182c2a" strokeWidth="2.3"/>
            {current.phase===1&&<circle cx={x} cy={y} r="11" stroke="#a6e4fa" opacity=".7" fill="none"/>}
            {current.phase===2&&<circle cx={x} cy={y} r="14" stroke="#ffca7c" opacity=".8" fill="none"/>}
          </svg>
          <div className="new-pitchoverlay"><span><i className="new-live-dot"/> LIVE SIMULATION</span><span>{current.owner>=0?nearest?.name+" ON THE BALL":current.phase===1?"PASS IN FLIGHT":current.phase===2?"SHOT IN FLIGHT":"MATCH ACTIVE"}</span></div>
          {last&&<div className="new-eventbanner"><span>{mtime(last.time)}</span><strong>{last.text}</strong></div>}
        </div>
        <div className="new-playback">
          <button aria-label="Restart" onClick={()=>{setTime(0);setPlaying(false)}}><RotateCcw size={18}/></button>
          <button className="new-play" aria-label={playing?"Pause":"Play"} onClick={()=>{if(time>=match.duration)setTime(0);setPlaying(p=>!p)}}>{playing?<Pause fill="currentColor" size={18}/>:<Play fill="currentColor" size={18}/>}</button>
          <span>{mtime(time)}</span>
          <input aria-label="Match timeline" type="range" min="0" max={match.duration} step=".25" value={time}
            onChange={e=>setTime(+e.target.value)}/>
          <span>90:00</span>
          <button onClick={()=>setSpeed(v=>v===1?2:v===2?4:v===4?8:1)} className="new-speed"><FastForward size={15}/>{speed}×</button>
        </div>
        <div className="new-footnote"><ShieldCheck size={13}/> This is a newly simulated 11-v-11 match. Statistics and events come from the same simulation—not the archived Foundry evidence match.</div>
      </main>
      <aside className="new-sidebar">
        <section className="new-card"><span className="new-kicker">MATCH CONTROL</span><h3>Viewing preferences</h3>
          <label>Follow team<select value={followTeam} onChange={e=>setFollowTeam(+e.target.value as Side|2)}><option value="2">Both teams</option><option value="0">Northport FC</option><option value="1">Southbridge Athletic</option></select></label>
          <label>Track a player<select value={selected} onChange={e=>{setSelected(+e.target.value);setMode("player")}}>
            {match.players.map(p=><option key={p.id} value={p.id}>{p.team===0?"NOR":"SOU"} · #{p.number} {p.name} ({p.role})</option>)}
          </select></label>
          <p className="new-muted">Select anyone on the pitch to track their contribution.</p></section>
        <section className="new-card"><span className="new-kicker">LIVE STATISTICS</span><h3>Match pulse</h3>
          <div className="new-statrow"><span>Completed passes</span><strong>{completions[0]} – {completions[1]}</strong></div>
          <div className="new-statrow"><span>Attempts</span><strong>{passes[0]} – {passes[1]}</strong></div>
          <div className="new-statrow"><span>Shots</span><strong>{shots[0]} – {shots[1]}</strong></div>
          <div className="new-statrow"><span>Ball recoveries</span><strong>{tackles[0]} – {tackles[1]}</strong></div>
        </section>
        <section className="new-card new-events"><span className="new-kicker">LIVE EVENT LOG</span><h3>On-pitch actions</h3>
          <div className="new-loglist">{recent.length?recent.map(e=><button key={e.id} onClick={()=>{setTime(e.time);setPlaying(false)}}>
            <span>{mtime(e.time)}</span><div><strong>{e.type.toUpperCase()}</strong><small>{e.text}</small></div></button>):
            <p className="new-muted">Kickoff underway.</p>}</div>
          <small className="new-muted">Click any action to inspect its exact simulation frame.</small>
        </section>
        <section className="new-card new-validation">
          <span className="new-kicker"><Crosshair size={12}/> ENGINE CHECK</span>
          {issues.length===0?<p className="new-ok">22 players validated · Kickoff ball centered · Pitch bounds verified</p>:
            <p className="new-error">{issues.join("; ")}</p>}
          <button onClick={()=>{setSeed(n=>n+1);setTime(0);setPlaying(false)}}>Generate another match</button>
        </section>
      </aside>
    </div>
  </div>;
}
