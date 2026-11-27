import * as THREE from 'three';
import { loft, fin, tube, blob, mirrorX, merge, hash, resample } from './kit.js';

/**
 * Squid models. Mantle at +z, head behind it, arms and feeding tentacles trailing toward -z; y up, x = left/right.
 * Vertex colours are light / fairly neutral: the game multiplies them by a per-use tint.
 */

const pair = (g) => [g, mirrorX(g)];

/**
 * Suckers on the oral (inward-facing) side of an arm / tentacle: two rows of small blobs along the spline.
 * points: same [x, y, z, radius] rows as the tube. u0..u1 = fraction of the path covered, n per row.
 */
function suckerRows(points, { u0, u1, n, scale, color, rows = [-0.5, 0.5], w = 5, h = 3, push = 0.9 }) {
  const S = resample(points, 80), out = [];
  const tan = new THREE.Vector3(), oral = new THREE.Vector3(), side = new THREE.Vector3(), P = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    const u = u0 + ((u1 - u0) * k) / Math.max(1, n - 1), f = u * 79, i = Math.min(78, Math.floor(f)), t = f - i;
    const a = S[i], b = S[i + 1], c = S[Math.min(79, i + 2)], d = S[Math.max(0, i - 1)];
    P.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
    const r = a[3] + (b[3] - a[3]) * t;
    tan.set(c[0] - d[0], c[1] - d[1], c[2] - d[2]).normalize();
    oral.set(-P.x, -P.y, 0); if (oral.lengthSq() < 1e-8) oral.set(0, -1, 0);
    oral.normalize(); oral.addScaledVector(tan, -oral.dot(tan)).normalize();
    side.crossVectors(tan, oral);
    rows.forEach((off, ri) => {
      const stagger = ri % 2 ? 0.5 : 0, uu = Math.min(1, u + stagger * (u1 - u0) / Math.max(1, n - 1) * 0.5);
      const q = P.clone().addScaledVector(oral, r * push).addScaledVector(side, r * off).addScaledVector(tan, (uu - u) * 0.3);
      out.push(blob([q.x, q.y, q.z], [r * scale, r * scale, r * scale], color, { w, h }));
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Small schooling squid (bigfin reef squid / firefly squid)
// ---------------------------------------------------------------------------------------------------------------------------

/** Small schooling squid, instanced in schools: <= 1200 triangles. Cream/white with chromatophore speckles. */
export function squidGeometry() {
  const mantle = loft([
    [0.5, 0.004, 0.004, 0.004],
    [0.47, 0.03, 0.028, 0.026],
    [0.4, 0.056, 0.052, 0.048],
    [0.28, 0.07, 0.065, 0.06],
    [0.1, 0.07, 0.066, 0.06],
    [0.0, 0.062, 0.058, 0.054],
    [-0.04, 0.05, 0.05, 0.046],
    [-0.08, 0.054, 0.05, 0.046],
    [-0.115, 0.046, 0.044, 0.04],
    [-0.145, 0.026, 0.026, 0.026],
    [-0.158, 0.004, 0.004, 0.004],
  ], {
    rings: 20, sides: 10, back: 0xcfbfab, belly: 0xf6f0e6,
    colorFn: (c, { z, s, co, t }) => {
      if (z > -0.04 && hash(Math.round(z * 60), Math.round(co * 6 + s * 4)) > 0.62) c.multiplyScalar(s > 0 ? 0.66 : 0.88);  // chromatophore speckles
      if (z > 0.38) c.multiplyScalar(0.94);
    },
  });

  const parts = [mantle];

  // big oval fins running along most of the mantle (horizontal, thickness in y)
  const finStations = [
    { le: [0.03, 0, 0.46], te: [0.03, 0, 0.12], t: 0.012 },
    { le: [0.08, 0, 0.45], te: [0.08, 0, 0.08], t: 0.01 },
    { le: [0.125, 0, 0.4], te: [0.125, 0, 0.13], t: 0.007 },
    { le: [0.15, 0, 0.33], te: [0.15, 0, 0.21], t: 0.004 },
    { le: [0.155, 0, 0.28], te: [0.155, 0, 0.25], t: 0.002 },
  ];
  const f = fin(finStations, { side: [0, 1, 0], span: 5, chord: 5, color: 0xd9cdbd,
    colorFn: (c, { u, v }) => { c.lerp(new THREE.Color(0xd0c2b2), smoothEdge(v)); if (hash(Math.round(u * 8), Math.round(v * 9)) > 0.86) c.multiplyScalar(0.85); } });
  parts.push(...pair(f));

  // eyes: big, bulging from the sides of the head
  for (const sd of [-1, 1]) {
    parts.push(blob([sd * 0.052, -0.004, -0.088], [0.022, 0.03, 0.032], 0x4c4850, { w: 7, h: 5 }));
    parts.push(blob([sd * 0.068, -0.004, -0.088], [0.012, 0.018, 0.019], 0x14121a, { w: 5, h: 3 }));
  }

  // 8 arms, ventral ones longest; slight outward flare at the ends
  const armCol = 0xe9dfd3;
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2 + Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a) * 0.8;
    const len = 0.31 - 0.07 * Math.max(0, sa) + 0.04 * Math.max(0, -sa) + 0.02 * hash(i, 3), z1 = -0.12 - len;
    parts.push(tube([
      [ca * 0.018, sa * 0.018, -0.115, 0.016],
      [ca * 0.034, sa * 0.034, -0.18, 0.0125],
      [ca * 0.043 + 0.004 * Math.sin(i * 2.3), sa * 0.043, (-0.18 + z1) / 2, 0.0085],
      [ca * 0.034, sa * 0.034, z1, 0.002],
    ], { segs: 5, sides: 4, color: armCol, colorFn: (c, { v }) => { c.lerp(new THREE.Color(0xd8c8b8), v * 0.6); } }));
  }

  // 2 longer feeding tentacles with clubs, between the ventral arms
  for (const sd of [-1, 1]) {
    parts.push(tube([
      [sd * 0.012, -0.018, -0.12, 0.009],
      [sd * 0.02, -0.025, -0.24, 0.0055],
      [sd * 0.03, -0.012, -0.37, 0.0045],
      [sd * 0.04, 0.0, -0.46, 0.0045],
      [sd * 0.044, 0.003, -0.5, 0.011],
      [sd * 0.045, 0.004, -0.55, 0.013],
      [sd * 0.044, 0.003, -0.59, 0.009],
      [sd * 0.042, 0.002, -0.64, 0.002],
    ], { segs: 10, sides: 4, color: 0xe2d6c8, colorFn: (c, { v }) => { if (v > 0.65) c.lerp(new THREE.Color(0xc9a898), 0.5); } }));
  }
  return merge(parts);
}

const smoothEdge = (v) => Math.pow(Math.min(1, Math.max(0, v)), 2) * 0.5;

// ---------------------------------------------------------------------------------------------------------------------------
// Giant squid (Architeuthis)
// ---------------------------------------------------------------------------------------------------------------------------

/** Giant squid: <= 9000 triangles. Reddish-copper dorsum, paler ventrally. */
export function giantSquidGeometry() {
  const BACK = 0xb9633f, BELLY = 0xe9c8ae;
  const mantle = loft([
    [0.5, 0.003, 0.003, 0.003],
    [0.485, 0.016, 0.016, 0.014],
    [0.45, 0.032, 0.032, 0.03],
    [0.38, 0.048, 0.047, 0.045],
    [0.28, 0.058, 0.057, 0.054],
    [0.14, 0.063, 0.062, 0.058],
    [0.03, 0.062, 0.06, 0.057],
    [-0.005, 0.052, 0.05, 0.05],      // mantle opening / neck
    [-0.03, 0.05, 0.05, 0.046],       // head
    [-0.065, 0.054, 0.05, 0.046],
    [-0.09, 0.044, 0.042, 0.04],
    [-0.108, 0.026, 0.026, 0.026],
    [-0.118, 0.004, 0.004, 0.004],
  ], {
    rings: 34, sides: 16, back: BACK, belly: BELLY,
    colorFn: (c, { z, s, co }) => {
      const h = hash(Math.round(z * 90), Math.round((co * 7 + s * 5)));
      if (s > -0.1 && h > 0.74) c.multiplyScalar(0.82);                                     // dark chromatophore blotches
      else if (h < 0.1) c.lerp(new THREE.Color(0xf0dcc8), 0.35);                           // pale scars / speckle
      if (z > 0.04) c.lerp(new THREE.Color(0xa24c32), 0.22 * Math.max(0, s));              // deeper red along the dorsal ridge
    },
  });
  const parts = [mantle];

  // small rhomboid terminal fins at the mantle tip
  const fs = [
    { le: [0.02, 0, 0.5], te: [0.02, 0, 0.3], t: 0.008 },
    { le: [0.06, 0, 0.47], te: [0.06, 0, 0.32], t: 0.007 },
    { le: [0.105, 0, 0.42], te: [0.105, 0, 0.355], t: 0.0045 },
    { le: [0.12, 0, 0.395], te: [0.12, 0, 0.385], t: 0.002 },
  ];
  const f = fin(fs, { side: [0, 1, 0], span: 6, chord: 6, color: 0xc7714d,
    colorFn: (c, { up }) => { if (!up) c.lerp(new THREE.Color(BELLY), 0.5); } });
  parts.push(...pair(f));

  // funnel (siphon) under the head
  parts.push(tube([[0, -0.048, 0.01, 0.014], [0, -0.056, -0.03, 0.012], [0, -0.054, -0.075, 0.008]], { segs: 5, sides: 8, color: 0xd9a888 }));

  // huge eyes
  for (const sd of [-1, 1]) {
    parts.push(blob([sd * 0.048, 0.002, -0.048], [0.03, 0.043, 0.045], 0x4a3f43, { w: 14, h: 10 }));
    parts.push(blob([sd * 0.074, 0.002, -0.048], [0.012, 0.025, 0.026], 0x0b080b, { w: 10, h: 7 }));
  }

  // 8 thick arms with two rows of suckers on the oral side
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2 + Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a) * 0.82;
    const len = 0.24 + 0.05 * (0.5 + 0.5 * -sa) + 0.02 * hash(i, 7), z1 = -0.08 - len;
    const sw = Math.sin(i * 2.1) * 0.012, sw2 = Math.cos(i * 1.7) * 0.012;
    const pts = [
      [ca * 0.026, sa * 0.026, -0.07, 0.026],
      [ca * 0.05, sa * 0.05, -0.13, 0.023],
      [ca * 0.068 + sw, sa * 0.066 + sw2 * 0.5, -0.1 - len * 0.45, 0.0185],
      [ca * 0.078 + sw * 1.6, sa * 0.074 + sw2, -0.1 - len * 0.75, 0.011],
      [ca * 0.08 + sw * 1.2, sa * 0.076 + sw2 * 1.2, z1, 0.0015],
    ];
    parts.push(tube(pts, { segs: 12, sides: 6, color: 0xc4724e,
      colorFn: (c, { v, s }) => { c.lerp(new THREE.Color(0xd99772), v * 0.5); c.multiplyScalar(0.92 + 0.14 * hash(Math.round(v * 40), Math.round(s * 4))); } }));
    parts.push(...suckerRows(pts, { u0: 0.22, u1: 0.94, n: 9, scale: 0.5, color: 0xf2d7c0, rows: [-0.8, 0.8], push: 0.8 }));
  }

  // 2 very long feeding tentacles with expanded, sucker-covered clubs
  for (const sd of [-1, 1]) {
    const pts = [
      [sd * 0.016, -0.016, -0.075, 0.013],
      [sd * 0.026, -0.022, -0.2, 0.0095],
      [sd * 0.036, -0.02, -0.4, 0.0075],
      [sd * 0.058, -0.004, -0.62, 0.0068],
      [sd * 0.082, 0.014, -0.82, 0.007],
      [sd * 0.092, 0.018, -0.91, 0.0115],     // club begins (carpus)
      [sd * 0.094, 0.014, -0.97, 0.026],
      [sd * 0.09, 0.008, -1.03, 0.0275],
      [sd * 0.084, 0.003, -1.08, 0.017],
      [sd * 0.08, 0.0, -1.115, 0.002],
    ];
    parts.push(tube(pts, { segs: 28, sides: 6, color: 0xc4724e,
      colorFn: (c, { v }) => { c.lerp(new THREE.Color(0xd99a76), Math.min(1, v * 1.2) * 0.55); } }));
    // sucker rows on the club (and a few larger ones on the manus); oral face points to the middle of the body
    parts.push(...suckerRows(pts, { u0: 0.7, u1: 0.95, n: 10, scale: 0.3, color: 0xf2d7c0, rows: [-0.5, 0.5] }));
  }
  return merge(parts);
}
