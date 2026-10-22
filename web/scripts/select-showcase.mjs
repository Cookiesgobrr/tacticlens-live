import { generateMatch } from "../src/footballEngine.ts";

const seeds=[1025,46,82,7,50,1076,1088,1022,1016,92,97,1061,10,17,28,8,9,31,33,98];
const format=(v)=>String(Math.floor(v/60)).padStart(2,"0")+":"+String(Math.floor(v%60)).padStart(2,"0");
let candidates=[];
for(const seed of seeds){
  const match=generateMatch(seed);
  const goals=match.events.filter(e=>e.type==="goal");
  const shots=match.events.filter(e=>e.type==="shot");
  const teamScores=[goals.filter(e=>e.team===0).length,goals.filter(e=>e.team===1).length];
  const good=teamScores[0]>=1&&teamScores[1]>=1&&teamScores[0]!==teamScores[1]&&teamScores[0]<=3&&teamScores[1]<=3;
  const log=goals.map(e=>({
    time:format(e.time),team:e.team===0?"Northport":"Southbridge",
    player:match.players[e.player]?.name,source:e.sourceId??e.sourceEventId??null,id:e.id
  }));
  const latest=goals.length?goals[goals.length-1].time:0;
  const rating=(good?100:0)+(Math.min(teamScores[0],teamScores[1])*5)+(latest>4000?10:0)+(latest>4800?10:0);
  const entry={seed,score:teamScores.join("-"),goals:goals.length,shots:shots.length,
    xg:Number(shots.reduce((sum,e)=>sum+(e.shotXg||0),0).toFixed(2)),
    lastGoal:format(latest),rating,log};
  console.log("SHOWCASE "+JSON.stringify(entry));
  if(good)candidates.push(entry);
}
candidates.sort((a,b)=>b.rating-a.rating||Math.abs(a.shots-23)-Math.abs(b.shots-23));
console.log("RECOMMENDED "+JSON.stringify(candidates.slice(0,6)));
