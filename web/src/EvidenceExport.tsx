import {useState} from 'react';
import type {Timeline} from './footballEngine';
import {auditEvidenceReport, broadcastVtt, buildEvidenceReport, type ExportView} from './matchEvidence';

export default function EvidenceExport({match,time,view}:{match:Timeline;time:number;view:ExportView}){
  const [status,setStatus]=useState('');
  function download(format:'json'|'vtt'){
    const report=buildEvidenceReport(match,time,view);
    if(auditEvidenceReport(match,report).length){setStatus('Evidence check failed. Export withheld.');return;}
    const text=format==='json'?JSON.stringify(report,null,2):broadcastVtt(report);
    const url=URL.createObjectURL(new Blob([text],{type:format==='json'?'application/json':'text/vtt'}));
    const link=document.createElement('a');link.href=url;
    link.download=`${match.matchId}-at-${time.toFixed(2)}.${format}`;
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setStatus(`${format==='json'?'Evidence JSON':'Broadcast captions'} exported at ${Math.floor(time/60)}:${String(Math.floor(time%60)).padStart(2,'0')}.`);
  }
  return <div className="new-export">
    <div><strong>Take the evidence with you</strong><p className="new-muted">Current replay time only · JSON event evidence or timed WebVTT broadcast captions.</p></div>
    <div className="new-export-actions"><button onClick={()=>download('json')}>Export evidence JSON</button><button onClick={()=>download('vtt')}>Export broadcast VTT</button></div>
    <small role="status" aria-live="polite">{status}</small>
  </div>;
}
