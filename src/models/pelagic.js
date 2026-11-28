import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loft, fin, tube, blob, mirrorX, merge, hash, smooth, resample, triCount } from './kit.js';

/**
 * Open-water and cave/wreck/reef-labyrinth animals (see src/groups/pelagic.js). Conventions of src/models/kit.js:
 * nose +z, body length ~1 (nose +0.5, tail root -0.5, tail fins reach further), y up, x = left/right, vertex colours.
 * Schooling species (tuna, mahi-mahi, hammerhead, barracuda, bannerfish) stay under ~900 triangles; singles under ~8000.
 */

const C = (hex) => new THREE.Color(hex);
const TAU = Math.PI * 2;

/** Analytic body surface (same spline as the loft) for placing eyes, mouths and gill covers exactly on the skin. */
function surfaceTools(sections) {
  const dense = resample(sections.map((s) => [s[0], s[1], s[2], s[3], s[4] ?? 0, s[5] ?? 2]), 400);
  const rowAt = (z) => { let b = 0, d = 9; for (let i = 0; i < dense.length; i++) { const e = Math.abs(dense[i][0] - z); if (e < d) { d = e; b = i; } } return dense[b]; };
  const surf = (z, a, k = 1) => {
    const [, w, top, bot, yo, p] = rowAt(z), e = 2 / Math.max(0.5, p), co = Math.cos(a), si = Math.sin(a);
    return [Math.sign(co) * Math.pow(Math.abs(co), e) * w * k, Math.sign(si) * Math.pow(Math.abs(si), e) * (si >= 0 ? top : bot) * k + yo, z];
  };
  return { rowAt, surf, top: (z) => { const r = rowAt(z); return r[4] + r[2]; }, bot: (z) => { const r = rowAt(z); return r[4] - r[3]; } };
}

/** Vertical fin in the x = 0 plane from rows [y, leZ, teZ, t] (root -> tip). */
const vfin = (rows, dy = 0, dz = 0) => rows.map(([y, le, te, t]) => ({ le: [0, y + dy, le + dz], te: [0, y + dy, te + dz], t }));
/** Long fin along the back/belly: stations [z, baseY, tipY, t]; the chord runs base -> tip, the span runs along z. */
const strip = (rows) => rows.map(([z, y0, y1, t]) => ({ le: [0, y0, z], te: [0, y1, z - 0.004], t }));
/** Paired fin (right side) from rows [x, y, leZ, teZ, t]. */
const pfin = (rows) => rows.map(([x, y, le, te, t]) => ({ le: [x, y, le], te: [x, y, te], t }));
/** Lunate / forked caudal fin centred on y = dy: z0 = root, half = half span, sweep = how far the tips trail behind, c0/cT = chord at centre / tips. */
function lunate({ z0, half, sweep, c0, cT, t0 = 0.012, tT = 0.004, n = 9, dy = 0, pow = 1.7 }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = -1 + (2 * i) / (n - 1), a = Math.abs(s), le = z0 - sweep * Math.pow(a, pow), ch = c0 + (cT - c0) * a;
    out.push({ le: [0, dy + s * half, le], te: [0, dy + s * half, le - ch], t: t0 + (tT - t0) * a });
  }
  return out;
}
const tip = (c, v, a, b, col, amt = 1) => c.lerp(col, amt * smooth(a, b, v));

/** Eye pair: iris ball with a black pupil and a thin dark rim, sitting on the skin at (z, angle a). */
const L = { lite: false };   // school models: cheaper eyes / lines (set by `school()` below)
const school = (fn) => (o) => { L.lite = true; try { return fn(o); } finally { L.lite = false; } };
function eyes(parts, T, z, a, r, iris = 0xd9b43a, k = 0.985) {
  for (const sx of [1, -1]) {
    const [ex, ey, ez] = T.surf(z, sx > 0 ? a : Math.PI - a, k), out = sx * r * 0.28;
    if (L.lite) {
      parts.push(blob([ex + out * 0.5, ey, ez], [r * 0.55, r, r], iris, { w: 6, h: 4 }));
      parts.push(blob([ex + out * 1.2, ey, ez], [r * 0.4, r * 0.55, r * 0.55], 0x07090a, { w: 5, h: 3 }));
    } else {
      parts.push(blob([ex, ey, ez], [r * 0.5, r * 1.08, r * 1.08], 0x20262a, { w: 10, h: 6 }));
      parts.push(blob([ex + out * 0.7, ey, ez], [r * 0.5, r * 0.96, r * 0.96], iris, { w: 10, h: 6 }));
      parts.push(blob([ex + out * 1.3, ey, ez], [r * 0.38, r * 0.55, r * 0.55], 0x07090a, { w: 8, h: 5 }));
    }
  }
}
/** A thin dark line along the skin: points [z, angle] on the +x side, mirrored for the -x side (joined across the front if `across`). */
function skinLine(parts, T, pts, r, color, k = 0.996, across = false) {
  const R = pts.map(([z, a]) => { const p = T.surf(z, a, k); return [p[0], p[1], p[2], r]; });
  const Lf = pts.map(([z, a]) => { const p = T.surf(z, Math.PI - a, k); return [p[0], p[1], p[2], r]; });
  const sides = L.lite ? 3 : 4;
  if (across) parts.push(tube([...Lf.slice().reverse(), ...R], { segs: pts.length * 2 - 1, sides, color }));
  else parts.push(tube(R, { segs: pts.length, sides, color }), tube(Lf, { segs: pts.length, sides, color }));
}
/** Gill cover arc on both sides: from the top of the head to the throat. */
function gillCover(parts, T, z, bend, a0 = 1.15, a1 = -1.0, r = 0.0018, color = 0x1d2427) {
  const pts = [], n = L.lite ? 3 : 6;
  for (let j = 0; j <= n; j++) { const u = j / n; pts.push([z - bend * Math.sin(u * Math.PI) * 0.5 - 0.004 * u, a0 + (a1 - a0) * u]); }
  skinLine(parts, T, pts, r, color);
}
const merged = (parts) => { const g = merge(parts); g.computeBoundingBox(); return g; };
const noise2 = (a, b) => hash(Math.floor(a), Math.floor(b));

// ===================================================== YELLOWFIN TUNA (school) =====================================================
const TUNA = [
  [0.5, 0.004, 0.004, 0.004, 0], [0.485, 0.02, 0.022, 0.022, -0.002], [0.46, 0.035, 0.04, 0.038, -0.004], [0.42, 0.05, 0.062, 0.054, -0.003],
  [0.36, 0.064, 0.088, 0.078, 0], [0.28, 0.074, 0.108, 0.096, 0], [0.18, 0.08, 0.122, 0.106, 0], [0.06, 0.08, 0.122, 0.104, 0],
  [-0.06, 0.072, 0.108, 0.092, 0], [-0.18, 0.056, 0.082, 0.07, 0], [-0.3, 0.038, 0.052, 0.046, 0], [-0.4, 0.022, 0.03, 0.028, 0],
  [-0.46, 0.014, 0.016, 0.015, 0, 2.5], [-0.5, 0.01, 0.01, 0.01, 0, 2.6],
];
function buildTuna({ rings = 18, sides = 12 } = {}) {
  const T = surfaceTools(TUNA), gold = C(0xe5bb2a), blue = C(0x2b5c90), steel = C(0xcfd8da);
  const body = loft(TUNA, {
    rings, sides, back: 0x10223f, belly: 0xe6ebec,
    colorFn: (c, { z, s }) => {
      c.lerp(blue, 0.35 * smooth(0.3, 0.75, s) * smooth(0.0, 0.9, s));
      const stripe = (1 - smooth(0.05, 0.22, Math.abs(s - 0.04))) * smooth(0.3, 0.2, z) * smooth(-0.5, -0.32, z);
      c.lerp(gold, 1.0 * stripe);
      if (s < -0.25) c.lerp(steel, 0.25 * smooth(-0.25, -0.7, s));
      c.multiplyScalar(0.96 + 0.06 * hash(z * 31, s * 7));
    },
  });
  const parts = [body];
  eyes(parts, T, 0.395, 0.22, 0.0155, 0xc9b24a);
  skinLine(parts, T, [[0.39, -0.28], [0.425, -0.3], [0.46, -0.32], [0.488, -0.3]], 0.0022, 0x1b1718, 0.997, true);
  gillCover(parts, T, 0.325, 0.02);
  const yel = C(0xf1cb2d), yelPale = C(0xe9d867), dark = C(0x2a2720);
  const edge = (col, a, b) => (c, { u, v }) => { c.copy(col); tip(c, u, a, b, dark, 0.8); };
  // first dorsal (spiny, falcate) and the long, sickle-shaped second dorsal / anal fins of the adult yellowfin
  parts.push(fin(vfin([[0.11, 0.17, -0.01, 0.012], [0.15, 0.155, 0.01, 0.009], [0.19, 0.135, 0.05, 0.006], [0.215, 0.125, 0.085, 0.004]]),
    { side: [1, 0, 0], span: 4, chord: 3, color: 0xe0b82f, colorFn: edge(yelPale, 0.7, 1) }));
  parts.push(fin(vfin([[0.1, -0.03, -0.2, 0.01], [0.15, -0.07, -0.21, 0.007], [0.195, -0.14, -0.22, 0.004], [0.222, -0.2, -0.235, 0.003]]),
    { side: [1, 0, 0], span: 4, chord: 3, color: 0xf1cb2d, colorFn: edge(yel, 0.75, 1) }));
  parts.push(fin(vfin([[-0.09, -0.03, -0.2, 0.01], [-0.14, -0.07, -0.21, 0.007], [-0.185, -0.14, -0.22, 0.004], [-0.21, -0.2, -0.235, 0.003]]),
    { side: [1, 0, 0], span: 4, chord: 3, color: 0xf1cb2d, colorFn: edge(yel, 0.75, 1) }));
  for (let i = 0; i < 5; i++) { // finlets above and below the tail stock
    const z = -0.265 - i * 0.04, h = 0.036 - i * 0.003;
    for (const dir of [1, -1]) {
      const y0 = dir > 0 ? T.top(z) - 0.004 : T.bot(z) + 0.004;
      parts.push(fin([{ le: [0, y0, z + 0.014], te: [0, y0, z - 0.004], t: 0.004 }, { le: [0, y0 + h * dir, z - 0.003], te: [0, y0 + h * dir, z - 0.016], t: 0.002 }],
        { side: [1, 0, 0], span: 2, chord: 2, color: 0xf3d12e, colorFn: (c, { v }) => tip(c, v, 0.6, 1, dark, 0.8) }));
    }
  }
  parts.push(fin(lunate({ z0: -0.5, half: 0.17, sweep: 0.15, c0: 0.05, cT: 0.032, n: 7 }), {
    side: [1, 0, 0], span: 7, chord: 3, color: 0x3a4a52,
    colorFn: (c, { u, p }) => { c.lerp(C(0x7d6e2c), 0.35); tip(c, u, 0.7, 1, C(0x1e2428), 0.6); },
  }));
  const pecR = fin(pfin([[0.075, -0.05, 0.26, 0.225, 0.008], [0.15, -0.1, 0.2, 0.13, 0.004], [0.215, -0.14, 0.13, 0.06, 0.0025]]),
    { side: [0.2, 1, 0], span: 3, chord: 3, color: 0xc8b13a, colorFn: (c, { up }) => { if (!up) c.lerp(steel, 0.7); } });
  parts.push(pecR, mirrorX(pecR));
  return merged(parts);
}

// ===================================================== MAHI-MAHI (school) =====================================================
const MAHI = [
  [0.5, 0.012, 0.04, 0.03, -0.01], [0.47, 0.04, 0.09, 0.05, 0.0], [0.42, 0.058, 0.12, 0.07, 0.01], [0.34, 0.066, 0.135, 0.09, 0.01],
  [0.22, 0.07, 0.13, 0.095, 0.005], [0.05, 0.063, 0.108, 0.085, 0], [-0.12, 0.05, 0.078, 0.065, 0], [-0.27, 0.035, 0.05, 0.045, 0],
  [-0.4, 0.02, 0.027, 0.025, 0], [-0.5, 0.011, 0.012, 0.012, 0, 2.5],
];
function buildMahi({ rings = 20, sides = 12 } = {}) {
  const T = surfaceTools(MAHI), gold = C(0xe9c53a), green = C(0x2fa77d), blue = C(0x1c8fd1), spot = C(0x37c8f0);
  const body = loft(MAHI, {
    rings, sides, back: 0x1e9a8c, belly: 0xf1e9a8,
    colorFn: (c, { z, s }) => {
      c.lerp(blue, 0.8 * smooth(0.4, 0.9, s)); c.lerp(green, 0.6 * smooth(0.15, 0.6, s) * (1 - smooth(0.75, 1, s)));
      c.lerp(C(0xffd23a), 0.95 * smooth(0.5, 0.0, s) * smooth(-0.55, -0.3, z));   // golden flank
      if (s < -0.5) c.lerp(C(0xf6efc0), 0.5);
      const dot = hash(Math.floor(z * 46), Math.floor((s + 1) * 6)), inSpots = smooth(0.0, 0.5, s) * (dot > 0.86 ? 1 : 0);
      c.lerp(spot, 0.55 * inSpots);
    },
  });
  const parts = [body];
  eyes(parts, T, 0.385, 0.18, 0.0135, 0xcfa43a);
  skinLine(parts, T, [[0.38, -0.3], [0.43, -0.32], [0.47, -0.3], [0.495, -0.2]], 0.002, 0x20211a, 0.997, true);
  const dors = [];
  for (let i = 0; i <= 9; i++) {   // one long dorsal from above the eye to the tail; tall in front, tapering back
    const z = 0.38 - i * 0.082, h = i === 0 ? 0.05 : 0.055 * Math.pow(1 - (i - 1) / 9, 1.1) + 0.02;
    dors.push([z, T.top(z) - 0.008, T.top(z) + h, 0.006 - i * 0.0003]);
  }
  parts.push(fin(strip(dors), { side: [1, 0, 0], span: 10, chord: 3, color: 0x2a86c9, colorFn: (c, { u }) => { c.lerp(C(0x3aa6b8), 0.4 * smooth(0, 0.7, 1 - u)); tip(c, u, 0.85, 1, C(0x1d5fa0), 0.5); } }));
  const anal = [];
  for (let i = 0; i <= 5; i++) { const z = -0.02 - i * 0.07, h = 0.065 - i * 0.008; anal.push([z, T.bot(z) + 0.006, T.bot(z) - h, 0.005]); }
  parts.push(fin(strip(anal), { side: [1, 0, 0], span: 6, chord: 3, color: 0xe3c63c, colorFn: (c, { u }) => tip(c, u, 0.8, 1, C(0x9a9a52), 0.5) }));
  parts.push(fin(lunate({ z0: -0.5, half: 0.16, sweep: 0.14, c0: 0.07, cT: 0.045, n: 6, pow: 1.5 }), {
    side: [1, 0, 0], span: 6, chord: 3, color: 0xd5cf3a, colorFn: (c, { u }) => tip(c, u, 0.75, 1, C(0x3f7d63), 0.55),
  }));
  const pecR = fin(pfin([[0.07, -0.07, 0.25, 0.21, 0.006], [0.11, -0.095, 0.22, 0.15, 0.004], [0.145, -0.115, 0.185, 0.1, 0.0025]]), { side: [0.2, 1, 0], span: 3, chord: 3, color: 0xcfe0c0 });
  parts.push(pecR, mirrorX(pecR));
  return merged(parts);
}

// ===================================================== GREAT BARRACUDA (school) =====================================================
const BARRA = [
  [0.5, 0.004, 0.004, 0.004, 0], [0.488, 0.014, 0.014, 0.012, -0.002], [0.46, 0.024, 0.026, 0.022, -0.003], [0.42, 0.034, 0.04, 0.032, -0.002],
  [0.36, 0.043, 0.054, 0.044, 0], [0.28, 0.05, 0.064, 0.052, 0], [0.15, 0.052, 0.07, 0.058, 0], [0.0, 0.05, 0.068, 0.058, 0],
  [-0.14, 0.042, 0.056, 0.05, 0], [-0.28, 0.032, 0.04, 0.036, 0], [-0.4, 0.02, 0.024, 0.022, 0], [-0.46, 0.013, 0.015, 0.014, 0, 2.5], [-0.5, 0.01, 0.01, 0.01, 0, 2.6],
];
function buildBarracuda({ rings = 20, sides = 10 } = {}) {
  const T = surfaceTools(BARRA), olive = C(0x7c968f), silver = C(0xe6eeec);
  const body = loft(BARRA, {
    rings, sides, back: 0x6b8780, belly: 0xfafaf6,
    colorFn: (c, { z, s }) => {
      c.lerp(silver, 0.75 * smooth(0.8, 0.05, s)); c.lerp(olive, 0.55 * smooth(0.45, 0.95, s));
      const bar = smooth(0.45, 0.8, 0.5 + 0.5 * Math.sin(z * 58 + s * 2.2)) * smooth(0.0, 0.45, s) * smooth(0.36, 0.25, z) * smooth(-0.42, -0.2, z);
      c.lerp(C(0x1f2a2a), 0.65 * bar);
      const bz = Math.sin((z + 0.4) * 17 * Math.PI), blotch = hash(Math.floor((z + 0.4) * 17), 3) > 0.4 ? 1 : 0;   // dark blotches on the lower rear flank
      c.lerp(C(0x1b2123), 0.7 * blotch * smooth(0.2, 0.6, Math.abs(bz)) * smooth(0.0, -0.2, s) * smooth(-0.85, -0.45, s) * smooth(0.2, 0.0, z) * smooth(-0.4, -0.25, z));
    },
  });
  const parts = [body];
  eyes(parts, T, 0.38, 0.2, 0.012, 0xcaa83a);
  // underslung jaw with a visible gape, tiny fangs and the protruding lower tip
  skinLine(parts, T, [[0.375, -0.26], [0.41, -0.3], [0.445, -0.33], [0.478, -0.3]], 0.002, 0x15191a, 0.997, true);
  parts.push(blob([0, T.bot(0.478) + 0.003, 0.49], [0.007, 0.005, 0.016], 0xd7dcd8, { w: 6, h: 4 }));
  for (let i = 0; i < 4; i++) for (const sx of [1, -1]) {
    const z = 0.405 + i * 0.019, p = T.surf(z, -0.3, 0.97);
    parts.push(tube([[p[0] * sx, p[1] - 0.001, z, 0.0016], [p[0] * sx * 0.96, p[1] - 0.012, z + 0.004, 0.0003]], { segs: 2, sides: 3, color: 0xf3f4ee }));
  }
  gillCover(parts, T, 0.31, 0.016, 1.1, -0.95);
  const fc = (c, { u, v }) => { c.lerp(C(0x44504f), 0.6); };
  parts.push(fin(vfin([[0.07, 0.045, -0.012, 0.007], [0.1, 0.03, -0.01, 0.005], [0.12, 0.02, -0.005, 0.0035]]), { side: [1, 0, 0], span: 3, chord: 3, color: 0x59605b, colorFn: fc }));
  parts.push(fin(vfin([[0.052, -0.265, -0.31, 0.006], [0.085, -0.285, -0.325, 0.004], [0.1, -0.31, -0.335, 0.003]]), { side: [1, 0, 0], span: 3, chord: 3, color: 0x59605b, colorFn: fc }));
  parts.push(fin(vfin([[-0.05, -0.265, -0.31, 0.006], [-0.085, -0.285, -0.325, 0.004], [-0.1, -0.31, -0.335, 0.003]]), { side: [1, 0, 0], span: 3, chord: 3, color: 0x6a706a, colorFn: fc }));
  parts.push(fin(lunate({ z0: -0.5, half: 0.1, sweep: 0.085, c0: 0.06, cT: 0.05, n: 6, pow: 1.2 }), {
    side: [1, 0, 0], span: 6, chord: 3, color: 0x4c5654,
    colorFn: (c, { u, p }) => { tip(c, u, 0.85, 1, C(0xf0f2ee), 0.9 * smooth(0.04, 0.08, Math.abs(p.y))); },
  }));
  const pecR = fin(pfin([[0.05, -0.04, 0.24, 0.215, 0.005], [0.075, -0.06, 0.22, 0.18, 0.004], [0.095, -0.075, 0.2, 0.15, 0.003]]), { side: [0.2, 1, 0], span: 3, chord: 3, color: 0x777e78 });
  parts.push(pecR, mirrorX(pecR));
  return merged(parts);
}

// ===================================================== PENNANT CORALFISH / LONGFIN BANNERFISH (school) =====================================================
const BANNER = [
  [0.5, 0.006, 0.008, 0.006, -0.02], [0.46, 0.02, 0.04, 0.03, -0.02], [0.4, 0.03, 0.09, 0.075, -0.01], [0.3, 0.04, 0.16, 0.14, 0],
  [0.15, 0.045, 0.21, 0.19, 0], [0.0, 0.045, 0.215, 0.19, 0], [-0.15, 0.04, 0.18, 0.16, 0], [-0.28, 0.03, 0.12, 0.11, 0],
  [-0.36, 0.016, 0.05, 0.045, 0], [-0.4, 0.01, 0.02, 0.02, 0],
];
function buildBannerfish({ rings = 26, sides = 8 } = {}) {
  const T = surfaceTools(BANNER), white = C(0xf3f1e6), black = C(0x15141a), yellow = C(0xf0d23a);
  const body = loft(BANNER, {
    rings, sides, back: 0xf3f1e6, belly: 0xf6f3ea,
    colorFn: (c, { z, s }) => {
      c.copy(white);
      const eyeBand = 1 - smooth(0.045, 0.07, Math.abs(z - 0.355));                     // narrow band through the eye
      const mid = smooth(0.2, 0.17, z) * smooth(-0.08, -0.05, z);                       // broad second band under the dorsal spines
      c.lerp(black, 0.96 * Math.max(eyeBand, mid));
      c.lerp(yellow, 0.9 * smooth(-0.14, -0.22, z) * (1 - Math.max(eyeBand, mid)));   // yellow rear body
      c.lerp(C(0xf0d84a), 0.5 * smooth(0.46, 0.5, z));
      c.multiplyScalar(0.97 + 0.04 * hash(z * 41, s * 9));
    },
  });
  const parts = [body];
  eyes(parts, T, 0.355, 0.12, 0.014, 0x2a2a2e);
  skinLine(parts, T, [[0.45, -0.22], [0.48, -0.1], [0.497, -0.05]], 0.0014, 0x2a2420, 0.997);
  // dorsal: tall spiny part and soft part, with the long trailing filament
  const dr = [];
  const hs = [0.08, 0.16, 0.22, 0.25, 0.18, 0.12, 0.09, 0.07, 0.055];
  for (let i = 0; i <= 8; i++) { const z = 0.17 - i * 0.045; dr.push([z, T.top(z) - 0.01, T.top(z) + hs[i], 0.006 - i * 0.0004]); }
  parts.push(fin(strip(dr), { side: [1, 0, 0], span: 9, chord: 3, color: 0xf2efe2, colorFn: (c, { v }) => { if (v < 0.5) c.lerp(black, 0.92 * smooth(0.5, 0.42, v)); else c.lerp(yellow, 0.8); } }));
  const yTop = T.top(0.035) + 0.25;   // the fourth spine is drawn out into the long white filament
  parts.push(tube([[0, yTop, 0.035, 0.0045], [0, yTop + 0.02, -0.2, 0.003], [0, yTop + 0.03, -0.45, 0.002], [0, yTop + 0.02, -0.7, 0.0012]], { segs: 8, sides: 4, color: 0xf4f2ea }));
  const an = [];
  for (let i = 0; i <= 4; i++) { const z = -0.12 - i * 0.045; an.push([z, T.bot(z) + 0.008, T.bot(z) - 0.07 + i * 0.008, 0.005]); }
  parts.push(fin(strip(an), { side: [1, 0, 0], span: 5, chord: 3, color: 0xf0d23a }));
  parts.push(fin(vfin([[0.05, -0.4, -0.5, 0.006], [0.0, -0.4, -0.52, 0.006], [-0.05, -0.4, -0.55, 0.005]]), { side: [1, 0, 0], span: 3, chord: 3, color: 0xf0d84a, colorFn: (c, { u }) => tip(c, u, 0.7, 1, C(0xf4efd2), 0.6) }));
  const pelR = fin(pfin([[0.03, -0.19, 0.2, 0.15, 0.004], [0.04, -0.28, 0.16, 0.1, 0.003], [0.045, -0.38, 0.1, 0.065, 0.002]]), { side: [1, 0.1, 0], span: 3, chord: 3, color: 0x1b1a20 });
  parts.push(pelR, mirrorX(pelR));
  const pecR = fin(pfin([[0.045, -0.04, 0.22, 0.2, 0.004], [0.06, -0.06, 0.2, 0.17, 0.003]]), { side: [0.2, 1, 0], span: 2, chord: 3, color: 0xcfcdbf });
  parts.push(pecR, mirrorX(pecR));
  return merged(parts);
}

// ===================================================== SCALLOPED HAMMERHEAD (school) =====================================================
const HAMMER = [
  [0.47, 0.01, 0.012, 0.012, 0], [0.44, 0.03, 0.022, 0.022, 0], [0.38, 0.05, 0.03, 0.03, 0], [0.3, 0.062, 0.048, 0.05, 0],
  [0.2, 0.07, 0.07, 0.065, 0], [0.08, 0.072, 0.082, 0.072, 0], [-0.05, 0.068, 0.08, 0.07, 0], [-0.2, 0.052, 0.062, 0.052, 0.003],
  [-0.33, 0.034, 0.04, 0.034, 0.005], [-0.43, 0.022, 0.026, 0.02, 0.007, 2.4], [-0.5, 0.016, 0.015, 0.012, 0.008, 2.6],
];
// cephalofoil (right half): scalloped leading edge with the central notch and two lateral indentations, eyes on the tips
const CEPH = [[0.0, 0.452, 0.34, 0.034], [0.03, 0.466, 0.336, 0.034], [0.055, 0.458, 0.332, 0.032], [0.08, 0.452, 0.334, 0.03], [0.1, 0.46, 0.342, 0.027], [0.12, 0.445, 0.352, 0.022], [0.138, 0.415, 0.37, 0.016]];
function buildHammerhead({ rings = 16, sides = 10 } = {}) {
  const T = surfaceTools(HAMMER), top = C(0x6c6a54), flank = C(0x908a6c), belly = C(0xf0eee2);
  const body = loft(HAMMER, {
    rings, sides, back: 0x6c6a54, belly: 0xf0eee2,
    colorFn: (c, { z, s }) => { c.copy(top).lerp(flank, smooth(0.9, 0.1, s)); c.lerp(belly, smooth(0.0, -0.3, s)); c.multiplyScalar(0.97 + 0.05 * hash(z * 53, s * 9)); },
  });
  const parts = [body];
  const wing = fin(CEPH.filter((_, i) => i !== 1 && i !== 4).map(([x, le, te, t]) => ({ le: [x, -0.003, le], te: [x, -0.003, te], t })), {
    side: [0, 1, 0], span: 5, chord: 4, color: 0x77735b,
    colorFn: (c, { up, u }) => { if (!up) c.lerp(belly, 0.9); else c.lerp(top, 0.3); },
  });
  parts.push(wing, mirrorX(wing));
  for (const sx of [1, -1]) {
    parts.push(blob([sx * 0.145, -0.002, 0.402], [0.013, 0.014, 0.017], 0x232019, { w: 6, h: 4 }));
    parts.push(blob([sx * 0.152, -0.002, 0.404], [0.007, 0.009, 0.011], 0x050505, { w: 5, h: 3 }));
  }
  const mp = []; for (let i = 0; i <= 5; i++) { const x = (i / 2.5 - 1) * 0.045; mp.push([x, -0.02, 0.385 - 5.5 * x * x, 0.0025]); }
  parts.push(tube(mp, { segs: 6, sides: 3, color: 0x2a2423 }));
  const d1 = (c, { v }) => { tip(c, v, 0.85, 1, C(0x302f2a), 0.5); };
  parts.push(fin(vfin([[0.07, 0.12, -0.035, 0.014], [0.14, 0.088, -0.025, 0.009], [0.215, 0.045, -0.012, 0.006], [0.25, 0.01, -0.016, 0.004]]), { side: [1, 0, 0], span: 4, chord: 3, color: 0x75725b, colorFn: d1 }));
  parts.push(fin(vfin([[0.035, -0.255, -0.325, 0.01], [0.062, -0.28, -0.335, 0.009], [0.098, -0.325, -0.36, 0.005]]), { side: [1, 0, 0], span: 3, chord: 3, color: 0x75725b }));
  parts.push(fin(vfin([[-0.022, -0.265, -0.335, 0.01], [-0.055, -0.285, -0.34, 0.009], [-0.09, -0.33, -0.365, 0.005]]), { side: [1, 0, 0], span: 3, chord: 3, color: 0x75725b }));
  parts.push(fin(vfin([[0.242, -0.7, -0.712, 0.005], [0.12, -0.565, -0.64, 0.012], [0.02, -0.465, -0.53, 0.016], [-0.105, -0.57, -0.617, 0.008], [-0.125, -0.6, -0.625, 0.005]]),
    { side: [1, 0, 0], span: 5, chord: 3, color: 0x75725b, colorFn: (c, { u }) => tip(c, u, 0.8, 1, C(0x2f2e2a), 0.5) }));
  const pecR = fin(pfin([[0.05, -0.05, 0.22, 0.105, 0.016], [0.16, -0.115, 0.155, 0.073, 0.011], [0.268, -0.2, 0.035, 0.018, 0.004]]),
    { side: [0.57, 0.82, 0], span: 3, chord: 3, color: 0x77735b, colorFn: (c, { v, up }) => { if (!up) c.lerp(belly, 0.8); tip(c, v, 0.7, 1, C(0x2c2b27), up ? 0.5 : 0.9); } });
  parts.push(pecR, mirrorX(pecR));
  const pelR = fin(pfin([[0.03, -0.062, -0.12, -0.18, 0.008], [0.085, -0.1, -0.15, -0.2, 0.004]]), { side: [0.3, 0.95, 0], span: 2, chord: 3, color: 0xb8b8a4 });
  parts.push(pelR, mirrorX(pelR));
  return merged(parts);
}

// ===================================================== SAILFISH (single) =====================================================
const SAIL = [
  [0.5, 0.002, 0.002, 0.002, 0], [0.46, 0.006, 0.006, 0.006, 0], [0.42, 0.01, 0.01, 0.01, 0], [0.38, 0.014, 0.014, 0.013, 0],
  [0.35, 0.022, 0.026, 0.022, -0.003], [0.31, 0.034, 0.044, 0.04, -0.004], [0.25, 0.042, 0.06, 0.052, -0.003], [0.15, 0.047, 0.07, 0.06, 0],
  [0.02, 0.047, 0.07, 0.058, 0], [-0.1, 0.04, 0.058, 0.05, 0], [-0.22, 0.03, 0.04, 0.034, 0], [-0.34, 0.018, 0.022, 0.02, 0],
  [-0.43, 0.01, 0.012, 0.011, 0, 2.6], [-0.48, 0.007, 0.008, 0.007, 0, 2.6], [-0.5, 0.006, 0.006, 0.006, 0, 2.6],
];
export function sailfishGeometry({ rings = 52, sides = 18 } = {}) {
  const T = surfaceTools(SAIL), blue = C(0x2a6fb4), deep = C(0x132c62), pale = C(0xa9cbe9);
  const body = loft(SAIL, {
    rings, sides, back: 0x132c62, belly: 0xe8eef2,
    colorFn: (c, { z, s }) => {
      c.lerp(blue, 0.7 * smooth(-0.3, 0.2, s) * smooth(0.95, 0.5, s));
      const bar = smooth(0.62, 0.85, 0.5 + 0.5 * Math.sin(z * 76)) * smooth(0.55, 0.15, s) * smooth(-0.55, -0.15, s) * smooth(0.28, 0.2, z) * smooth(-0.4, -0.3, z);
      c.lerp(pale, 0.4 * bar);
      c.lerp(deep, 0.55 * smooth(0.34, 0.42, z) * smooth(-0.6, 0.3, s));          // dark bill
      c.multiplyScalar(0.97 + 0.05 * hash(z * 47, s * 11));
    },
  });
  const parts = [body];
  eyes(parts, T, 0.322, 0.28, 0.021, 0xa9965a);
  parts.push(tube([[0, -0.027, 0.33, 0.011], [0, -0.027, 0.362, 0.0075], [0, -0.026, 0.395, 0.0038], [0, -0.025, 0.412, 0.0014]], { segs: 8, sides: 6, color: 0x39445a }));   // lower jaw, shorter than the bill
  skinLine(parts, T, [[0.33, -0.55], [0.345, -0.45], [0.36, -0.4]], 0.003, 0x1b1d22, 0.998);
  gillCover(parts, T, 0.285, 0.014, 1.1, -0.95, 0.0022, 0x14203a);
  // the sail: a huge dorsal reaching from the nape almost to the tail, tallest in front, spotted
  const sail = [], sz = [0.27, 0.23, 0.19, 0.15, 0.1, 0.05, 0.0, -0.05, -0.1, -0.15, -0.2, -0.24], sh = [0.06, 0.13, 0.18, 0.2, 0.2, 0.19, 0.18, 0.16, 0.12, 0.085, 0.05, 0.024];
  sz.forEach((z, i) => sail.push([z, T.top(z) - 0.012, T.top(z) + sh[i], 0.007 - i * 0.0003]));
  parts.push(fin(strip(sail), {
    side: [1, 0, 0], span: 12, chord: 10, color: 0x1a3a78,
    colorFn: (c, { u, v }) => {
      c.lerp(C(0x2f64ab), 0.35 * smooth(0.2, 0.9, 1 - u));
      if (hash(Math.floor(v * 11), Math.floor(u * 7)) > 0.72 && u > 0.2) c.lerp(C(0x070d22), 0.75);
      tip(c, u, 0.9, 1, C(0x0a1430), 0.6);
    },
  }));
  const d2 = []; for (let i = 0; i < 4; i++) { const z = -0.31 - i * 0.025; d2.push([z, T.top(z) - 0.004, T.top(z) + 0.034 - i * 0.007, 0.004]); }
  parts.push(fin(strip(d2), { side: [1, 0, 0], span: 4, chord: 3, color: 0x1b3a72 }));
  for (const [z0, n, h0] of [[-0.2, 5, 0.07], [-0.345, 3, 0.03]]) {
    const an = []; for (let i = 0; i < n; i++) { const z = z0 - i * 0.026; an.push([z, T.bot(z) + 0.006, T.bot(z) - h0 * (1 - i / n * 0.8), 0.004]); }
    parts.push(fin(strip(an), { side: [1, 0, 0], span: n, chord: 3, color: 0x2a4f86 }));
  }
  parts.push(fin(lunate({ z0: -0.5, half: 0.185, sweep: 0.16, c0: 0.055, cT: 0.03, n: 9, t0: 0.01, tT: 0.003 }), {
    side: [1, 0, 0], span: 9, chord: 5, color: 0x1f3f78, colorFn: (c, { u }) => tip(c, u, 0.6, 1, C(0x0d1b3a), 0.6),
  }));
  parts.push(fin([{ le: [-0.03, 0.004, -0.458], te: [-0.03, 0.004, -0.466], t: 0.002 }, { le: [0, 0.004, -0.432], te: [0, 0.004, -0.478], t: 0.01 }, { le: [0.03, 0.004, -0.458], te: [0.03, 0.004, -0.466], t: 0.002 }],
    { side: [0, 1, 0], span: 3, chord: 4, color: 0x1d3a70 }));   // caudal keel on the peduncle
  const pecR = fin(pfin([[0.04, -0.055, 0.21, 0.185, 0.006], [0.08, -0.09, 0.17, 0.13, 0.004], [0.11, -0.13, 0.12, 0.075, 0.0025]]), { side: [0.3, 1, 0], span: 5, chord: 4, color: 0x31568e, colorFn: (c, { up }) => { if (!up) c.lerp(C(0xcfd9e2), 0.6); } });
  parts.push(pecR, mirrorX(pecR));
  const pelR = fin(pfin([[0.012, -0.055, 0.11, 0.1, 0.004], [0.018, -0.08, 0.03, 0.022, 0.003], [0.022, -0.105, -0.07, -0.078, 0.002]]), { side: [1, 0, 0], span: 5, chord: 3, color: 0x22407a });
  parts.push(pelR, mirrorX(pelR));
  return merged(parts);
}

// ===================================================== GREEN MORAY (single) =====================================================
const MORAY = [
  [0.5, 0.005, 0.007, 0.005, 0], [0.49, 0.014, 0.017, 0.012, -0.001], [0.47, 0.026, 0.03, 0.022, -0.002], [0.44, 0.036, 0.044, 0.034, 0],
  [0.4, 0.044, 0.056, 0.044, 0.003], [0.35, 0.05, 0.064, 0.05, 0.005], [0.3, 0.05, 0.064, 0.054, 0.004], [0.2, 0.048, 0.064, 0.058, 0.003],
  [0.05, 0.045, 0.066, 0.052, 0.003], [-0.1, 0.04, 0.064, 0.044, 0.004], [-0.25, 0.032, 0.056, 0.034, 0.004], [-0.38, 0.021, 0.04, 0.022, 0.003],
  [-0.46, 0.011, 0.022, 0.01, 0.002], [-0.5, 0.003, 0.005, 0.003, 0.001],
];
export function morayGeometry({ rings = 64, sides = 20 } = {}) {
  const T = surfaceTools(MORAY), olive = C(0x55601f), yel = C(0xa6a444), dark = C(0x2c3414);
  const body = loft(MORAY, {
    rings, sides, back: 0x4a5420, belly: 0x9a9a46,
    colorFn: (c, { z, s, co }) => {
      const m = hash(Math.floor(z * 34), Math.floor((s + 1) * 4 + co * 2)), m2 = hash(Math.floor(z * 90) + 7, Math.floor((s + 1) * 9));
      c.lerp(yel, 0.6 * smooth(0.45, 0.85, m));        // yellowish mucus mottling over the dark skin
      c.lerp(dark, 0.3 * smooth(0.75, 0.95, m2));
      if (z > 0.3) { c.multiplyScalar(0.84); c.lerp(yel, 0.5 * smooth(-0.1, -0.7, s)); }   // darker head, pale throat
      c.multiplyScalar(0.96 + 0.06 * hash(z * 71, s * 13));
    },
  });
  const parts = [body];
  eyes(parts, T, 0.425, 0.5, 0.0115, 0xd3c14a, 0.99);
  skinLine(parts, T, [[0.488, -0.16], [0.455, -0.2], [0.42, -0.2], [0.38, -0.12], [0.345, -0.02]], 0.0042, 0x1a110c, 0.999);   // wide gape reaching well behind the eye
  for (let i = 0; i < 7; i++) for (const sx of [1, -1]) {                                                                     // needle teeth along the gape
    const z = 0.478 - i * 0.02, p = T.surf(z, -0.2, 0.998);
    parts.push(tube([[p[0] * sx * 0.97, p[1] + 0.001, z, 0.0026], [p[0] * sx * 0.9, p[1] - 0.012, z - 0.003, 0.0004]], { segs: 2, sides: 3, color: 0xf2efe2 }));
  }
  for (const sx of [1, -1]) {
    parts.push(tube([[sx * 0.011, 0.0135, 0.486, 0.0042], [sx * 0.011, 0.0185, 0.494, 0.0032]], { segs: 3, sides: 5, color: 0x6b6f2a }));   // tubular front nostrils
    const p = T.surf(0.455, sx > 0 ? 1.0 : Math.PI - 1.0, 1); parts.push(blob([p[0], p[1] + 0.001, p[2]], [0.0035, 0.0025, 0.0045], 0x20240f, { w: 6, h: 4 }));
    const g = T.surf(0.29, sx > 0 ? 0.1 : Math.PI - 0.1, 1); parts.push(blob([g[0], g[1], g[2]], [0.0045, 0.012, 0.007], 0x161a09, { w: 6, h: 5 }));   // gill opening
  }
  const fz = [0.27, 0.2, 0.1, 0, -0.1, -0.2, -0.3, -0.4, -0.46, -0.5];
  const dfin = fz.map((z, i) => [z, T.top(z) - 0.012, T.top(z) + 0.034 * Math.sin(Math.min(1, (i + 1) / 3) * 1.4) * (1 - smooth(-0.3, -0.5, z)), 0.005]);
  parts.push(fin(strip(dfin), { side: [1, 0, 0], span: 10, chord: 4, color: 0x4f5822, colorFn: (c, { u }) => tip(c, u, 0.7, 1, C(0x23280f), 0.6) }));
  const afin = fz.slice(4).map((z) => [z, T.bot(z) + 0.01, T.bot(z) - 0.03 * (1 - smooth(-0.3, -0.5, z)), 0.004]);
  parts.push(fin(strip(afin), { side: [1, 0, 0], span: afin.length, chord: 4, color: 0x555f24, colorFn: (c, { u }) => tip(c, u, 0.7, 1, C(0x23280f), 0.6) }));
  return merged(parts);
}

// ===================================================== ATLANTIC GOLIATH GROUPER (single) =====================================================
const GROUPER = [
  [0.5, 0.012, 0.012, 0.012, -0.02, 2.2], [0.49, 0.05, 0.045, 0.035, -0.03], [0.465, 0.085, 0.075, 0.07, -0.025], [0.43, 0.11, 0.105, 0.1, -0.015],
  [0.37, 0.128, 0.13, 0.125, -0.005], [0.28, 0.14, 0.15, 0.138, 0], [0.15, 0.142, 0.158, 0.14, 0], [0.0, 0.134, 0.15, 0.135, 0],
  [-0.14, 0.11, 0.125, 0.11, 0], [-0.27, 0.078, 0.09, 0.076, 0], [-0.38, 0.05, 0.058, 0.05, 0], [-0.46, 0.036, 0.042, 0.036, 0, 2.3], [-0.5, 0.03, 0.034, 0.03, 0, 2.4],
];
export function grouperGeometry({ rings = 50, sides = 28 } = {}) {
  const T = surfaceTools(GROUPER), back = C(0x78733a), flank = C(0x9c8e46), belly = C(0xcdbf82), dk = C(0x2c2614);
  const body = loft(GROUPER, {
    rings, sides, back: 0x78733a, belly: 0xcdbf82,
    colorFn: (c, { z, s, co }) => {
      c.copy(back).lerp(flank, smooth(0.85, 0.1, s)).lerp(belly, smooth(0.0, -0.55, s));
      const patch = hash(Math.floor(z * 14), Math.floor((s + 1) * 3 + (co > 0 ? 0 : 5)));
      c.lerp(dk, 0.35 * smooth(0.55, 0.9, patch) * smooth(-0.4, 0.2, s));                         // broad dark blotches
      if (z > 0.22) { const sp = hash(Math.floor(z * 75), Math.floor(co * 7 + s * 7 + 20)); c.lerp(dk, 0.7 * smooth(0.87, 0.93, sp)); }   // freckled head
      c.multiplyScalar(0.95 + 0.08 * hash(z * 61, s * 17));
    },
  });
  const parts = [body];
  eyes(parts, T, 0.385, 0.62, 0.0125, 0xb5973a, 0.99);
  skinLine(parts, T, [[0.49, -0.14], [0.46, -0.15], [0.42, -0.1], [0.385, -0.02], [0.35, 0.06]], 0.005, 0x1b140e, 0.999);      // huge gape ending behind the eye
  skinLine(parts, T, [[0.485, -0.02], [0.45, -0.02], [0.41, 0.03], [0.375, 0.1], [0.345, 0.17]], 0.0035, 0xb4a674, 0.998);    // pale maxilla edge
  gillCover(parts, T, 0.3, 0.02, 1.05, -0.9, 0.003, 0x2a2314);
  for (const sx of [1, -1]) { const n = T.surf(0.43, sx > 0 ? 0.75 : Math.PI - 0.75, 1); parts.push(blob([n[0], n[1], n[2]], [0.004, 0.004, 0.006], 0x211b0d, { w: 6, h: 4 })); }
  const dz = [0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0.0, -0.06, -0.12, -0.19, -0.26, -0.33, -0.4], dh = [0.06, 0.075, 0.085, 0.09, 0.09, 0.085, 0.075, 0.1, 0.11, 0.108, 0.095, 0.075, 0.045];
  const dors = dz.map((z, i) => [z, T.top(z) - 0.012, T.top(z) + dh[i], 0.007]);
  parts.push(fin(strip(dors), { side: [1, 0, 0], span: 13, chord: 6, color: 0x6a6232, colorFn: (c, { u, v }) => { if (hash(Math.floor(v * 16), Math.floor(u * 5)) > 0.8) c.lerp(dk, 0.6); tip(c, u, 0.8, 1, C(0x302a15), 0.5); } }));
  const az = [-0.26, -0.3, -0.34, -0.38, -0.42], ah = [0.07, 0.085, 0.085, 0.07, 0.045];
  parts.push(fin(strip(az.map((z, i) => [z, T.bot(z) + 0.01, T.bot(z) - ah[i], 0.006])), { side: [1, 0, 0], span: 5, chord: 5, color: 0x6a6232, colorFn: (c, { u }) => tip(c, u, 0.7, 1, C(0x302a15), 0.55) }));
  const cs = []; for (let i = 0; i < 11; i++) { const s = -1 + (i * 2) / 10, k = 1 - s * s; cs.push({ le: [0, s * 0.15, -0.49 - 0.02 * Math.abs(s)], te: [0, s * 0.15, -0.51 - 0.16 * Math.pow(k, 0.55)], t: 0.014 - 0.008 * Math.abs(s) }); }
  parts.push(fin(cs, { side: [1, 0, 0], span: 11, chord: 7, color: 0x5e5a30, colorFn: (c, { u, v }) => { if (hash(Math.floor(v * 10), Math.floor(u * 6)) > 0.82) c.lerp(dk, 0.55); tip(c, u, 0.85, 1, C(0x262111), 0.6); } }));
  const pecR = fin(pfin([[0.14, -0.06, 0.22, 0.12, 0.022], [0.2, -0.09, 0.2, 0.04, 0.017], [0.26, -0.12, 0.15, 0.0, 0.011], [0.3, -0.14, 0.08, -0.02, 0.006]]), { side: [0.3, 1, 0], span: 4, chord: 6, color: 0x6c6434, colorFn: (c, { u, up }) => { if (!up) c.lerp(belly, 0.4); tip(c, u, 0.8, 1, C(0x2a2412), 0.5); } });
  parts.push(pecR, mirrorX(pecR));
  const pelR = fin(pfin([[0.05, -0.14, 0.02, -0.05, 0.016], [0.08, -0.19, -0.02, -0.1, 0.012], [0.1, -0.21, -0.04, -0.12, 0.007]]), { side: [0.5, 1, 0], span: 3, chord: 5, color: 0x6a6232 });
  parts.push(pelR, mirrorX(pelR));
  return merged(parts);
}

// ===================================================== HAWKSBILL SEA TURTLE (single) =====================================================
const SHELL = [
  [0.3, 0.05, 0.025, 0.015, 0, 2.2], [0.27, 0.15, 0.06, 0.03, 0.003, 2.2], [0.2, 0.215, 0.09, 0.04, 0.005, 2.2], [0.08, 0.25, 0.105, 0.045, 0.006, 2.2],
  [-0.06, 0.245, 0.103, 0.045, 0.006, 2.2], [-0.18, 0.215, 0.09, 0.04, 0.005, 2.2], [-0.28, 0.16, 0.07, 0.032, 0.004, 2.2], [-0.34, 0.09, 0.045, 0.02, 0.003, 2.2], [-0.375, 0.02, 0.015, 0.01, 0.002, 2.2],
];
const TURTLE_HEAD = [
  [0.5, 0.004, 0.006, 0.005, -0.012], [0.488, 0.02, 0.018, 0.014, -0.01], [0.465, 0.034, 0.03, 0.026, -0.008], [0.43, 0.043, 0.037, 0.034, -0.005],
  [0.38, 0.048, 0.04, 0.04, -0.004], [0.32, 0.05, 0.045, 0.045, -0.003], [0.27, 0.048, 0.045, 0.045, -0.003],
];
export function hawksbillGeometry({ rings = 40, sides = 28 } = {}) {
  const S = surfaceTools(SHELL), H = surfaceTools(TURTLE_HEAD);
  const amber = C(0xb7772a), brown = C(0x5a3517), dark = C(0x25160a), cream = C(0xd9c28a);
  const shell = loft(SHELL, {
    rings, sides, back: 0xb7772a, belly: 0xdcc58a,
    colorFn: (c, { z, x, s }) => {
      if (s < 0.1) { c.copy(cream).lerp(C(0xb79a58), 0.25 * hash(z * 20, x * 20)); return; }              // plastron
      const th = Math.atan2(x, z + 0.12), streak = 0.5 + 0.5 * Math.sin(th * 26 + z * 5 + 3 * Math.sin(z * 17));
      c.copy(amber).lerp(brown, 0.75 * smooth(0.45, 0.9, streak) * smooth(0.0, 0.5, s));              // dark streaks over amber, the tortoiseshell look
      c.lerp(C(0xe0a64a), 0.35 * smooth(0.5, 0.15, streak));
      const seam = Math.max(smooth(0.465, 0.495, Math.abs(((z + 0.4) * 7.5) % 1 - 0.5)), smooth(0.04, 0.0, Math.abs(x) - 0.0) * 0.8);
      c.lerp(dark, 0.7 * seam * smooth(0.2, 0.6, s));                                                  // scute seams: five vertebrals down the middle, costals either side
      c.multiplyScalar(0.95 + 0.1 * hash(z * 33, x * 33));
    },
  });
  const head = loft(TURTLE_HEAD, {
    rings: 18, sides: 14, back: 0x4a3318, belly: 0xc9b077,
    colorFn: (c, { z, s, co }) => { c.lerp(C(0x8a6527), 0.55 * smooth(0.2, 0.7, s)); if (hash(Math.floor(z * 60), Math.floor(co * 6 + s * 6 + 9)) > 0.8) c.lerp(dark, 0.45); if (s < -0.3) c.lerp(cream, 0.7); },
  });
  const parts = [shell, head];
  parts.push(blob([0, -0.018, 0.49], [0.007, 0.011, 0.013], 0x4a3318, { w: 8, h: 5 }));                   // the hooked, bird-like beak
  for (const sx of [1, -1]) {
    const [ex, ey, ez] = H.surf(0.435, sx > 0 ? 0.35 : Math.PI - 0.35, 0.99);
    parts.push(blob([ex, ey, ez], [0.006, 0.013, 0.013], 0x1a1208, { w: 8, h: 5 }), blob([ex + sx * 0.002, ey, ez + 0.001], [0.004, 0.009, 0.009], 0x060403, { w: 6, h: 4 }));
    const nz = H.surf(0.487, sx > 0 ? 0.7 : Math.PI - 0.7, 1); parts.push(blob(nz, [0.0025, 0.0025, 0.003], 0x1a1208, { w: 4, h: 3 }));
    for (let i = 0; i < 8; i++) {                                                                          // serrated rear margin of the carapace
      const z = -0.03 - i * 0.043, r = S.rowAt(z), x = sx * r[1] * 0.985, y = r[4] + 0.004;
      parts.push(tube([[x, y, z, 0.018], [x * 1.03, y - 0.002, z - 0.034, 0.0012]], { segs: 2, sides: 4, color: 0x8a5a22 }));
    }
  }
  const front = fin(pfin([[0.17, -0.01, 0.2, 0.09, 0.03], [0.28, -0.02, 0.18, 0.03, 0.022], [0.4, -0.035, 0.1, -0.04, 0.014], [0.5, -0.05, 0.0, -0.09, 0.009], [0.56, -0.06, -0.07, -0.11, 0.006]]), {
    side: [0, 1, 0], span: 9, chord: 8, color: 0x5d4020,
    colorFn: (c, { u, v, up }) => { if (!up) c.copy(cream).lerp(C(0x9c8a58), 0.4); else { c.lerp(C(0x8a6a30), 0.5 * smooth(0, 0.6, v)); if (hash(Math.floor(u * 6), Math.floor(v * 9)) > 0.72) c.lerp(dark, 0.4); tip(c, u, 0.8, 1, C(0xc7a456), 0.55); } },
  });
  parts.push(front, mirrorX(front));
  const hind = fin(pfin([[0.1, -0.012, -0.28, -0.37, 0.02], [0.17, -0.022, -0.3, -0.4, 0.014], [0.23, -0.032, -0.34, -0.43, 0.008]]), {
    side: [0, 1, 0], span: 5, chord: 5, color: 0x5d4020, colorFn: (c, { up }) => { if (!up) c.copy(cream).lerp(C(0x9c8a58), 0.4); },
  });
  parts.push(hind, mirrorX(hind));
  parts.push(tube([[0, 0.0, -0.36, 0.014], [0, -0.006, -0.4, 0.009], [0, -0.012, -0.43, 0.003]], { segs: 4, sides: 5, color: 0x5a4020 }));
  return merged(parts);
}

// ===================================================== COMMON OCTOPUS (single; arm span ~1) =====================================================
const OCTO = [
  ...[[0.1, 0.045, 0.04, 0.035, 0.07], [0.05, 0.068, 0.06, 0.05, 0.075], [-0.02, 0.084, 0.075, 0.06, 0.085], [-0.1, 0.076, 0.076, 0.056, 0.09], [-0.17, 0.05, 0.056, 0.04, 0.09], [-0.215, 0.012, 0.012, 0.01, 0.086]]
    .map(([z, w, t, b, y]) => [z * 1.3 - 0.02, w * 1.35, t * 1.4, b * 1.4, y * 1.25]),
];
export function octopusGeometry({ rings = 26, sides = 20 } = {}) {
  const T = surfaceTools(OCTO), base = C(0xa6683a), mot = C(0x5d3420), pal = C(0xe0b585);
  const mantle = loft(OCTO, {
    rings, sides, back: 0xa6683a, belly: 0xd9a97c,
    colorFn: (c, { z, s, co }) => {
      const m = hash(Math.floor(z * 46), Math.floor((s + 1) * 6 + co * 3)), m2 = hash(Math.floor(z * 120) + 3, Math.floor((s + 1) * 11 + co * 5));
      c.lerp(mot, 0.8 * smooth(0.5, 0.9, m) * smooth(-0.3, 0.3, s)); c.lerp(pal, 0.55 * smooth(0.75, 0.92, m2));   // mottled, speckled with pale papillae
    },
  });
  const parts = [mantle];
  for (const sx of [1, -1]) {                                       // bulging eyes with horizontal slit pupils
    const e = [sx * 0.075, 0.15, 0.085];
    parts.push(blob(e, [0.03, 0.034, 0.034], 0x8a5a2c, { w: 10, h: 7 }));
    parts.push(blob([e[0] + sx * 0.012, e[1] + 0.003, e[2] + 0.014], [0.02, 0.023, 0.023], 0xc9a45c, { w: 8, h: 6 }));
    parts.push(blob([e[0] + sx * 0.02, e[1] + 0.003, e[2] + 0.023], [0.006, 0.004, 0.015], 0x090604, { w: 6, h: 4 }));
  }
  parts.push(tube([[0.035, 0.04, 0.1, 0.014], [0.046, 0.034, 0.122, 0.01], [0.058, 0.03, 0.138, 0.007]], { segs: 3, sides: 6, color: 0xb87a46 }));   // siphon
  const th = [0.3, -0.3, 0.8, -0.8, 1.5, -1.5, 2.35, -2.35];
  th.forEach((a, i) => {
    const L = [0.4, 0.4, 0.44, 0.44, 0.4, 0.4, 0.36, 0.36][i], dx = Math.sin(a), dz = Math.cos(a), px = dz, pz = -dx, pts = [];
    const sw = (i % 2 ? -1 : 1) * (0.05 + 0.03 * hash(i, 3)), curl = (i % 2 ? -1 : 1) * 0.13;
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, d = 0.05 + L * t, lat = sw * Math.sin(t * 3.4 + i) + curl * t * t * t;
      const x = dx * d + px * lat, z = dz * d + pz * lat - 0.02, r = 0.04 * Math.pow(1 - t, 0.85) + 0.003;
      const y = r + 0.004 + 0.05 * Math.max(0, 1 - t * 4) + (t > 0.78 ? 0.09 * (t - 0.78) * (t - 0.78) * 14 : 0);
      pts.push([x, y, z, r]);
    }
    parts.push(tube(pts, { segs: 14, sides: 6, color: 0xa6683a, colorFn: (c, { v, s }) => {
      const m = hash(Math.floor(v * 16) + i * 5, Math.floor((s + 1) * 2.5));
      c.lerp(mot, 0.4 * smooth(0.5, 0.9, m) + 0.25 * smooth(0.2, 0.9, v) * smooth(-0.2, 0.8, s)); c.lerp(pal, 0.55 * smooth(0.3, -0.8, s) + 0.25 * smooth(0.85, 0.95, m));
    } }));
  });
  return merged(parts);
}

// ===================================================== DEN ROCK (a boulder with a hole; the moray looks out of it) =====================================================
const vn = (x, y, z) => {   // smooth value noise
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = (t) => t * t * (3 - 2 * t), u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const h = (a, b, c) => hash(a * 12.9 + c * 78.2, b * 37.7 + c * 11.1);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v), l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
};
/** Unit boulder (about radius 1, flattened to 0.75 in y), opening toward +z. */
export function denRockGeometry({ seed = 0 } = {}) {
  const g = new THREE.SphereGeometry(1, 28, 18); g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3), c = new THREE.Color();
  const grey = C(0x74705f), moss = C(0x4f6a3a), pink = C(0xb2667a), deep = C(0x090a0c), sand = C(0x9a917a);
  for (let i = 0; i < n; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    let r = 1 + 0.28 * (vn(x * 2.1 + seed, y * 2.1, z * 2.1) - 0.5) * 2 + 0.1 * (vn(x * 5.3, y * 5.3 + seed, z * 5.3) - 0.5) * 2;
    const d = x * 0.0 + y * 0.12 + z * 0.99, hole = smooth(0.8, 0.965, d);
    r *= 1 - 0.62 * hole;
    p.setXYZ(i, x * r, y * r * 0.75, z * r);
    c.copy(grey).lerp(sand, 0.4 * vn(x * 3 + 9, y * 3, z * 3)).multiplyScalar(0.85 + 0.3 * vn(x * 7, y * 7, z * 7 + seed));
    c.lerp(moss, 0.65 * smooth(0.1, 0.8, y) * vn(x * 4, y * 4 + 3, z * 4));
    if (vn(x * 9 + 4, y * 9, z * 9) > 0.72) c.lerp(pink, 0.55);   // encrusting coralline algae
    c.lerp(deep, smooth(0.5, 0.9, hole) * 0.97);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = mergeVertices(g, 1e-4); m.computeVertexNormals(); m.computeBoundingBox();
  return m;
}

export const tunaGeometry = school(buildTuna), mahiGeometry = school(buildMahi), barracudaGeometry = school(buildBarracuda), bannerfishGeometry = school(buildBannerfish), hammerheadGeometry = school(buildHammerhead);
export { triCount };
