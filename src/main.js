// Bootstrap: Three.js scene + WebXR session. P0 marker, P1 planes, P2 apples.
import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { createPlaneTracker } from './xr/planes.js';
import { spawnApplesOnPlanes } from './game/spawner.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

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

const controller = renderer.xr.getController(0);
scene.add(controller);
controller.addEventListener('select', respawnApples);

document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test', 'plane-detection'],
    optionalFeatures: ['local-floor', 'hand-tracking', 'anchors', 'depth-sensing'],
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
  if (DEBUG) console.log('[xr-apple-10] session started, refSpace=', refSpace);
});
renderer.xr.addEventListener('sessionend', () => { refSpace = null; });

renderer.setAnimationLoop((t, frame) => {
  marker.rotation.y = t * 0.001;
  if (frame && refSpace) planeTracker.update(frame, refSpace);
  renderer.render(scene, camera);
});

if (DEBUG) {
  console.log('[xr-apple-10] boot, debug=on');
  setInterval(() => console.log('[planes] count=', planeTracker.count()), 2000);
}
