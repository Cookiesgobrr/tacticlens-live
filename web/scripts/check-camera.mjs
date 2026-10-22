import * as THREE from 'three';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {generateMatch,atTime,eventsUntil} from '../src/footballEngine.ts';
import {cameraPose,cameraZoom} from '../src/broadcastCamera.ts';
const m=generateMatch(82),digest=createHash('sha256');
for(const a of [m.positions,m.ball,m.owners,m.ballPhases,m.speeds,m.distances])digest.update(Buffer.from(a.buffer));
digest.update(JSON.stringify(m.events));
assert.equal(digest.digest('hex'),'c66c53cffd774f4a5598da9fb3262aaee24aa538ba3d726cf2e0e0d6451026c0','Seed 82 replay and evidence must remain exact');
for(const mode of ['broadcast','tactical','player'])for(const flipped of [false,true])for(const zoom of [.7,1,1.8]){
  for(let t=0;t<=5400;t+=7.25){
    const frame=atTime(m,t),e=eventsUntil(m,t).at(-1),pose=cameraPose(frame,t,e,mode,9,zoom,flipped,1.5);
    assert.ok([...pose.aim,...pose.position,pose.fov].every(Number.isFinite));assert.ok(pose.position[1]>=22);
    const cam=new THREE.PerspectiveCamera(pose.fov,1.5,.1,400);cam.position.set(...pose.position);cam.lookAt(new THREE.Vector3(...pose.aim));cam.updateMatrixWorld();
    const projected=new THREE.Vector3(frame.ball.x-52.5,frame.ball.z,frame.ball.y-34).project(cam);
    assert.ok(Math.abs(projected.x)<.95&&Math.abs(projected.y)<.95,`Ball in ${mode} frame at ${t}: ${projected.toArray()}`);
  }
}
assert.equal(cameraZoom(100),1.8);assert.equal(cameraZoom(-1),.7);
assert.ok(cameraPose(atTime(m,0),0,m.events[0],'broadcast',9,1,false,1.5).position[1]<50);
console.log('Camera modes, bounds, flip and all-match finite-state gates passed.');
