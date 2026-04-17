// Left-hand basket: a small ring that follows the left wrist. Right-hand pinches
// starting inside the basket spawn a new numbered apple, which the right hand then
// carries until pinch release.
import * as THREE from 'three';

const BASKET_RADIUS = 0.08;
const GRAB_DISTANCE = 0.18; // right-pinch must start within 18cm of the basket center

// Weighted 1~9: middle values are slightly rarer so clearing a plane at sum=10
// usually requires a small combination rather than a single lucky draw.
const VALUE_WEIGHTS = [0, 3, 3, 3, 3, 2, 2, 3, 3, 3]; // index 0 unused
function rollValue() {
  const total = VALUE_WEIGHTS.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let v = 1; v <= 9; v++) {
    r -= VALUE_WEIGHTS[v];
    if (r <= 0) return v;
  }
  return 9;
}

export function createBasket(scene) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(BASKET_RADIUS, 0.012, 10, 32),
    new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 })
  );
  ring.rotation.x = Math.PI / 2;
  const base = new THREE.Mesh(
    new THREE.CircleGeometry(BASKET_RADIUS * 0.95, 32),
    new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9, side: THREE.DoubleSide })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.01;
  group.add(ring, base);
  group.visible = false;
  scene.add(group);

  const tmp = new THREE.Vector3();

  function follow(wristJoint) {
    if (!wristJoint) { group.visible = false; return; }
    wristJoint.getWorldPosition(tmp);
    group.position.copy(tmp);
    group.position.y += 0.05;
    group.visible = true;
  }

  function isNear(worldPos) {
    if (!group.visible) return false;
    return group.position.distanceTo(worldPos) < GRAB_DISTANCE;
  }

  function spawnApple(fromCreate) {
    const value = rollValue();
    const apple = fromCreate(value, group.position);
    return apple;
  }

  return { mesh: group, follow, isNear, spawnApple };
}
