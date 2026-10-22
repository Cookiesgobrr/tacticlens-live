/** Portable, replay-time evidence. No model calls or archived match inputs. */
import {eventsUntil, type Timeline} from './footballEngine.ts';
import {matchStory, pulse, type Lens} from './matchAnalysis.ts';

export type ExportView={lens:Lens; team:0|1|2; player:number};
export type BroadcastCue={id:string; startSecond:number; endSecond:number; text:string; evidenceIds:string[]};
const lenses=['fan','analyst','club','player'];
const validView=(v:unknown):v is ExportView=>{
  if(!v||typeof v!=='object')return false;
  const view=v as ExportView;
  return lenses.includes(view.lens)&&[0,1,2].includes(view.team)&&Number.isInteger(view.player)&&view.player>=0&&view.player<22;
};
export function buildEvidenceReport(match:Timeline,asOfSecond:number,view:ExportView={lens:'fan',team:2,player:9}){
  if(!Number.isFinite(asOfSecond)||asOfSecond<0||asOfSecond>match.duration)throw new RangeError('Replay time is outside this match');
  if(!validView(view))throw new RangeError('Invalid audience or player');
  const events=eventsUntil(match,asOfSecond);
  const story=matchStory(match,events,view.lens,view.team,view.player);
  const actions=events.filter(e=>['shot','goal','save','miss'].includes(e.type));
  const cues:BroadcastCue[]=actions.flatMap((e,i)=>{
    // A result can replace a shot cue only after that result has occurred.
    // WebVTT has millisecond resolution. Floor the export boundary so a
    // sub-millisecond replay prefix cannot create a zero-length/future cue.
    const endSecond=Math.floor(Math.min(e.time+6,actions[i+1]?.time??asOfSecond,asOfSecond)*1000)/1000;
    if(endSecond<=e.time)return [];
    const club=e.team===0?'Northport':'Southbridge';
    const detail=e.type==='shot'?`${match.players[e.player].name} shoots · ${((e.shotXg??0)*100).toFixed(1)}% synthetic xG`:e.text;
    return [{id:`cue-${e.id}`,startSecond:e.time,endSecond,text:`${club} · ${detail}`,
      evidenceIds:e.sourceId?[e.sourceId,e.id]:[e.id]}];
  });
  return {
    schemaVersion:'tacticlens.evidence.v1',matchId:match.matchId,seed:match.seed,asOfSecond,
    provenance:{simulation:match.simulation,engineVersion:match.engineVersion,formations:match.formations,narrativeProvider:'rule-based',
      probabilityModel:'simplified-synthetic-xg',realWorldCalibrated:false,foundryEvidence:false},
    view:{...view},totals:pulse(events),
    recap:{headline:story.headline,text:story.text,evidenceIds:story.evidence.map(e=>e.id)},
    cues,events:events.map(e=>({...e})),
  };
}
export type EvidenceReport=ReturnType<typeof buildEvidenceReport>;

// Key-order-independent comparison also covers JSON serialize/parse round trips.
function stable(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}';
  return JSON.stringify(value)??'null';
}
/** Fail closed on fabricated totals/text, future events or another match's IDs.
 * This audits our deterministic export format; it is not a general LLM fact checker.
 */
export function auditEvidenceReport(match:Timeline,value:unknown):string[]{
  if(!value||typeof value!=='object')return ['Invalid report'];
  const report=value as EvidenceReport;
  if(report.matchId!==match.matchId||report.seed!==match.seed)return ['Wrong match identity'];
  if(!Number.isFinite(report.asOfSecond)||report.asOfSecond<0||report.asOfSecond>match.duration)return ['Invalid replay time'];
  if(!validView(report.view))return ['Invalid audience or player'];
  const expected=buildEvidenceReport(match,report.asOfSecond,report.view);
  const fields=['schemaVersion','provenance','totals','recap','cues','events'] as const;
  return fields.filter(key=>stable(report[key])!==stable(expected[key])).map(key=>`Evidence mismatch: ${key}`);
}
export function vttTimestamp(seconds:number):string {
  const ms=Math.round(seconds*1000);
  return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
}
export function broadcastVtt(report:EvidenceReport):string {
  const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\r\n]+/g,' ');
  return `WEBVTT\n\nNOTE ${report.matchId} | synthetic rule-based overlay | as of ${vttTimestamp(report.asOfSecond)}\n\n`+
    report.cues.map(c=>`${c.id}\n${vttTimestamp(c.startSecond)} --> ${vttTimestamp(c.endSecond)}\n${escape(c.text)}\n${c.evidenceIds.join(' · ')}\n`).join('\n');
}
