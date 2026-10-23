/** Nominal geometry and prefix-bound observations, never coaching intentions. */
import {FORMATIONS,type Formation} from './formations.ts';
import {eventsUntil,type Timeline,type Side} from './footballEngine.ts';
import {clock} from './editorialCommentary.ts';
import type {AICard} from './momentIntelligence.ts';
const round=(n:number)=>Math.round(n*10)/10;
const club=(t:Side)=>t===0?'Northport':'Southbridge';
const profiles:Record<string,[string,string]>={
 '4-3-3':['A back four, a three-player midfield and three forward lanes.','The full-back and wide-forward anchors provide two levels of width, with the centre-forward between the two wide attackers. The three midfield anchors separate the central and side-channel starting lanes; these are nominal reference positions, not proof of a particular passing pattern.'],
 '4-2-3-1':['Two deeper midfield anchors behind an attacking midfielder.','The nominal double pivot sits below the attacking-midfield anchor, while the two wide attackers and centre-forward occupy the next line. That creates staggered central support and separate wide outlets on the template; measured possession and pass events are needed before describing how it was used.'],
 '4-4-2':['Two central forwards ahead of a four-player midfield.','The midfield has two central anchors and a player on each flank, with two forward starting lanes rather than one. A back four supplies the defensive reference line. The template offers both a wide midfield outlet and a second central forward option, without establishing that either was actually available on a given play.'],
 '3-5-2':['Three centre-back anchors with wing-back width.','Five midfield reference positions include the two wing-backs, a deeper central anchor and two side midfielders; two forwards remain ahead. The template places the widest anchors in midfield rather than the defensive line. That is nominal geometry, not evidence of a wing-back instruction or an observed overload.'],
 '4-1-4-1':['A holding-midfield anchor separates the back four and next midfield line.','Four midfield reference lanes sit ahead of the deeper central midfielder, with one centre-forward beyond them. This introduces a central depth step between defence and the more advanced midfield anchors. It describes the simulation template, not a real manager’s plan or proof of defensive effectiveness.'],
};
export function formationFacts(match:Timeline,team:Side,atSecond:number){
 if(!Number.isFinite(atSecond)||atSecond<0||atSecond>match.duration)throw Error('Invalid formation boundary');
 const shape=FORMATIONS.find(f=>f.name===match.formations[team])!;
 const ids=match.players.filter(p=>p.team===team).map(p=>p.id),outfield=ids.filter(id=>id%11!==0);
 const lineIds=(band:number)=>ids.filter(id=>shape.lines[id%11]===band);
 const fromSecond=Math.max(0,atSecond-300),samples=[];
 const sum={width:0,backDepth:0,midfieldGap:0,support:0,withBallDepth:0,withoutBallDepth:0},counts={withBall:0,withoutBall:0,carriers:0};
 const localX=(x:number)=>team===0?x:105-x;
 for(let second=Math.ceil(fromSecond/5)*5;second<=atSecond;second+=5){
  const f=Math.floor(second/match.frameSeconds);if(match.ballPhases[f]===3)continue;
  const point=(id:number)=>({x:match.positions[(f*22+id)*2],y:match.positions[(f*22+id)*2+1]});
  const depth=(band:number)=>lineIds(band).reduce((a,id)=>a+localX(point(id).x),0)/lineIds(band).length;
  const back=depth(1),owner=match.owners[f],ownerTeam=owner>=0?match.players[owner].team:null;
  const ys=outfield.map(id=>point(id).y);sum.width+=Math.max(...ys)-Math.min(...ys);sum.backDepth+=back;sum.midfieldGap+=depth(2)-back;
  if(ownerTeam===team){sum.withBallDepth+=back;counts.withBall++;const p=point(owner);sum.support+=outfield.filter(id=>id!==owner&&Math.hypot(point(id).x-p.x,point(id).y-p.y)>=4&&Math.hypot(point(id).x-p.x,point(id).y-p.y)<=26).length;counts.carriers++;}
  else if(ownerTeam!==null){sum.withoutBallDepth+=back;counts.withoutBall++;}
  samples.push(second);
 }
 const events=eventsUntil(match,atSecond).filter(e=>e.time>=fromSecond&&e.team===team);
 const wins=events.filter(e=>['tackle','interception','recovery'].includes(e.type)),shots=events.filter(e=>e.type==='shot');
 const passes=events.filter(e=>e.type==='pass'),receipts=events.filter(e=>e.type==='receive');
 const examples=[...shots.slice(-1),...wins.slice(-1),...receipts.slice(-1)].sort((a,b)=>a.time-b.time);
 return {schemaVersion:'tacticlens.formation-facts.v1',matchId:match.matchId,seed:match.seed,engineVersion:match.engineVersion,team,atSecond,
  formation:shape.name,anchors:ids.map(id=>({id,role:match.players[id].role,nominalX:shape.x[id%11],nominalY:shape.y[id%11],line:shape.lines[id%11]})),
  window:{fromSecond,toSecond:atSecond,sampleSeconds:5,activeSamples:samples.length,sampledSeconds:samples},
  observed:samples.length?{widthM:round(sum.width/samples.length),backDepthM:round(sum.backDepth/samples.length),midfieldGapM:round(sum.midfieldGap/samples.length),
   withBallBackDepthM:counts.withBall?round(sum.withBallDepth/counts.withBall):null,withoutBallBackDepthM:counts.withoutBall?round(sum.withoutBallDepth/counts.withoutBall):null,
   nearbyOptions:counts.carriers?round(sum.support/counts.carriers):null,withBallSamples:counts.withBall,withoutBallSamples:counts.withoutBall}:null,
  actions:{passes:passes.length,completed:receipts.length,ballWins:wins.length,shots:shots.length,xg:round(shots.reduce((a,e)=>a+(e.shotXg??0),0))},
  evidenceIds:events.filter(e=>['pass','receive','tackle','interception','recovery','shot'].includes(e.type)).map(e=>e.id),exampleIds:examples.map(e=>e.id)};
}
export type FormationFacts=ReturnType<typeof formationFacts>;
export function formationBriefing(match:Timeline,team:Side,time:number,card:AICard|null){
 const facts=formationFacts(match,team,time),shape=FORMATIONS.find(f=>f.name===facts.formation) as Formation;
 const [headline,template]=profiles[shape.name],o=facts.observed,a=facts.actions;
 const lines=shape.lines.filter(n=>n>0).reduce((r,n)=>({...r,[n]:(r[n]??0)+1}),{} as Record<number,number>);
 const dimensions=`${lines[1]} defensive, ${lines[2]} midfield and ${lines[3]} forward anchors, excluding the goalkeeper.`;
 const observation=o?`From ${clock(facts.window.fromSecond)} to ${clock(time)}, ${facts.window.activeSamples} live-play position samples place ${club(team)}'s defensive unit an average ${o.backDepthM.toFixed(1)} metres from their own goal line, with a ${o.midfieldGapM.toFixed(1)}-metre depth gap to the midfield and ${o.widthM.toFixed(1)} metres of outfield width. The window contains ${a.completed} completed passes, ${a.ballWins} logged ball wins and ${a.shots} shots.`:'Observed positioning will appear after live-play samples are available; the diagram currently shows the actual kickoff positions.';
 const transition=o?.withBallBackDepthM!==null&&o?.withoutBallBackDepthM!==null&&o?`The back line averages ${o.withBallBackDepthM!.toFixed(1)} metres from its own goal with a teammate in possession and ${o.withoutBallBackDepthM!.toFixed(1)} metres with an opponent in possession. ${o.nearbyOptions!==null?`A carrier has an average ${o.nearbyOptions.toFixed(1)} other outfield teammates within the engine's 4–26 metre candidate-pass range in these samples.`:''} These are sampled positions and distances, not proof of pressing intent, open passing lanes or a tactical cause.`:'The engine responds to the possession state through line targets, support lanes and nearest-player pressure; this template alone cannot show whether those responses succeeded.';
 // Genuine cached team evidence is kept separate from newly calculated geometry.
 let context:null|{method:string;matchId:string;momentId:string;atSecond:number;lines:{text:string;claimIds:string[];evidenceIds:string[]}[]}=null;
 if(card&&card.moment.matchId===match.matchId&&card.moment.seed===match.seed&&card.moment.atSecond<=time&&time-card.moment.atSecond<=120&&card.selectedClaimIds.includes('team'+team)){
  const m=card.moment,c=m.checks,lines:{text:string;claimIds:string[];evidenceIds:string[]}[]=[];
  const add=(text:string,claimIds:string[])=>{if(claimIds.every(id=>card.selectedClaimIds.includes(id)))lines.push({text,claimIds,evidenceIds:[...new Set(claimIds.flatMap(id=>m.claims.find(c=>c.id===id)?.evidenceIds??[]))]});};
  add(`At ${clock(m.atSecond)}, ${club(team)} have ${c.shots[team]} attempts, ${c.xg[team].toFixed(2)} synthetic xG and ${c.score[team]} goals.`,['team'+team]);
  const change=c.recentShots[team]-c.previousShots[team];
  add(`Their latest ten minutes contain ${c.recentShots[team]} attempts, against ${c.previousShots[team]} in the preceding ten: ${change>0?'an increase':change<0?'a decrease':'no change'} in shot activity. Read that output alongside the ${shape.name} spacing above; shot counts alone cannot establish a press, a low block or which lane created a chance.`,['activity']);
  if(m.team===team)add(`The latest scoring sequence contains ${c.completedBuildup} completed passes in its final fifteen-second possession window. It provides a replayable example of the route to goal, without establishing that the nominal formation caused the finish.`,['sequence']);
  context={method:'foundry-plan/authored-formation-grammar',matchId:match.matchId,momentId:m.id,atSecond:m.atSecond,lines};
 }

 return {facts,headline,paragraphs:[template+' '+dimensions,observation,transition],context};
}

export function auditFormationFacts(match:Timeline,team:Side,asOfSecond:number,value:unknown){
 try{const f=value as FormationFacts;if(f.atSecond>asOfSecond||f.team!==team||f.matchId!==match.matchId)return false;return JSON.stringify(f)===JSON.stringify(formationFacts(match,team,f.atSecond));}catch{return false;}
}
