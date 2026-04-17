// Bootstrap: Three.js scene + WebXR session. P0 marker, P1 planes, P2 apples, P3 pinch-select, P4 lasso+sum10, P5 score/HUD, P6 audio+fx.
import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { createPlaneTracker } from './xr/planes.js';
import { createHandsTracker } from './xr/hands.js';
import { spawnApplesOnPlanes } from './game/spawner.js';
import { createLasso } from './game/lasso.js';
import { createScoring } from './game/scoring.js';
import { createAudioEngine } from './game/audio.js';
import { createFx } from './game/fx.js';
import { createHud } from './ui/hud.js';

const QS = new URLSearchParams(location.search);
const DEBUG = QS.has('debug');
const MODE = QS.get('mode') === 'zen' ? 'zen' : 'classic';
const ZEN_REFILL_THRESHOLD = 20;   // spawn more when field drops below this in zen mode
const ZEN_REFILL_DENSITY = 25;     // apples per m² added on each refill batch

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 50);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

const light = new THREE.HemisphereLight(0xffffff, 0x223344, 1.0);
scene.add(light);

// P0 sanity marker: small cube 1m in front of user.
const marker = new THREE.Mesh(
  new THREE.BoxGeometry(0.1, 0.1, 0.1),
  new THREE.MeshStandardMaterial({ color: 0xff3355 })
);
marker.position.set(0, 0, -1);
scene.add(marker);

const planeTracker = createPlaneTracker(scene, { debug: DEBUG });

// Apple field (P2). Tap/pinch (controller select) to (re)spawn apples on current planes.
const applesRoot = new THREE.Group();
applesRoot.name = 'Apples';
scene.add(applesRoot);
let apples = [];

function clearApples() {
  for (const a of apples) {
    applesRoot.remove(a.mesh);
    a.dispose?.();
  }
  apples = [];
}

function respawnApples() {
  const planeList = planeTracker.list();
  if (!planeList.length) {
    if (DEBUG) console.warn('[spawn] no visible planes yet — walk around to scan');
    return;
  }
  clearApples();
  apples = spawnApplesOnPlanes(planeList);
  for (const a of apples) applesRoot.add(a.mesh);
  if (DEBUG) console.log('[spawn] apples=', apples.length, 'planes=', planeList.length);
}

function refillApples() {
  const planeList = planeTracker.list();
  if (!planeList.length) return;
  const extras = spawnApplesOnPlanes(planeList, { density: ZEN_REFILL_DENSITY, hardCapTotal: 120 });
  for (const a of extras) applesRoot.add(a.mesh);
  apples.push(...extras);
  if (DEBUG) console.log('[refill] +', extras.length, 'total=', apples.length);
}

const SELECT_RADIUS = 0.12; // 12cm pinch-to-apple pickup radius (single tap)
const LASSO_MIN_LEN = 0.10; // 10cm — shorter trails treated as a tap, not a lasso

const lasso = createLasso(scene, camera);
const scoring = createScoring({ roundSeconds: MODE === 'zen' ? Infinity : 90 });
const hud = createHud(scene);
const fx = createFx(scene);
const audio = createAudioEngine(camera);
let lassoHand = -1;
const pinchStartPos = new THREE.Vector3();

function nearestAppleWithin(worldPos, maxDist) {
  let best = null, bestD = maxDist;
  for (const a of apples) {
    const d = a.mesh.position.distanceTo(worldPos);
    if (d < bestD) { best = a; bestD = d; }
  }
  return best;
}

function removeApple(apple) {
  const idx = apples.indexOf(apple);
  if (idx >= 0) apples.splice(idx, 1);
  if (gazedApple === apple) gazedApple = null;
  applesRoot.remove(apple.mesh);
  apple.dispose?.();
}

function evaluateLasso(trail) {
  const polygon = lasso.project2D(trail);
  if (polygon.length < 3) return { sum: 0, picked: [] };
  const picked = [];
  const v = new THREE.Vector3();
  for (const apple of apples) {
    v.copy(apple.mesh.position).project(camera);
    if (v.z < -1 || v.z > 1) continue;
    if (lasso.pointInPoly2D(v.x, v.y, polygon)) picked.push(apple);
  }
  const sum = picked.reduce((s, a) => s + a.value, 0);
  return { sum, picked };
}

function onPinchStart(handIndex, worldPos) {
  if (lassoHand !== -1) return; // only one active lasso at a time
  if (scoring.ended) {
    // Round over → next pinch starts a fresh round with a new apple field.
    scoring.start(performance.now() / 1000);
    respawnApples();
    return;
  }
  if (apples.length === 0) { respawnApples(); return; }
  lassoHand = handIndex;
  pinchStartPos.copy(worldPos);
  lasso.start(worldPos);
}

function onPinchMove(handIndex, worldPos) {
  if (handIndex !== lassoHand) return;
  lasso.addPoint(worldPos);
  if (lasso.points.length >= 3) {
    const { sum } = evaluateLasso(lasso.points);
    lasso.setSum(sum, worldPos);
  }
}

function onPinchEnd(handIndex) {
  if (handIndex !== lassoHand) return;
  lassoHand = -1;
  const trail = lasso.end();
  const len = lasso.trailLength(trail);

  // Short trail → treat as a single tap: select/deselect nearest apple.
  if (len < LASSO_MIN_LEN) {
    lasso.hide();
    const hit = nearestAppleWithin(pinchStartPos, SELECT_RADIUS);
    if (hit) hit.setSelected(!hit.selected);
    return;
  }

  const { sum, picked } = evaluateLasso(trail);
  if (DEBUG) console.log('[lasso] picked=', picked.length, 'sum=', sum);

  // Classic rule: 2+ apples, sum exactly 10.
  if (picked.length >= 2 && sum === 10) {
    // Bonus calc (design §3.2): cross-plane ×1.5, any apple ≥2m from camera ×1.2.
    const uniquePlanes = new Set(picked.map((a) => a.planeId)).size;
    const camPos = camera.getWorldPosition(new THREE.Vector3());
    const farthest = picked.reduce((d, a) => Math.max(d, a.mesh.position.distanceTo(camPos)), 0);
    const bonus = (uniquePlanes >= 2 ? 1.5 : 1) * (farthest >= 2 ? 1.2 : 1);

    for (const a of picked) {
      fx.burst(a.mesh.position, 0xffaa33);
      audio.playPop(a.mesh.position, a.value);
      removeApple(a);
    }
    const nowSec = performance.now() / 1000;
    const gained = scoring.onPop(picked.length, nowSec, { bonusMultiplier: bonus });
    if (DEBUG) console.log('[score] +', gained, 'bonus×', bonus.toFixed(2), '→', scoring.score, 'combo×', scoring.combo);
    lasso.hide();
  } else {
    lasso.flashFailAndHide();
  }
}

const hands = createHandsTracker(renderer, scene, {
  onPinchStart, onPinchMove, onPinchEnd,
});

// Gaze highlight: forward ray from camera → closest apple within a small angular radius
// gets a soft glow. Head-ray proxy for real eye-tracking; same UX, no feature dependency.
const GAZE_RAY_RADIUS = 0.08;   // perpendicular distance from ray (meters)
const GAZE_MIN_DEPTH  = 0.15;   // ignore apples right on top of the camera
const _gazeTmp = {
  origin: new THREE.Vector3(),
  forward: new THREE.Vector3(),
  toApple: new THREE.Vector3(),
};
let gazedApple = null;

function updateGaze() {
  const g = _gazeTmp;
  camera.getWorldPosition(g.origin);
  camera.getWorldDirection(g.forward); // unit vector, already normalized

  let best = null, bestPerpSq = GAZE_RAY_RADIUS * GAZE_RAY_RADIUS;
  for (const a of apples) {
    g.toApple.copy(a.mesh.position).sub(g.origin);
    const depth = g.toApple.dot(g.forward);
    if (depth < GAZE_MIN_DEPTH) continue;
    const perpSq = g.toApple.lengthSq() - depth * depth;
    if (perpSq < bestPerpSq) { bestPerpSq = perpSq; best = a; }
  }

  if (best !== gazedApple) {
    gazedApple?.setGazed(false);
    best?.setGazed(true);
    gazedApple = best;
  }
}

// HUD placement: left-wrist-anchored when the left hand is tracked and roughly palm-up,
// otherwise a head-locked fallback 60cm in front of the camera.
const _hudTmp = {
  camPos: new THREE.Vector3(),
  camQuat: new THREE.Quaternion(),
  wristPos: new THREE.Vector3(),
  wristQuat: new THREE.Quaternion(),
  palmNormal: new THREE.Vector3(),
  worldUp: new THREE.Vector3(0, 1, 0),
  offset: new THREE.Vector3(),
};

function positionHud() {
  const t = _hudTmp;
  camera.getWorldPosition(t.camPos);
  camera.getWorldQuaternion(t.camQuat);

  const wrist = hands.wristOf('left');
  // WebXR wrist joint: +Y is along the bone (toward elbow for wrist); the back-of-hand
  // normal is roughly -Z in the joint's local frame. Works well enough as a palm-up check.
  if (wrist) {
    wrist.getWorldPosition(t.wristPos);
    wrist.getWorldQuaternion(t.wristQuat);
    t.palmNormal.set(0, 0, -1).applyQuaternion(t.wristQuat);
    const palmUp = t.palmNormal.dot(t.worldUp);
    if (palmUp > 0.25) {
      t.offset.set(0, 0.04, 0).applyQuaternion(t.wristQuat); // float a bit above the wrist
      hud.mesh.position.copy(t.wristPos).add(t.offset);
      hud.mesh.lookAt(t.camPos);
      hud.mesh.visible = true;
      return;
    }
  }
  // Fallback: head-locked.
  t.offset.set(0, -0.18, -0.6).applyQuaternion(t.camQuat);
  hud.mesh.position.copy(t.camPos).add(t.offset);
  hud.mesh.quaternion.copy(t.camQuat);
  hud.mesh.visible = true;
}

// Controller fallback for non-hand inputs (e.g., emulator or tracked-pointer controllers).
const controller = renderer.xr.getController(0);
scene.add(controller);
controller.addEventListener('select', (e) => {
  if (e.data?.hand) return; // ignore when the input is a hand — handled via pinch
  respawnApples();
});

document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test', 'plane-detection', 'hand-tracking'],
    optionalFeatures: ['local-floor', 'anchors', 'depth-sensing'],
  })
);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let refSpace = null;
renderer.xr.addEventListener('sessionstart', async () => {
  const session = renderer.xr.getSession();
  refSpace = await session.requestReferenceSpace('local-floor').catch(
    () => session.requestReferenceSpace('local')
  );
  scoring.start(performance.now() / 1000);
  audio.resume();
  if (DEBUG) console.log('[xr-apple-10] session started, refSpace=', refSpace);
});
renderer.xr.addEventListener('sessionend', () => { refSpace = null; });

let lastT = 0;
renderer.setAnimationLoop((t, frame) => {
  const nowSec = t / 1000;
  const dt = lastT ? Math.min(0.1, nowSec - lastT) : 0;
  lastT = nowSec;

  marker.visible = DEBUG;
  if (DEBUG) marker.rotation.y = t * 0.001;

  if (frame && refSpace) planeTracker.update(frame, refSpace);
  hands.update();
  audio.updateListener();
  fx.update(dt);
  updateGaze();

  scoring.tick(nowSec);

  // Zen mode auto-refill: keep the field dense while the user keeps playing.
  if (MODE === 'zen' && apples.length < ZEN_REFILL_THRESHOLD && planeTracker.count() > 0) {
    refillApples();
  }

  let message = '';
  if (refSpace) {
    if (scoring.ended) message = '핀치하여 다시 시작';
    else if (planeTracker.count() === 0) message = '주변을 둘러보며 평면을 스캔하세요';
    else if (apples.length === 0) message = '허공을 핀치해 사과를 스폰하세요';
  }

  hud.render({
    score: scoring.score,
    timeLeft: scoring.timeLeft(nowSec),
    combo: scoring.combo,
    ended: scoring.ended,
    message,
  });

  positionHud();

  renderer.render(scene, camera);
});

if (DEBUG) {
  console.log('[xr-apple-10] boot, debug=on');
  setInterval(() => console.log('[planes] count=', planeTracker.count()), 2000);
}
