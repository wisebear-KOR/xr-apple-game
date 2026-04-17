// Plane detection — P1. Track XRPlanes from the session and render their polygons.
// Each detected plane becomes two children: a translucent fill and an outline loop.
// Rebuild geometry only when plane.lastChangedTime moves forward; re-pose every frame.

import * as THREE from 'three';

const COLORS = {
  horizontal: 0x4aa3ff, // floor, desk, seat
  vertical:   0xff7a4a, // walls
};

function buildPlaneMeshes(plane) {
  const orient = plane.orientation === 'vertical' ? 'vertical' : 'horizontal';
  const color = COLORS[orient];

  // plane.polygon is a closed loop of DOMPointReadOnly in plane-local space (XZ, y≈0).
  const pts = plane.polygon;
  const positions = new Float32Array(pts.length * 3);
  for (let i = 0; i < pts.length; i++) {
    positions[i * 3 + 0] = pts[i].x;
    positions[i * 3 + 1] = pts[i].y;
    positions[i * 3 + 2] = pts[i].z;
  }

  // Triangulate as a fan from vertex 0. Polygons from WebXR are convex-ish; fan is good enough for viz.
  const idx = [];
  for (let i = 1; i < pts.length - 2; i++) idx.push(0, i, i + 1);

  const fillGeom = new THREE.BufferGeometry();
  fillGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  fillGeom.setIndex(idx);
  fillGeom.computeVertexNormals();

  const fill = new THREE.Mesh(
    fillGeom,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false })
  );

  const outlineGeom = new THREE.BufferGeometry();
  outlineGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const outline = new THREE.LineLoop(
    outlineGeom,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );

  const group = new THREE.Group();
  group.add(fill, outline);
  group.userData.orient = orient;
  return group;
}

export function createPlaneTracker(scene, { debug = false } = {}) {
  // planeId → { group, lastChangedTime }
  const cache = new Map();
  const root = new THREE.Group();
  root.name = 'PlaneTracker';
  scene.add(root);

  let warnedUnsupported = false;

  function update(frame, refSpace) {
    const detected = frame.detectedPlanes;
    if (!detected) {
      if (!warnedUnsupported) {
        console.warn('[planes] detectedPlanes not available on this frame');
        warnedUnsupported = true;
      }
      return;
    }

    const seen = new Set();
    for (const plane of detected) {
      seen.add(plane);
      let entry = cache.get(plane);

      if (!entry || entry.lastChangedTime < plane.lastChangedTime) {
        if (entry) root.remove(entry.group);
        const group = buildPlaneMeshes(plane);
        root.add(group);
        entry = { group, lastChangedTime: plane.lastChangedTime };
        cache.set(plane, entry);
      }

      const pose = frame.getPose(plane.planeSpace, refSpace);
      if (pose) {
        entry.group.visible = true;
        entry.group.matrix.fromArray(pose.transform.matrix);
        entry.group.matrixAutoUpdate = false;
        entry.group.matrixWorldNeedsUpdate = true;
      } else {
        entry.group.visible = false;
      }
    }

    // Drop planes that disappeared from the detected set.
    for (const [plane, entry] of cache) {
      if (!seen.has(plane)) {
        root.remove(entry.group);
        entry.group.traverse((o) => {
          o.geometry?.dispose?.();
          o.material?.dispose?.();
        });
        cache.delete(plane);
      }
    }

    if (debug) root.userData.count = cache.size;
  }

  function count() { return cache.size; }

  // Snapshot of currently visible planes for downstream spawners.
  // matrix is the latest plane→world 4x4 (16 elements) — valid until next update().
  function list() {
    const out = [];
    for (const [plane, entry] of cache) {
      if (!entry.group.visible) continue;
      out.push({
        polygon: plane.polygon,
        orient: entry.group.userData.orient,
        matrix: entry.group.matrix.elements,
      });
    }
    return out;
  }

  return { update, count, list, root };
}
