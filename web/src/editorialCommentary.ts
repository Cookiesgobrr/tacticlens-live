/** Original, evidence-bound editorial grammar. Foundry supplies the verified
 * evidence plan; this compiler authors no new match events or model responses. */
import {eventsUntil,type Timeline} from './footballEngine.ts';
import {momentFacts,AUDIENCES,type AICard,type Audience} from './momentIntelligence.ts';
export const EDITORIAL_VERSION='tacticlens.editorial.v2';
export const clock=(s:number)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const words=(n:number)=>['zero','one','two','three','four','five','six','seven','eight','nine','ten'][n]??String(n);
const teams=['Northport FC','Southbridge Athletic'],short=['Northport','Southbridge'];
export type EditorialLine={id:string;text:string;claimIds:string[];evidenceIds:string[];rosterIds?:number[]};
export type Commentary={schemaVersion:typeof EDITORIAL_VERSION;matchId:string;momentId:string;atSecond:number;audience:Audience;player:number;method:'foundry-plan/authored-grammar';lines:EditorialLine[];text:string};
const stable=(v:unknown):string=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+stable(x)).join(',')+'}':JSON.stringify(v)??'null';

export function compileCommentary(match:Timeline,card:AICard,audience:Audience):Commentary{
  if(match.seed!==82||match.matchId!=='SIM-82')throw Error('No Foundry editorial plan for this match');
  if(!AUDIENCES.includes(audience))throw Error('Unknown audience');
  if(stable(card.moment)!==stable(momentFacts(match,card.moment.atSecond)))throw Error('Commentary requires canonical match facts');
  if(!Array.isArray(card.selectedClaimIds)||!Array.isArray(card.modes[audience])||card.selectedClaimIds.some(id=>!card.moment.claims.some(c=>c.id===id))||card.modes[audience].some(id=>!card.selectedClaimIds.includes(id)))throw Error('Unverified editorial plan');
  const m=card.moment,c=m.checks,events=eventsUntil(match,m.atSecond),goals=events.filter(e=>e.type==='goal');
  const goal=events.find(e=>e.id===c.goalId),shot=events.find(e=>e.id===c.shotId),scorer=match.players[m.player];
  const isGoal=goal?.time===m.atSecond,full=m.atSecond===match.duration,half=m.atSecond===2700;
  const lead=c.score[0]-c.score[1],score=`${teams[0]} ${c.score.join('–')} ${teams[1]}`;
  const before=[...c.score];if(isGoal)before[m.team]--;
  const history:[number,number][]=[[0,0]];for(const g of goals){const last=history.at(-1)!;history.push([last[0]+(g.team===0?1:0),last[1]+(g.team===1?1:0)]);}
  const trailing=history.some(s=>s[m.team]<s[1-m.team]),twoDown=history.some(s=>s[m.team]<=s[1-m.team]-2);
  const consecutive=goals.slice(-c.run),prior=goals.at(-2),sameScorer=consecutive.every(e=>e.player===m.player);
  const previousEqualiser=prior&&history.at(-2)![0]===history.at(-2)![1]&&prior.team===m.team;
  const gap=prior?Math.round((goal!.time-prior.time)*100)/100:0;
  const lines:EditorialLine[]=[];
  const focus=new Set(card.modes[audience]);
  const add=(id:string,text:string,claimIds:string[])=>{
    // Every fact family must have been selected by the actual Insight agent.
    if(!claimIds.every(id=>card.selectedClaimIds.includes(id)))return;
    if(!id.endsWith('.state')&&!claimIds.some(id=>focus.has(id)))return;
    const evidenceIds=[...new Set(claimIds.flatMap(id=>m.claims.find(f=>f.id===id)?.evidenceIds??[]))];
    lines.push({id,text,claimIds,evidenceIds});
  };
  const scoreLine=()=>full?`Full-time — ${score}.`:half?`Half-time — ${score}.`:`${clock(m.atSecond)} — ${score}.`;
  const goalVerb=()=>c.score[m.team]===c.score[1-m.team]?'draws the sides level':c.score[m.team]<c.score[1-m.team]?'pulls a goal back':before[m.team]===before[1-m.team]?'puts '+short[m.team]+' in front':'extends '+short[m.team]+"'s lead";
  const comeback=()=>twoDown&&c.score[m.team]>=c.score[1-m.team]?`${short[m.team]} were two goals down; ${words(c.run)} unanswered goals have ${c.score[m.team]===c.score[1-m.team]?'wiped out that deficit':'turned it into a lead'}.`:trailing&&c.score[m.team]===c.score[1-m.team]?`${short[m.team]} have recovered the deficit, leaving the match level again.`:c.run>1?`${short[m.team]} have now scored ${words(c.run)} unanswered goals.`:c.score[m.team]<c.score[1-m.team]?`${short[1-m.team]} still lead, but the deficit is down to ${words(c.score[1-m.team]-c.score[m.team])}.`:`${short[1-m.team]} now have a ${words(c.score[m.team]-c.score[1-m.team])}-goal deficit to chase.`;
  const geometry=()=>`The source attempt carried ${((shot?.shotXg??0)*100).toFixed(1)}% synthetic xG: ${shot?.shotDistance?.toFixed(1)} metres from goal, ${shot?.shotAngle?.toFixed(1)}° off centre, with the nearest defender ${shot?.shotPressure?.toFixed(1)} metres away.`;
  const activity=()=>`Attempts in the latest ten-minute window stand at ${c.recentShots[0]} for Northport and ${c.recentShots[1]} for Southbridge, compared with ${c.previousShots[0]} and ${c.previousShots[1]} in the previous ten minutes.`;
  const teamLine=(t:number)=>`${short[t]} have ${c.shots[t]} shot${c.shots[t]===1?'':'s'} and ${c.xg[t].toFixed(2)} synthetic xG for their ${c.score[t]} goal${c.score[t]===1?'':'s'}`;
  if(audience==='fan'){
    if(full){
      add('fan.full',`${scoreLine()} ${lead!==0&&twoDown?'From two down to a completed comeback — '+short[lead>0?0:1]+' have turned this match around.':'The final score is in.'}`,['score','run']);
      if(goal)add('fan.deciding-goals',`${scorer.name} scored ${words(c.playerGoals)} times, including the equaliser at ${clock(prior?.time??goal.time)} and the goal that put ${short[m.team]} ahead at ${clock(goal.time)}.`,['player','score','goal']);
      add('fan.full-chances',`The two sides produced ${c.shots[0]+c.shots[1]} shots between them, worth ${(c.xg[0]+c.xg[1]).toFixed(2)} combined synthetic xG.`,['score','team0','team1']);
    }else if(half){
      add('fan.interval',`${scoreLine()} ${short[lead>0?0:1]} take a ${words(Math.abs(lead))}-goal advantage into the second half.`,['score']);
      if(goal)add('fan.interval-scorer',`${scorer.name} has supplied ${c.playerGoals===2?'both goals':c.playerGoals+' goals'}, with the latest arriving at ${clock(goal.time)}.`,['goal','player']);
      add('fan.interval-stakes',`${short[lead>0?1:0]} have taken ${words(c.shots[lead>0?1:0])} shots to ${short[lead>0?0:1]}'s ${words(c.shots[lead>0?0:1])}; it is ${short[lead>0?0:1]} who have the goals.`,['score','team0','team1']);
    }else{
      const opener=c.score.reduce((a,b)=>a+b,0)===1;
      const call=c.score[m.team]===c.score[1-m.team]?'All square!':c.score[m.team]<c.score[1-m.team]?short[m.team]+' have a way back!':trailing?short[m.team]+' are ahead!':opener?short[m.team]+' strike first!':'Two for '+short[m.team]+'!' ;
      add('fan.goal',`${clock(m.atSecond)} — ${call} ${scorer.name} ${goalVerb()}, ${score}.`,['goal','score']);
      add('fan.story',comeback(),['score','run']);
      if(previousEqualiser&&gap>0)add('fan.quick-change',`The equaliser came at ${clock(prior!.time)}; ${gap.toFixed(0)} seconds later, the scoreboard has turned again.`,['score','goal']);
      if(c.playerGoals===1&&shot)add('fan.route',`${scorer.name}'s goal comes from ${shot.shotDistance?.toFixed(1)} metres, after ${words(c.completedBuildup)} completed pass${c.completedBuildup===1?'':'es'} in the recorded build-up.`,['goal','chance','sequence']);
      if(c.playerGoals>1)add('fan.scorer-run',sameScorer?`${scorer.name} has supplied ${c.playerGoals===2?'both':'all '+words(c.playerGoals)} ${short[m.team]} goals, this latest finish coming from ${shot?.shotDistance?.toFixed(1)} metres.`:`That is goal number ${c.playerGoals} for ${scorer.name} in this match.`,['player','score','chance']);
    }
  }else if(audience==='analyst'){
    add('analyst.state',`${clock(m.atSecond)} — ${score}${goal?', following '+scorer.name+"'s goal at "+clock(goal.time):''}.`,['score','goal']);
    if(shot)add('analyst.geometry',geometry(),['chance']);
    if(shot)add('analyst.buildup',`The final fifteen-second possession window contains ${words(c.completedBuildup)} completed pass${c.completedBuildup===1?'':'es'} before the attempt.`,['sequence']);
    add('analyst.activity',activity(),['activity']);
    add('analyst.comparison',`${teamLine(0)}, while ${teamLine(1).replace('have','record')}.`,['team0','team1']);
    add('analyst.boundary','The record supports a description of the passing sequence into this chance; attributing the finish to a formation change or pressing decision would go beyond that evidence.',['chance','sequence']);
  }else if(audience==='club_home'||audience==='club_away'){
    const t=audience==='club_home'?0:1,margin=c.score[t]-c.score[1-t],ours=m.team===t;
    if(full){
      add('supporter.full',`${scoreLine()} ${margin>0?'A comeback to savour for '+short[t]+': a two-goal deficit has become a win.':margin<0?'A painful finish for '+short[t]+': the two-goal lead is gone, and so is the result.':'The sides finish level.'}`,['score']);
    }else if(half){
      add('supporter.interval',`${scoreLine()} ${margin>0?short[t]+' have the advantage, with a two-goal lead at the break.':short[t]+' reach the interval two goals down, with the recovery still ahead of them.'}`,['score']);
    }else{
      const hook=ours?(margin===0?'Back on terms!':margin<0?'There is the response '+short[t]+' needed.':trailing?`From chasing the game to leading it — ${short[t]} have overturned the deficit.`:`An important moment for ${short[t]}.`):(margin>0?`A setback, but ${short[t]} still have the lead.`:margin===0?`The lead has slipped away from ${short[t]}.`:`A hard turn for ${short[t]}: ${before[t]<before[1-t]?'the deficit has grown':'they are now behind'}.`);
      add('supporter.turn',`${clock(m.atSecond)} — ${hook} ${scorer.name} ${goalVerb()}; ${score}.`,['score','goal']);
      if(twoDown)add('supporter.comeback',ours?comeback():`${short[m.team]} were two down and have scored ${words(c.run)} unanswered goal${c.run===1?'':'s'}; ${short[t]} can no longer look at the match as a two-goal lead to protect.`,['score','run']);
    }
    add('supporter.numbers',`${teamLine(t)}. ${margin>0?(c.shots[t]>c.shots[1-t]?short[t]+' have the greater shot count and the lead to go with it.':short[t]+' lead despite '+(c.shots[t]===c.shots[1-t]?'an equal':'a lower')+' shot count.'):margin===0?'It is level again, with neither side able to count on the earlier scoreline.':full?short[t]+' finish one goal short after leading by two.':short[t]+' must now recover a '+words(Math.abs(margin))+'-goal deficit.'}`,['team'+t,'team'+(1-t),'score']);
    if(goal&&ours&&c.playerGoals>1)add('supporter.player',`${scorer.name} has ${c.playerGoals} goals from ${c.playerShots} attempts — the central figure in ${short[t]}'s scoring so far.`,['player']);
  }else if(audience==='player'){
    add('player.performance',`${scorer.name} has ${c.playerGoals} goal${c.playerGoals===1?'':'s'} from ${c.playerShots} shots at ${clock(m.atSecond)}, as ${short[m.team]}'s listed ${scorer.role==='ST'?'centre-forward':scorer.role}. ${isGoal?`The latest finish ${goalVerb()}`:`The most recent scoring contribution came at ${clock(goal?.time??m.atSecond)}`}, with ${score}.`,['player','goal','score']);
    if(shot)add('player.chance',geometry(),['chance']);
    const receipt=[...events].reverse().find(e=>e.type==='receive'&&e.player===scorer.id&&m.claims.find(c=>c.id==='sequence')?.evidenceIds.includes(e.id));
    if(shot)add('player.receiving',`${short[m.team]} completed ${words(c.completedBuildup)} pass${c.completedBuildup===1?'':'es'} in the final fifteen-second possession window${receipt?', with '+scorer.name+' receiving at '+clock(receipt.time):''} before the attempt at ${clock(shot.time)}.`,['sequence']);
    const performance=lines.find(l=>l.id==='player.performance');if(performance)performance.rosterIds=[scorer.id];
    add('player.share',`${c.playerGoals===c.score[m.team]?`${scorer.name} has supplied every ${short[m.team]} goal so far.`:`Those ${c.playerGoals} goals are part of ${short[m.team]}'s ${c.score[m.team]}-goal total.`}`,['player','score']);
  }else{
    add('broadcast.score',full?`${scoreLine()} ${twoDown&&c.score[m.team]>c.score[1-m.team]?short[m.team]+' recover from a two-goal deficit to win.':''}`:half?scoreLine():`${clock(m.atSecond)} · ${scorer.name} ${goalVerb()}: Northport ${c.score.join('–')} Southbridge.`,['score','goal']);
  }
  // A sparse/older verified plan still gets a faithful single-line fallback.
  if(!lines.length)for(const id of card.modes[audience]){const claim=m.claims.find(c=>c.id===id);if(claim)add('fallback.'+id,claim.text,[id]);}
  return {schemaVersion:EDITORIAL_VERSION,matchId:match.matchId,momentId:m.id,atSecond:m.atSecond,audience,player:m.player,method:'foundry-plan/authored-grammar',lines,text:lines.map(l=>l.text).join(' ')};
}
export function auditCommentary(match:Timeline,card:AICard,audience:Audience,value:unknown,asOfSecond:number,selectedPlayer=card.moment.player){
  if(!Number.isFinite(asOfSecond)||card.moment.atSecond>asOfSecond||asOfSecond-card.moment.atSecond>120||audience==='player'&&selectedPlayer!==card.moment.player)return false;
  try{return stable(value)===stable(compileCommentary(match,card,audience));}catch{return false;}
}

export function commentaryExport(match:Timeline,card:AICard,audience:Audience,asOfSecond:number,selectedPlayer=card.moment.player){
 const narrative=compileCommentary(match,card,audience);
 if(!auditCommentary(match,card,audience,narrative,asOfSecond,selectedPlayer))throw Error('Commentary is outside its evidence boundary');
 return {schemaVersion:'tacticlens.ai-moment.v2',matchId:match.matchId,seed:match.seed,asOfSecond,audience,text:narrative.text,narrativeMethod:narrative.method,narrative};
}
export function auditCommentaryExport(match:Timeline,card:AICard,audience:Audience,value:unknown,selectedPlayer=card.moment.player){
 try{const v=value as ReturnType<typeof commentaryExport>;return stable(v)===stable(commentaryExport(match,card,audience,v.asOfSecond,selectedPlayer));}catch{return false;}
}
