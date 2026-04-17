// Numbered apple entity. Phases: 'held' (attached to right hand), 'falling' (gravity),
// 'resting' (on a plane), 'dead' (fell out of world). Value is 1~9, rendered as a sprite.
import * as THREE from 'three';

const APPLE_RADIUS = 0.04;
const sphereGeom = new THREE.SphereGeometry(APPLE_RADIUS, 20, 14);

function makeNumberTexture(value) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.font = 'bold 92px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#1a0000';
  ctx.strokeText(String(value), size / 2, size / 2 + 4);
  ctx.fillStyle = '#fff';
  ctx.fillText(String(value), size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

export function createApple(value, worldPosition) {
  const hue = (0.98 + (Math.random() - 0.5) * 0.04) % 1;
  const color = new THREE.Color().setHSL(hue, 0.78, 0.42);

  const body = new THREE.Mesh(
    sphereGeom,
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 })
  );

  const tex = makeNumberTexture(value);
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  );
  label.scale.set(0.05, 0.05, 0.05);
  label.position.set(0, APPLE_RADIUS + 0.01, 0);
  label.renderOrder = 999;

  const group = new THREE.Group();
  group.add(body, label);
  group.position.copy(worldPosition);

  return {
    value,
    mesh: group,
    velocity: new THREE.Vector3(),
    phase: 'held',        // 'held' | 'falling' | 'resting' | 'dead'
    planeId: null,
    radius: APPLE_RADIUS,
    dispose() {
      body.material.dispose();
      tex.dispose();
      label.material.dispose();
    },
  };
}
