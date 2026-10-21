import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export type ReplayCamera = "broadcast" | "tactical" | "player";
export type ReplayTeam = "north" | "south";
export interface ReplayEvent {
  id: string; second: number; team: ReplayTeam; player: string; kind: string;
  x: number; y: number; description: string; end_x?: number; end_y?: number;
  pass_completed?: boolean; pass_distance_m?: number;
}
export type MovementFeed = { sample_seconds: number; players: { id: string; name: string; team: ReplayTeam; max_speed_mps: number }[]; frames: number[][][]; summary: { player_id: string; distance_m: number; peak_speed_mps: number; running_seconds: number }[]; event_alignment: Record<string,{estimated_position_error_m:number}>; measurement_status: string };
export type BallPlayback = { sample_seconds: number; ball_frames: number[][]; measurement_status: string };
type Props = {
  playback?: BallPlayback;
  movement?: MovementFeed;
  events: ReplayEvent[]; clock: number; cameraMode: ReplayCamera;
  focusedPlayer: string; favoriteTeam: ReplayTeam | "all";
  viewerLens?: "fan" | "analyst" | "club" | "player";
  onSeek: (second: number) => void;
};
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const toPitch = (x: number, y: number): [number, number] => [x - 50, (y - 50) * 0.64];
const blend = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
function before(events: ReplayEvent[], t: number): number {
  let lo = 0, hi = events.length;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (events[m].second <= t) lo = m + 1;
    else hi = m;
  }
  return lo - 1;
}
const flight = (e: ReplayEvent) => ["pass", "shot", "goal"].includes(e.kind);
function trajectory(e: ReplayEvent, t: number): THREE.Vector3 {
  const [x, z] = toPitch(e.x, e.y);
  const [tx, tz] = e.kind === "pass" && e.end_x !== undefined && e.end_y !== undefined
    ? toPitch(e.end_x, e.end_y)
    : [e.team === "north" ? 49.5 : -49.5, clamp((e.y - 50) * 0.18, -3.5, 3.5)];
  const progress = clamp(t, 0, 1);
  return new THREE.Vector3(blend(x, tx, progress),
    0.4 + Math.sin(progress * Math.PI) * (e.kind === "pass" ? 0.65 : 4.3),
    blend(z, tz, progress));
}
function addLine(scene: THREE.Scene, coordinates: [number, number][], opacity = 0.57) {
  const points = coordinates.map(([x, z]) => new THREE.Vector3(x, 0.06, z));
  const mesh = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0xf1faf3, transparent: true, opacity })
  );
  scene.add(mesh);
}
function ring(radius: number): [number, number][] {
  return Array.from({ length: 73 }, (_, i) => {
    const t = i / 72 * Math.PI * 2;
    return [Math.cos(t) * radius, Math.sin(t) * radius];
  });
}
type Actor = {
  name: string; team: ReplayTeam; track: ReplayEvent[]; figure: THREE.Group;
  legs: THREE.Mesh[]; arms: THREE.Mesh[]; halo: THREE.Mesh; baseX: number; baseZ: number;
};
function createActor(scene: THREE.Scene, name: string, team: ReplayTeam,
  track: ReplayEvent[], index: number): Actor {
  const figure = new THREE.Group();
  const jersey = new THREE.MeshStandardMaterial({ color: team === "north" ? 0xc6fa65 : 0x77aaff });
  const dark = new THREE.MeshStandardMaterial({ color: team === "north" ? 0x243628 : 0x142d4a });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb58c69 });
  const sock = new THREE.MeshStandardMaterial({ color: 0xe5f3e8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.37, 1.12, 10), jersey);
  body.position.y = 1.85; figure.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8), skin);
  head.position.y = 2.74; figure.add(head);
  const legs: THREE.Mesh[] = [], arms: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const short = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.20, 0.46, 8), dark);
    short.position.set(side * 0.23, 1.33, 0); figure.add(short);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1, 7), sock);
    leg.position.set(side * 0.22, 0.64, 0); figure.add(leg); legs.push(leg);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.9, 7), skin);
    arm.position.set(side * 0.56, 1.85, 0); arm.rotation.z = side * 0.24;
    figure.add(arm); arms.push(arm);
  }
  scene.add(figure);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.72, 1.03, 28),
    new THREE.MeshBasicMaterial({ color: 0xf0ffa6, side: THREE.DoubleSide }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.11; scene.add(halo);
  return { name, team, track, figure, legs, arms, halo,
    baseX: team === "north" ? -33 + index * 12 : 33 - index * 12,
    baseZ: (index % 3 - 1) * 17 };
}
function actorLocation(actor: Actor, t: number): [number, number] {
  const ix = before(actor.track, t);
  const prev = actor.track[ix], next = actor.track[ix + 1];
  if (!prev && !next) return [actor.baseX, actor.baseZ];
  if (!prev && next) {
    const [nx, nz] = toPitch(next.x, next.y);
    const approach = clamp((t - next.second + 22) / 22, 0, 1);
    return [blend(actor.baseX, nx, approach), blend(actor.baseZ, nz, approach)];
  }
  const [px, pz] = toPitch(prev.x, prev.y);
  if (!next || next.second <= prev.second) return [px, pz];
  const [nx, nz] = toPitch(next.x, next.y);
  const progress = clamp((t - prev.second) / (next.second - prev.second), 0, 1);
  const ease = progress * progress * (3 - 2 * progress);
  return [blend(px, nx, ease), blend(pz, nz, ease)];
}
function timeLabel(second: number) {
  return String(Math.floor(second / 60)).padStart(2, "0") + ":" +
    String(second % 60).padStart(2, "0");
}
export default function Replay3D({ events, movement, playback, clock, cameraMode, focusedPlayer,
  favoriteTeam, viewerLens = "fan", onSeek }: Props) {
  const node = useRef<HTMLDivElement>(null);
  const nameTag = useRef<HTMLDivElement>(null);
  const current = useRef({ clock, cameraMode, focusedPlayer, favoriteTeam, viewerLens });
  current.current = { clock, cameraMode, focusedPlayer, favoriteTeam, viewerLens };
  const [unavailable, setUnavailable] = useState(false);
  const ticker = useMemo(() => {
    const past = events.filter(e => e.second <= clock);
    if (viewerLens === "player" && focusedPlayer) return past.filter(e => e.player === focusedPlayer).slice(-4).reverse();
    if (viewerLens === "club" && favoriteTeam !== "all") return past.filter(e => e.team === favoriteTeam).slice(-4).reverse();
    return past.slice(-4).reverse();
  }, [events, clock, viewerLens, focusedPlayer, favoriteTeam]);
  const selectedMovement = useMemo(() => {
    if (!focusedPlayer || !movement) return null;
    const index = movement.players.findIndex(p => p.name === focusedPlayer);
    const frame = movement.frames[Math.max(0, Math.min(movement.frames.length - 1,
      Math.floor(clock / movement.sample_seconds)))];
    const value = frame?.[index];
    if (!value) return null;
    return { speedKmh: (value[2] * 3.6).toFixed(1), team: movement.players[index].team };
  }, [clock, focusedPlayer, movement]);
  const recent = ticker[0];
  const eventBadge = recent && clock - recent.second < 6 && flight(recent)
    ? (recent.kind === "pass"
      ? (recent.pass_completed ? "PASS COMPLETED · " : "PASS ATTEMPT · ") +
        (recent.pass_distance_m?.toFixed(1) || "—") + "m"
      : recent.kind === "goal" ? "GOAL · SHOT FLIGHT" : "SHOT · BALL TRAJECTORY")
    : "";

  useEffect(() => {
    const mount = node.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "default" });
    } catch {
      setUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x091821);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", "Reconstructed 3D football pitch with moving simulated players and ball");
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x091821);
    scene.add(new THREE.HemisphereLight(0xecf8ff, 0x1b3429, 3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-25, 60, -30); scene.add(sun);
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 320);
    camera.position.set(0, 53, 80);
    const field = new THREE.Mesh(new THREE.PlaneGeometry(110, 75),
      new THREE.MeshStandardMaterial({ color: 0x174938, roughness: 0.9 }));
    field.rotation.x = -Math.PI / 2; scene.add(field);
    for (let k = 0; k < 10; k++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(10, 64),
        new THREE.MeshBasicMaterial({ color: k % 2 ? 0x1c6344 : 0x114634 }));
      stripe.rotation.x = -Math.PI / 2; stripe.position.set(-45 + k * 10, 0.015, 0);
      scene.add(stripe);
    }
    addLine(scene, [[-50,-32],[50,-32],[50,32],[-50,32],[-50,-32]]);
    addLine(scene, [[0,-32],[0,32]]);
    addLine(scene, ring(9));
    addLine(scene, [[-50,-20],[-33,-20],[-33,20],[-50,20]]);
    addLine(scene, [[50,-20],[33,-20],[33,20],[50,20]]);
    addLine(scene, [[-50,-9],[-44,-9],[-44,9],[-50,9]]);
    addLine(scene, [[50,-9],[44,-9],[44,9],[50,9]]);
    for (const x of [-50, 50]) {
      const goal = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.4, 7.3),
        new THREE.MeshStandardMaterial({ color: 0xe1f0ea }));
      goal.position.set(x, 1.25, 0); scene.add(goal);
    }
    const unique = movement?.players.map(p => p.team + "|" + p.name) ?? Array.from(new Set(events.map(e => e.team + "|" + e.player)));
    const actors: Actor[] = [];
    for (const key of unique) {
      const [team, name] = key.split("|") as [ReplayTeam, string];
      const index = actors.filter(p => p.team === team).length;
      actors.push(createActor(scene, name, team, events.filter(e => e.team === team && e.player === name), index));
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0xf8fcff, emissive: 0x27342a }));
    scene.add(ball);
    const trailMat = new THREE.LineBasicMaterial({ color: 0x93ddff, transparent: true, opacity: 0.95 });
    const trail = new THREE.Line(new THREE.BufferGeometry(), trailMat);
    const receiverMarker = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.45, 32), new THREE.MeshBasicMaterial({ color: 0x9eeaff, side: THREE.DoubleSide }));
    receiverMarker.rotation.x = -Math.PI / 2; receiverMarker.position.y = 0.12;
    scene.add(receiverMarker);
    scene.add(trail);
    // A separate 3D route shows the focused player's *simulated* recent run,
    // never a reconstruction falsely presented as observed match tracking.
    const routeMaterial = new THREE.LineBasicMaterial({ color: 0xf0ffa6, transparent: true, opacity: 0.85 });
    const focusRoute = new THREE.Line(new THREE.BufferGeometry(), routeMaterial);
    scene.add(focusRoute);
    let routeKey = "";
    const labelVec = new THREE.Vector3();
    let lastTrail = "", lastFraction = -1, raf = 0, destroyed = false;
    let lastFrame = performance.now();
    const wantedCamera = new THREE.Vector3(), target = new THREE.Vector3();
    const lookAt = new THREE.Vector3();
    const draw = (now: number) => {
      if (destroyed) return;
      const dt = clamp((now - lastFrame) / 1000, 0, 0.1);
      lastFrame = now;
      const props = current.current;
      const t = props.clock;
      for (const [actorIndex, actor] of actors.entries()) {
        const step = t / (movement?.sample_seconds ?? 1);
        const firstIndex = clamp(Math.floor(step), 0, (movement?.frames.length ?? 1)-1);
        const secondIndex = clamp(firstIndex + 1, 0, (movement?.frames.length ?? 1)-1);
        const sampleA = movement?.frames[firstIndex]?.[actorIndex];
        const sampleB = movement?.frames[secondIndex]?.[actorIndex];
        const fraction = step - Math.floor(step);
        const [x, z] = sampleA && sampleB
          ? [blend(sampleA[0], sampleB[0], fraction), blend(sampleA[1], sampleB[1], fraction)]
          : actorLocation(actor, t);
        const dx = x - actor.figure.position.x, dz = z - actor.figure.position.z;
        actor.figure.position.set(x, 0, z);
        if (Math.abs(dx) + Math.abs(dz) > 0.02) actor.figure.rotation.y = Math.atan2(dx, dz);
        const speed = sampleA ? sampleA[2] : 0;
        const stride = speed > 1 ? Math.sin(t * (5.4 + speed * 1.4) + actor.baseX) * Math.min(0.65, speed * 0.085) : 0;
        actor.legs[0].rotation.x = stride;
        actor.legs[1].rotation.x = -stride;
        actor.arms[0].rotation.x = -stride * 0.65;
        actor.arms[1].rotation.x = stride * 0.65;
        const selected = props.focusedPlayer === actor.name ||
          (!props.focusedPlayer && props.favoriteTeam !== "all" && props.favoriteTeam === actor.team);
        actor.halo.visible = selected;
        actor.halo.position.set(x, 0.105, z);
        actor.halo.scale.setScalar(props.focusedPlayer === actor.name ? 1.2 : 0.77);
      }
      const ix = before(events, t), e = events[ix], upcoming = events[ix + 1];
      receiverMarker.visible = false;
      if (e) {
        const delta = Math.max(0, t - e.second);
        const flightTime = e.kind === "pass" ? 2.7 : 2.1;
        const [originX, originZ] = toPitch(e.x, e.y);
        const actor = actors.find(p => p.name === e.player && p.team === e.team);
        const flightActive = flight(e) && delta <= flightTime;
        // A pass starts at the event's synthetic origin, and the landing
        // position is visible for the full duration of the ball flight.
        let ballPosition = flightActive
          ? trajectory(e, delta / flightTime)
          : new THREE.Vector3(originX, 0.4, originZ);
        if (!flightActive && actor) {
          ballPosition.set(actor.figure.position.x + 0.75, 0.4, actor.figure.position.z + 0.75);
        }
        if (flight(e) && delta > flightTime) {
          const landed = trajectory(e, 1);
          if (upcoming && upcoming.second > e.second + flightTime) {
            const fraction = (t - e.second - flightTime) / (upcoming.second - e.second - flightTime);
            const [nx, nz] = toPitch(upcoming.x, upcoming.y);
            ballPosition = new THREE.Vector3(blend(landed.x, nx, fraction), 0.4, blend(landed.z, nz, fraction));
          } else {
            ballPosition.copy(landed);
            ballPosition.y = 0.4;
          }
        }
        if (playback?.ball_frames.length) {
          const sample = t / playback.sample_seconds;
          const i = clamp(Math.floor(sample), 0, playback.ball_frames.length - 1);
          const j = Math.min(i + 1, playback.ball_frames.length - 1);
          const a = playback.ball_frames[i], b = playback.ball_frames[j];
          const k = sample - Math.floor(sample);
          ballPosition.set(blend(a[0], b[0], k), blend(a[2], b[2], k), blend(a[1], b[1], k));
        }
        ball.position.copy(ballPosition);
        ball.rotation.x += dt * 3;
        const trailId = flight(e) && delta < 5 ? e.id : "";
        const fraction = flight(e) ? clamp(delta / flightTime, 0, 1) : 0;
        const fractionBucket = Math.floor(fraction * 36);
        if (trailId !== lastTrail || (trailId && fractionBucket !== lastFraction)) {
          trail.geometry.dispose();
          trail.geometry = trailId
            ? new THREE.BufferGeometry().setFromPoints(
                Array.from({ length: fractionBucket + 1 }, (_, j) =>
                  trajectory(e, fractionBucket === 0 ? 0 : fraction * j / fractionBucket))
              )
            : new THREE.BufferGeometry();
          trailMat.color.setHex(e.kind === "pass" ? 0x8ce7ff : 0xffde61);
          lastTrail = trailId;
          lastFraction = fractionBucket;
        }
        trail.visible = Boolean(trailId);
        trailMat.opacity = clamp((5 - delta) / 3, 0, 0.95);
        if (flight(e) && delta < 5) {
          const landing = trajectory(e, 1);
          receiverMarker.position.set(landing.x, 0.12, landing.z);
          receiverMarker.visible = true;
        }
      }
      const follow = actors.find(actor => actor.name === props.focusedPlayer);
      const projectedTag = nameTag.current;
      const frameIndex = Math.max(0, Math.floor(t / (movement?.sample_seconds ?? 1)));
      const followIndex = follow ? actors.indexOf(follow) : -1;
      const routeIdentity = props.viewerLens === "player" && followIndex >= 0 && movement ?
        followIndex + ":" + frameIndex : "";
      if (routeKey !== routeIdentity) {
        focusRoute.geometry.dispose();
        const from = Math.max(0, frameIndex - 8);
        const positions: THREE.Vector3[] = [];
        if (routeIdentity && movement) for (let j = from; j <= frameIndex; j++) {
          const sample = movement.frames[j]?.[followIndex];
          if (sample) positions.push(new THREE.Vector3(sample[0], 0.18, sample[1]));
        }
        focusRoute.geometry = new THREE.BufferGeometry().setFromPoints(positions);
        routeKey = routeIdentity;
      }
      focusRoute.visible = Boolean(routeIdentity);
      if (props.cameraMode === "tactical") {
        wantedCamera.set(0, 114, 0.01); target.set(0, 0, 0); camera.up.set(0, 0, -1);
      } else if (props.cameraMode === "player" && follow) {
        wantedCamera.set(follow.figure.position.x + 12, 22, follow.figure.position.z + 30);
        target.set(follow.figure.position.x, 1, follow.figure.position.z);
        camera.up.set(0, 1, 0);
      } else {
        const ballX = ball.position.x;
        wantedCamera.set(clamp(ballX * 0.25, -13, 13), 46, 77);
        target.set(clamp(ballX * 0.48, -24, 24), 0, 0); camera.up.set(0, 1, 0);
      }
      camera.position.lerp(wantedCamera, clamp(dt * 3.5, 0, 1));
      lookAt.lerp(target, clamp(dt * 3.5, 0, 1));
      camera.lookAt(lookAt);
      // Project the actor position into a small readable 2D label.
      // This does not alter the measured/source event dataset.
      if (projectedTag) {
        const show = Boolean(follow && (props.viewerLens === "player" || props.cameraMode === "player"));
        projectedTag.style.display = show ? "block" : "none";
        if (show && follow) {
          labelVec.copy(follow.figure.position);
          labelVec.y += 3.7;
          labelVec.project(camera);
          const canvas = renderer.domElement;
          projectedTag.style.left = ((labelVec.x + 1) / 2 * canvas.clientWidth) + "px";
          projectedTag.style.top = ((1 - labelVec.y) / 2 * canvas.clientHeight) + "px";
          projectedTag.style.display = labelVec.z < 1 ? "block" : "none";
        }
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(draw);
    };
    const resize = () => {
      if (destroyed) return;
      const width = Math.max(2, mount.clientWidth), height = Math.max(2, mount.clientHeight);
      camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount); resize();
    raf = requestAnimationFrame(draw);
    return () => {
      destroyed = true; cancelAnimationFrame(raf); observer.disconnect();
      scene.traverse(item => {
        if (item instanceof THREE.Mesh || item instanceof THREE.Line) {
          item.geometry.dispose();
          const materials = Array.isArray(item.material) ? item.material : [item.material];
          materials.forEach(material => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [events, movement, playback]);

  return <div className="replay3d-wrapper">
    {unavailable ? <div className="replay3d-error">3D WebGL is unavailable. Switch to the 2D view.</div> :
      <div ref={node} className="replay3d-canvas" />}
    <div className="replay3d-top"><span className="replay3d-live-dot" /> 3D MATCH STUDIO
      <span className="replay3d-approx">EVENT-BASED RECONSTRUCTION</span></div>
    <div className="replay3d-focus-tag" ref={nameTag} aria-hidden="true">{focusedPlayer}</div>
    <div className="replay3d-lens-hud">
      <strong>{viewerLens === "analyst" ? "TACTICAL DATA" : viewerLens === "player" ?
        "PLAYER TRACK" : viewerLens === "club" ? "CLUB FOCUS" : "MATCH VIEW"}</strong>
      {viewerLens === "player" && focusedPlayer && <span>{focusedPlayer} · {selectedMovement ?
        selectedMovement.speedKmh + " km/h simulated" : "No movement sample"}</span>}
      {viewerLens === "club" && <span>{favoriteTeam === "all" ? "Both clubs" :
        favoriteTeam === "north" ? "Northport FC" : "Southbridge Athletic"}</span>}
      {viewerLens === "analyst" && <span>Pass distances · Verified source events · Reconstructed movement</span>}
    </div>
    {eventBadge && <div className="replay3d-trail-label">{eventBadge}</div>}
    <div className="replay3d-ticker" aria-label={viewerLens === "player" ? "Focused player's event ticker" : "Recent event ticker"}>
      {ticker.map(e => <button key={e.id} onClick={() => onSeek(e.second)}>
        <span>{timeLabel(e.second)}</span>
        <strong>{e.kind === "pass" ? (e.pass_completed ? "PASS ✓" : "PASS ATTEMPT") : e.kind.toUpperCase()}</strong>
        <small>{e.player}{viewerLens === "analyst" && e.kind === "pass" && e.pass_distance_m !== undefined ? " · " + e.pass_distance_m.toFixed(1) + " m" : ""}</small>
      </button>)}
      {ticker.length === 0 && <div className="replay3d-no-events">No events from this focus yet</div>}
    </div>
    <div className="replay3d-disclaimer">Synthetic possession-linked ball and running · Inferred handoffs are not observed match tracking.</div>
  </div>;
}
