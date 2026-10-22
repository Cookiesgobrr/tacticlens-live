/** Nominal lines are inputs to movement, support lanes and defensive transitions. */
export type FormationName='4-3-3'|'4-2-3-1'|'4-4-2'|'3-5-2'|'4-1-4-1';
export type Formation={name:FormationName;roles:string[];x:number[];y:number[];lines:number[]};
export const FORMATIONS:Formation[]=[
  {name:'4-3-3',roles:['GK','LB','LCB','RCB','RB','LCM','CM','RCM','LW','ST','RW'],x:[7,23,22,22,23,40,39,40,48,50,48],y:[34,9,25,43,59,15,34,53,12,34,56],lines:[0,1,1,1,1,2,2,2,3,3,3]},
  {name:'4-2-3-1',roles:['GK','LB','LCB','RCB','RB','LDM','RDM','AM','LW','ST','RW'],x:[7,23,22,22,23,34,34,43,47,50,47],y:[34,9,25,43,59,25,43,34,12,34,56],lines:[0,1,1,1,1,2,2,2,3,3,3]},
  {name:'4-4-2',roles:['GK','LB','LCB','RCB','RB','LM','LCM','RCM','RM','LST','RST'],x:[7,23,22,22,23,39,38,38,39,49,49],y:[34,9,25,43,59,10,26,42,58,26,42],lines:[0,1,1,1,1,2,2,2,2,3,3]},
  {name:'3-5-2',roles:['GK','LCB','CB','RCB','LWB','LCM','DM','RCM','RWB','LST','RST'],x:[7,22,21,22,35,39,34,39,35,49,49],y:[34,18,34,50,7,23,34,45,61,26,42],lines:[0,1,1,1,2,2,2,2,2,3,3]},
  {name:'4-1-4-1',roles:['GK','LB','LCB','RCB','RB','DM','LM','LCM','RCM','ST','RM'],x:[7,23,22,22,23,32,42,40,40,50,42],y:[34,9,25,43,59,34,9,25,43,34,59],lines:[0,1,1,1,1,2,2,2,2,3,2]},
];
export function formationsFor(seed:number,version:'classic-v1'|'formations-v2'):[Formation,Formation]{
  if(version==='classic-v1')return [FORMATIONS[0],FORMATIONS[0]];
  const n=seed>>>0;return [FORMATIONS[n%5],FORMATIONS[Math.floor(n/5)%5]];
}
