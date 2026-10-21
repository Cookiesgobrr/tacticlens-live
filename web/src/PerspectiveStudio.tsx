import { useMemo, useState } from "react";
import { ArrowRight, Eye, Play, ScanEye, ShieldCheck, UserRound, Users, Clapperboard } from "lucide-react";
import type { PublishedInsight } from "./foundry";

export type TeamId = "north" | "south";
export type Perspective = "fan" | "analyst" | "club" | "player";
export interface PerspectiveEvent {
  id: string;
  second: number;
  team: TeamId;
  player: string;
  kind: string;
  x: number;
  y: number;
  pass_completed?: boolean;
}
interface MomentWithMetric {
  id: string;
  at_second: number;
  team: TeamId;
  headline: string;
  casual: string;
  analyst: string;
  broadcast: string;
  evidence_ids: string[];
  baseline_ids: string[];
  method: string;
  metric: { name: string; previous: number; recent: number; delta: number };
}
export interface ComparisonMoment {
  id: string;
  kind: "insight" | "goal" | "pattern";
  at_second: number;
  team: TeamId;
  label: string;
  evidence_ids: string[];
  metric?: MomentWithMetric;
  event?: PerspectiveEvent;
}
interface ProfileCard {
  key: Perspective;
  label: string;
  kicker: string;
  headline: string;
  narrative: string;
  footnote: string;
  source: string;
  accent: string;
}
interface Props {
  clock: number;
  events: PerspectiveEvent[];
  insights: MomentWithMetric[];
  patterns: MomentWithMetric[];
  verifiedInsight: PublishedInsight | null;
  favoriteTeam: TeamId | "all";
  favoritePlayer: string;
  active: Perspective | null;
  onActivate: (profile: Perspective, moment: ComparisonMoment, focusPlayer: string) => void;
  onReplay: (profile: Perspective, moment: ComparisonMoment, focusPlayer: string) => void;
  onSeekEvidence: (second: number) => void;
}

const clockText = (second: number) => {
  const exact = Math.floor(second);
  return String(Math.floor(exact / 60)).padStart(2, "0") + ":" + String(exact % 60).padStart(2, "0");
};
const teamName = (team: TeamId) => team === "north" ? "Northport" : "Southbridge";
const teamShort = (team: TeamId) => team === "north" ? "NOR" : "SOU";

export function comparisonMoments(events: PerspectiveEvent[],
  insights: MomentWithMetric[], patterns: MomentWithMetric[]): ComparisonMoment[] {
  const chosen = [
    ...events.filter(e => e.kind === "goal").map(event => ({
      id: event.id, kind: "goal" as const, at_second: event.second,
      team: event.team, label: "GOAL · " + event.player,
      evidence_ids: [event.id], event,
    })),
    ...insights.map(i => ({
      id: i.id, kind: "insight" as const, at_second: i.at_second,
      team: i.team, label: "INSIGHT · " + i.headline,
      evidence_ids: [...i.baseline_ids, ...i.evidence_ids], metric: i,
    })),
    ...patterns.slice(-12).map(p => ({
      id: p.id, kind: "pattern" as const, at_second: p.at_second,
      team: p.team, label: "PATTERN · " + p.headline,
      evidence_ids: [...p.baseline_ids, ...p.evidence_ids], metric: p,
    })),
  ];
  return chosen.sort((a, b) => a.at_second - b.at_second || a.id.localeCompare(b.id));
}

export function profileStories(moment: ComparisonMoment, events: PerspectiveEvent[],
  club: TeamId, player: string, verified: PublishedInsight | null): ProfileCard[] {
  const timestamp = clockText(moment.at_second);
  const named = teamName(moment.team);
  const event = moment.event;
  const selectedPlayer = player || event?.player ||
    events.find(e => moment.evidence_ids.includes(e.id))?.player || "";
  const cited = events.filter(e => moment.evidence_ids.includes(e.id));
  const visible = events.filter(e => e.second <= moment.at_second);
  const involved = cited.some(e => e.player === selectedPlayer);
  const playerEvents = visible.filter(e => e.player === selectedPlayer);
  const passes = playerEvents.filter(e => e.kind === "pass");
  const completed = passes.filter(e => e.pass_completed === true).length;
  const recoveries = playerEvents.filter(e => e.kind === "recovery").length;
  const shots = playerEvents.filter(e => e.kind === "goal" || e.kind === "shot").length;
  const goalEvents = visible.filter(e => e.kind === "goal");
  const homeGoals = goalEvents.filter(e => e.team === "north").length;
  const awayGoals = goalEvents.filter(e => e.team === "south").length;
  const score = teamShort("north") + " " + homeGoals + "–" + awayGoals + " " + teamShort("south");
  const isFeaturedAI = moment.kind === "insight" && verified?.id === moment.id &&
    verified.at_second === moment.at_second;
  const goal = moment.kind === "goal" && event;
  const fact = moment.metric;
  const metricLabel = fact?.metric.name.toLowerCase() ?? "events";
  const countSentence = fact
    ? named + "'s " + metricLabel + " changed from " + fact.metric.previous +
      " to " + fact.metric.recent + " (" + (fact.metric.delta >= 0 ? "+" : "") +
      fact.metric.delta + ")."
    : "";
  const fanHeadline = isFeaturedAI ? verified.headline :
    goal ? named + " score!" : fact?.headline || "Match moment";
  const fanCopy = isFeaturedAI ? verified.modes.fan :
    goal ? event.player + " finds the net at " + timestamp + ". The score is now " + score + "." :
    fact?.casual || "";
  const analystCopy = isFeaturedAI ? verified.modes.analyst :
    goal ? "Confirmed goal event " + event.id + " by " + event.player +
      ". Recorded event coordinate (" + event.x + ", " + event.y +
      ") on a synthetic 0–100 pitch; score " + score + "." :
    fact?.analyst || "";
  const clubScored = club === moment.team;
  const clubHeadline = goal
    ? (clubScored ? "Your club have scored!" : "Your club have conceded.")
    : clubScored ? "Your team's pattern" : "What the opposition are doing";
  const clubCopy = goal
    ? (clubScored ? teamName(club) + " score through " + event.player :
      teamName(club) + " concede to " + event.player) +
      " at " + timestamp + ". Current score: " + score + "."
    : (clubScored ? "For " + teamName(club) + ": " : "Against " + teamName(club) + ": ") +
      countSentence + " The figures show what happened, not a confirmed tactical intention.";
  const playerHeadline = selectedPlayer ? "Follow " + selectedPlayer : "Choose a player";
  const playerCopy = selectedPlayer
    ? selectedPlayer + " has " + completed + "/" + passes.length +
      " completed passes, " + shots + " shots and " + recoveries +
      " recoveries by " + timestamp + ". " +
      (involved ? "This player is named in the moment's source events." :
        "This player is not named in the moment's source events.")
    : "Select a player to review their contribution at this match minute.";

  return [
    {
      key: "fan", label: "Casual fan", kicker: "THE STORY",
      headline: fanHeadline, narrative: fanCopy,
      footnote: "Plain language · Broadcast camera", source: isFeaturedAI ? "VERIFIED FOUNDRY COPY" : "EVENT-DERIVED COPY",
      accent: "fan",
    },
    {
      key: "analyst", label: "Studio analyst", kicker: "THE EVIDENCE",
      headline: goal ? "Goal confirmed · " + timestamp : (fact?.headline || "Match facts"),
      narrative: analystCopy,
      footnote: moment.evidence_ids.length + " source references · Tactical camera",
      source: isFeaturedAI ? "VERIFIED FOUNDRY COPY" : "DETERMINISTIC FACTS", accent: "analyst",
    },
    {
      key: "club", label: teamName(club) + " supporter", kicker: "YOUR CLUB",
      headline: clubHeadline, narrative: clubCopy,
      footnote: "Club-centered language · Chosen side highlighted",
      source: "RULE-BASED PERSONALIZATION", accent: "club",
    },
    {
      key: "player", label: "Player focus", kicker: "YOUR PLAYER",
      headline: playerHeadline, narrative: playerCopy,
      footnote: "Player performance through " + timestamp + " · Follow camera",
      source: "EVENT-BASED PLAYER LOG", accent: "player",
    },
  ];
}

/** A quiet companion to the match: one active lens, not four competing cards. */
export default function PerspectiveStudio({
  clock, events, insights, patterns, verifiedInsight, favoriteTeam, favoritePlayer,
  active, onActivate, onReplay, onSeekEvidence,
}: Props) {
  const moments = useMemo(() => comparisonMoments(events, insights, patterns), [events, insights, patterns]);
  const [selectedId, setSelectedId] = useState("");
  const available = moments.filter(m => m.at_second <= clock);
  const moment = moments.find(m => m.id === selectedId && m.at_second <= clock)
    ?? available.at(-1);
  const feature = moments.find(m => m.kind === "insight");
  const club = favoriteTeam === "all" ? (moment?.team ?? "north") : favoriteTeam;
  const linked = useMemo(() => {
    if (!moment) return [];
    const ids = new Set(moment.evidence_ids);
    return events.filter(e => ids.has(e.id) && e.second <= moment.at_second);
  }, [events, moment]);
  const targetPlayer = favoritePlayer || moment?.event?.player || linked.at(-1)?.player || "";
  const stories = moment ? profileStories(moment, events, club, targetPlayer, verifiedInsight) : [];
  const selectedProfile = active ?? "fan";
  const story = stories.find(s => s.key === selectedProfile);
  const lensOptions: { key: Perspective; label: string; icon: typeof Eye }[] = [
    { key: "fan", label: "Fan", icon: Eye },
    { key: "analyst", label: "Data", icon: ScanEye },
    { key: "club", label: "Club", icon: Users },
    { key: "player", label: "Player", icon: UserRound },
  ];

  return <section className="panel match-lens-panel" aria-label="Match Lens personalized viewing">
    <div className="lens-topline"><span><ScanEye size={14} /> MATCH LENS</span>
      <span>YOUR VIEW</span>
    </div>
    <h2>Watch it your way.</h2>
    <p className="lens-subheading">Your viewpoint changes the commentary, camera and player emphasis.</p>
    <div className="lens-selector" role="group" aria-label="Viewing perspective">
      {lensOptions.map(option => {
        const Icon = option.icon;
        return <button key={option.key}
          aria-pressed={selectedProfile === option.key}
          onClick={() => {
            if (moment) onActivate(option.key, moment, targetPlayer);
          }}>
          <Icon size={14} /> {option.label}
        </button>;
      })}
    </div>
    {available.length > 0 && <label className="lens-moment-select">
      Key moment
      <select aria-label="Choose a past match moment"
        value={moment?.id ?? ""}
        onChange={event => setSelectedId(event.target.value)}>
        {available.map(item => <option key={item.id} value={item.id}>
          {clockText(item.at_second)} · {item.label}
        </option>)}
      </select>
    </label>}
    {moment && story ? <div className="lens-story">
      <div className="lens-story-top"><span>{clockText(moment.at_second)} · {story.kicker}</span>
        <small>{story.source}</small></div>
      <h3>{story.headline}</h3>
      <p>{story.narrative}</p>
      <div className="lens-actions">
        <button className="lens-replay" onClick={() => onReplay(selectedProfile, moment, targetPlayer)}>
          <Play size={13} /> Replay moment
        </button>
        <span><ShieldCheck size={12} /> {linked.length} sources</span>
      </div>
      <details className="lens-sources">
        <summary>Inspect source events</summary>
        <div>{linked.slice(-12).map(e => <button key={e.id}
          onClick={() => onSeekEvidence(e.second)}>{e.id} <span>{clockText(e.second)}</span></button>)}</div>
      </details>
    </div> : <div className="lens-empty">
      <span>Insights will appear as the match unfolds.</span>
      <small>The selected view uses only events visible at your replay time.</small>
    </div>}
    {feature && clock < feature.at_second && <button className="lens-demo-jump" onClick={() =>
      onActivate(selectedProfile, feature,
        favoritePlayer || events.find(e => feature.evidence_ids.includes(e.id))?.player || "")}>
      Explore the verified AI moment <ArrowRight size={13} />
    </button>}
    <div className="lens-footer"><Clapperboard size={13} />
      Synthetic event replay · Only the validated Foundry insight contains AI-written copy.</div>
  </section>;
}
