// Positional audio — P6.
// Synthesizes a short plucky "pop" via WebAudio, panned with an HRTF PannerNode to the
// apple's world position. No sample assets required; keeps the build-less rule intact.
// Listener pose is synced from the active camera each frame.
import * as THREE from 'three';

export function createAudioEngine(camera) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) {
    console.warn('[audio] WebAudio unavailable — running silent');
    return { playPop() {}, updateListener() {}, resume() {} };
  }

  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);

  const tmpPos = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const tmpUp = new THREE.Vector3();

  function resume() { if (ctx.state === 'suspended') ctx.resume(); }

  function setListenerPose(pos, forward, up) {
    const L = ctx.listener;
    const now = ctx.currentTime;
    if (L.positionX) {
      L.positionX.setValueAtTime(pos.x, now);
      L.positionY.setValueAtTime(pos.y, now);
      L.positionZ.setValueAtTime(pos.z, now);
      L.forwardX.setValueAtTime(forward.x, now);
      L.forwardY.setValueAtTime(forward.y, now);
      L.forwardZ.setValueAtTime(forward.z, now);
      L.upX.setValueAtTime(up.x, now);
      L.upY.setValueAtTime(up.y, now);
      L.upZ.setValueAtTime(up.z, now);
    } else {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  function updateListener() {
    camera.getWorldPosition(tmpPos);
    camera.getWorldDirection(tmpDir);
    tmpUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    setListenerPose(tmpPos, tmpDir, tmpUp);
  }

  function makePanner(worldPos) {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 0.5;
    p.rolloffFactor = 1.2;
    const t = ctx.currentTime;
    if (p.positionX) {
      p.positionX.setValueAtTime(worldPos.x, t);
      p.positionY.setValueAtTime(worldPos.y, t);
      p.positionZ.setValueAtTime(worldPos.z, t);
    } else {
      p.setPosition(worldPos.x, worldPos.y, worldPos.z);
    }
    return p;
  }

  // value: 1–9. Smaller numbers ring a bit brighter — design spec "숫자가 클수록 낮은 톤".
  function playPop(worldPos, value = 5) {
    resume();
    const t = ctx.currentTime;
    const base = 300 + (10 - value) * 55;   // 9→355, 1→795
    const panner = makePanner(worldPos);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(base * 2.1, t);
    osc.frequency.exponentialRampToValueAtTime(base, t + 0.14);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.6, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(g).connect(panner).connect(master);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  return { playPop, updateListener, resume };
}
