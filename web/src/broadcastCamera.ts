/** Camera composition only; never changes positions or creates events. */
import type {CurrentFrame,EventLog} from './footballEngine';
export type CameraMode='broadcast'|'tactical'|'player';
export const cameraZoom=(n:number)=>Math.max(.7,Math.min(1.8,n));
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function cameraPose(frame:CurrentFrame,time:number,action:EventLog|undefined,mode:CameraMode,selected:number,zoom:number,flipped:boolean,aspect:number){
  const flip=flipped?-1:1,b=frame.ball;
  if(mode==='tactical')return {aim:[0,0,0],position:[0,Math.max(108,112/cameraZoom(zoom)),flip*.1],fov:43};
  let x=b.x,y=b.y;
  // Intended pass destination is known at release; no future outcomes are read.
  if(frame.phase===1&&action?.type==='pass'&&action.targetX!==undefined){x+=(action.targetX-x)*.12;y+=((action.targetY??y)-y)*.12;}
  if(frame.owner>=0){const p=frame.people[frame.owner];x=x*.75+p.x*.25;y=y*.75+p.y*.25;}
  if(action?.type==='goal'&&time-action.time<4){const p=frame.people[action.player];x=x*.8+p.x*.2;y=y*.8+p.y*.2;}
  if(mode==='player'){const p=frame.people[selected];x=p.x*.65+b.x*.35;y=p.y*.65+b.y*.35;}
  const edge=13/cameraZoom(zoom);
  x=clamp(x,edge,105-edge);y=clamp(y,8,60);
  const span=mode==='player'?Math.hypot(frame.people[selected].x-b.x,frame.people[selected].y-b.y):0;
  const height=Math.max(35/cameraZoom(zoom),span*1.3,22),side=Math.max(32/cameraZoom(zoom),span*1.2,22);
  const fit=Math.max(1,1.45/Math.max(.6,aspect));
  return {aim:[x-52.5,.4,y-34],position:[x-52.5,height*fit,y-34+flip*side*fit],fov:43};
}
