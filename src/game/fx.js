// Pop particle bursts — P6.
// Shared icosahedron geometry, per-instance MeshBasicMaterial so opacity fades independently.
// Animation is advanced from the main animation loop (rAF is paused during XR sessions).
import * as THREE from 'three';

const SHARED_GEOM = new THREE.IcosahedronGeometry(0.014, 0);
const BURST_DURATION = 0.6; // seconds
const GRAVITY = 1.4;

export function createFx(scene) {
  const active = [];

  function burst(worldPos, color = 0xffaa33, count = 8) {
    const group = new THREE.Group();
    group.position.copy(worldPos);
    scene.add(group);

    const parts = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 1, depthWrite: false,
      });
      const m = new THREE.Mesh(SHARED_GEOM, mat);
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.2 + 0.2,
        (Math.random() - 0.5) * 2,
      ).normalize().multiplyScalar(0.8 + Math.random() * 0.6);
      parts.push({ mesh: m, vel: v });
      group.add(m);
    }
    active.push({ group, parts, age: 0 });
  }

  function update(dt) {
    for (let i = active.length - 1; i >= 0; i--) {
      const b = active[i];
      b.age += dt;
      const t = b.age / BURST_DURATION;
      if (t >= 1) {
        scene.remove(b.group);
        for (const p of b.parts) p.mesh.material.dispose();
        active.splice(i, 1);
        continue;
      }
      for (const p of b.parts) {
        p.mesh.position.x = p.vel.x * b.age * 0.4;
        p.mesh.position.y = p.vel.y * b.age * 0.4 - 0.5 * GRAVITY * b.age * b.age;
        p.mesh.position.z = p.vel.z * b.age * 0.4;
        p.mesh.material.opacity = 1 - t;
        p.mesh.scale.setScalar(1 - t * 0.35);
      }
    }
  }

  return { burst, update };
}
