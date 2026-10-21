import { useMemo, useState } from "react";
import { ArrowRight, Clapperboard, Eye, Play, ScanEye, ShieldCheck, UserRound, Users } from "lucide-react";
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

export default function PerspectiveStudio({
  clock, events, insights, patterns, verifiedInsight, favoriteTeam, favoritePlayer,
  active, onActivate, onReplay, onSeekEvidence,
}: Props) {
  const moments = useMemo(() => comparisonMoments(events, insights, patterns), [events, insights, patterns]);
  const preferredMoment = moments.find(m => m.kind === "insight") ?? moments.find(m => m.kind === "goal") ?? moments[0];
  const [choice, setChoice] = useState("");
  const moment = moments.find(m => m.id === choice) ?? preferredMoment;
  const club = favoriteTeam === "all" ? (moment?.team ?? "north") : favoriteTeam;
  const linkedEvents = useMemo(() => {
    if (!moment) return [];
    const ids = new Set(moment.evidence_ids);
    return events.filter(e => ids.has(e.id) && e.second <= moment.at_second);
  }, [events, moment]);
  const targetPlayer = favoritePlayer || moment?.event?.player || linkedEvents.at(-1)?.player || "";
  const stories = moment ? profileStories(moment, events, club, targetPlayer, verifiedInsight) : [];

  if (!moment) return null;
  const isPreview = moment.at_second > clock;

  return <section className="panel perspectives-panel" aria-label="Same moment, four perspectives">
    <div className="perspectives-heading">
      <div>
        <div className="section-kicker"><ScanEye size={15} /> PERSONALIZED MATCH INTELLIGENCE</div>
        <h2>One moment. Four experiences.</h2>
        <p>One audited event stream, four genuinely different ways to understand the action.</p>
      </div>
      <span className="perspectives-pill"><ShieldCheck size={14} /> SAME SOURCE EVENTS</span>
    </div>
    <div className="perspectives-toolbar">
      <label htmlFor="moment-select">Explore a match moment
        <select id="moment-select" value={moment.id} onChange={event => setChoice(event.target.value)}>
          {moments.map(item => <option key={item.id} value={item.id}>
            {clockText(item.at_second)} · {item.label}
          </option>)}
        </select>
      </label>
      <div className="perspectives-preview-note">
        {clockText(moment.at_second)} · {isPreview ? "Highlight preview — this moment is ahead of the replay clock" :
          "Available at the current replay time"}
      </div>
    </div>
    <div className="perspectives-grid">
      {stories.map(story => {
        const Icon = story.key === "fan" ? Eye : story.key === "analyst" ? ScanEye :
          story.key === "club" ? Users : UserRound;
        return <article key={story.key}
          className={"perspective-card perspective-" + story.accent + (active === story.key ? " selected" : "")}>
          <div className="perspective-card-top">
            <span><Icon size={15} /> {story.label}</span>
            <small>{story.source}</small>
          </div>
          <div className="perspective-kicker">{story.kicker}</div>
          <h3>{story.headline}</h3>
          <p>{story.narrative}</p>
          <div className="perspective-footnote">{story.footnote}</div>
          <div className="perspective-actions">
            <button aria-pressed={active === story.key}
              onClick={() => onActivate(story.key, moment, targetPlayer)}>
              {active === story.key ? "Viewing" : "Switch to view"}
              <ArrowRight size={14} />
            </button>
            <button className="perspective-replay" onClick={() => onReplay(story.key, moment, targetPlayer)}>
              <Play size={13} /> Replay
            </button>
          </div>
        </article>;
      })}
    </div>
    <div className="perspectives-evidence">
      <div className="perspectives-evidence-title">
        <span><ShieldCheck size={14} /> SHARED EVIDENCE · {linkedEvents.length} EVENT REFERENCES</span>
        <span>All content is derived from the selected fictional match</span>
      </div>
      <div className="perspectives-evidence-scroll">
        {linkedEvents.slice(-10).map(event => <button key={event.id}
          onClick={() => onSeekEvidence(event.second)} title={"Seek to " + clockText(event.second)}>
          {event.id} <span>{clockText(event.second)}</span> <ArrowRight size={12} />
        </button>)}
      </div>
      <div className="perspectives-disclosure">
        <Clapperboard size={13} /> Verified Microsoft Foundry output is reused only for its original
        audited insight. Club and player views use deterministic event facts. Selecting a viewer
        does not trigger any additional AI inference.
      </div>
    </div>
  </section>;
}
