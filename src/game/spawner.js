// Plane-based apple spawner — P2.
// Distributes apples across detected planes proportional to polygon area.
// Points are sampled inside each plane's polygon (XZ plane-local) then lifted by
// APPLE_OFFSET along the plane's local +Y (= plane normal) so apples sit above the surface.
import * as THREE from 'three';
import { createApple } from './apple.js';

const APPLE_OFFSET = 0.04;    // 4cm above plane surface
const MIN_SPACING = 0.075;    // 7.5cm min gap between apple centers (radius is 4cm)
const MIN_SPACING_SQ = MIN_SPACING * MIN_SPACING;
const MAX_PIP_TRIES = 48;

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
// density: target apples per square meter of plane surface. Capped per plane by
// how many points we can place while honoring MIN_SPACING, so tiny planes don't
// get hundreds of overlapping apples.
export function spawnApplesOnPlanes(planeList, opts = {}) {
  const { density = 80, hardCapPerPlane = 160, hardCapTotal = 400 } = opts;
  const apples = [];
  if (!planeList.length) return apples;

  const tmpLocal = new THREE.Vector3();
  const worldMat = new THREE.Matrix4();

  for (const entry of planeList) {
    if (entry.polygon.length < 3) continue;
    if (apples.length >= hardCapTotal) break;

    const area = polygonArea(entry.polygon);
    const want = Math.min(hardCapPerPlane, Math.max(2, Math.round(area * density)));

    worldMat.fromArray(entry.matrix);

    // Track placed positions in plane-local XZ to enforce MIN_SPACING.
    const placed = [];
    let attempts = 0;
    const maxAttempts = want * 8;

    while (placed.length < want && attempts < maxAttempts && apples.length < hardCapTotal) {
      attempts++;
      const { x, z } = sampleInPolygon(entry.polygon);
      let clash = false;
      for (const p of placed) {
        const dx = p.x - x, dz = p.z - z;
        if (dx * dx + dz * dz < MIN_SPACING_SQ) { clash = true; break; }
      }
      if (clash) continue;
      placed.push({ x, z });

      tmpLocal.set(x, APPLE_OFFSET, z).applyMatrix4(worldMat);
      const value = 1 + Math.floor(Math.random() * 9);
      const apple = createApple(value, tmpLocal);
      apple.planeId = entry.id;
      apples.push(apple);
    }
  }
  return apples;
}
