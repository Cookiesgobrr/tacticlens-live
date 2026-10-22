/** Presentation only: consumes the exact CurrentFrame already used by SVG. */
import {useEffect, useRef} from 'react';
import * as THREE from 'three';
import type {CurrentFrame, EventLog, Timeline} from './footballEngine';
import {cameraPose,cameraZoom,type CameraMode} from './broadcastCamera';
export type {CameraMode} from './broadcastCamera';
type Props={match:Timeline; frame:CurrentFrame; time:number; selected:number; event:EventLog|undefined;
  camera:CameraMode; zoom:number; reset:number; onZoom:(zoom:number)=>void; quality:'low'|'medium'; flipped:boolean; onSelect:(id:number)=>void; onUnavailable:()=>void};
const world=(x:number,y:number,z=0)=>new THREE.Vector3(x-52.5,z,y-34);
function line(scene:THREE.Scene,points:number[][],color=0xd8f1df){
  const geometry=new THREE.BufferGeometry().setFromPoints(points.map(([x,y,z])=>world(x,y,z??.04)));
  scene.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.8})));
}
export default function MatchPitch3D(props:Props){
  const mount=useRef<HTMLDivElement>(null),latest=useRef(props);
  latest.current=props;
  useEffect(()=>{
    const node=mount.current;if(!node)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:props.quality==='medium',powerPreference:'low-power'});}catch{props.onUnavailable();return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,props.quality==='low'?1:1.5));
    renderer.setClearColor(0x16121d);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label','3D replay of the same 11v11 simulation frames');
    renderer.domElement.setAttribute('role','img');renderer.domElement.dataset.matchId=props.match.matchId;
    node.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xf0f8ff,0x183426,2.8));
    const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(-15,50,20);scene.add(sun);
    const camera=new THREE.PerspectiveCamera(43,1,.1,400);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(124,86),new THREE.MeshStandardMaterial({color:0x123529,roughness:1}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-.04;scene.add(ground);
    for(let i=0;i<10;i++){
      const stripe=new THREE.Mesh(new THREE.PlaneGeometry(10.5,68),new THREE.MeshBasicMaterial({color:i%2?0x15533b:0x1b6043}));
      stripe.rotation.x=-Math.PI/2;stripe.position.x=-47.25+i*10.5;scene.add(stripe);
    }
    line(scene,[[0,0],[105,0],[105,68],[0,68],[0,0]]);line(scene,[[52.5,0],[52.5,68]]);
    line(scene,Array.from({length:73},(_,i)=>[52.5+9.15*Math.cos(i/72*2*Math.PI),34+9.15*Math.sin(i/72*2*Math.PI)]));
    for(const right of [false,true]){
      const gx=right?105:0,edge=right?88.5:16.5,small=right?99.5:5.5;
      line(scene,[[gx,13.84],[edge,13.84],[edge,54.16],[gx,54.16]]);
      line(scene,[[gx,24.84],[small,24.84],[small,43.16],[gx,43.16]]);
      line(scene,[[gx,30.34,0],[gx,30.34,2.44],[gx,37.66,2.44],[gx,37.66,0]]);
      const back=gx+(right?2:-2);
      line(scene,[[gx,30.34,2.44],[back,30.34,2.44],[back,37.66,2.44],[gx,37.66,2.44]]);
      for(let i=0;i<=8;i++){const y=30.34+i*7.32/8;line(scene,[[back,y,0],[back,y,2.44]],0x688f7c);}
      for(let i=0;i<=3;i++)line(scene,[[back,30.34,i*.8],[back,37.66,i*.8]],0x688f7c);
    }
    // Modest perimeter seating establishes pitch orientation without heavy assets.
    for(const z of [-42,42]){
      const stand=new THREE.Mesh(new THREE.BoxGeometry(116,4,4),new THREE.MeshStandardMaterial({color:0x203d47}));stand.position.set(0,1,z);scene.add(stand);
      for(let i=0;i<24;i++){
        const seat=new THREE.Mesh(new THREE.BoxGeometry(3,1,.8),new THREE.MeshBasicMaterial({color:i%2?0x426675:0x294c5a}));seat.position.set(-54+i*4.7,3,z);scene.add(seat);
      }
    }
    const actors=props.match.players.map(p=>{
      const root=new THREE.Group();root.userData.player=p.id;
      const color=p.role==='GK'?(p.team===0?0xffc67b:0xff8c9f):p.team===0?0xc6fa65:0x77aaff;
      const shirt=new THREE.MeshStandardMaterial({color,roughness:.85});
      const skin=new THREE.MeshStandardMaterial({color:[0xc18c65,0x865438,0xe0b393][p.id%3],roughness:1});
      const boots=new THREE.MeshStandardMaterial({color:0x15121a});
      const dark=new THREE.MeshStandardMaterial({color:p.team===0?0x1b3325:0x18385a});
      const body=new THREE.Mesh(new THREE.CylinderGeometry(.28,.23,.7,8),shirt);body.position.y=1.18;root.add(body);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.20,8,6),skin);head.position.y=1.75;root.add(head);
      const limbs:THREE.Group[]=[];
      for(const side of [-1,1]){
        const leg=new THREE.Group();leg.position.set(side*.15,.85,0);
        const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.09,.07,.72,6),dark);mesh.position.y=-.36;leg.add(mesh);const boot=new THREE.Mesh(new THREE.BoxGeometry(.18,.13,.4),boots);boot.position.set(0,-.69,.12);leg.add(boot);root.add(leg);limbs.push(leg);
        const arm=new THREE.Group();arm.position.set(side*.34,1.43,0);
        const hand=new THREE.Mesh(new THREE.CylinderGeometry(.07,.06,.57,6),skin);hand.position.y=-.28;arm.add(hand);root.add(arm);limbs.push(arm);
      }
      root.scale.setScalar(1.25);scene.add(root);
      const halo=new THREE.Mesh(new THREE.RingGeometry(.7,1.05,24),new THREE.MeshBasicMaterial({color:0xffe69b,side:THREE.DoubleSide}));
      halo.rotation.x=-Math.PI/2;halo.position.y=.07;scene.add(halo);
      const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
      const context=canvas.getContext('2d')!;context.fillStyle='#eef8ed';context.font='bold 44px sans-serif';context.textAlign='center';context.fillText(String(p.number),32,48);
      const texture=new THREE.CanvasTexture(canvas);
      const number=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));number.scale.set(2.1,2.1,1);scene.add(number);
      return {root,limbs,halo,number};
    });
    const ball=new THREE.Mesh(new THREE.SphereGeometry(.30,12,8),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.55}));scene.add(ball);
    const ballHalo=new THREE.Mesh(new THREE.RingGeometry(.42,.6,20),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,transparent:true,opacity:.6}));ballHalo.rotation.x=-Math.PI/2;scene.add(ballHalo);
    const trail=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xffedac,transparent:true,opacity:.65}));scene.add(trail);
    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
    let suppressClickUntil=0;
    const onClick=(e:MouseEvent)=>{
      if(performance.now()<suppressClickUntil)return;
      const bounds=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1);
      ray.setFromCamera(pointer,camera);
      const hit=ray.intersectObjects(actors.map(a=>a.root),true)[0];
      if(hit){let object:THREE.Object3D|null=hit.object;while(object&&object.userData.player===undefined)object=object.parent;if(object)latest.current.onSelect(object.userData.player);}
    };
    const canvas=renderer.domElement;
    const onWheel=(e:WheelEvent)=>{e.preventDefault();latest.current.onZoom(cameraZoom(latest.current.zoom*Math.exp(-e.deltaY*.002)));};
    let pinchDistance=0,pinchZoom=1;
    const touchDistance=(e:TouchEvent)=>Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    const onTouchStart=(e:TouchEvent)=>{if(e.touches.length===2){e.preventDefault();pinchDistance=touchDistance(e);pinchZoom=latest.current.zoom;suppressClickUntil=performance.now()+800;}};
    const onTouchMove=(e:TouchEvent)=>{if(e.touches.length===2&&pinchDistance>0){e.preventDefault();latest.current.onZoom(cameraZoom(pinchZoom*touchDistance(e)/pinchDistance));}};
    const onTouchEnd=()=>{pinchDistance=0;};
    canvas.addEventListener('wheel',onWheel,{passive:false});canvas.addEventListener('touchstart',onTouchStart,{passive:false});canvas.addEventListener('touchmove',onTouchMove,{passive:false});canvas.addEventListener('touchend',onTouchEnd);canvas.addEventListener('touchcancel',onTouchEnd);
    renderer.domElement.addEventListener('click',onClick);
    const onLost=(event:Event)=>{event.preventDefault();latest.current.onUnavailable();};renderer.domElement.addEventListener('webglcontextlost',onLost);
    const resize=new ResizeObserver(()=>{const w=node.clientWidth,h=node.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();});resize.observe(node);
    const aim=new THREE.Vector3(),look=new THREE.Vector3(),cameraTarget=new THREE.Vector3();let raf=0,lastWall=performance.now(),lastTime=-1,lastMode='',lastFlip=props.flipped,lastReset=props.reset,lastActionId='';
    const actions=props.match.events,direction=new THREE.Vector3();
    const render=(wall:number)=>{
      const state=latest.current,{frame,time,selected}=state;
      const dt=Math.min(.06,Math.max(0,(wall-lastWall)/1000));

      let lo=0,hi=actions.length;while(lo<hi){const m=(lo+hi)>>1;if(actions[m].time<=time)lo=m+1;else hi=m;}
      const action=actions[lo-1],next=actions[lo];
      // A stoppage restart is an intentional broadcast cut: the source positions
      // reset there, so damping from the old goal would briefly lose the ball.
      const restartCut=action?.id!==lastActionId&&(action?.type==='kickoff'||action?.type==='restart');
      const snap=restartCut||Math.abs(time-lastTime)>2||time<lastTime||state.camera!==lastMode||state.flipped!==lastFlip||state.reset!==lastReset||lastTime<0;
      for(let i=0;i<22;i++){
        const actor=actors[i],p=frame.people[i];const old=actor.root.position.clone();
        actor.root.position.copy(world(p.x,p.y));
        const dx=actor.root.position.x-old.x,dz=actor.root.position.z-old.z;
        let heading=actor.root.rotation.y;
        if(Math.hypot(dx,dz)>.002&&!snap)heading=Math.atan2(dx,dz);
        else if(frame.speed[i]<.3||snap)heading=Math.atan2(frame.ball.x-p.x,frame.ball.y-p.y);
        if(i===frame.owner||action?.target===i&&frame.phase===1)heading=Math.atan2(frame.ball.x-p.x,frame.ball.y-p.y);
        const turn=Math.atan2(Math.sin(heading-actor.root.rotation.y),Math.cos(heading-actor.root.rotation.y));
        actor.root.rotation.y+=turn*(snap?1:1-Math.exp(-dt*12));
        // Pure replay-time animation: pause/seek affects limbs deterministically.
        const gait=Math.sin(frame.distance[i]*2.4)*Math.min(.65,frame.speed[i]*.16);
        actor.limbs[0].rotation.x=gait;actor.limbs[2].rotation.x=-gait;
        actor.limbs[1].rotation.x=-gait*.7;actor.limbs[3].rotation.x=gait*.7;
        const kick=action&&(action.type==='shot'||action.type==='pass')&&action.player===i?time-action.time:10;
        const prepare=next&&(next.type==='shot'||next.type==='pass')&&next.player===i&&frame.owner===i?next.time-time:10;
        if(prepare<.2)actor.limbs[0].rotation.x=.55*(1-prepare/.2);
        if(kick>=0&&kick<.55)actor.limbs[0].rotation.x=-Math.sin(kick/.55*Math.PI)*(action?.type==='shot'?1.2:.8);
        const touch=action&&['receive','interception','tackle','recovery'].includes(action.type)&&action.player===i?time-action.time:10;
        if(touch<.4)actor.limbs[2].rotation.x=-Math.sin(touch/.4*Math.PI)*.5;
        const saving=frame.phase===2&&props.match.players[i].role==='GK'&&action?.team!==props.match.players[i].team;
        if(saving){actor.limbs[1].rotation.x=-.9;actor.limbs[3].rotation.x=-.9;}
        const goal=action?.type==='goal'&&action.player===i?time-action.time:10;
        actor.limbs[1].rotation.z=goal<3?-1:0;actor.limbs[3].rotation.z=goal<3?1:0;
        const save=action?.type==='save'&&action.player===i?time-action.time:10;
        actor.root.rotation.z=save>=0&&save<.8?Math.sin(save/.8*Math.PI)*.3:0;
        actor.halo.position.copy(world(p.x,p.y,.07));actor.halo.visible=i===selected||i===frame.owner;
        actor.number.position.copy(world(p.x,p.y,3.15));
        actor.number.visible=state.camera==='tactical'||i===selected||i===frame.owner;
      }
      ball.position.copy(world(frame.ball.x,frame.ball.y,frame.ball.z));ball.rotation.z=time*2;
      ballHalo.position.copy(world(frame.ball.x,frame.ball.y,.08));
      if(action&&(action.type==='pass'||action.type==='shot')&&time-action.time<2.5){
        trail.geometry.dispose();trail.geometry=new THREE.BufferGeometry().setFromPoints([world(action.x,action.y,.08),world(frame.ball.x,frame.ball.y,.08)]);trail.visible=true;
      }else trail.visible=false;
      const pose=cameraPose(frame,time,action,state.camera,selected,state.zoom,state.flipped,camera.aspect);
      cameraTarget.set(...pose.position as [number,number,number]);aim.set(...pose.aim as [number,number,number]);
      camera.position.lerp(cameraTarget,snap?1:1-Math.exp(-dt*6));look.lerp(aim,snap?1:1-Math.exp(-dt*10));camera.lookAt(look);
      camera.fov=pose.fov;camera.updateProjectionMatrix();direction.copy(ball.position).project(camera);
      canvas.dataset.camera=JSON.stringify({position:camera.position.toArray(),aim:look.toArray(),zoom:state.zoom,mode:state.camera,ballNdc:direction.toArray()});
      renderer.render(scene,camera);
      // Read back actual mesh coordinates for parity diagnostics in browser CI.
      renderer.domElement.dataset.renderedFrame=JSON.stringify({people:actors.map(a=>({x:a.root.position.x+52.5,y:a.root.position.z+34})),ball:{x:ball.position.x+52.5,y:ball.position.z+34,z:ball.position.y},time});
      lastWall=wall;lastTime=time;lastMode=state.camera;lastFlip=state.flipped;lastReset=state.reset;lastActionId=action?.id??'';raf=requestAnimationFrame(render);
    };
    raf=requestAnimationFrame(render);
    return()=>{
      cancelAnimationFrame(raf);resize.disconnect();canvas.removeEventListener('wheel',onWheel);canvas.removeEventListener('touchstart',onTouchStart);canvas.removeEventListener('touchmove',onTouchMove);canvas.removeEventListener('touchend',onTouchEnd);canvas.removeEventListener('touchcancel',onTouchEnd);renderer.domElement.removeEventListener('click',onClick);renderer.domElement.removeEventListener('webglcontextlost',onLost);
      scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Sprite){object.geometry?.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){if('map' in material&&material.map instanceof THREE.Texture)material.map.dispose();material.dispose();}}});
      renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    };
  },[props.match,props.quality]);
  return <div className="new-pitch3d" ref={mount}/>;
}
