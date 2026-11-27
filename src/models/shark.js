import * as THREE from 'three';
import { loft, fin, tube, blob, mirrorX, merge, hash, smooth, resample } from './kit.js';

/**
 * Requiem shark (Carcharhinidae). One shared build, three variants:
 *   'blacktip' - slender, pointed snout, black fin tips, pale flank wedge
 *   'greyreef' - grey-bronze back, broad black trailing margin on the tail, dark pectoral tips
 *   'tiger'    - stout, blunt broad snout, dark vertical bars fading toward the tail
 * Nose +z, body length 1 (nose +0.5, tail root -0.5, caudal fin reaches about -0.71), y up, x = left/right.
 */

const C = (hex) => new THREE.Color(hex);
const TAU = Math.PI * 2;

// [z, halfWidth, top, bottom, yOffset, squareness]. Nose first. The snout is conical and underslung (mouth below the tip).
const SLIM = [
  [0.5, 0.005, 0.005, 0.005, 0.0], [0.487, 0.017, 0.016, 0.019, -0.004], [0.465, 0.03, 0.028, 0.032, -0.007],
  [0.43, 0.045, 0.04, 0.045, -0.008], [0.38, 0.058, 0.055, 0.056, -0.004], [0.32, 0.068, 0.07, 0.064, -0.002],
  [0.25, 0.076, 0.084, 0.07, 0], [0.15, 0.079, 0.093, 0.076, 0], [0.03, 0.078, 0.095, 0.078, 0],
  [-0.1, 0.069, 0.085, 0.068, 0.001], [-0.22, 0.053, 0.064, 0.05, 0.003], [-0.33, 0.037, 0.045, 0.034, 0.005],
  [-0.42, 0.026, 0.03, 0.022, 0.007, 2.4], [-0.47, 0.021, 0.021, 0.016, 0.008, 2.6], [-0.5, 0.017, 0.016, 0.013, 0.009, 2.6],
];
const BLUNT = [
  [0.5, 0.014, 0.012, 0.016, -0.003], [0.492, 0.034, 0.026, 0.03, -0.005], [0.475, 0.055, 0.04, 0.044, -0.007],
  [0.445, 0.075, 0.052, 0.056, -0.008], [0.4, 0.09, 0.066, 0.068, -0.006], [0.33, 0.099, 0.086, 0.08, -0.003],
  [0.25, 0.103, 0.102, 0.088, 0], [0.15, 0.102, 0.11, 0.09, 0], [0.03, 0.098, 0.108, 0.088, 0],
  [-0.1, 0.086, 0.096, 0.078, 0.002], [-0.22, 0.065, 0.072, 0.056, 0.004], [-0.33, 0.044, 0.05, 0.038, 0.006],
  [-0.42, 0.031, 0.034, 0.025, 0.008, 2.4], [-0.47, 0.025, 0.024, 0.018, 0.009, 2.6], [-0.5, 0.02, 0.018, 0.014, 0.01, 2.6],
];
const scaled = (rows, kw, kt, kb) => rows.map(([z, w, t, b, y, p]) => [z, w * kw, t * kt, b * kb, y, p]);

const VARIANTS = {
  blacktip: {
    sections: scaled(SLIM, 0.93, 0.96, 0.94), rings: 44, sides: 24,
    top: 0x5d6266, flank: 0x777a78, belly: 0xf1f1ea, wedge: true,
    fin: 0x686b69, pale: 0xdfe0da,
    d1: { h: 1.03, dz: 0.0 }, pec: { s: 1.06, ox: 0, oy: 0 }, tailDy: 0, pelOx: 0, mouth: { z: 0.398, hw: 0.034, k: 24 }, eyeZ: 0.372,
    gill: 0.3, gillStep: 0.021,
  },
  greyreef: {
    sections: SLIM, rings: 44, sides: 24,
    top: 0x474d48, flank: 0x8c8a79, belly: 0xeceee8,
    fin: 0x585c58, pale: 0xd7d9d3,
    d1: { h: 1.0, dz: 0.0 }, pec: { s: 1.0, ox: 0, oy: 0 }, tailDy: 0, pelOx: 0, mouth: { z: 0.4, hw: 0.036, k: 22 }, eyeZ: 0.375,
    gill: 0.3, gillStep: 0.021,
  },
  tiger: {
    sections: BLUNT, rings: 60, sides: 20,
    top: 0x5f726f, flank: 0x869388, belly: 0xe6e3d3, bars: true,
    fin: 0x66777a, pale: 0xd8d6c6,
    d1: { h: 0.85, dz: -0.01 }, pec: { s: 1.12, ox: 0.022, oy: -0.012 }, tailDy: 0.011, pelOx: 0.016, mouth: { z: 0.404, hw: 0.05, k: 13 }, eyeZ: 0.372,
    gill: 0.305, gillStep: 0.023,
  },
};

/** Vertical fin in the x = 0 plane from rows [y, leZ, teZ, t]. */
const vfin = (rows, dy = 0, dz = 0) => rows.map(([y, le, te, t]) => ({ le: [0, y + dy, le + dz], te: [0, y + dy, te + dz], t }));
/** Paired fin (right side) from rows [x, y, leZ, teZ, t], scaled about (ox, oy, z0) then offset. */
const pfin = (rows, s, ox, oy, z0) => rows.map(([x, y, le, te, t]) => {
  const x0 = rows[0][0], y0 = rows[0][1];
  return { le: [x0 + (x - x0) * s + ox, y0 + (y - y0) * s + oy, z0 + (le - z0) * s], te: [x0 + (x - x0) * s + ox, y0 + (y - y0) * s + oy, z0 + (te - z0) * s], t: t * (0.7 + 0.3 * s) };
});

const D1 = [[0.07, 0.105, -0.02, 0.016], [0.12, 0.09, -0.005, 0.014], [0.17, 0.068, 0.003, 0.012], [0.215, 0.04, 0.0, 0.009], [0.245, 0.015, -0.012, 0.007], [0.262, -0.005, -0.028, 0.005]];
const D2 = [[0.035, -0.255, -0.325, 0.01], [0.062, -0.28, -0.335, 0.009], [0.085, -0.305, -0.345, 0.007], [0.098, -0.325, -0.36, 0.005]];
const ANAL = [[-0.022, -0.265, -0.335, 0.01], [-0.055, -0.285, -0.34, 0.009], [-0.078, -0.31, -0.35, 0.007], [-0.09, -0.33, -0.365, 0.005]];
// heterocercal caudal, upper tip -> lower tip: long upper lobe with subterminal notch, short lower lobe
const CAUDAL = [
  [0.242, -0.7, -0.712, 0.005], [0.222, -0.67, -0.71, 0.007], [0.195, -0.64, -0.676, 0.008], [0.17, -0.615, -0.675, 0.01],
  [0.12, -0.565, -0.64, 0.012], [0.065, -0.51, -0.59, 0.014], [0.02, -0.465, -0.53, 0.016], [-0.015, -0.478, -0.535, 0.016],
  [-0.045, -0.5, -0.565, 0.014], [-0.075, -0.535, -0.6, 0.011], [-0.105, -0.57, -0.617, 0.008], [-0.125, -0.6, -0.625, 0.005],
];
const PEC = [[0.05, -0.05, 0.22, 0.105, 0.016], [0.105, -0.08, 0.195, 0.093, 0.014], [0.16, -0.115, 0.155, 0.073, 0.011], [0.215, -0.15, 0.112, 0.047, 0.008], [0.25, -0.18, 0.07, 0.02, 0.0055], [0.268, -0.2, 0.035, 0.018, 0.004]];
const PEL = [[0.03, -0.062, -0.12, -0.18, 0.008], [0.058, -0.082, -0.135, -0.19, 0.006], [0.085, -0.1, -0.15, -0.2, 0.004]];

export function sharkGeometry(variant = 'greyreef') {
  const V = VARIANTS[variant] || VARIANTS.greyreef;
  const { sections, rings, sides } = V;
  const isTiger = !!V.bars;

  // ---- analytic body surface (matches the loft's spline) for placing eyes, gill slits and the mouth ----
  const dense = resample(sections.map((s) => [s[0], s[1], s[2], s[3], s[4] ?? 0, s[5] ?? 2]), 400);
  const rowAt = (z) => { let b = 0, d = 9; for (let i = 0; i < dense.length; i++) { const e = Math.abs(dense[i][0] - z); if (e < d) { d = e; b = i; } } return dense[b]; };
  const surf = (z, a, k = 1) => {
    const [, w, top, bot, yo, p] = rowAt(z), e = 2 / Math.max(0.5, p), co = Math.cos(a), si = Math.sin(a);
    const x = Math.sign(co) * Math.pow(Math.abs(co), e) * w, y = Math.sign(si) * Math.pow(Math.abs(si), e) * (si >= 0 ? top : bot);
    return [x * k, y * k + yo, z];
  };
  const underY = (z, x) => { const [, w, , bot, yo, p] = rowAt(z); const r = Math.min(0.999, Math.abs(x) / w); return yo - bot * Math.pow(1 - Math.pow(r, p), 1 / p); };

  // ---- body colouring: countershading line, markings ----
  const cTop = C(V.top), cFlank = C(V.flank), cBelly = C(V.belly), cBar = C(0x2c3837);
  const lineAt = (z) => {
    let L = -0.12 + 0.34 * smooth(-0.05, -0.45, z) - 0.14 * Math.exp(-(((z - 0.2) / 0.09) ** 2)) + 0.38 * smooth(0.3, 0.46, z);
    if (V.wedge) L = Math.max(L, -0.15 + 0.58 * smooth(0.34, 0.12, z) * smooth(-0.43, -0.08, z)); // white flank wedge reaching up toward the dorsal
    return L;
  };
  const bodyColor = (c, { z, s, co }) => {
    c.copy(cTop).lerp(cFlank, smooth(0.88, 0.12, s));
    c.lerp(cBelly, smooth(lineAt(z) + 0.14, lineAt(z) - 0.14, s));
    if (isTiger) {
      const ph = z * 8.6 + 0.12 * s + 0.1 * Math.sin(z * 19 + s * 2);
      const wave = 0.5 + 0.5 * Math.cos(TAU * ph);
      const n = 0.5 + 0.5 * Math.sin(z * 37 + co * 5.3) * Math.sin(z * 13 - s * 3.1);
      const k = smooth(0.25, 0.75, wave) * smooth(-0.47, -0.05, z) * smooth(0.33, 0.25, z) * smooth(-0.55, 0.05, s) * (0.8 + 0.3 * n);
      c.lerp(cBar, Math.min(1, 0.95 * k));
    }
    c.multiplyScalar(0.965 + 0.05 * hash(z * 53, co * 9 + s * 3));
  };
  const body = loft(sections, { rings, sides, back: V.top, belly: V.belly, colorFn: bodyColor });

  const parts = [body];

  // ---- eyes: dark socket, black round eye, pale lower lid hinting at the nictitating membrane ----
  for (const sx of [1, -1]) {
    const a = sx > 0 ? 0.38 : Math.PI - 0.38, [ex, ey, ez] = surf(V.eyeZ, a, 0.975), out = sx * 0.0035;
    parts.push(blob([ex, ey, ez], [0.0075, 0.0135, 0.0145], 0x3b3f40, { w: 8, h: 5 }));
    parts.push(blob([ex + out, ey + 0.001, ez + 0.001], [0.0075, 0.0098, 0.0106], 0x0b0c0d, { w: 8, h: 5 }));
    parts.push(blob([ex + out * 0.8, ey - 0.0085, ez + 0.001], [0.0055, 0.0034, 0.0085], 0x9aa3a5, { w: 6, h: 3 }));
  }

  // ---- mouth: crescent on the underside of the snout, with short labial furrows at the corners ----
  const m = V.mouth, mp = [];
  for (let i = 0; i <= 10; i++) { const x = (i / 5 - 1) * m.hw, z = m.z - m.k * x * x; mp.push([x, underY(z, x) + 0.0008, z, 0.0028]); }
  parts.push(tube(mp, { segs: 11, sides: 4, color: 0x1d191a }));
  for (const sx of [1, -1]) {
    const x = sx * m.hw, z = m.z - m.k * m.hw * m.hw;
    parts.push(tube([[x, underY(z, x) + 0.0008, z, 0.0024], [x * 1.1, underY(z - 0.01, x * 1.1) + 0.0008, z - 0.01, 0.002], [x * 1.18, underY(z - 0.019, x * 1.18) + 0.001, z - 0.019, 0.0012]], { segs: 3, sides: 4, color: 0x1d191a }));
  }

  // ---- five gill slits per side (dark recessed bands, slightly leaning back at the top) ----
  const gills = [];
  for (let i = 0; i < 5; i++) {
    const z0 = V.gill - i * V.gillStep, top = 0.95 - i * 0.05, pts = [];
    for (let j = 0; j < 4; j++) {
      const a = -0.3 + (top + 0.3) * (j / 3), [x, y, z] = surf(z0 - 0.007 * (j / 3) + 0.003 * Math.sin((j / 3) * Math.PI), a, 0.992);
      pts.push([x, y, z, j === 0 || j === 3 ? 0.0018 : 0.0027]);
    }
    gills.push(tube(pts, { segs: 4, sides: 4, color: 0x24211f }));
  }
  for (const g of gills) { parts.push(g, mirrorX(g)); }

  // ---- fins ----
  const pale = C(V.pale), black = C(0x131417);
  const tip = (c, v, a, b, col, amt = 1) => c.lerp(col, amt * smooth(a, b, v));
  const bt = variant === 'blacktip', gr = variant === 'greyreef';

  const d1Root = (rowAt(0.04)[4] + rowAt(0.04)[2]) - 0.026;  // sink the root into the back
  const d1 = V.d1;
  const d1rows = D1.map(([y, le, te, t], i) => [d1Root + (y - D1[0][0]) * d1.h, le, te, t]);
  parts.push(fin(vfin(d1rows, 0, d1.dz), {
    side: [1, 0, 0], span: 10, chord: 8, color: V.fin,
    colorFn: (c, { u, v }) => {
      if (bt) tip(c, v, 0.6, 0.76, black);
      else if (gr) { tip(c, v, 0.86, 0.97, C(0xd3d6d0), 0.55); tip(c, u, 0.85, 1, C(0x2c2f2e), 0.3); }
    },
  }));
  parts.push(fin(vfin(D2, V.tailDy), {
    side: [1, 0, 0], span: 6, chord: 6, color: V.fin,
    colorFn: (c, { v }) => { if (bt) tip(c, v, 0.55, 0.72, black); },
  }));
  parts.push(fin(vfin(ANAL, -V.tailDy), {
    side: [1, 0, 0], span: 6, chord: 6, color: V.fin,
    colorFn: (c, { v }) => { if (bt) tip(c, v, 0.55, 0.72, black); },
  }));
  parts.push(fin(vfin(CAUDAL), {
    side: [1, 0, 0], span: 16, chord: 8, color: V.fin,
    colorFn: (c, { u, p }) => {
      if (bt) {
        tip(c, p.y, 0.17, 0.2, black); tip(c, -p.y, 0.075, 0.095, black); tip(c, u, 0.88, 1, black, 0.7);
      } else if (gr) {
        tip(c, u, 0.46, 0.62, C(0x15161a), 0.95);
      } else { tip(c, u, 0.82, 1, C(0x30383a), 0.5); tip(c, p.y, 0.2, 0.24, C(0x30383a), 0.5); }
    },
  }));
  // caudal keel: small flat lateral keels on the peduncle
  const kw = isTiger ? 0.04 : 0.032, ky = rowAt(-0.44)[4];
  parts.push(fin([
    { le: [-kw, ky, -0.456], te: [-kw, ky, -0.464], t: 0.002 }, { le: [0, ky, -0.415], te: [0, ky, -0.478], t: 0.008 }, { le: [kw, ky, -0.456], te: [kw, ky, -0.464], t: 0.002 },
  ], { side: [0, 1, 0], span: 3, chord: 4, color: V.fin }));

  const pecColor = (c, { v, up }) => {
    if (!up) c.lerp(pale, 0.88);
    if (bt) tip(c, v, 0.68, 0.8, black);
    else if (gr) tip(c, v, 0.6, 0.78, C(0x1b1d1f), 0.9);
    else if (!up) tip(c, v, 0.72, 0.92, C(0x4b5558), 0.6);
  };
  const pelColor = (c, { v, up }) => { if (!up) c.lerp(pale, 0.85); if (bt) tip(c, v, 0.6, 0.8, black); else if (gr) tip(c, v, 0.7, 1, C(0x35383a), 0.4); };
  const pec = pfin(PEC, V.pec.s, V.pec.ox, V.pec.oy, 0.16);
  const pecR = fin(pec, { side: [0.57, 0.82, 0], span: 8, chord: 8, color: V.fin, colorFn: pecColor });
  parts.push(pecR, mirrorX(pecR));
  const pelR = fin(pfin(PEL, 1, V.pelOx, V.pelOx > 0 ? -0.012 : 0, -0.15), { side: [0.3, 0.95, 0], span: 5, chord: 6, color: V.fin, colorFn: pelColor });
  parts.push(pelR, mirrorX(pelR));

  const g = merge(parts);
  g.computeBoundingBox();
  return g;
}
