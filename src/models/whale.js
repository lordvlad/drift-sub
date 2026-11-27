import * as THREE from 'three';
import { loft, fin, tube, blob, mirrorX, merge, resample, hash, smooth } from './kit.js';

/**
 * Baleen whales: humpback and blue whale. Nose +z, body length 1, y up. The shader bends the body up/down (uAxis = y),
 * so the long axis stays on z and flukes are horizontal.
 */

const K = (hex) => new THREE.Color(hex);

/** Smooth 3D value noise (0..1) and a 3-octave fbm of it. */
const vn = (x, y, z) => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const h = (i, j, k) => hash(xi + i + (zi + k) * 57, yi + j + (zi + k) * 113);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(0, 0, 0), h(1, 0, 0), u), l(h(0, 1, 0), h(1, 1, 0), u), v), l(l(h(0, 0, 1), h(1, 0, 1), u), l(h(0, 1, 1), h(1, 1, 1), u), v), w);
};
const fbm = (x, y, z) => vn(x, y, z) * 0.6 + vn(x * 2 + 5.2, y * 2, z * 2) * 0.3 + vn(x * 4, y * 4 + 3.1, z * 4) * 0.1;

/** Returns surf(z, a, grow): a point on the loft surface at body station z and ring angle a (0 = +x, pi/2 = top), pushed out radially by grow. */
function surface(sections, n = 400) {
  const rows = resample(sections.map((s) => [s[0], s[1], s[2], s[3], s[4] ?? 0, s[5] ?? 2]), n);
  return (z, a, grow = 0) => {
    let lo = 0, hi = rows.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rows[m][0] > z) lo = m; else hi = m; }
    const r = Math.abs(rows[lo][0] - z) < Math.abs(rows[hi][0] - z) ? rows[lo] : rows[hi];
    const [, w, top, bot, yo, p] = r, e = 2 / Math.max(0.5, p), co = Math.cos(a), si = Math.sin(a);
    const x = Math.sign(co) * Math.pow(Math.abs(co), e) * w, y = Math.sign(si) * Math.pow(Math.abs(si), e) * (si >= 0 ? top : bot);
    const len = Math.hypot(x, y) || 1;
    return [x + (x / len) * grow, y + yo + (y / len) * grow, z];
  };
}

/** Per-vertex pass over a loft: fn(c, info) recolours (info.k = ring slot) and may return a displacement along the vertex normal. */
function paintBody(g, rings, sides, fn) {
  const P = g.attributes.position, C = g.attributes.color, N = g.attributes.normal, c = new THREE.Color();
  const d = new Float32Array(rings * sides);
  for (let i = 0; i < rings; i++) for (let k = 0; k < sides; k++) {
    const j = i * sides + k, a = (k / sides) * Math.PI * 2;
    c.fromBufferAttribute(C, j);
    d[j] = fn(c, { i, k, t: i / (rings - 1), x: P.getX(j), y: P.getY(j), z: P.getZ(j), s: Math.sin(a), co: Math.cos(a) }) || 0;
    C.setXYZ(j, c.r, c.g, c.b);
  }
  for (let j = 0; j < d.length; j++) if (d[j]) P.setXYZ(j, P.getX(j) + N.getX(j) * d[j], P.getY(j) + N.getY(j) * d[j], P.getZ(j) + N.getZ(j) * d[j]);
  for (const [ap, ring] of [[rings * sides, 0], [rings * sides + 1, rings - 1]]) { // nose / tail apex take their ring's colour
    c.fromBufferAttribute(C, ring * sides + (sides >> 2)); C.setXYZ(ap, c.r, c.g, c.b);
  }
  g.computeVertexNormals();
}

/** Ventral pleat window (0..1): lower flank/belly, from z = zf (front) to z = zb (navel). */
const pleatWin = (z, s, zf, zb) => smooth(-0.1, -0.5, s) * smooth(zf, zf - 0.08, z) * smooth(zb, zb + 0.08, z);

/** Dark slit-like ellipsoid, rotated about y. */
function slit(center, radii, rot, color) {
  const g = blob([0, 0, 0], radii, color, { w: 8, h: 5 });
  g.rotateY(rot); g.translate(center[0], center[1], center[2]);
  return g;
}

/** Mouth line: a thin dark tube hugging the surface along the jaw from the gape (rear) to the snout. */
function mouthLine(surf, side, sm, zRear, zFront, color, r) {
  const pts = [], n = 14;
  for (let i = 0; i < n; i++) {
    const z = zRear + ((zFront - zRear) * i) / (n - 1), s = Math.max(-0.95, Math.min(0.95, sm(z)));
    const a = side > 0 ? Math.asin(s) : Math.PI - Math.asin(s), p = surf(z, a, 0.0008);
    pts.push([p[0], p[1], p[2], r]);
  }
  return tube(pts, { segs: n, sides: 4, color });
}

/** Height of the top surface at lateral offset x for body station z (for things sitting on the head). */
function topAt(sections, z, x) {
  const rows = resample(sections.map((s) => [s[0], s[1], s[2], s[3], s[4] ?? 0, s[5] ?? 2]), 400);
  let lo = 0, hi = rows.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rows[m][0] > z) lo = m; else hi = m; }
  const [, w, top, , yo, p] = rows[lo], e = 2 / Math.max(0.5, p);
  const co = Math.pow(Math.min(1, Math.abs(x) / w), 1 / e), si = Math.sqrt(Math.max(0, 1 - co * co));
  return yo + top * Math.pow(si, e);
}

// ───────────────────────────── humpback ─────────────────────────────

const HUMP_SECTIONS = [
  [0.5, 0.004, 0.004, 0.006, -0.03, 2.2],
  [0.49, 0.04, 0.012, 0.022, -0.03, 2.6],
  [0.46, 0.072, 0.03, 0.045, -0.028, 2.7],
  [0.4, 0.094, 0.052, 0.07, -0.02, 2.6],
  [0.36, 0.103, 0.065, 0.085, -0.016, 2.5],
  [0.28, 0.123, 0.09, 0.115, -0.01, 2.4],
  [0.2, 0.14, 0.115, 0.138, -0.004, 2.3],
  [0.05, 0.15, 0.135, 0.15, 0, 2.2],
  [-0.06, 0.146, 0.138, 0.146, 0, 2.2],
  [-0.14, 0.128, 0.134, 0.125, 0, 2.2],
  [-0.22, 0.104, 0.106, 0.095, 0.004, 2.1],
  [-0.29, 0.078, 0.082, 0.068, 0.008, 2.0],
  [-0.36, 0.052, 0.058, 0.046, 0.01, 2.0],
  [-0.43, 0.032, 0.044, 0.034, 0.012, 2.0],
  [-0.47, 0.02, 0.032, 0.026, 0.012, 2.0],
  [-0.505, 0.008, 0.016, 0.012, 0.012],
];

/** Humpback whale: ~14 m class. Broad tubercled rostrum, throat pleats, long scalloped white flippers, serrated flukes. */
export function humpbackGeometry() {
  const R = 50, S = 48;
  const SL = K(0x1c2530), SL2 = K(0x2e3a47), WH = K(0xf0f2f0), GR = K(0x9aa6b0), DK = K(0x0f1317);
  const body = loft(HUMP_SECTIONS, { rings: R, sides: S, back: 0x1c2530, belly: 0xf0f2f0 });
  const mix = new THREE.Color();
  paintBody(body, R, S, (c, { k, x, y, z, s }) => {
    const n = fbm(x * 9, y * 9, z * 9), n2 = fbm(x * 24 + 3, y * 24, z * 24), n3 = fbm(x * 4 + 9, y * 4, z * 4);
    c.copy(SL).lerp(SL2, smooth(0.35, 0.75, n) * 0.8);
    // lateral/ventral white with an irregular edge; grey and dark blotches inside it
    const edge = -0.1 + 0.4 * (n3 - 0.5), jaw = 1 - 0.5 * smooth(0.28, 0.4, z);
    let belly = smooth(edge + 0.1, edge - 0.3, s) * jaw;
    belly *= 1 - 0.65 * smooth(0.66, 0.78, fbm(x * 6 + 1, y * 6, z * 5));
    c.lerp(mix.copy(WH).lerp(GR, smooth(0.5, 0.8, n2) * 0.5), belly * 0.95);
    // pleats: dark grooves, pale ridges
    const w = pleatWin(z, s, 0.485, -0.1);
    let d = 0;
    if (w > 0) {
      if (k & 1) { c.multiplyScalar(1 - 0.4 * w); d = -0.0048 * w; } else { c.lerp(WH, 0.3 * w); d = 0.0014 * w; }
    }
    return d;
  });

  const parts = [body], surf = surface(HUMP_SECTIONS), TOP = Math.PI / 2, BOT = -Math.PI / 2;

  // mouth lines, eyes, blowholes
  const sm = (z) => -0.22 + 0.3 * smooth(0.42, 0.27, z);
  for (const sd of [1, -1]) {
    parts.push(mouthLine(surf, sd, sm, 0.262, 0.492, DK, 0.0021));
    const e = surf(0.252, sd > 0 ? Math.asin(0.13) : Math.PI - Math.asin(0.13), 0.0005);
    parts.push(blob(e, [0.0055, 0.0055, 0.0065], 0x0e1114, { w: 8, h: 6 }));
    const b = surf(0.205, TOP - sd * 0.12, 0.0005);
    parts.push(slit(b, [0.0038, 0.0022, 0.015], -sd * 0.28, 0x0b0e11));
  }

  // tubercles: staggered rows over the rostrum top, lower-jaw rows and the chin knob
  const knob = (z, a, r, hex) => {
    const p = surf(z, a, r * 0.25);
    parts.push(blob(p, [r, r * 0.9, r], hex, { w: 6, h: 3 }));
  };
  const kc = (i) => (hash(i, 3.3) > 0.8 ? 0xaeb0a8 : 0x3a4652);
  for (let r = 0, z = 0.472; z > 0.25; r++, z -= 0.0235) {
    const set = r & 1 ? [-0.95, -0.32, 0.32, 0.95] : [-0.64, 0, 0.64];
    set.forEach((a, j) => knob(z + 0.004 * (hash(r, j) - 0.5), TOP + a * (1 + 0.1 * (hash(j, r) - 0.5)), 0.0045 + 0.002 * hash(r + 3, j), kc(r * 5 + j)));
  }
  for (let r = 0, z = 0.462; z > 0.31; r++, z -= 0.03) {
    for (const a of [-0.8, -0.35, 0.35, 0.8]) knob(z + 0.005 * (hash(r, a) - 0.5), BOT + a, 0.0042 + 0.0016 * hash(r + 9, a), kc(r * 7 + a * 10));
  }
  knob(0.468, BOT, 0.0115, 0xa9aba3); // chin knob
  knob(0.488, TOP, 0.0065, 0x3a4652);

  // dorsal fin on a hump
  parts.push(fin([
    { le: [0, 0.1, -0.105], te: [0, 0.1, -0.22], t: 0.032 },
    { le: [0, 0.128, -0.118], te: [0, 0.128, -0.212], t: 0.025 },
    { le: [0, 0.152, -0.142], te: [0, 0.152, -0.2], t: 0.016 },
    { le: [0, 0.168, -0.176], te: [0, 0.168, -0.196], t: 0.008 },
  ], { side: [1, 0, 0], span: 8, chord: 7, color: 0x222d38, colorFn: (c, { v }) => c.lerp(GR, 0.25 * v) }));

  // long pectoral flippers: knobby leading edge, white underside
  {
    const N = 28, st = [];
    for (let j = 0; j < N; j++) {
      const v = j / (N - 1), x = 0.11 + 0.34 * v, y = -0.095 - 0.11 * Math.pow(v, 1.3);
      const chord = 0.012 + 0.085 * Math.pow(1 - Math.pow(v, 2.4), 0.6), zle = 0.255 - 0.17 * Math.pow(v, 1.2);
      const bump = 0.0075 * Math.abs(Math.sin(Math.PI * (v * 7.5 + 0.2))) * smooth(0.1, 0.22, v) * (1 - 0.6 * v);
      st.push({ le: [x, y, zle + bump], te: [x, y, zle - chord], t: 0.008 + 0.026 * (1 - v) });
    }
    const fl = fin(st, {
      side: [0, 1, 0], span: N, chord: 6, color: 0xdde2e4,
      colorFn: (c, { u, v, up, p }) => {
        if (up) {
          c.copy(SL2).lerp(WH, smooth(0.55, 1, v) * 0.6 + smooth(0.78, 1, u) * 0.35 * smooth(0.2, 0.5, v));
          if (u < 0.1) c.lerp(SL, 0.5);
        } else {
          c.copy(WH).lerp(GR, 0.18 * (1 - v) + 0.15 * fbm(p.x * 20, p.z * 20, 0.5));
        }
      },
    });
    parts.push(fl, mirrorX(fl));
  }

  // flukes: wide, median notch, serrated trailing edge, mottled white underside
  {
    const X = 0.235, N = 41, st = [];
    for (let j = 0; j < N; j++) {
      const a = Math.abs(-1 + (2 * j) / (N - 1)), x = -X + (2 * X * j) / (N - 1);
      const zle = -0.468 - 0.09 * Math.pow(a, 1.7);
      const chord = 0.112 * Math.pow(Math.max(0, 1 - Math.pow(a, 2.3)), 0.65) - 0.03 * Math.exp(-Math.pow(a / 0.09, 2)) + 0.004;
      const ser = 0.0085 * Math.abs(Math.sin(Math.PI * a * 5.2)) * smooth(0.1, 0.2, a) * (1 - a * a * 0.6);
      const y = 0.012 + 0.014 * a * a;
      st.push({ le: [x, y, zle], te: [x, y, zle - chord - ser], t: 0.006 + 0.014 * (1 - a) });
    }
    parts.push(fin(st, {
      side: [0, 1, 0], span: N, chord: 5, color: 0x222d38,
      colorFn: (c, { u, up, p }) => {
        if (up) { c.copy(SL).lerp(SL2, smooth(0.3, 0.8, fbm(p.x * 10, p.z * 10, 1)) * 0.7); return; }
        const n = fbm(p.x * 13 + 4, p.z * 13, 2);
        c.copy(WH).lerp(SL, smooth(0.52, 0.66, n) * 0.9);
        c.lerp(SL, smooth(0.82, 1, u) * 0.55);
      },
    }));
  }
  return merge(parts);
}

// ───────────────────────────── blue whale ─────────────────────────────

const BLUE_SECTIONS = [
  [0.5, 0.004, 0.004, 0.005, -0.012, 2.2],
  [0.49, 0.035, 0.01, 0.016, -0.012, 2.8],
  [0.465, 0.056, 0.022, 0.032, -0.01, 2.8],
  [0.4, 0.07, 0.036, 0.048, -0.008, 2.6],
  [0.32, 0.079, 0.054, 0.068, -0.005, 2.4],
  [0.22, 0.086, 0.07, 0.082, -0.002, 2.25],
  [0.08, 0.09, 0.082, 0.088, 0, 2.15],
  [-0.06, 0.088, 0.084, 0.086, 0, 2.1],
  [-0.2, 0.076, 0.074, 0.07, 0.003, 2.1],
  [-0.32, 0.056, 0.056, 0.05, 0.006, 2.0],
  [-0.42, 0.036, 0.04, 0.034, 0.009, 2.0],
  [-0.475, 0.024, 0.03, 0.024, 0.01, 2.0],
  [-0.505, 0.011, 0.016, 0.012, 0.011],
];

/** Blue whale: very long and slender, flat U-shaped head with splashguard, tiny far-back dorsal, long ventral pleats, mottled blue-grey. */
export function blueWhaleGeometry() {
  const R = 56, S = 56;
  const BA = K(0x3a4a5e), BB = K(0x60788d), BL = K(0xcfd8da), SP = K(0xa9bfd0), DK = K(0x10161c);
  const body = loft(BLUE_SECTIONS, { rings: R, sides: S, back: 0x3a4a5e, belly: 0xcfd8da });
  paintBody(body, R, S, (c, { i, k, x, y, z, s, t }) => {
    const n = fbm(x * 12, y * 12, z * 12), n2 = fbm(x * 30 + 2, y * 30, z * 30), n3 = fbm(x * 5 + 7, y * 5, z * 4);
    c.copy(BA).lerp(BB, smooth(0.38, 0.78, n) * 0.75);
    c.lerp(BB, smooth(0.55, 0.78, n2) * 0.5);
    c.lerp(BL, 0.18 * smooth(0.4, 0.5, z));                                              // paler head
    const belly = smooth(-0.02 + 0.2 * (n3 - 0.5), -0.5, s);
    c.lerp(BL, belly * 0.8);
    if (hash(i * 7.3, k * 3.1) > 0.94 && s > -0.5) c.lerp(SP, 0.4);                    // light speckles
    const w = pleatWin(z, s, 0.47, -0.06);
    let d = 0;
    if (w > 0) {
      if (k & 1) { c.multiplyScalar(1 - 0.38 * w); d = -0.0032 * w; } else { c.lerp(BL, 0.15 * w); d = 0.001 * w; }
    }
    // rostrum ridge
    const rz = smooth(0.495, 0.46, z) * smooth(0.26, 0.31, z);
    if (rz > 0 && s > 0.98) d += 0.0055 * rz;
    else if (rz > 0 && s > 0.9) d += 0.0015 * rz;
    return d;
  });

  const parts = [body], surf = surface(BLUE_SECTIONS), TOP = Math.PI / 2;

  const sm = (z) => -0.27 + 0.38 * smooth(0.4, 0.27, z);
  for (const sd of [1, -1]) {
    parts.push(mouthLine(surf, sd, sm, 0.262, 0.494, DK, 0.0017));
    const e = surf(0.252, sd > 0 ? Math.asin(0.1) : Math.PI - Math.asin(0.1), 0.0004);
    parts.push(blob(e, [0.0045, 0.0045, 0.005], 0x0e1114, { w: 8, h: 6 }));
    const b = surf(0.28, TOP - sd * 0.14, 0.0005);
    parts.push(slit(b, [0.003, 0.002, 0.014], -sd * 0.3, 0x0b0e11));
  }

  // splashguard: raised arc in front of the blowholes
  {
    const pts = [];
    [[-0.036, 0.265], [-0.027, 0.292], [-0.012, 0.308], [0.012, 0.308], [0.027, 0.292], [0.036, 0.265]].forEach(([x, z]) => {
      pts.push([x, topAt(BLUE_SECTIONS, z, x) + 0.0015, z, 0.0048]);
    });
    parts.push(tube(pts, { segs: 14, sides: 5, color: 0x4a5c70 }));
  }

  // tiny falcate dorsal ~3/4 along
  parts.push(fin([
    { le: [0, 0.05, -0.23], te: [0, 0.05, -0.294], t: 0.016 },
    { le: [0, 0.064, -0.24], te: [0, 0.064, -0.292], t: 0.011 },
    { le: [0, 0.077, -0.254], te: [0, 0.077, -0.296], t: 0.007 },
    { le: [0, 0.09, -0.274], te: [0, 0.09, -0.3], t: 0.003 },
  ], { side: [1, 0, 0], span: 8, chord: 7, color: 0x3a4a5e }));

  // small slim pectorals
  {
    const N = 14, st = [];
    for (let j = 0; j < N; j++) {
      const v = j / (N - 1), x = 0.07 + 0.14 * v, y = -0.058 - 0.05 * Math.pow(v, 1.3);
      const chord = 0.007 + 0.046 * Math.pow(1 - Math.pow(v, 2.2), 0.7), zle = 0.27 - 0.085 * Math.pow(v, 1.2);
      st.push({ le: [x, y, zle], te: [x, y, zle - chord], t: 0.005 + 0.011 * (1 - v) });
    }
    const fl = fin(st, {
      side: [0, 1, 0], span: N, chord: 6, color: 0x3a4a5e,
      colorFn: (c, { up, v }) => { if (up) c.copy(BA).lerp(BB, 0.35 * v); else c.copy(BL).lerp(BA, 0.25 * (1 - v)); },
    });
    parts.push(fl, mirrorX(fl));
  }

  // broad thin flukes, shallow notch
  {
    const X = 0.135, N = 33, st = [];
    for (let j = 0; j < N; j++) {
      const a = Math.abs(-1 + (2 * j) / (N - 1)), x = -X + (2 * X * j) / (N - 1);
      const zle = -0.472 - 0.07 * Math.pow(a, 1.6);
      const chord = 0.082 * Math.pow(Math.max(0, 1 - Math.pow(a, 2.0)), 0.7) - 0.016 * Math.exp(-Math.pow(a / 0.1, 2)) + 0.004;
      st.push({ le: [x, 0.011, zle], te: [x, 0.011, zle - chord], t: 0.004 + 0.009 * (1 - a) });
    }
    parts.push(fin(st, {
      side: [0, 1, 0], span: N, chord: 5, color: 0x3a4a5e,
      colorFn: (c, { up, p }) => {
        if (up) c.copy(BA).lerp(BB, smooth(0.4, 0.8, fbm(p.x * 12, p.z * 12, 1)) * 0.5);
        else c.copy(BL).lerp(BA, 0.35 + 0.3 * fbm(p.x * 14, p.z * 14, 3));
      },
    }));
  }
  return merge(parts);
}
