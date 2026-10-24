import type {Timeline,EventLog} from './footballEngine';
import {AUDIENCES,type Audience} from './momentIntelligence.ts';
export type Candidate={id:string;atSecond:number;kind:string;priority:number;eventId:string|null;player:number|null;team:number|null};
const q=(n:number)=>Math.round(n*1e6)/1e6;
const wins=['tackle','interception','recovery'];
const rows=(match:Timeline,at:number)=>match.events.filter(e=>e.time<=at);
const pair=(events:EventLog[],kind:string)=>[0,1].map(t=>events.filter(e=>e.type===kind&&e.team===t).length);
function sequence(events:EventLog[],team:number|null,at:number){
  const result:EventLog[]=[];
  for(const e of [...events].reverse()){
    if(e.time>at)continue;if(e.time<at-25)break;
    if(['pass','receive',...wins,'save'].includes(e.type)&&e.team!==team)break;
    if(e.team===team&&['pass','receive'].includes(e.type))result.unshift(e);
  }return result;
}
const candidatesCache=new WeakMap<Timeline,Candidate[]>();
export function liveCandidates(match:Timeline){
  const cached=candidatesCache.get(match);if(cached)return cached;
  const result:Candidate[]=[],seen=new Map<string,EventLog>(),last=new Map<string,number>();
  for(const [i,e] of match.events.entries()){
    let kind='',priority=0;const action=seen.get(e.sourceId??''),prefix=match.events.slice(0,i+1);
    if(e.type==='goal'){kind='goal';priority=100;}
    else if(['save','miss'].includes(e.type)&&action&&(action.shotXg??0)>=.10){kind=e.type==='save'?'save':'chance';priority=70+Math.min(15,Math.floor((action.shotXg??0)*100));}
    else if(['interception','tackle'].includes(e.type)&&(e.team===0?e.x<30:e.x>75)){kind='defence';priority=65;}
    else if(e.type==='receive'&&sequence(prefix,e.team,e.time).filter(x=>x.type==='receive').length>=5){kind='sequence';priority=45;}
    if(!kind&&e.type==='shot'){
      const recent=prefix.filter(x=>x.time>e.time-300&&x.type==='shot'&&x.team===e.team);
      const previous=prefix.filter(x=>x.time>e.time-600&&x.time<=e.time-300&&x.type==='shot'&&x.team===e.team);
      if(recent.length>=3&&recent.length-previous.length>=2){kind='activity';priority=55;}
    }
    if(!kind&&['shot','tackle','interception'].includes(e.type)&&prefix.filter(x=>x.player===e.player&&x.type===e.type).length===(e.type==='shot'?4:3)){kind='player';priority=50;}
    seen.set(e.id,e);
    if(kind){const key=kind+(kind==='player'?e.player:'');const cooldown=kind==='goal'?0:['save','chance','defence'].includes(kind)?180:600;
      if(e.time-(last.get(key)??-10000)<cooldown)continue;last.set(key,e.time);
      result.push({id:e.id,atSecond:e.time,kind,priority,eventId:e.id,player:e.player,team:e.team});}
  }
  for(const [atSecond,kind] of [[2700,'halftime'],[5400,'fulltime']] as const)result.push({id:`${match.matchId}:${kind}`,atSecond,kind,priority:95,eventId:null,player:null,team:null});
  result.sort((a,b)=>a.atSecond-b.atSecond||(a.id<b.id?-1:a.id>b.id?1:0));candidatesCache.set(match,result);return result;
}
export function liveFacts(match:Timeline,candidate:Candidate){
  const at=candidate.atSecond,events=rows(match,at),event=events.find(e=>e.id===candidate.eventId)??null;
  const source=events.find(e=>e.id===event?.sourceId),shot=source?.type==='shot'?source:null;
  const {player,team}=candidate,shots=events.filter(e=>e.type==='shot');
  const recent=events.filter(e=>e.time>at-300),previous=events.filter(e=>e.time>at-600&&e.time<=at-300);
  const chain=team===null?[]:sequence(events,team,shot?.time??at);
  const ids=(events:EventLog[])=>[...new Set(events.map(e=>e.id))];
  const claims:Record<string,string[]>={event:ids([shot,event].filter((e):e is EventLog=>!!e)),score:ids(events.filter(e=>e.type==='goal')),
    totals:ids(shots),activity:ids([...previous,...recent].filter(e=>e.type==='shot')),
    team0:ids(events.filter(e=>e.team===0&&['shot','goal'].includes(e.type))),team1:ids(events.filter(e=>e.team===1&&['shot','goal'].includes(e.type)))};
  if(player!==null){claims.player=ids(events.filter(e=>e.player===player&&['shot','goal',...wins].includes(e.type)));claims.sequence=ids(chain);}
  if(shot)claims.chance=[shot.id];
  return {matchId:match.matchId,seed:match.seed,engineVersion:match.engineVersion,measurementPrecision:6,candidate,
    stats:{score:pair(events,'goal'),shots:pair(events,'shot'),xg:[0,1].map(t=>Math.round(shots.filter(e=>e.team===t).reduce((s,e)=>s+(e.shotXg??0),0)*1000)/1000),passes:pair(events,'receive'),
      recentShots:pair(recent,'shot'),previousShots:pair(previous,'shot'),completedSequence:chain.filter(e=>e.type==='receive').length,
      playerGoals:events.filter(e=>e.type==='goal'&&e.player===player).length,playerShots:events.filter(e=>e.type==='shot'&&e.player===player).length,
      playerWins:events.filter(e=>wins.includes(e.type)&&e.player===player).length},
    claims,actor:player===null?null:match.players[player],
    shot:shot?{id:shot.id,time:shot.time,player:shot.player,team:shot.team,x:q(shot.x),y:q(shot.y),shotXg:q(shot.shotXg!),shotDistance:q(shot.shotDistance!),shotAngle:q(shot.shotAngle!),shotPressure:q(shot.shotPressure!)}:null,
    event:event?{id:event.id,time:event.time,player:event.player,team:event.team,type:event.type,x:q(event.x),y:q(event.y)}:null};
}
export type LiveFacts=ReturnType<typeof liveFacts>;
export type Plan={id:string;modes:Record<Audience,string[]>};
export type SessionRecord={candidate:Candidate;state:string;facts:LiveFacts;startedAt:number;finishedAt:number|null;
  plan?:Plan;proposal?:{id:string;angle:string;claimIds:string[]};trace?:{stage:string;responseId:string;inputTokens:number;outputTokens:number;elapsedMs:number}[];elapsedMs?:number;providerMode?:string;eventToPublicationMs?:number};
export type SessionFeed={schemaVersion:string;sessionId:string;matchId:string;seed:number;engineVersion:string;engineSha256:string;sourceSha256:string;
  status:string;generationEnabled:boolean;serviceAvailable?:boolean;clock:number;speed:number;queued:number;records:SessionRecord[];reservedCalls:number;reservedMoments:number};
export const stable=(v:unknown):string=>Array.isArray(v)?`[${v.map(stable).join(',')}]`:v&&typeof v==='object'?`{${Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>`${JSON.stringify(k)}:${stable(x)}`).join(',')}}`:JSON.stringify(v)??'null';
export function validateSessionFeed(value:unknown,match:Timeline,sid:string):SessionFeed|null{
 try{
  const f=value as SessionFeed;
  if(!f||f.schemaVersion!=='tacticlens.session-feed.v1'||f.sessionId!==sid||f.seed!==match.seed||f.matchId!==match.matchId||f.engineVersion!==match.engineVersion
    ||f.engineSha256!=='03c5db863bac507fa815e43b8727565f099915507d4c6bac1b23e642962c5384'||!/^[0-9a-f]{64}$/.test(f.sourceSha256)||!Number.isFinite(f.clock)||f.clock<0||f.clock>5400
    ||!Number.isInteger(f.speed)||f.speed<1||f.speed>60||!Array.isArray(f.records)||f.records.length>27||new Set(f.records.map(r=>r.candidate.id)).size!==f.records.length)return null;
  const eligible=liveCandidates(match);
  for(const r of f.records){
    const c=eligible.find(c=>c.id===r.candidate.id);
    if(!c||stable(c)!==stable(r.candidate)||c.atSecond>f.clock||stable(r.facts)!==stable(liveFacts(match,c))||!['identified','processing','verification','presentation','verified','fallback'].includes(r.state))return null;
    if(r.state==='verified'){
      if(!r.plan||!r.proposal||r.plan.id!==c.id||r.proposal.id!==c.id||Object.keys(r.plan.modes).sort().join()!==[...AUDIENCES].sort().join())return null;
      const chosen=r.proposal.claimIds;
      if(!Array.isArray(chosen)||chosen.length<4||chosen.length>9||new Set(chosen).size!==chosen.length||chosen.some(id=>!(id in r.facts.claims))||!['event','score','team0','team1',r.proposal.angle].every(id=>chosen.includes(id))||r.facts.actor&&!chosen.includes('player'))return null;
      for(const a of AUDIENCES){const ids=r.plan.modes[a];const required=a==='fan'||a==='broadcast'?'event':a==='club_home'?'team0':a==='club_away'?'team1':a==='player'?(r.facts.actor?'player':'score'):null;
        if(!Array.isArray(ids)||ids.length<1||ids.length>5||new Set(ids).size!==ids.length||ids.some(id=>!chosen.includes(id))||required&&!ids.includes(required))return null;}
      if(!r.plan.modes.analyst.some(id=>['chance','sequence','activity','totals'].includes(id))||r.plan.modes.broadcast.length>2||c.kind==='goal'&&(r.plan.modes.fan.length<3||!r.plan.modes.fan.includes('player')||!r.plan.modes.fan.some(id=>['chance','sequence','activity','totals'].includes(id))))return null;
      if(stable(r.plan.modes.fan)===stable(r.plan.modes.analyst)||!Array.isArray(r.trace)||r.trace.length!==3||new Set(r.trace.map(t=>t.responseId)).size!==3)return null;
      if(r.trace.some((t,i)=>t.stage!==['Insight','Verification','Presentation'][i]||typeof t.responseId!=='string'||t.responseId.length<6||!Number.isInteger(t.inputTokens)||t.inputTokens<0||t.inputTokens>16000||!Number.isInteger(t.outputTokens)||t.outputTokens<0||t.outputTokens>1000||!Number.isFinite(t.elapsedMs)||t.elapsedMs<0))return null;
    }
  }return f;
 }catch{return null;}
}
const club=(t:number)=>t===0?'Northport FC':'Southbridge Athletic';
export const liveClock=(t:number)=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
export function liveHeadline(f:LiveFacts){
 const c=f.candidate,name=f.actor?.name??'';
 return c.kind==='goal'?`${name} scores for ${club(c.team!)}`:c.kind==='save'?`${name} makes the save`:c.kind==='chance'?'A major chance goes begging':c.kind==='halftime'?'The half-time picture':c.kind==='fulltime'?'The full-time verdict':c.kind==='defence'?`${name} stops the attack`:c.kind==='sequence'?'A sustained passing sequence':c.kind==='activity'?'Shot activity is rising':`${name} in focus`;
}
export function edition(f:LiveFacts,audience:Audience,plan?:Plan){
 const s=f.stats,c=f.candidate,actor=f.actor?.name??'The selected player',score=`${club(0)} ${s.score[0]}–${s.score[1]} ${club(1)}`;
 const own=s.score[c.team??0],other=s.score[1-(c.team??0)],teamName=club(c.team??0);
 const goalLead=own+other===1?`${actor} breaks the deadlock for ${teamName}!`:own===other?`All square! ${actor} draws ${teamName} level.`:own<other?`${actor} pulls one back for ${teamName}. The gap closes, though they still trail.`:own-other===1?`${teamName} are in front! ${actor} makes it ${s.score[0]}–${s.score[1]}.`:`${actor} extends ${teamName}'s advantage. They now lead by ${own-other}.`;
 const event=c.kind==='goal'?(audience==='fan'?`${goalLead} ${score}.`:audience==='club_home'||audience==='club_away'?(c.team===(audience==='club_home'?0:1)?`${actor} finds the net. A moment to savour for ${teamName}. ${score}.`:`${actor} scores at the other end. ${club(audience==='club_home'?0:1)} must respond. ${score}.`):`${actor} scores for ${teamName}. ${score}.`):`${liveHeadline(f)}. ${score}.`;
 const sentences:Record<string,string>={event,score:`At ${liveClock(c.atSecond)}, it is ${score}.`,
  totals:`The match has produced ${s.shots[0]+s.shots[1]} shots and ${(s.xg[0]+s.xg[1]).toFixed(2)} combined synthetic xG so far.`,
  activity:`Over the last five minutes, Northport have ${s.recentShots[0]} shots and Southbridge ${s.recentShots[1]}; the preceding five-minute counts were ${s.previousShots[0]} and ${s.previousShots[1]}. This measures attempts, not territorial control.`,
  sequence:`${club(c.team??0)} completed ${s.completedSequence} passes in the uninterrupted logged possession sequence within 25 seconds of this action.`,
  player:audience==='fan'&&c.kind==='goal'?`That is ${actor}'s ${s.playerGoals===1?'first':s.playerGoals===2?'second':s.playerGoals===3?'third':String(s.playerGoals)+'th'} goal of this match, from ${s.playerShots} attempts. `:`${actor}: ${s.playerGoals} goals, ${s.playerShots} shots and ${s.playerWins} recorded tackles, interceptions or recoveries so far.`,
  team0:`Northport's return: ${s.score[0]} goals from ${s.shots[0]} shots, with ${s.xg[0].toFixed(2)} synthetic xG.`,
  team1:`Southbridge's return: ${s.score[1]} goals from ${s.shots[1]} shots, with ${s.xg[1].toFixed(2)} synthetic xG.`,
  chance:f.shot?`The source shot carried ${((f.shot.shotXg??0)*100).toFixed(1)}% synthetic xG, struck from ${f.shot.shotDistance?.toFixed(1)} metres at ${f.shot.shotAngle?.toFixed(1)}° off centre. The nearest defender was ${f.shot.shotPressure?.toFixed(1)} metres away.`:''};
 const ids=plan?.modes[audience]??['event','score'];
 return ids.map(id=>({id,text:sentences[id],evidenceIds:[...new Set([...(f.claims[id]??[]),...(id==='event'?f.claims.score:[])])]}));
}
