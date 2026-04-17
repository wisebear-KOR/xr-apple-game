// Minimal head-locked HUD — P5.
// A single canvas-textured plane parented to the camera shows 점수 / 남은 시간 / 콤보 배수.
// Head-locked is a shortcut; the design calls for a wrist HUD (unlocked via look-down) — that
// comes later once hand-anchor integration is in.
import * as THREE from 'three';

export function createHud(scene) {
  const CW = 640, CH = 220;
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const ctx = c.getContext('2d');

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.062), mat);
  mesh.renderOrder = 1000;
  scene.add(mesh);

  let lastKey = '';

  function render(state) {
    const { score = 0, timeLeft = 0, combo = 1, ended = false, message = '' } = state;
    const key = `${score}|${timeLeft.toFixed(1)}|${combo.toFixed(1)}|${ended ? 1 : 0}|${message}`;
    if (key === lastKey) return;
    lastKey = key;

    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, CW, CH);

    const rowY = 72;
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(`${score}`, 28, rowY);

    ctx.textAlign = 'center';
    ctx.fillStyle = timeLeft < 10 ? '#ff6677' : '#fff';
    const timeText = Number.isFinite(timeLeft) ? `${Math.ceil(timeLeft)}s` : '∞';
    ctx.fillText(timeText, CW / 2, rowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = combo > 1 ? '#ffd84a' : '#888';
    ctx.fillText(`×${combo.toFixed(1)}`, CW - 28, rowY);

    if (message) {
      ctx.font = '32px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#cfe';
      ctx.fillText(message, CW / 2, CH - 44);
    }

    if (ended) {
      ctx.fillStyle = 'rgba(255, 60, 90, 0.3)';
      ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 56px system-ui';
      ctx.fillText('TIME OVER', CW / 2, CH / 2);
    }

    tex.needsUpdate = true;
  }

  render({}); // initial empty
  return { mesh, render };
}
