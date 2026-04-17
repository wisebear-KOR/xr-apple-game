// Bootstrap: Three.js scene + WebXR session. Phase P0.
import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';

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

document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['plane-detection', 'hand-tracking', 'anchors', 'depth-sensing'],
  })
);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop((t) => {
  marker.rotation.y = t * 0.001;
  renderer.render(scene, camera);
});

if (DEBUG) console.log('[xr-apple-10] boot, debug=on');
