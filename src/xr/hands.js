// Hand tracking + pinch detection — P3.
// Reads thumb-tip / index-finger-tip joints on both hands, computes distance, and emits
// pinchstart/pinchend with a midpoint world position. Hysteresis avoids jitter at threshold.

import * as THREE from 'three';

const PINCH_ON = 0.022;   // 22mm — engage pinch when tips come this close
const PINCH_OFF = 0.038;  // 38mm — release only after tips open up clearly

export function createHandsTracker(renderer, scene, callbacks = {}) {
  const hands = [renderer.xr.getHand(0), renderer.xr.getHand(1)];
  for (const h of hands) {
    scene.add(h);
    // Stash handedness once the input source connects so downstream code can
    // pick out the left wrist for the HUD, etc.
    h.addEventListener('connected', (e) => { h.userData.handedness = e.data?.handedness ?? 'unknown'; });
    h.addEventListener('disconnected', () => { h.userData.handedness = null; });
  }

  const state = [
    { pinched: false, pos: new THREE.Vector3() },
    { pinched: false, pos: new THREE.Vector3() },
  ];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  function jointVisible(j) {
    // Three.js sets joint.visible=true once the joint gets a pose this frame.
    return j && j.visible !== false && j.jointRadius !== undefined;
  }

  function update() {
    for (let i = 0; i < 2; i++) {
      const hand = hands[i];
      const thumb = hand.joints?.['thumb-tip'];
      const index = hand.joints?.['index-finger-tip'];

      if (!jointVisible(thumb) || !jointVisible(index)) {
        if (state[i].pinched) {
          state[i].pinched = false;
          callbacks.onPinchEnd?.(i);
        }
        continue;
      }

      thumb.getWorldPosition(a);
      index.getWorldPosition(b);
      const d = a.distanceTo(b);
      state[i].pos.copy(a).add(b).multiplyScalar(0.5);
      state[i].distance = d;

      if (!state[i].pinched && d < PINCH_ON) {
        state[i].pinched = true;
        callbacks.onPinchStart?.(i, state[i].pos);
      } else if (state[i].pinched && d > PINCH_OFF) {
        state[i].pinched = false;
        callbacks.onPinchEnd?.(i);
      } else if (state[i].pinched) {
        callbacks.onPinchMove?.(i, state[i].pos);
      }
    }
  }

  function wristOf(handedness) {
    for (const h of hands) {
      if (h.userData.handedness === handedness) {
        const w = h.joints?.['wrist'];
        if (w && w.jointRadius !== undefined) return w;
      }
    }
    return null;
  }

  return { update, state, hands, wristOf };
}
