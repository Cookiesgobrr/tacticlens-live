import type {EventLog,Timeline} from './footballEngine';
export type HighlightFilter='All'|'Goals'|'Chances'|'Defensive actions';
export type Highlight={event:EventLog;label:string;kind:'goal'|'chance'|'defence'|'sequence';evidenceIds:string[]};
/** A prefix-only selection. Derived passing sequences retain every source ID. */
export function matchHighlights(match:Timeline,time:number,filter:HighlightFilter,review=false){
  const result:Highlight[]=[],run:EventLog[]=[];
  let score=[0,0],passingTeam=-1;
  for(const e of match.events){
    if(!review&&e.time>time)break;
    let h:Highlight|undefined;
    if(e.type==='goal'){score[e.team]++;h={event:e,label:`Goal · ${score[0]}–${score[1]}`,kind:'goal',evidenceIds:[e.sourceId!,e.id]};}
    else if(e.type==='shot')h={event:e,label:(e.shotXg??0)>=.2?'Big chance':'Shot',kind:'chance',evidenceIds:[e.id]};
    else if(e.type==='miss')h={event:e,label:'Shot wide',kind:'chance',evidenceIds:[e.sourceId!,e.id]};
    else if(['save','tackle','interception','recovery'].includes(e.type))h={event:e,label:e.type==='save'?'Save':e.type==='tackle'?'Tackle':e.type==='interception'?'Interception':'Recovery',kind:'defence',evidenceIds:[e.sourceId,e.id].filter((id):id is string=>!!id)};
    if(e.type==='receive'){
      if(passingTeam!==e.team)run.length=0;
      passingTeam=e.team;run.push(e);
      if(run.length===5){h={event:e,label:'5-pass sequence',kind:'sequence',evidenceIds:run.flatMap(p=>[p.sourceId!,p.id])};run.length=0;}
    }else if(['tackle','interception','goal','miss','save','loose','recovery','kickoff'].includes(e.type)){run.length=0;passingTeam=-1;}
    if(h&&(filter==='All'||filter==='Goals'&&h.kind==='goal'||filter==='Chances'&&h.kind==='chance'||filter==='Defensive actions'&&h.kind==='defence'))result.push(h);
  }
  return result;
}
