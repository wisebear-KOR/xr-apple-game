// Lasso gesture — P4.
// Records a 3D trail while the user pinches-and-drags, then on release projects the trail
// (and all apples) to camera-space 2D and runs point-in-polygon to decide which apples
// were encircled. Sum-of-values must equal 10 to "pop" — otherwise the lasso flashes red.

import * as THREE from 'three';

const MAX_PTS = 384;
const MIN_STEP = 0.012;      // 1.2cm — decimate trail to keep geometry sane
const LASSO_COLOR = 0x77ffcc;
const FAIL_COLOR  = 0xff4466;

export function createLasso(scene, camera) {
  const positions = new Float32Array(MAX_PTS * 3);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: LASSO_COLOR, transparent: true, opacity: 0.95 });
  const line = new THREE.Line(geom, mat);
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);

  // Live sum label that floats at the cursor while the user draws.
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256; labelCanvas.height = 128;
  const labelCtx = labelCanvas.getContext('2d');
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, depthTest: false, transparent: true }));
  labelSprite.scale.set(0.12, 0.06, 1);
  labelSprite.renderOrder = 1001;
  labelSprite.visible = false;
  scene.add(labelSprite);

  function drawLabel(sum) {
    labelCtx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
    labelCtx.fillStyle = 'rgba(0,0,0,0.55)';
    labelCtx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
    labelCtx.font = 'bold 72px system-ui, sans-serif';
    labelCtx.textAlign = 'center';
    labelCtx.textBaseline = 'middle';
    labelCtx.fillStyle = sum === 10 ? '#77ffaa' : '#fff';
    labelCtx.fillText(`${sum} / 10`, labelCanvas.width / 2, labelCanvas.height / 2);
    labelTex.needsUpdate = true;
  }

  let pts = [];
  let active = false;

  function start(worldPos) {
    active = true;
    pts = [worldPos.clone()];
    writeGeom();
    mat.color.setHex(LASSO_COLOR);
    line.visible = true;
  }

  function addPoint(worldPos) {
    if (!active) return;
    const last = pts[pts.length - 1];
    if (last && last.distanceTo(worldPos) < MIN_STEP) return;
    if (pts.length >= MAX_PTS) return;
    pts.push(worldPos.clone());
    writeGeom();
  }

  function writeGeom() {
    for (let i = 0; i < pts.length; i++) {
      positions[i * 3 + 0] = pts[i].x;
      positions[i * 3 + 1] = pts[i].y;
      positions[i * 3 + 2] = pts[i].z;
    }
    geom.setDrawRange(0, pts.length);
    geom.attributes.position.needsUpdate = true;
    geom.computeBoundingSphere();
  }

  function end() {
    active = false;
    const trail = pts;
    pts = [];
    return trail;
  }

  function flashFailAndHide(ms = 600) {
    mat.color.setHex(FAIL_COLOR);
    labelSprite.visible = false;
    setTimeout(() => { line.visible = false; }, ms);
  }

  function hide() { line.visible = false; labelSprite.visible = false; }

  function setSum(sum, worldPos) {
    drawLabel(sum);
    labelSprite.position.copy(worldPos);
    labelSprite.visible = true;
  }

  function trailLength(trail) {
    let len = 0;
    for (let i = 1; i < trail.length; i++) len += trail[i].distanceTo(trail[i - 1]);
    return len;
  }

  // Screen-space (NDC) projection against current camera.
  function project2D(worldPoints) {
    const v = new THREE.Vector3();
    const out = [];
    for (const p of worldPoints) {
      v.copy(p).project(camera);
      // Skip points behind the camera — projecting those gives garbage polygon.
      if (v.z > 1 || v.z < -1) continue;
      out.push({ x: v.x, y: v.y });
    }
    return out;
  }

  function pointInPoly2D(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const denom = (yj - yi) || 1e-9;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / denom + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  return {
    start, addPoint, end, hide, flashFailAndHide, setSum,
    trailLength, project2D, pointInPoly2D,
    isActive: () => active,
    get points() { return pts; },
  };
}
