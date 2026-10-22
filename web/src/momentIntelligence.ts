import {eventsUntil, type Timeline, type EventLog} from './footballEngine.ts';
export const AUDIENCES=['fan','analyst','club_home','club_away','player','broadcast'] as const;
export type Audience=typeof AUDIENCES[number];
export type Claim={id:string;kind:string;text:string;evidenceIds:string[]};
const clock=(s:number)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const club=(t:number)=>t===0?'Northport FC':'Southbridge Athletic';
const rounded=(n:number)=>Math.round(n*1000)/1000;
const pair=(events:EventLog[],type:string)=>[0,1].map(t=>events.filter(e=>e.type===type&&e.team===t).length);
const xgs=(events:EventLog[])=>[0,1].map(t=>rounded(events.filter(e=>e.type==='shot'&&e.team===t).reduce((a,e)=>a+(e.shotXg??0),0)));
export function momentFacts(match:Timeline,atSecond:number){
  const events=eventsUntil(match,atSecond),goals=events.filter(e=>e.type==='goal'),shots=events.filter(e=>e.type==='shot');
  const latest=goals.at(-1),shot=events.find(e=>e.id===latest?.sourceId);
  const score=pair(events,'goal'),totalShots=pair(events,'shot'),xg=xgs(events);
  const recent=events.filter(e=>e.time>atSecond-600),previous=events.filter(e=>e.time>atSecond-1200&&e.time<=atSecond-600);
  const team=latest?.team??0,player=latest?.player??9;
  let run=0;for(const g of [...goals].reverse()){if(g.team!==team)break;run++;}
  const chain:EventLog[]=[];
  if(shot)for(const e of [...events].reverse()){
    if(e.time>shot.time)continue;
    if(e.time<shot.time-15||(['pass','receive','tackle','interception','recovery','save'].includes(e.type)&&e.team!==team))break;
    if(e.team===team&&(e.type==='pass'||e.type==='receive'))chain.unshift(e);
  }
  const scorerGoals=goals.filter(e=>e.player===player),scorerShots=shots.filter(e=>e.player===player);
  const claims:Claim[]=[];
  const add=(id:string,kind:string,text:string,rows:EventLog[])=>claims.push({id,kind,text,evidenceIds:[...new Set(rows.map(e=>e.id))]});
  add('score','score',`${club(0)} ${score[0]}–${score[1]} ${club(1)} at ${clock(atSecond)}.`,goals);
  add('totals','totals',`${totalShots[0]+totalShots[1]} shots and ${(xg[0]+xg[1]).toFixed(2)} combined synthetic xG so far.`,shots);
  add('activity','activity',`Shot activity in the last ten minutes: ${club(0)} ${pair(recent,'shot')[0]}, ${club(1)} ${pair(recent,'shot')[1]}; in the preceding ten minutes: ${pair(previous,'shot')[0]} and ${pair(previous,'shot')[1]}. This measures attempts, not tactical causation.`,[...previous,...recent].filter(e=>e.type==='shot'));
  for(const t of [0,1])add(`team${t}`,'team',`${club(t)}: ${totalShots[t]} shots, ${xg[t].toFixed(2)} synthetic xG and ${score[t]} goals.`,events.filter(e=>e.team===t&&(e.type==='shot'||e.type==='goal')));
  if(latest&&shot){
    add('goal','goal',`${match.players[player].name} scored for ${club(team)} at ${clock(latest.time)}.`,[shot,latest]);
    add('chance','chance',`The source shot had ${((shot.shotXg??0)*100).toFixed(1)}% synthetic xG, from ${shot.shotDistance?.toFixed(1)} metres at ${shot.shotAngle?.toFixed(1)}° off centre, with the nearest defender ${shot.shotPressure?.toFixed(1)} metres away.`,[shot]);
    add('sequence','sequence',`${club(team)} completed ${chain.filter(e=>e.type==='receive').length} passes in the uninterrupted possession events recorded within fifteen seconds before the source shot. This sequence does not prove why the goal occurred.`,[...chain,shot]);
    add('run','run',`${club(team)} have scored the last ${run} goal${run===1?'':'s'} of this match.`,goals.slice(-run));
    add('player','player',`${match.players[player].name} has ${scorerGoals.length} goals from ${scorerShots.length} shots so far.`,[...scorerGoals,...scorerShots]);
  }
  return {id:`${match.matchId}@${atSecond}`,matchId:match.matchId,seed:match.seed,atSecond,player,team,
    checks:{score,shots:totalShots,xg,recentShots:pair(recent,'shot'),previousShots:pair(previous,'shot'),run,
      completedBuildup:chain.filter(e=>e.type==='receive').length,playerGoals:scorerGoals.length,playerShots:scorerShots.length,
      goalId:latest?.id??null,shotId:shot?.id??null},claims};
}
export type Moment=ReturnType<typeof momentFacts>;
export const ANGLES={score:'The match picture',chance:'Chance quality',sequence:'The route to goal',activity:'Shot activity',run:'The scoring run',player:'Player contribution'} as const;
export type Angle=keyof typeof ANGLES;
export type AICard={moment:Moment;angle:Angle;selectedClaimIds:string[];modes:Record<Audience,string[]>};
export type AIPack={schemaVersion:'tacticlens.foundry11.v1';status:'verified';provider:'microsoft-foundry';model:'gpt-4.1-mini';
  matchId:string;seed:number;generatedAt:string;cards:AICard[];
  trace:{stage:string;agent:string;status:string;responseId:string;inputTokens:number;outputTokens:number;elapsedMs:number}[]};
const stable=(v:unknown):string=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+stable(x)).join(',')+'}':JSON.stringify(v)??'null';
export function validateAIPack(value:unknown,match:Timeline):AIPack|null{
  try{
    const p=value as AIPack;
    if(!p||p.schemaVersion!=='tacticlens.foundry11.v1'||p.status!=='verified'||p.provider!=='microsoft-foundry'||p.model!=='gpt-4.1-mini'||p.matchId!==match.matchId||p.seed!==match.seed||!Number.isFinite(Date.parse(p.generatedAt)))return null;
    if(!Array.isArray(p.cards)||!p.cards.length||p.cards.length>8||new Set(p.cards.map(c=>c.moment.id)).size!==p.cards.length)return null;
    for(const c of p.cards){
      const t=c.moment.atSecond;
      if(!Number.isFinite(t)||t<0||t>match.duration||stable(c.moment)!==stable(momentFacts(match,t))||!(c.angle in ANGLES))return null;
      const ids=c.selectedClaimIds;
      if(!Array.isArray(ids)||ids.length<3||ids.length>10||new Set(ids).size!==ids.length||!ids.includes(c.angle)||ids.some(id=>!c.moment.claims.some(f=>f.id===id)))return null;
      if(Object.keys(c.modes).sort().join()!==[...AUDIENCES].sort().join())return null;
      for(const mode of AUDIENCES){const rows=c.modes[mode];if(!Array.isArray(rows)||rows.length<1||rows.length>3||new Set(rows).size!==rows.length||rows.some(id=>!ids.includes(id)))return null;}
    }
    if(!Array.isArray(p.trace)||p.trace.length!==3||!['Insight','Verification','Presentation'].every(s=>p.trace.some(t=>t.stage===s&&t.status==='complete'&&typeof t.responseId==='string'&&t.responseId.length>5&&Number.isInteger(t.inputTokens)&&t.inputTokens>=0&&Number.isInteger(t.outputTokens)&&t.outputTokens>=0&&Number.isFinite(t.elapsedMs)&&t.elapsedMs>=0)))return null;
    return p;
  }catch{return null;}
}
export function visibleAICard(pack:AIPack|null,time:number,lens:string,_team:number,player:number){
  return pack?.cards.filter(c=>c.moment.atSecond<=time&&time-c.moment.atSecond<=120&&(lens!=='player'||c.moment.player===player)).sort((a,b)=>b.moment.atSecond-a.moment.atSecond)[0]??null;
}
export function aiAudience(lens:string,team:number):Audience{return lens==='club'?(team===1?'club_away':'club_home'):lens==='analyst'?'analyst':lens==='player'?'player':'fan';}
export function aiText(card:AICard,audience:Audience){return card.modes[audience].map(id=>card.moment.claims.find(c=>c.id===id)!.text).join(' ');}
