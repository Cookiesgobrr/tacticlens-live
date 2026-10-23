/** A finite static gateway. This module has no Azure/model/generation endpoint. */
import {validateAIPack,type AIPack} from './momentIntelligence.ts';
import type {Timeline} from './footballEngine.ts';
export const LIVE_SECOND=4680.25;
export const LIVE_SOURCE_SHA256='d67670f7cb63452b24e05dcb88550036386e0dee56592e186c6d45d0306cc52d';
export const LIVE_ENGINE_SHA256='961d4746c6996e30d1289583bc114387a002bb5ef0db23328b392056970f5e5d';
export const LIVE_CACHE_FILE='data/live-sim82-4680.25.json';
export type LivePublication={schemaVersion:'tacticlens.live-publication.v1';authorizationId:'issue40-seed82-winner';
 sourceSha256:string;engineSha256:string;generationStartedAt:string;generationFinishedAt:string;generationDisabledVerifiedAt:string;
 authorizationExhausted:true;limits:{modelCalls:3;outputTokensPerCall:1000;inputBytesPerCall:16000;automaticRetries:0};pack:AIPack};
export function validateLivePublication(value:unknown,match:Timeline):LivePublication|null{
 try{
  const p=value as LivePublication;
  if(match.seed!==82||match.matchId!=='SIM-82'||p.schemaVersion!=='tacticlens.live-publication.v1'||p.authorizationId!=='issue40-seed82-winner'||
   p.sourceSha256!==LIVE_SOURCE_SHA256||p.engineSha256!==LIVE_ENGINE_SHA256||p.authorizationExhausted!==true)return null;
  const times=[p.generationStartedAt,p.generationFinishedAt,p.generationDisabledVerifiedAt].map(s=>Date.parse(s));
  if(!times.every(Number.isFinite)||times[0]>times[1]||times[1]>times[2])return null;
  if(p.limits.modelCalls!==3||p.limits.outputTokensPerCall!==1000||p.limits.inputBytesPerCall!==16000||p.limits.automaticRetries!==0)return null;
  const pack=validateAIPack(p.pack,match);
  if(!pack||pack.cards.length!==1||pack.cards[0].moment.atSecond!==LIVE_SECOND||pack.generatedAt!==p.generationFinishedAt)return null;
  if(pack.trace.map(t=>t.stage).join()!=='Insight,Verification,Presentation'||new Set(pack.trace.map(t=>t.responseId)).size!==3||pack.trace.some(t=>t.outputTokens>1000))return null;
  return p;
 }catch{return null;}
}
export function liveEligible(match:Timeline,time:number){return match.seed===82&&match.matchId==='SIM-82'&&time>=LIVE_SECOND&&time-LIVE_SECOND<=120;}
export function liveStatusText(state:string){return ({off:'Off · verified showcase preserved',waiting:'Waiting for a covered replay moment',checking:'Checking the read-only cache…',verified:'Verified · protected live-test result',unavailable:'Unavailable · verified showcase retained'} as Record<string,string>)[state]??'Unavailable · verified showcase retained';}
