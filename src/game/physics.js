// Minimal physics: downward gravity + per-apple raycast against horizontal plane fills.
// Avoids adding a full rigid-body lib (cannon-es) to keep the import map slim; the only
// supported interaction is "drop and settle onto a table/floor plane".
import * as THREE from 'three';

const GRAVITY = 9.8;
const DOWN = new THREE.Vector3(0, -1, 0);
const KILL_Y = -5; // anything that falls past this is considered lost

export function createPhysics({ appleRadius = 0.04 } = {}) {
  const raycaster = new THREE.Raycaster();
  const delta = new THREE.Vector3();
  const meshArr = [];

  // Advance one apple; returns { planeId } on rest, 'dead' when lost, null otherwise.
  function step(apple, dt, horizontalFills) {
    if (apple.phase !== 'falling') return null;

    apple.velocity.y -= GRAVITY * dt;
    delta.copy(apple.velocity).multiplyScalar(dt);

    const castDist = Math.max(0.02, -delta.y) + appleRadius;
    raycaster.set(apple.mesh.position, DOWN);
    raycaster.far = castDist;

    meshArr.length = 0;
    for (const f of horizontalFills) meshArr.push(f.mesh);
    const hits = raycaster.intersectObjects(meshArr, false);
    if (hits.length > 0) {
      const hit = hits[0];
      const planeId = hit.object.userData.planeId;
      apple.mesh.position.copy(hit.point);
      apple.mesh.position.y += appleRadius;
      apple.velocity.set(0, 0, 0);
      apple.phase = 'resting';
      apple.planeId = planeId;
      return { planeId };
    }

    apple.mesh.position.add(delta);
    if (apple.mesh.position.y < KILL_Y) { apple.phase = 'dead'; return 'dead'; }
    return null;
  }

  return { step };
}
