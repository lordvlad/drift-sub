import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Modelling kit for creature geometry. Conventions shared by every creature model:
 * - nose points +z, body length 1 (nose tip ~ +0.5, tail root ~ -0.5; tail fins may extend further), y up, x = animal's left/right;
 * - output: indexed BufferGeometry with `position`, `normal`, `color` (vertex colours are multiplied by the material / instance tint);
 * - the creature shader bends vertices with z < 0.25 (tail wave), so keep the body's long axis on z.
 */

export const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const cr = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};
/** Catmull-Rom resample of equal-length numeric tuples to n rows (first and last rows are kept exactly). */
export function resample(rows, n) {
  const m = rows.length; if (m < 2 || n < 2) return rows.map((r) => r.slice());
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * (m - 1), k = Math.min(m - 2, Math.floor(u)), t = u - k;
    const r0 = rows[Math.max(0, k - 1)], r1 = rows[k], r2 = rows[k + 1], r3 = rows[Math.min(m - 1, k + 2)];
    out.push(r1.map((_, j) => cr(r0[j], r1[j], r2[j], r3[j], t)));
  }
  return out;
}

function geometry(pos, col, idx, orientTo) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  if (orientTo) { // make the first triangle face `orientTo`; flip all if not
    const a = new THREE.Vector3().fromArray(pos, idx[0] * 3), b = new THREE.Vector3().fromArray(pos, idx[1] * 3), c = new THREE.Vector3().fromArray(pos, idx[2] * 3);
    const n = b.sub(a).cross(c.sub(a));
    if (n.dot(orientTo) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); }
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Smooth body. sections: [z, halfWidth, top, bottom, yOffset = 0, squareness = 2], nose first (z descending).
 * Each ring is a superellipse (squareness 2 = ellipse, >2 boxier, <2 diamond-ish) whose upper half has height `top`
 * and lower half `bottom`, centred at yOffset. Rows are spline-interpolated to `rings`, so a handful of sections suffice.
 * colorFn(c, info): info = { z, t (0 nose .. 1 tail), s = sin(angle) (+1 dorsal, -1 ventral), co = cos(angle) (+1 = +x side), x, y }.
 */
export function loft(sections, { rings = 40, sides = 24, back = 0x777777, belly = 0xffffff, colorFn } = {}) {
  const rows = resample(sections.map((s) => [s[0], s[1], s[2], s[3], s[4] ?? 0, s[5] ?? 2]), rings);
  const pos = [], col = [], idx = [], c = new THREE.Color(), cb = new THREE.Color(back), cl = new THREE.Color(belly);
  rows.forEach(([z, w, top, bot, yo, p], i) => {
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2, co = Math.cos(a), si = Math.sin(a), e = 2 / Math.max(0.5, p);
      const x = Math.sign(co) * Math.pow(Math.abs(co), e) * Math.max(0, w);
      const y = Math.sign(si) * Math.pow(Math.abs(si), e) * Math.max(0, si >= 0 ? top : bot) + yo;
      pos.push(x, y, z);
      c.copy(cb).lerp(cl, smooth(0.15, -0.35, si));
      if (colorFn) colorFn(c, { z, t: i / (rings - 1), s: si, co, x, y });
      col.push(c.r, c.g, c.b);
    }
  });
  for (let i = 0; i < rings - 1; i++) for (let k = 0; k < sides; k++) {
    const a = i * sides + k, b = i * sides + ((k + 1) % sides), d = a + sides, e = b + sides;
    idx.push(a, d, b, b, d, e);
  }
  // close nose and tail with an apex vertex each
  for (const [ring, flip] of [[0, true], [rings - 1, false]]) {
    const r = rows[ring], ap = pos.length / 3;
    pos.push(0, r[4], r[0] + (flip ? 1e-4 : -1e-4));
    col.push(col[ring * sides * 3], col[ring * sides * 3 + 1], col[ring * sides * 3 + 2]);
    for (let k = 0; k < sides; k++) { const a = ring * sides + k, b = ring * sides + ((k + 1) % sides); flip ? idx.push(ap, a, b) : idx.push(ap, b, a); }
  }
  return geometry(pos, col, idx);
}

/**
 * Fin / flipper / fluke with real thickness and a rounded airfoil section.
 * stations: [{ le: [x,y,z], te: [x,y,z], t }] from root to tip (leading edge, trailing edge, max thickness); spline-interpolated.
 * side: thickness direction (normal of the fin plane), e.g. [1,0,0] for a vertical fin, [0,1,0] for a horizontal fluke.
 * colorFn(c, { u (0 leading .. 1 trailing edge), v (0 root .. 1 tip), up (true on the +side surface), p: THREE.Vector3 }).
 */
export function fin(stations, { side = [1, 0, 0], span = 10, chord = 8, color = 0x777777, colorFn } = {}) {
  const rows = resample(stations.map((s) => [...s.le, ...s.te, s.t]), Math.max(stations.length, span));
  const n = new THREE.Vector3(...side).normalize(), base = new THREE.Color(color), c = new THREE.Color(), p = new THREE.Vector3();
  const parts = [];
  for (const up of [1, -1]) {
    const pos = [], col = [], idx = [];
    rows.forEach((r, j) => {
      for (let i = 0; i <= chord; i++) {
        const u = (1 - Math.cos((Math.PI * i) / chord)) / 2;             // cosine spacing: detail at both edges
        const th = r[6] * 0.5 * Math.min(1, 2.6 * Math.sqrt(u) * (1 - u)) * up;
        p.set(r[0] + (r[3] - r[0]) * u, r[1] + (r[4] - r[1]) * u, r[2] + (r[5] - r[2]) * u).addScaledVector(n, th);
        pos.push(p.x, p.y, p.z);
        c.copy(base); if (colorFn) colorFn(c, { u, v: j / (rows.length - 1), up: up > 0, p });
        col.push(c.r, c.g, c.b);
      }
    });
    const W = chord + 1;
    for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < chord; i++) {
      const a = j * W + i, b = a + 1, d = a + W, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
    parts.push(geometry(pos, col, idx, n.clone().multiplyScalar(up)));
  }
  return mergeGeometries(parts, false);
}

/**
 * Tapered tube along a spline (arms, tentacles, barbels). points: [[x, y, z, radius], ...]; the end is closed.
 * colorFn(c, { v (0 start .. 1 end), s, co }).
 */
export function tube(points, { segs = 16, sides = 6, color = 0x777777, colorFn } = {}) {
  const rows = resample(points, Math.max(points.length, segs));
  const pos = [], col = [], idx = [], base = new THREE.Color(color), c = new THREE.Color();
  const P = rows.map((r) => new THREE.Vector3(r[0], r[1], r[2]));
  let nrm = null; const tan = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Vector3();
  rows.forEach((r, j) => {
    tan.subVectors(P[Math.min(j + 1, P.length - 1)], P[Math.max(j - 1, 0)]).normalize();
    if (!nrm) { nrm = Math.abs(tan.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0); }
    nrm.sub(q.copy(tan).multiplyScalar(nrm.dot(tan))).normalize();     // parallel transport
    b.crossVectors(tan, nrm);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2, co = Math.cos(a), si = Math.sin(a), rad = Math.max(0, r[3]);
      pos.push(P[j].x + (nrm.x * si + b.x * co) * rad, P[j].y + (nrm.y * si + b.y * co) * rad, P[j].z + (nrm.z * si + b.z * co) * rad);
      c.copy(base); if (colorFn) colorFn(c, { v: j / (rows.length - 1), s: si, co });
      col.push(c.r, c.g, c.b);
    }
  });
  for (let j = 0; j < rows.length - 1; j++) for (let k = 0; k < sides; k++) {
    const a = j * sides + k, bb = j * sides + ((k + 1) % sides);
    idx.push(a, bb, a + sides, bb, bb + sides, a + sides);
  }
  const last = rows.length - 1, ap = pos.length / 3, e = P[last].clone().addScaledVector(tan, rows[last][3]);
  pos.push(e.x, e.y, e.z); col.push(col[last * sides * 3], col[last * sides * 3 + 1], col[last * sides * 3 + 2]);
  for (let k = 0; k < sides; k++) idx.push(last * sides + k, last * sides + ((k + 1) % sides), ap);
  return geometry(pos, col, idx);
}

/** Ellipsoid blob (eyes, knobs, suckers). */
export function blob(center, radii, color, { w = 10, h = 7 } = {}) {
  const g = new THREE.SphereGeometry(1, w, h); g.deleteAttribute('uv');
  g.scale(radii[0], radii[1], radii[2]); g.translate(center[0], center[1], center[2]);
  const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Mirror a part across x (left/right pair). */
export function mirrorX(g) {
  const m = g.clone(); m.scale(-1, 1, 1);
  const ix = m.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  m.index.needsUpdate = true; m.computeVertexNormals();
  return m;
}

/** Merge parts into one indexed geometry (position, normal, color). */
export function merge(parts) {
  const clean = parts.map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g.index ? g : g; });
  const out = mergeGeometries(clean, false);
  out.computeBoundingSphere();
  return out;
}

export const triCount = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
