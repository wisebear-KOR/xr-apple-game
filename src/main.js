// Bootstrap: Three.js scene + WebXR session.
// Rule: left hand holds a basket, right hand pinches to draw a numbered apple from it
// and places the apple on a real-world plane. Sum of numbers on a plane = 10 → plane
// cleared & locked (score). Sum > 10 → plane overflow & locked (no score).
import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { createPlaneTracker } from './xr/planes.js';
import { createHandsTracker } from './xr/hands.js';
import { createApple } from './game/apple.js';
import { createBasket } from './game/basket.js';
import { createPhysics } from './game/physics.js';
import { createPlaneStates } from './game/planeState.js';
import { createScoring } from './game/scoring.js';
import { createAudioEngine } from './game/audio.js';
import { createFx } from './game/fx.js';
import { createHud } from './ui/hud.js';

const QS = new URLSearchParams(location.search);
const DEBUG = QS.has('debug');
const MODE = QS.get('mode') === 'zen' ? 'zen' : 'classic';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 50);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.0));

const planeTracker = createPlaneTracker(scene, { debug: DEBUG });
const basket = createBasket(scene);
const physics = createPhysics();
const planeStates = createPlaneStates();

const applesRoot = new THREE.Group();
applesRoot.name = 'Apples';
scene.add(applesRoot);
const apples = [];
/** Apple currently attached to a right-hand pinch, keyed by hand index. */
const heldByHand = new Map();

const scoring = createScoring({ roundSeconds: MODE === 'zen' ? Infinity : 90 });
const hud = createHud(scene);
const fx = createFx(scene);
const audio = createAudioEngine(camera);

function disposeApple(apple) {
  applesRoot.remove(apple.mesh);
  apple.dispose?.();
}

function removeApple(apple) {
  const idx = apples.indexOf(apple);
  if (idx >= 0) apples.splice(idx, 1);
  disposeApple(apple);
}

function clearAllApples() {
  for (const a of apples) disposeApple(a);
  apples.length = 0;
  heldByHand.clear();
}

function resetRound() {
  clearAllApples();
  planeStates.reset();
  planeTracker.resetStates();
  scoring.start(performance.now() / 1000);
}

function handednessOf(handIndex) {
  return hands.hands[handIndex]?.userData?.handedness ?? 'unknown';
}

function onPinchStart(handIndex, worldPos) {
  // Any pinch restarts the round once it's over.
  if (scoring.ended) { resetRound(); return; }

  const side = handednessOf(handIndex);
  if (side !== 'right') return; // only right hand grabs

  if (!basket.isNear(worldPos)) return;

  const apple = basket.spawnApple(createApple);
  apple.mesh.position.copy(worldPos);
  apple.phase = 'held';
  applesRoot.add(apple.mesh);
  apples.push(apple);
  heldByHand.set(handIndex, apple);
  if (DEBUG) console.log('[grab] value=', apple.value);
}

function onPinchMove(handIndex, worldPos) {
  const apple = heldByHand.get(handIndex);
  if (!apple) return;
  apple.mesh.position.copy(worldPos);
}

function onPinchEnd(handIndex) {
  const apple = heldByHand.get(handIndex);
  if (!apple) return;
  heldByHand.delete(handIndex);
  apple.phase = 'falling';
  apple.velocity.set(0, 0, 0);
  if (DEBUG) console.log('[drop] value=', apple.value);
}

const hands = createHandsTracker(renderer, scene, {
  onPinchStart, onPinchMove, onPinchEnd,
});

function handleRest(apple, planeId) {
  const result = planeStates.addApple(planeId, apple);
  if (result === 'locked') {
    // Apple landed on an already-locked plane — bounce it off (remove).
    fx.burst(apple.mesh.position, 0x888888, 4);
    removeApple(apple);
    return;
  }
  if (result === 'clear') {
    const nowSec = performance.now() / 1000;
    const gained = scoring.onPop(1, nowSec, { bonusMultiplier: 1 });
    // Pop every apple on the plane; plane itself gets a locked tint.
    for (const a of planeStates.applesOn(planeId)) {
      fx.burst(a.mesh.position, 0xffaa33);
      audio.playPop(a.mesh.position, a.value);
      removeApple(a);
    }
    planeTracker.setState(planeId, 'locked');
    if (DEBUG) console.log('[clear] plane=', planeId, '+', gained, '→', scoring.score);
    return;
  }
  if (result === 'overflow') {
    for (const a of planeStates.applesOn(planeId)) {
      fx.burst(a.mesh.position, 0xff3344, 6);
      removeApple(a);
    }
    planeTracker.setState(planeId, 'locked');
    if (DEBUG) console.log('[overflow] plane=', planeId, 'locked');
    return;
  }
  // 'added' → keep apple resting on plane, mark plane active.
  planeTracker.setState(planeId, 'active');
}

// HUD placement: wrist-anchored when the *left* hand is palm-up — but left hand now
// carries the basket, so we keep it head-locked to avoid overlap.
const _hudTmp = {
  camPos: new THREE.Vector3(),
  camQuat: new THREE.Quaternion(),
  offset: new THREE.Vector3(),
};
function positionHud() {
  const t = _hudTmp;
  camera.getWorldPosition(t.camPos);
  camera.getWorldQuaternion(t.camQuat);
  t.offset.set(0, -0.18, -0.6).applyQuaternion(t.camQuat);
  hud.mesh.position.copy(t.camPos).add(t.offset);
  hud.mesh.quaternion.copy(t.camQuat);
  hud.mesh.visible = true;
}

// Controller fallback (emulator): tap = spawn test apple from basket position if near.
const controller = renderer.xr.getController(0);
scene.add(controller);
controller.addEventListener('select', (e) => {
  if (e.data?.hand) return;
  // Emulator: simulate a right-hand grab at the controller pos and release a moment later
  // so the apple falls toward any plane beneath.
  const pos = new THREE.Vector3();
  controller.getWorldPosition(pos);
  const apple = basket.spawnApple(createApple);
  apple.mesh.position.copy(pos);
  apple.phase = 'falling';
  applesRoot.add(apple.mesh);
  apples.push(apple);
  if (DEBUG) console.log('[controller] drop value=', apple.value, 'at', pos.toArray());
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
  resetRound();
  audio.resume();
  if (DEBUG) console.log('[xr-apple-10] session started, refSpace=', refSpace);
});
renderer.xr.addEventListener('sessionend', () => { refSpace = null; });

let lastT = 0;
let lastPlaneLogCount = -1;
renderer.setAnimationLoop((t, frame) => {
  const nowSec = t / 1000;
  const dt = lastT ? Math.min(0.1, nowSec - lastT) : 0;
  lastT = nowSec;

  if (frame && refSpace) planeTracker.update(frame, refSpace);
  hands.update();
  audio.updateListener();
  fx.update(dt);
  scoring.tick(nowSec);

  // Keep the basket anchored to the left wrist.
  basket.follow(hands.wristOf('left'));

  // Physics: plane world matrices must be current before raycasting against them.
  planeTracker.root.updateMatrixWorld(true);
  const fills = planeTracker.horizontalFills();
  for (let i = apples.length - 1; i >= 0; i--) {
    const a = apples[i];
    if (a.phase !== 'falling') continue;
    const r = physics.step(a, dt, fills);
    if (r === 'dead') { removeApple(a); continue; }
    if (r && r.planeId != null) handleRest(a, r.planeId);
  }

  let message = '';
  if (refSpace) {
    if (scoring.ended) message = '핀치하여 다시 시작';
    else if (planeTracker.count() === 0) message = '평면을 스캔하세요';
    else if (!basket.mesh.visible) message = '왼손을 앞으로 들어 바구니를 꺼내세요';
    else message = '오른손으로 사과를 꺼내 평면에 놓으세요 (합 10)';
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

  if (DEBUG && planeTracker.count() !== lastPlaneLogCount) {
    lastPlaneLogCount = planeTracker.count();
    console.log('[planes] count=', lastPlaneLogCount);
  }
});

if (DEBUG) console.log('[xr-apple-10] boot, debug=on');
