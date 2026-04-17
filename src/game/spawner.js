// Plane-based apple spawner — P2.
// Distributes apples across detected planes proportional to polygon area.
// Points are sampled inside each plane's polygon (XZ plane-local) then lifted by
// APPLE_OFFSET along the plane's local +Y (= plane normal) so apples sit above the surface.
import * as THREE from 'three';
import { createApple } from './apple.js';

const APPLE_OFFSET = 0.04; // 4cm above plane surface
const MAX_PIP_TRIES = 32;

function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

function bbox(poly) {
  let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity;
  for (const p of poly) {
    if (p.x < xmin) xmin = p.x;
    if (p.x > xmax) xmax = p.x;
    if (p.z < zmin) zmin = p.z;
    if (p.z > zmax) zmax = p.z;
  }
  return { xmin, xmax, zmin, zmax };
}

function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, zi = poly[i].z;
    const xj = poly[j].x, zj = poly[j].z;
    const denom = (zj - zi) || 1e-9;
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / denom + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function sampleInPolygon(poly) {
  const b = bbox(poly);
  for (let i = 0; i < MAX_PIP_TRIES; i++) {
    const x = b.xmin + Math.random() * (b.xmax - b.xmin);
    const z = b.zmin + Math.random() * (b.zmax - b.zmin);
    if (pointInPolygon(x, z, poly)) return { x, z };
  }
  return { x: (b.xmin + b.xmax) / 2, z: (b.zmin + b.zmax) / 2 };
}

// planeList: [{ polygon, orient, matrix }] — matrix is 16-element plane→world.
export function spawnApplesOnPlanes(planeList, opts = {}) {
  const { target = 30, minPerPlane = 2, maxPerPlane = 10 } = opts;
  const apples = [];
  if (!planeList.length) return apples;

  const areas = planeList.map((p) => polygonArea(p.polygon));
  const totalArea = areas.reduce((s, a) => s + a, 0);

  const tmpLocal = new THREE.Vector3();
  const worldMat = new THREE.Matrix4();

  for (let i = 0; i < planeList.length; i++) {
    const entry = planeList[i];
    if (entry.polygon.length < 3) continue;

    const share = totalArea > 0 ? areas[i] / totalArea : 1 / planeList.length;
    const n = Math.min(maxPerPlane, Math.max(minPerPlane, Math.round(target * share)));

    worldMat.fromArray(entry.matrix);

    for (let k = 0; k < n; k++) {
      const { x, z } = sampleInPolygon(entry.polygon);
      tmpLocal.set(x, APPLE_OFFSET, z).applyMatrix4(worldMat);
      const value = 1 + Math.floor(Math.random() * 9);
      apples.push(createApple(value, tmpLocal));
    }
  }
  return apples;
}
