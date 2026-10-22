import type {EventLog, Side, Timeline} from './footballEngine';
export type Lens='fan'|'analyst'|'club'|'player';
export function pulse(events:EventLog[]){
  const score=[0,0],shots=[0,0],xg=[0,0],passes=[0,0],completed=[0,0];
  for(const e of events){
    if(e.type==='goal')score[e.team]++;
    if(e.type==='shot'){shots[e.team]++;xg[e.team]+=e.shotXg??0;}
    if(e.type==='pass')passes[e.team]++;
    if(e.type==='receive')completed[e.team]++;
  }
  return {score,shots,xg,passes,completed};
}
export function shotExplanation(e:EventLog){
  return `${e.shotDistance?.toFixed(1)} m from goal, ${e.shotAngle?.toFixed(0)}° off center, nearest defender ${e.shotPressure?.toFixed(1)} m away.`;
}
export function matchStory(match:Timeline,events:EventLog[],lens:Lens,team:Side|2,player:number){
  const relevant=events.filter(e=>(lens!=='club'||team===2||e.team===team)&&(lens!=='player'||e.player===player||e.target===player));
  const shots=relevant.filter(e=>e.type==='shot');
  const lastShot=shots.at(-1);
  if(lastShot){
    const outcome=events.find(e=>e.sourceId===lastShot.id);
    const name=match.players[lastShot.player].name;
    const probability=((lastShot.shotXg??0)*100).toFixed(1);
    return {headline:outcome?.type==='goal'?`${name} finds the net`:outcome?.type==='save'?'The keeper keeps it out':outcome?.type==='miss'?'A chance goes wide':`${name} takes aim`,
      text:lens==='analyst'?`${probability}% pre-shot probability. ${shotExplanation(lastShot)} This estimate was logged before the outcome.`:
        lens==='player'?`${name}'s latest attempt had a ${probability}% scoring chance. Inspect the shot to see its position and pressure.`:
        lens==='club'?`${lastShot.team===0?'Northport':'Southbridge'} created this chance through the simulated play. Chance quality: ${probability}%.`:
        `A ${probability}% chance for ${name}. The replay shows the shot and its outcome from the same match clock.`,
      evidence:[...events.filter(e=>e.time>=lastShot.time-12&&e.time<lastShot.time&&(e.type==='pass'||e.type==='receive')&&e.team===lastShot.team).slice(-2),lastShot,...(outcome?[outcome]:[])]};
  }
  const action=relevant.filter(e=>e.type==='receive'||e.type==='tackle'||e.type==='interception').at(-1);
  return {headline:action?'The match is taking shape':'Ready for kickoff',
    text:action?`${match.players[action.player].name} ${action.type==='receive'?'connects the passing move':'wins possession'}. Select the source action to inspect the replay.`:'Press play to follow a fictional 11v11 match. Every statistic and explanation comes from its own event log.',
    evidence:action?[...events.filter(e=>e.id===action.sourceId),action]:[]};
}
// Greedy labels in screen coordinates. Prioritize selected actor; hide a label
// when no clear placement exists instead of covering another label/player.
export function placeLabels(people:{x:number;y:number}[],ids:number[]){
  const boxes:{id:number;x:number;y:number;width:number;height:number}[]=[];
  const w=122,h=48;
  for(const id of ids){
    const p=people[id];
    for(const [dx,dy] of [[18,-65],[-140,-65],[18,22],[-140,22],[-61,-90],[-61,42]]){
      const x=Math.max(25,Math.min(975-w,p.x+dx)),y=Math.max(55,Math.min(610-h,p.y+dy));
      const overlaps=boxes.some(b=>x<b.x+w+5&&x+w+5>b.x&&y<b.y+h+5&&y+h+5>b.y);
      const coversPlayer=people.some(q=>q.x>x-13&&q.x<x+w+13&&q.y>y-13&&q.y<y+h+13);
      if(!overlaps&&!coversPlayer){boxes.push({id,x,y,width:w,height:h});break;}
    }
  }
  return boxes;
}
