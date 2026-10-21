import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, BarChart3, ChevronRight, CircleHelp, Clock3,
  Eye, FastForward, Flag, Layers3, Pause, Play, RotateCcw,
  ShieldCheck, Sparkles, Target, Volume2
} from "lucide-react";

type TeamId = "north" | "south";
type Mode = "fan" | "analyst" | "broadcast";
type EventKind = "pass" | "carry" | "recovery" | "turnover" | "shot" | "pressure" | "goal";
interface Team { id: TeamId; name: string; short: string; color: string }
interface MatchEvent {
  id: string; second: number; minute: number; team: TeamId; player: string;
  kind: EventKind; x: number; y: number; control_seconds: number; description: string;
}
interface Insight {
  id: string; at_second: number; team: TeamId; type: string; headline: string;
  casual: string; analyst: string; broadcast: string;
  evidence_ids: string[]; baseline_ids: string[]; method: string;
  metric: { name: string; previous: number; recent: number; delta: number;
    previous_window: string; recent_window: string };
}
interface OverlayCue {
  id: string; kind: "goal" | "insight"; start_second: number;
  end_second: number; priority: number; headline: string;
  subtitle: string; source_event_ids: string[]; placement: string;
}
interface Match {
  match_id: string; title: string; disclaimer: string; seed: number;
  duration_seconds: number; teams: Team[]; events: MatchEvent[]; insights: Insight[];
  overlays?: OverlayCue[];
}
interface Stats { passes: number; shots: number; goals: number;
  recoveries: number; pressures: number; control_seconds: number; control_share_pct: number }

const EMPTY_STATS = (): Stats => ({
  passes: 0, shots: 0, goals: 0, recoveries: 0, pressures: 0,
  control_seconds: 0, control_share_pct: 50
});

function getStats(events: MatchEvent[]) {
  const stats: Record<TeamId, Stats> = { north: EMPTY_STATS(), south: EMPTY_STATS() };
  for (const e of events) {
    const s = stats[e.team];
    if (e.kind === "pass") s.passes++;
    if (e.kind === "shot" || e.kind === "goal") s.shots++;
    if (e.kind === "goal") s.goals++;
    if (e.kind === "recovery") s.recoveries++;
    if (e.kind === "pressure") s.pressures++;
    s.control_seconds += e.control_seconds;
  }
  const total = stats.north.control_seconds + stats.south.control_seconds;
  for (const id of ["north", "south"] as const) {
    stats[id].control_share_pct = total
      ? Math.round(stats[id].control_seconds / total * 100) : 50;
  }
  return stats;
}

function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
}

const modes: { id: Mode; title: string; icon: typeof Eye }[] = [
  { id: "fan", title: "Fan", icon: Eye },
  { id: "analyst", title: "Analyst", icon: BarChart3 },
  { id: "broadcast", title: "Broadcast", icon: Volume2 }
];

function Pitch({ recent, highlighted }: { recent: MatchEvent[]; highlighted: Set<string> }) {
  return (
    <div className="pitch-outer">
      <div className="pitch-topline">
        <span><span className="light-dot" /> LIVE EVENT MAP</span>
        <span>ATTACK DIRECTION <ArrowRight size={12} /></span>
      </div>
      <svg viewBox="0 0 960 572" className="pitch" role="img"
        aria-label="Fictional football pitch displaying the most recent event locations">
        <defs>
          <linearGradient id="pitchBg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#16392f" />
            <stop offset="1" stopColor="#102d27" />
          </linearGradient>
          <pattern id="stripes" x="0" y="0" width="200" height="572" patternUnits="userSpaceOnUse">
            <rect width="100" height="572" fill="#ffffff" opacity=".014" />
          </pattern>
        </defs>
        <rect width="960" height="572" rx="18" fill="url(#pitchBg)" />
        <rect width="960" height="572" rx="18" fill="url(#stripes)" />
        <g stroke="#a7c5b0" strokeWidth="2" strokeOpacity=".39" fill="none">
          <rect x="38" y="38" width="884" height="496" />
          <line x1="480" y1="38" x2="480" y2="534" />
          <circle cx="480" cy="286" r="75" />
          <circle cx="480" cy="286" r="3" fill="#cbded0" />
          <rect x="38" y="147" width="153" height="278" />
          <rect x="769" y="147" width="153" height="278" />
          <rect x="38" y="208" width="60" height="156" />
          <rect x="862" y="208" width="60" height="156" />
          <path d="M 191 240 A 75 75 0 0 1 191 332" />
          <path d="M 769 240 A 75 75 0 0 0 769 332" />
          <rect x="23" y="240" width="15" height="92" />
          <rect x="922" y="240" width="15" height="92" />
        </g>
        {recent.map((e, idx) => {
          const emphasis = highlighted.has(e.id);
          const important = e.kind === "shot" || e.kind === "goal";
          const r = emphasis ? 12 : important ? 8 : 5;
          const cx = 38 + e.x * 8.84;
          const cy = 38 + e.y * 4.96;
          return (
            <g key={e.id} opacity={0.33 + (idx + 1) / Math.max(recent.length, 1) * 0.67}>
              {emphasis && <circle cx={cx} cy={cy} r="21" fill="none"
                stroke="#e6fe8f" strokeDasharray="4 5" strokeWidth="2" />}
              <circle cx={cx} cy={cy} r={r + 3} fill="#07120f" opacity=".6" />
              <circle cx={cx} cy={cy} r={r}
                fill={e.team === "north" ? "#c6fa65" : "#77aaff"}
                stroke="#edf6e5" strokeWidth={important ? 2 : 0} />
            </g>
          );
        })}
      </svg>
      <div className="pitch-legend">
        <span><i className="legend-dot north" /> Northport FC</span>
        <span><i className="legend-dot south" /> Southbridge Athletic</span>
        <span className="muted">Latest {recent.length} events</span>
      </div>
    </div>
  );
}

function StatBar({ label, left, right, suffix = "" }: {
  label: string; left: number; right: number; suffix?: string
}) {
  const sum = Math.max(left + right, 1);
  return (
    <div className="stat">
      <div className="stat-heading">
        <strong>{left}{suffix}</strong><span>{label}</span><strong>{right}{suffix}</strong>
      </div>
      <div className="stat-track">
        <span className="stat-left" style={{ width: (left / sum * 100) + "%" }} />
        <span className="stat-right" style={{ width: (right / sum * 100) + "%" }} />
      </div>
    </div>
  );
}

function App() {
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [mode, setMode] = useState<Mode>("fan");
  const [showEvidence, setShowEvidence] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const matchUrl = import.meta.env.VITE_STATIC_DEMO === "true"
      ? import.meta.env.BASE_URL + "demo-match.json"
      : "/api/match";
    fetch(matchUrl, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("API returned " + response.status);
        return response.json() as Promise<Match>;
      })
      .then(setMatch)
      .catch(e => {
        if (e.name !== "AbortError")
          setError("Could not load synthetic match data. " + e.message);
      });
    return () => controller.abort();
  }, []);

  const duration = match?.duration_seconds ?? 5400;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setClock(previous => Math.min(duration, previous + speed * 5));
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, speed, duration]);

  useEffect(() => {
    if (clock >= duration) setPlaying(false);
  }, [clock, duration]);

  const visible = useMemo(() => match?.events.filter(e => e.second <= clock) ?? [], [match, clock]);
  const stats = useMemo(() => getStats(visible), [visible]);
  const recent = useMemo(() => visible.slice(-18), [visible]);
  const milestones = useMemo(() => visible.filter(e =>
    ["goal", "shot", "recovery", "turnover"].includes(e.kind)).slice(-5).reverse(), [visible]);
  const insight = match?.insights.find(i => clock >= i.at_second);
  const activeOverlay = useMemo(() => (match?.overlays ?? [])
    .filter(cue => clock >= cue.start_second && clock < cue.end_second)
    .sort((a, b) => b.priority - a.priority)[0], [match, clock]);
  const allEvidence = useMemo(() => {
    if (!match || !insight) return [];
    const ids = new Set([...insight.baseline_ids, ...insight.evidence_ids]);
    return match.events.filter(e => ids.has(e.id));
  }, [match, insight]);
  const highlighted = useMemo(() => new Set(insight?.evidence_ids ?? []), [insight]);
  const teams = match?.teams ?? [
    { id: "north" as TeamId, name: "Northport FC", short: "NOR", color: "#c6fa65" },
    { id: "south" as TeamId, name: "Southbridge Athletic", short: "SOU", color: "#77aaff" }
  ];
  const jumpToInsight = () => {
    if (match?.insights[0]) {
      setClock(match.insights[0].at_second);
      setPlaying(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="nav">
        <div className="nav-brand">
          <div className="brand-symbol"><Activity size={22} strokeWidth={2.5} /></div>
          <div className="brand-copy">TACTICLENS<span>LIVE</span></div>
          <span className="beta">ALPHA 01</span>
        </div>
        <div className="nav-right">
          <span className="nav-meta"><span className="light-dot" /> SYNTHETIC MATCH ENGINE</span>
          <span className="nav-divider" />
          <a href="https://github.com/Cookiesgobrr/tacticlens-live" target="_blank" rel="noreferrer">
            SOURCE CODE <ArrowRight size={13} />
          </a>
        </div>
      </header>

      <main className="content">
        <section className="hero">
          <div>
            <div className="eyebrow"><Sparkles size={14} /> FOOTBALL, DECODED</div>
            <h1>See beyond <em>the score.</em></h1>
            <p>Every moment has a story. Explore real-time simulated match intelligence,
              with every insight grounded in events you can inspect.</p>
          </div>
          <div className="hero-chip"><ShieldCheck size={19} />
            <span>100% traceable insights<small>Deterministic analytics · No fabricated stats</small></span>
          </div>
        </section>

        {error && <div className="error-panel" role="alert">{error}</div>}

        <div className="match-heading">
          <div className="section-kicker"><span className="live-pill"><span className="light-dot" /> REPLAY</span>
            <span>MATCH SIMULATOR / DEMO 001</span></div>
          <span className="subtle">SEED {match?.seed ?? "—"} · FICTIONAL DATA</span>
        </div>

        <section className="scoreboard">
          <div className="team team-north"><div className="team-crest">N</div>
            <div><span>HOME</span><strong>{teams[0].name}</strong></div></div>
          <div className="score-center">
            <div className="score"><b>{stats.north.goals}</b><span>:</span><b>{stats.south.goals}</b></div>
            <div className="score-time"><Clock3 size={13} /> {formatTime(clock)} <span>/ 90:00</span></div>
          </div>
          <div className="team team-south"><div><span>AWAY</span><strong>{teams[1].name}</strong></div>
            <div className="team-crest">S</div></div>
        </section>

        <div className="dashboard-grid">
          <div className="main-column">
            <section className="panel pitch-panel">
              <div className="panel-head">
                <div><div className="section-kicker"><Target size={15} /> MATCH VISION</div>
                  <h2>Live tactical map</h2></div>
                <span className="meta-outline"><span className="light-dot" /> EVENT STREAM ACTIVE</span>
              </div>
              <Pitch recent={recent} highlighted={highlighted} />
              {activeOverlay && <div className="broadcast-overlay" role="status" aria-live="polite">
                <div className="broadcast-overlay-eyebrow">
                  <span className="light-dot" /> BROADCAST CUE · {formatTime(activeOverlay.start_second)}
                  <span className="broadcast-overlay-id">{activeOverlay.id}</span>
                </div>
                <strong>{activeOverlay.headline}</strong>
                <span>{activeOverlay.subtitle}</span>
                <small>{activeOverlay.source_event_ids.length} TRACEABLE EVENT REFERENCES · SYNTHETIC</small>
              </div>}
              <div className="replay-controls">
                <button className="icon-button" aria-label="Restart match" title="Restart"
                  onClick={() => { setClock(0); setPlaying(false); }}><RotateCcw size={19} /></button>
                <button className="play-button" aria-label={playing ? "Pause replay" : "Play replay"}
                  onClick={() => { if (clock >= duration) setClock(0); setPlaying(!playing); }}>
                  {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                </button>
                <span className="small-time">{formatTime(clock)}</span>
                <input type="range" className="scrubber" aria-label="Seek replay time"
                  min={0} max={duration} step={1} value={clock}
                  style={{ backgroundSize: (clock / duration * 100) + "% 100%" }}
                  onChange={e => setClock(Number(e.target.value))} />
                <span className="small-time">90:00</span>
                <button className="speed-button" aria-label="Change replay speed"
                  onClick={() => setSpeed(s => s === 1 ? 4 : s === 4 ? 12 : 1)}>
                  <FastForward size={15} /> {speed}×
                </button>
              </div>
            </section>

            <section className="panel intelligence-panel">
              <div className="panel-head between">
                <div><div className="section-kicker"><Sparkles size={15} /> INTELLIGENCE LAYER</div>
                  <h2>What the numbers reveal</h2></div>
                <span className="proof-pill"><ShieldCheck size={14} /> EVIDENCE BACKED</span>
              </div>
              <div className="mode-tabs" role="group" aria-label="Viewing mode">
                {modes.map(m => {
                  const Icon = m.icon;
                  return <button key={m.id} onClick={() => setMode(m.id)}
                    className={mode === m.id ? "mode-tab active" : "mode-tab"}
                    aria-pressed={mode === m.id}>
                    <Icon size={15} /> {m.title}
                  </button>;
                })}
              </div>
              {insight ? (
                <div className="insight">
                  <div className="insight-top">
                    <span className="insight-label"><span className="pulse" /> PATTERN DETECTED · 75'</span>
                    <span className="insight-id">#{insight.id}</span>
                  </div>
                  <h3>{mode === "broadcast" ? insight.broadcast : insight.headline}</h3>
                  {mode !== "broadcast" && <p>{mode === "fan" ? insight.casual : insight.analyst}</p>}
                  <div className="insight-metric">
                    <div><small>PREVIOUS 10 MIN</small><strong>{insight.metric.previous}</strong></div>
                    <ArrowRight size={20} />
                    <div><small>LATEST 10 MIN</small><strong>{insight.metric.recent}</strong></div>
                    <div className="increase">+{insight.metric.delta} EVENTS</div>
                  </div>
                  <button className="evidence-toggle" onClick={() => setShowEvidence(!showEvidence)}
                    aria-expanded={showEvidence}>
                    <ShieldCheck size={17} /> {showEvidence ? "Hide" : "Inspect"} Evidence Trail
                    <ChevronRight size={16} className={showEvidence ? "rotated" : ""} />
                  </button>
                  {showEvidence && <div className="evidence">
                    <p className="evidence-method"><CircleHelp size={15} /> {insight.method}</p>
                    <div className="evidence-head"><span>SUPPORTING EVENTS</span><span>{allEvidence.length} VERIFIED REFERENCES</span></div>
                    <div className="evidence-scroll">
                      {allEvidence.map(e => (
                        <button key={e.id} className="evidence-row"
                          onClick={() => { setClock(e.second); setPlaying(false); }}>
                          <span className="event-id">{e.id}</span>
                          <span className="evidence-player">{e.player}</span>
                          <span className={highlighted.has(e.id) ? "window recent-window" : "window"}>
                            {highlighted.has(e.id) ? "CURRENT" : "BASELINE"}
                          </span>
                          <span className="evidence-time">{formatTime(e.second)}</span>
                        </button>
                      ))}
                    </div>
                  </div>}
                </div>
              ) : <div className="insight-empty">
                <div className="insight-empty-icon"><Layers3 size={24} /></div>
                <h3>Intelligence is building.</h3>
                <p>As the match unfolds, the detection engine checks 10-minute windows for
                  meaningful changes. An evidence-backed shift appears at 75:00.</p>
                <button className="secondary-cta" onClick={jumpToInsight}>
                  Jump to insight <ArrowRight size={16} />
                </button>
              </div>}
            </section>
          </div>

          <aside className="side-column">
            <section className="panel stats-panel">
              <div className="panel-head">
                <div><div className="section-kicker"><BarChart3 size={15} /> PERFORMANCE</div>
                  <h2>Match statistics</h2></div>
              </div>
              <div className="stats-labels">
                <span><i className="legend-dot north" /> NOR</span>
                <span>TEAM COMPARISON</span>
                <span>SOU <i className="legend-dot south" /></span>
              </div>
              <StatBar label="Control share*" left={stats.north.control_share_pct}
                right={stats.south.control_share_pct} suffix="%" />
              <StatBar label="Passes" left={stats.north.passes} right={stats.south.passes} />
              <StatBar label="Shots incl. goals" left={stats.north.shots} right={stats.south.shots} />
              <StatBar label="Recoveries" left={stats.north.recoveries} right={stats.south.recoveries} />
              <StatBar label="Pressures" left={stats.north.pressures} right={stats.south.pressures} />
              <div className="stats-note">*Synthetic on-ball control time, not measured match possession.</div>
            </section>

            <section className="panel moments-panel">
              <div className="panel-head">
                <div><div className="section-kicker"><Flag size={15} /> MATCH FEED</div>
                  <h2>Key moments</h2></div>
                <span className="small-counter">{visible.length} events</span>
              </div>
              <div className="moment-feed">
                {milestones.length ? milestones.map(e =>
                  <button className="moment" key={e.id} onClick={() => { setClock(e.second); setPlaying(false); }}>
                    <span className="moment-time">{formatTime(e.second)}</span>
                    <span className={"moment-dot " + e.team} />
                    <span className="moment-copy"><strong>{e.kind === "goal" ? "GOAL" : e.kind.toUpperCase()}</strong>
                      <small>{e.description}</small></span>
                    <ChevronRight size={15} />
                  </button>
                ) : <div className="moment-empty">Press play or move the timeline to explore match events.</div>}
              </div>
            </section>

            <div className="context-note">
              <ShieldCheck size={20} />
              <div><strong>Built for trust.</strong><p>Every statistic is calculated in code. Every detected insight cites the exact fictional events behind it.</p></div>
            </div>
          </aside>
        </div>
        <footer>
          <div><span className="light-dot" /> TACTICLENS LIVE · EXPERIMENTAL PROTOTYPE</div>
          <div>100% synthetic match data <span>·</span> No official league affiliation</div>
        </footer>
      </main>
    </div>
  );
}

export default App;
