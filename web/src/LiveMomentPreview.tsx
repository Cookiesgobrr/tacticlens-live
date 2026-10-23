import {useEffect,useState} from 'react';
import type {Timeline} from './footballEngine';
import {LIVE_CACHE_FILE,liveEligible,liveStatusText,validateLivePublication,type LivePublication} from './liveMomentCache';
// One read per page session, shared across seeks and toggle changes. No polling
// timer, no POST, no configurable origin and no Function key in the browser.
let cacheRead:Promise<unknown>|null=null;
export function useLiveMomentPreview(match:Timeline,time:number,enabled:boolean){
 const eligible=liveEligible(match,time);
 const [feed,setFeed]=useState<{matchId:string;state:string;publication:LivePublication|null}>({matchId:'',state:'off',publication:null});
 useEffect(()=>{
  if(!enabled||!eligible)return;
  let active=true;setFeed({matchId:match.matchId,state:'checking',publication:null});
  if(!cacheRead)cacheRead=(async()=>{
   const signal=AbortSignal.timeout(5000);
   const r=await fetch(`${import.meta.env.BASE_URL}${LIVE_CACHE_FILE}`,{method:'GET',credentials:'omit',signal});
   if(!r.ok)throw Error('Live-test cache unavailable');
   const body=await r.text();if(body.length>250000)throw Error('Cache exceeds size limit');return JSON.parse(body);
  })();
  cacheRead.then(value=>{const publication=validateLivePublication(value,match);if(active)setFeed({matchId:match.matchId,state:publication?'verified':'unavailable',publication})})
   .catch(()=>{if(active)setFeed({matchId:match.matchId,state:'unavailable',publication:null})});
  return()=>{active=false};
 },[enabled,eligible,match]);
 const state=!enabled?'off':!eligible?'waiting':feed.matchId===match.matchId?feed.state:'checking';
 const publication=enabled&&eligible&&feed.matchId===match.matchId?feed.publication:null;
 return {state,publication,pack:publication?.pack??null};
}
export default function LiveMomentPreview({enabled,onChange,state}:{enabled:boolean;onChange:(v:boolean)=>void;state:string}){
 return <details className="live-cache-preview"><summary>Live AI test · read-only preview</summary>
  <label><input type="checkbox" checked={enabled} onChange={e=>onChange(e.target.checked)} aria-label="Use verified live-test cache"/> Use verified live-test cache</label>
  <p role="status" aria-live="polite" data-testid="live-cache-status">{liveStatusText(state)}</p>
  <small>One protected Microsoft Foundry test. Generation is disabled; replay only reads a published result. The verified showcase remains the fallback.</small>
 </details>;
}
