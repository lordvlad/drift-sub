/**
 * Rare-wreck geometry: hull variants for the 20 wrecks of src/wrecks/data.js.
 *
 * buildRareWreck(spec) -> { pieces, length, beam, height }  (same shape as buildWreck in models/landmarks-wreck.js; local frame:
 * x starboard, y up (keel ~0), +z bow, centred on z = 0). spec = { hull, length, beam, seed, tone, cargo, funnels, ... } (see data.js `model`).
 * hulls: freighter, ferry, liner, warship, tanker, trawler, galleon, ancient, sub.
 */
import { mulberry32 } from '../noise.js';
import {
  Mesh, sweep, limb, ellipsoid, noiseKit, rotFn, TAU, clamp, lerp, smooth, mix, mul, add3, scale3,
  makePiece, assignColliders, tplBounds,
} from '../models/landmarks-kit.js';

// ---- palette ----------------------------------------------------------------------------------
const ALGAE = [0.2, 0.38, 0.17], CRUST = [0.72, 0.68, 0.5], GLASS = [0.015, 0.025, 0.035];
const BRONZE = [0.36, 0.42, 0.28], RUSTC = [0.55, 0.27, 0.11], RUST_DARK = [0.27, 0.14, 0.09];
const CORALS = [[0.85, 0.35, 0.45], [0.9, 0.55, 0.2], [0.7, 0.3, 0.75], [0.9, 0.8, 0.3]];
/** brass: the faint glow (4th component) marks a rare wreck's bell and plaque */
const BRASS = (g = 0.55) => [0.9, 0.7, 0.28, g];
const TONES = {
  rust:  { a: [0.17, 0.2, 0.23], b: RUSTC, top: [0.62, 0.52, 0.38], band: [0.55, 0.16, 0.1] },
  grey:  { a: [0.3, 0.34, 0.37], b: [0.4, 0.3, 0.24], top: [0.4, 0.43, 0.45], band: [0.3, 0.32, 0.34] },
  black: { a: [0.1, 0.1, 0.12], b: [0.32, 0.17, 0.1], top: [0.5, 0.46, 0.4], band: [0.6, 0.14, 0.1] },
  white: { a: [0.5, 0.52, 0.52], b: [0.5, 0.3, 0.18], top: [0.72, 0.7, 0.62], band: [0.18, 0.3, 0.55] },
  green: { a: [0.1, 0.27, 0.2], b: [0.4, 0.2, 0.1], top: [0.5, 0.52, 0.45], band: [0.8, 0.8, 0.8] },
  wood:  { a: [0.22, 0.17, 0.13], b: [0.42, 0.33, 0.22], top: [0.4, 0.31, 0.22], band: [0.5, 0.4, 0.2] },
  olive: { a: [0.2, 0.24, 0.14], b: [0.4, 0.28, 0.14], top: [0.4, 0.4, 0.3], band: [0.5, 0.5, 0.3] },
};
const RAINBOW = [[0.85, 0.2, 0.2], [0.9, 0.55, 0.15], [0.9, 0.85, 0.25], [0.25, 0.7, 0.3], [0.25, 0.45, 0.85], [0.55, 0.3, 0.75]];

/** hull shapes: sq squareness, w0 stern width, sternEnd/bowStart/bowPow: plan form, Hk: depth / beam, deck: deck height / depth, bowRise/sternRise: sheer (x depth) */
const SHAPES = {
  freighter: { sq: 2.8, w0: 0.82, sternEnd: 0.2, bowStart: 0.58, bowPow: 1.9, Hk: 0.55, deck: 0.72, bowRise: 0.18, sternRise: 0 },
  ferry:     { sq: 3.4, w0: 0.9, sternEnd: 0.12, bowStart: 0.7, bowPow: 1.8, Hk: 0.78, deck: 0.7, bowRise: 0.12, sternRise: 0 },
  liner:     { sq: 3.0, w0: 0.76, sternEnd: 0.2, bowStart: 0.5, bowPow: 1.55, Hk: 0.78, deck: 0.7, bowRise: 0.14, sternRise: 0 },
  warship:   { sq: 2.6, w0: 0.7, sternEnd: 0.18, bowStart: 0.45, bowPow: 1.4, Hk: 0.78, deck: 0.7, bowRise: 0.2, sternRise: 0 },
  tanker:    { sq: 3.5, w0: 0.86, sternEnd: 0.15, bowStart: 0.76, bowPow: 2.3, Hk: 0.62, deck: 0.8, bowRise: 0.1, sternRise: 0 },
  trawler:   { sq: 2.4, w0: 0.7, sternEnd: 0.25, bowStart: 0.5, bowPow: 1.5, Hk: 0.62, deck: 0.7, bowRise: 0.25, sternRise: 0 },
  galleon:   { sq: 2.1, w0: 0.62, sternEnd: 0.28, bowStart: 0.55, bowPow: 1.5, Hk: 0.62, deck: 0.62, bowRise: 0.2, sternRise: 0.55, wood: true, cut: 0.95, rag: 1.6 },
  ancient:   { sq: 1.9, w0: 0.08, sternEnd: 0.2, bowStart: 0.78, bowPow: 1.3, Hk: 0.5, deck: 0.5, bowRise: 0.3, sternRise: 0.3, wood: true, cut: 0.62, rag: 0.7 },
};

const fract = (x) => ((x % 1) + 1) % 1;

// =====================================================================================================================
export function buildRareWreck(spec) {
  if (spec.hull === 'sub') return buildSub(spec);
  const hull = SHAPES[spec.hull] ? spec.hull : 'freighter';
  const L = spec.length, B = spec.beam, S = SHAPES[hull], wood = !!S.wood, k = B / 9;
  const rng = mulberry32(spec.seed * 4093 + 71), nz = noiseKit(spec.seed * 13 + 9), off = rng() * 60;
  const T = TONES[spec.tone || (wood ? 'wood' : 'rust')] || TONES.rust;
  const X0 = -L / 2, NU = clamp(Math.round(L / 1.5), 20, 72), NV = 9;
  const H = B * S.Hk, yDeck = H * S.deck, kz = L / 36;
  const m = new Mesh();
  const zOf = (f) => X0 + f * L;
  const cols = [];   // colliders [x, y, z, r, 1]
  const coralK = spec.coral ?? 1;

  // ---- plan form -------------------------------------------------------------------------------------------------
  const widthProf = (s) => (s < S.sternEnd ? lerp(S.w0, 1, smooth(0, S.sternEnd, s)) : s < S.bowStart ? 1 : Math.max(0, 1 - Math.pow((s - S.bowStart) / (1 - S.bowStart), S.bowPow)));
  const Hof = (s) => H * (1 + S.bowRise * smooth(0.55, 1, s) + S.sternRise * smooth(0.32, 0, s));
  const keelRise = (s) => H * 0.1 * Math.pow(smooth(0.72, 1, s), 1.5) + H * 0.04 * smooth(0.1, 0, s);
  const stem = Math.min(5, L * 0.07), rake = Math.min(1.6, L * 0.02);

  // optional break in the hull: a gap of two cells with the bow section dipping away
  const brk = spec.breakAt || null, ib = brk ? Math.round(brk.s * NU) : -9, gapN = 2;
  const zB1 = brk ? X0 + ((ib + gapN) / NU) * L : 1e9, zB0 = brk ? X0 + (ib / NU) * L : 1e9;
  const bendP = (p) => {
    if (!brk || p[2] < zB1 - 0.8) return p;
    const a = brk.pitch, c = Math.cos(a), s = Math.sin(a), pivY = H * 0.3, dz = p[2] - zB1, dy = p[1] - pivY;
    return [p[0], pivY + dy * c - dz * s, zB1 + brk.gap + dz * c + dy * s];
  };
  const inGap = (s) => brk && s >= ib / NU - 1e-6 && s < (ib + gapN) / NU - 1e-6;
  const hullRaw = (s, g, side, inset) => {
    const bw = Math.max((B / 2) * widthProf(s) - inset, 0), Hs = Hof(s);
    const phi = (g * Math.PI) / 2, cs = Math.pow(Math.cos(phi), 2 / S.sq), sn = Math.pow(Math.sin(phi), 2 / S.sq), Y = 1 - cs;
    const rag = smooth(0.82, 1, g) * 0.7 * (H / 4.8) * (0.5 + 0.5 * nz.n3(s * 11 + side * 4, 2.2, g)) * (s > 0.04 && s < 0.97 ? 1 : 0.3);
    return [side * bw * sn * (1 + 0.05 * Y), Hs * Y + (keelRise(s) + inset) * (1 - Y) - rag, X0 + s * L + stem * smooth(0.9, 1, s) * Math.pow(Y, 1.5) - rake * Y * (1 - smooth(0, 0.12, s))];
  };
  const hullPt = (s, g, side, inset = 0) => { const p = hullRaw(s, g, side, inset); return brk && s * NU >= ib + gapN - 1e-6 ? bendP(p) : p; };
  const hullXAtY = (s, y, inset = 0) => {
    const Hs = Hof(s), Y = clamp((y - keelRise(s)) / (Hs - keelRise(s))), sn = Math.pow(1 - Math.pow(1 - Y, S.sq), 1 / S.sq);
    return Math.max((B / 2) * widthProf(s) - inset, 0) * sn * (1 + 0.05 * Y);
  };

  // rotted-away plating
  const holeSide = rng() < 0.5 ? -1 : 1, hs = 0.3 + rng() * 0.3, hg = 0.34 + rng() * 0.1;
  const topCut = wood ? 0.35 : 0.58, ragK = S.rag ?? 2.3;
  const missing = (side, s, g) => {
    if (inGap(s)) return true;
    if (S.cut && g > S.cut) return true;
    if (g > topCut && nz.n3(s * 9 + side * 3.7, g * 6, 1.3) > 0.2 + (1 - g) * ragK) return true;
    if (side === holeSide) { const d = Math.hypot((s - hs) / 0.09, (g - hg) / 0.22); if (d < 1 + 0.4 * nz.n2(s * 14 + off, g * 9)) return true; }
    return false;
  };
  const refZ = (i) => X0 + (i / NU) * L;

  // ---- colour -----------------------------------------------------------------------------------------------------
  const plateTone = (x, y, z) => fract(Math.sin((Math.floor(z / 2.4) * 7 + Math.floor(y / (H / 4)) + (x > 0 ? 31 : 0)) * 12.9898 + off) * 43758.5453);
  const growth = (col, x, y, z, up) => {
    const yn = y / H;
    col = mix(col, ALGAE, smooth(0.1, 0.55, nz.n3(x * 0.9 + off, y * 0.8, z * 0.9)) * (Math.max(smooth(0.77, 1.04, yn), 0.7 * smooth(0.25, 0, Math.abs(yn - 0.5) - 0.2)) * 0.6 + up * 0.25));
    col = mix(col, CRUST, smooth(0.5, 0.75, nz.n3(x * 1.7 - off, y * 1.5, z * 1.7)) * (0.25 + 0.35 * smooth(0.2, 0.85, yn)));
    // soft coral and sponge patches: what makes a rare wreck colourful
    const cp = smooth(0.38, 0.68, nz.n3(x * 0.5 + off * 1.7, y * 0.45, z * 0.5)) * (0.2 + 0.6 * smooth(0.1, 0.9, yn)) * coralK;
    if (cp > 0.01) col = mix(col, mul(CORALS[Math.floor((nz.n3(x * 0.18 + 9, y * 0.2, z * 0.18) + 1) * 2) & 3], 0.95), Math.min(0.9, cp * 1.3));
    return mul(col, 0.94 + 0.12 * nz.n3(x * 7, y * 7, z * 7));
  };
  const outerCol = (x, y, z) => {
    const tone = plateTone(x, y, z), yn = y / H;
    let col;
    if (wood) {
      col = mix(T.a, T.b, 0.25 + 0.45 * nz.n3(x * 0.8 + off, y * 0.6, z * 0.4) + 0.2 * (Math.floor(y / (H / 9)) % 2));
    } else {
      col = mix(T.a, T.b, smooth(-0.3, 0.45, nz.n3(x * 0.5 + off, y * 0.35, z * 0.5) * 0.7 + (tone - 0.5) * 0.8 + 0.3 * smooth(0, 0.65, yn)));
      col = mix(col, mul(T.a, 1.8), smooth(0.65, 1, tone) * 0.25);
      col = mix(col, RUST_DARK, smooth(0.5, 0.9, nz.n2(z * 1.3 + off, x * 0.6)) * 0.4);
      if (spec.rainbow && z > X0 + L * 0.62 && yn > 0.35 && yn < 0.85) {   // painted rainbow arc on the bow
        const q = clamp((yn - 0.35) / 0.5) * 6, ci = Math.min(5, Math.floor(q)), arc = smooth(0.62, 0.7, (z - X0) / L);
        col = mix(col, mul(RAINBOW[ci], 0.7), arc * 0.85);
      }
      if (spec.band && yn > 0.8 && yn < 0.92) col = mix(col, T.band, 0.6);
    }
    return mul(growth(col, x, y, z, 0), (0.6 + 0.4 * smooth(-0.3, 0.45, yn)) * 1.18);
  };
  const innerCol = (x, y, z) => {
    let col = mix(RUST_DARK, wood ? T.b : RUSTC, 0.25 + 0.5 * smooth(-0.4, 0.8, nz.n3(x * 0.6 + off, y * 0.5, z * 0.6)));
    col = mix(col, T.a, 0.25 * smooth(0.3, 0.9, plateTone(x, y, z)));
    return mul(growth(col, x, y, z, 0.2), 0.45 + 0.4 * smooth(-0.05, 0.75, y / H));
  };
  const ribCol = (x, y, z) => mul(growth(mix(wood ? T.b : RUSTC, RUST_DARK, 0.3 + 0.4 * nz.n3(x * 1.3 + off, y, z * 1.3)), x, y, z, 0.2), 0.55 + 0.45 * smooth(0, 0.8, y / H));
  const woodCol = (x, y, z, plank) => mul(growth(mix(wood ? T.b : [0.4, 0.31, 0.22], [0.28, 0.24, 0.2], 0.4 * (plank % 2) + 0.3 * nz.n3(x * 1.4, 1, z * 0.7)), x, y, z, 0.6), 0.8);
  const steelDeckCol = (x, y, z) => mul(growth(mix(T.a, RUSTC, 0.3 + 0.4 * nz.n3(x * 0.7 + off, 1, z * 0.7)), x, y, z, 0.5), 0.75);
  const paintCol = (x, y, z, y1) => {
    let col = mix(T.top, mul(T.top, 0.8), smooth(0.2, 0.8, nz.n3(x * 0.7 + off, y * 0.5, z * 0.7)));
    col = mix(col, RUSTC, smooth(0.45, 0.85, nz.n2((x + z) * 2.4 + off, y * 0.25)) * (0.35 + 0.5 * smooth(y1, y1 - 1.5 * k, y)));
    col = mix(col, RUST_DARK, smooth(0.65, 0.95, nz.n3(x * 2, y * 2, z * 2)) * 0.3);
    return mul(growth(col, x, y, z, 0.3), 0.7 + 0.3 * smooth(yDeck, yDeck + 2 * B, y));
  };
  const metalCol = (x, y, z) => mul(growth(mix(RUSTC, RUST_DARK, 0.4), x, y, z, 0.2), 0.85);

  // ---- tiny solids ------------------------------------------------------------------------------------------------
  /** closed box centred c with half sizes h, rotated (rx, ry, rz) */
  const boxM = (c, h, col, rot = null) => {
    const from = m.nv, [x, y, z] = c, [hx, hy, hz] = h;
    const faces = [
      [[x - hx, y - hy, z + hz], [2 * hx, 0, 0], [0, 2 * hy, 0]], [[x + hx, y - hy, z - hz], [-2 * hx, 0, 0], [0, 2 * hy, 0]],
      [[x + hx, y - hy, z + hz], [0, 0, -2 * hz], [0, 2 * hy, 0]], [[x - hx, y - hy, z - hz], [0, 0, 2 * hz], [0, 2 * hy, 0]],
      [[x - hx, y + hy, z - hz], [2 * hx, 0, 0], [0, 0, 2 * hz]], [[x - hx, y - hy, z + hz], [2 * hx, 0, 0], [0, 0, -2 * hz]],
    ];
    for (const [o, u, v] of faces) m.surface(1, 1, (i, j) => [o[0] + u[0] * i + v[0] * j, o[1] + u[1] * i + v[1] * j, o[2] + u[2] * i + v[2] * j], col, { mode: 1, ref: () => c });
    if (rot) { const f = rotFn(rot[0], rot[1], rot[2], c); m.map(from, f); }
  };
  /** move everything built since `from` by a rigid transform (rotation about the origin, then translation) */
  const place = (from, rot, at) => { const f = rotFn(rot[0], rot[1], rot[2]); m.map(from, (p) => { const q = f(p); return [q[0] + at[0], q[1] + at[1], q[2] + at[2]]; }); };
  const wheel = (x, y, z, r, w) => limb(m, [x - w, y, z], [x + w, y, z], r, r, 7, 1, (px, py, pz) => mul([0.07, 0.07, 0.07], 1), { capStart: true });

  // ---- hull skins -------------------------------------------------------------------------------------------------
  const inset = (wood ? 0.35 : 0.2) * k;
  for (const side of [-1, 1]) {
    m.surface(NU, NV, (i, j) => hullPt(i / NU, j / NV, side), outerCol, {
      mode: 1, ref: (i) => [-side * B * 0.33, H * 0.5, refZ(i)], skip: (i, j) => missing(side, (i + 0.5) / NU, (j + 0.5) / NV),
    });
    m.surface(NU, NV, (i, j) => hullPt(i / NU, j / NV, side, inset), innerCol, {
      mode: -1, ref: (i) => [-side * B * 0.22, H * 0.62, refZ(i)], skip: (i, j) => missing(side, (i + 0.5) / NU, (j + 0.5) / NV),
    });
  }
  // transom / stern plate (galleons: windows in two rows)
  {
    const NT = 14, NR = 8, s0 = 0;
    const tp = (i, j) => {
      const Y = j / NR, Hs = Hof(s0), sn = Math.pow(1 - Math.pow(1 - Y, S.sq), 1 / S.sq), xh = (B / 2) * widthProf(s0) * sn * (1 + 0.05 * Y);
      return [lerp(-xh, xh, i / NT), Hs * Y + keelRise(s0) * (1 - Y), X0 - rake * Y];
    };
    const win = hull === 'galleon' ? (i, j) => j >= 3 && j < 7 && i % 3 === 1 && j % 2 === 1 : () => false;
    m.surface(NT, NR, tp, outerCol, { mode: 1, ref: () => [0, H * 0.5, X0 + 6], skip: (i, j) => win(i, j) || (j >= NR - 2 && nz.n3(i * 0.9 + off, j, 5) > 0.1 + (wood ? 0.3 : 0)) });
  }
  // keel (in two runs when the hull is broken)
  const keelRun = (a, b) => sweep(m, {
    path: (t) => { const s = a + t * (b - a); return [0, hullPt(s, 0, 1)[1] - 0.12, hullPt(s, 0, 1)[2]]; },
    rings: 12, sides: 5, radius: () => 0.3 * Math.max(0.8, k), capEnd: true, capStart: true,
    attr: (x, y, z) => mul(mix(RUST_DARK, ALGAE, 0.25 * smooth(0.1, 0.6, nz.n3(x, y, z))), 0.7),
  });
  if (brk) { keelRun(0.02, ib / NU - 0.005); keelRun((ib + gapN) / NU + 0.005, 0.98); } else keelRun(0.02, 0.98);
  // ribs, some broken off
  const ribStep = wood ? 1.7 : Math.max(2.4, L / 30), nRibs = Math.round(L / ribStep) - 1, rr = Math.max(wood ? 0.16 : 0.1, B * (wood ? 0.02 : 0.014));
  for (let q = 0; q < nRibs; q++) {
    const s = (q + 1) / (nRibs + 1);
    if (inGap(s) || (brk && Math.abs(s - (ib + 1) / NU) < 0.03)) continue;
    const full = wood ? 0.55 : 0.55, gm = [rng() < full ? 1 : 0.45 + rng() * 0.4, rng() < full ? 1 : 0.45 + rng() * 0.4], cutG = S.cut || 2;
    sweep(m, {
      path: (t) => { const u = (t - 0.5) * 2, side = u < 0 ? -1 : 1; return hullPt(s, Math.min(Math.abs(u) * gm[side < 0 ? 0 : 1], 1, cutG), side, 0.24 * k); },
      rings: 12, sides: 4, radius: (t) => rr * (1 + 0.25 * Math.sin(t * 20 + q)), capEnd: true, capStart: true, capH: 0.3, attr: ribCol,
    });
  }
  // stringers
  for (const side of [-1, 1]) for (const g of [0.45, 0.8]) {
    if (S.cut && g > S.cut) continue;
    const s0 = 0.08 + rng() * 0.06, s1 = 0.8 + rng() * 0.12;
    const run = (a, b) => sweep(m, { path: (t) => hullPt(lerp(a, b, t), g, side, 0.24 * k), rings: 10, sides: 4, radius: () => rr * 0.8, capEnd: true, capStart: true, attr: ribCol });
    if (brk) { run(s0, Math.min(s1, ib / NU - 0.01)); if (s1 > (ib + gapN) / NU) run((ib + gapN) / NU + 0.01, s1); } else run(s0, s1);
  }
  // deck beams across the open holds, some snapped
  if (!wood) for (let q = 2; q < nRibs; q += 2) {
    const s = (q + 1) / (nRibs + 1), hw = hullXAtY(s, yDeck, 0.2 * k), z = X0 + s * L;
    if (inGap(s) || (brk && Math.abs(s - (ib + 1) / NU) < 0.03)) continue;
    const a0 = rng() < 0.3 ? 0.35 : 1, a1 = rng() < 0.3 ? 0.35 : 1;
    const from = m.nv;
    limb(m, [-hw * a0, yDeck - 0.12, z], [hw * a1, yDeck - 0.12 + (rng() - 0.5) * 0.2, z], 0.15 * k, 0.15 * k, 4, 3, (x, y, zz) => ribCol(x, y + 1, zz), { capStart: true });
    if (brk && z > zB1) m.map(from, bendP);
  }

  // ---- deck remnants ---------------------------------------------------------------------------------------------
  const deckSlab = (zA, zB, nrows, sagAmp, skipFn, colFn = woodCol) => {
    const NC = 14, from = m.nv, sAt = (z) => clamp((z - X0) / L);
    m.surface(NC, nrows, (i, j) => {
      const z = lerp(zA, zB, j / nrows), s = sAt(z), hw = Math.max(hullXAtY(s, yDeck, 0.35 * k), 0.3), u = (i / NC) * 2 - 1;
      return [u * hw, yDeck - sagAmp * k * (1 - u * u) * Math.sin((j / nrows) * Math.PI) + 0.06 * nz.n2(i * 1.3 + off, j * 1.1), z];
    }, (x, y, z, i, j) => colFn(x, y, z, i), { mode: 1, ref: () => [0, -8, 0], skip: (i, j) => (brk && lerp(zA, zB, (j + 0.5) / nrows) > zB0 - 0.2 && lerp(zA, zB, (j + 0.5) / nrows) < zB1 + 0.2) || (skipFn && skipFn(i, j)) });
    if (brk && zB > zB1) m.map(from, bendP);
  };

  // ---- superstructure bits -----------------------------------------------------------------------------------------
  /** box with windows (a deckhouse, bridge, castle); b = { x0, x1, y0, y1, z0, z1 } */
  const house = (b, o = {}) => {
    const { x0, x1, y0, y1, z0, z1 } = b, ctr = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    const cell = o.cell || clamp(Math.max(x1 - x0, z1 - z0) / 40, 0.5 * k, 1.5), pf = o.paint || paintCol;
    const faces = [
      ['front', [x0, y0, z1], [x1 - x0, 0, 0], [0, y1 - y0, 0], [0, 0, 1]], ['back', [x1, y0, z0], [x0 - x1, 0, 0], [0, y1 - y0, 0], [0, 0, -1]],
      ['right', [x1, y0, z1], [0, 0, z0 - z1], [0, y1 - y0, 0], [1, 0, 0]], ['left', [x0, y0, z0], [0, 0, z1 - z0], [0, y1 - y0, 0], [-1, 0, 0]],
      ['roof', [x0, y1, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], [0, 1, 0]],
    ];
    for (const [name, org, u, v, n] of faces) {
      const nu = Math.max(2, Math.round(Math.hypot(...u) / cell)), nv = Math.max(2, Math.round(Math.hypot(...v) / cell)), wins = [];
      if (name !== 'roof' && !o.solid) {
        const j0 = Math.max(1, Math.floor(nv / 2) - 1), ww = o.ww || 1, step = ww + (o.gap ?? 1);
        for (let i = 1; i + ww <= nu - 1; i += step) wins.push([i, j0, ww, Math.min(2, nv - j0 - 1)]);
        if (name === o.broken && wins.length) { const w = wins[Math.floor(wins.length / 2)]; w[2] += 1; w[3] = Math.min(w[3] + 1, nv - w[1]); }
      }
      const inWin = (i, j) => wins.some(([a, c, w, h]) => i >= a && i < a + w && j >= c && j < c + h);
      const holeAt = (i, j) => name === 'roof' && o.roofHole && i >= 2 && i < 5 && j >= 2 && j < 4;
      const pos = (i, j) => {
        const p = add3(add3(org, scale3(u, i / nu)), scale3(v, j / nv));
        if (name === 'roof') p[1] -= 0.35 * Math.sin((i / nu) * Math.PI) * Math.sin((j / nv) * Math.PI) * (o.sag ?? 0.3) * k + 0.06 * nz.n2(i * 0.9 + off, j * 0.9);
        else return add3(p, scale3(n, 0.05 * nz.n3(i * 0.9 + off, j * 0.9, 1)));
        return p;
      };
      const idx = m.surface(nu, nv, pos, (x, y, z) => (name === 'roof' ? mul(growth(mix([0.2, 0.18, 0.17], RUST_DARK, 0.4), x, y, z, 0.8), 0.9) : pf(x, y, z, y1)), {
        mode: 1, ref: () => ctr, skip: (i, j) => inWin(i, j) || holeAt(i, j) || (o.rot && nz.n3(i * 0.8 + off, j * 0.8 + y0, 6) > 0.7),
      });
      for (const [a, c, w, h] of wins) {
        const loop = [];
        for (let i = a; i < a + w; i++) loop.push([i, c]);
        for (let j = c; j < c + h; j++) loop.push([a + w, j]);
        for (let i = a + w; i > a; i--) loop.push([i, c + h]);
        for (let j = c + h; j > c; j--) loop.push([a, j]);
        const pts = loop.map(([i, j]) => m.pt(idx(i, j))), cen = pts.reduce((s, p) => add3(s, p), [0, 0, 0]).map((q) => q / pts.length), depth = 0.35 * k;
        const axisRef = add3(cen, scale3(n, -depth * 0.5));
        for (let q = 0; q < pts.length; q++) {
          const p1 = pts[q], p2 = pts[(q + 1) % pts.length], q1 = add3(p1, scale3(n, -depth)), q2 = add3(p2, scale3(n, -depth));
          const col = (deep) => (deep ? mul(RUST_DARK, 0.35) : mul(mix(T.top, RUSTC, 0.5), 0.9));
          const ids = [p1, p2, q2, q1].map((p, qq) => m.v(p[0], p[1], p[2], col(qq >= 2), axisRef));
          m.quad(ids[0], ids[1], ids[2], ids[3], -1);
        }
        const deepRef = add3(cen, scale3(n, -3)), corners = [loop[0], loop[w], loop[w + h], loop[2 * w + h]].map(([i, j]) => add3(m.pt(idx(i, j)), scale3(n, -depth)));
        const ids = corners.map((p) => m.v(p[0], p[1], p[2], GLASS, deepRef));
        m.quad(ids[0], ids[1], ids[2], ids[3], 1);
      }
    }
    cols.push([ctr[0], ctr[1], ctr[2], Math.max(1.6, Math.min(x1 - x0, y1 - y0) * 0.55), 1]);
    if (z1 - z0 > 2.2 * (x1 - x0)) for (const f of [0.2, 0.5, 0.8]) cols.push([ctr[0], ctr[1], lerp(z0, z1, f), Math.max(1.6, Math.min(x1 - x0, y1 - y0) * 0.55), 1]);
  };
  /** funnel: base z, y0, height, radius, lean (m of z), band colour; broken tops allowed */
  const funnel = (z, y0, h, r, lean, o = {}) => {
    const path = (t) => [0.15 * Math.sin(t * 2) * k, y0 + t * h, z + lean * t * t];
    const col = (x, y, zz, t, a) => {
      let c = mix(o.base || [0.2, 0.19, 0.19], RUST_DARK, 0.3 + 0.5 * smooth(0.2, 0.8, nz.n3(x * 1.1 + off, y * 0.7, zz * 1.1)));
      c = mix(c, o.band || T.band, smooth(0.5, 0.58, t) * smooth(0.82, 0.72, t) * 0.8);
      c = mix(c, [0.04, 0.04, 0.04], smooth(0.84, 0.95, t));
      c = mix(c, RUSTC, smooth(0.45, 0.8, nz.n2(a * 2.2 + off, t * 1.3)) * 0.35);
      return mul(growth(c, x, y, zz, 0.3), 0.85);
    };
    const f = sweep(m, { path, rings: 9, sides: 12, capEnd: false, radius: (t, a) => r * (1 - 0.1 * t) * (1 + 0.03 * Math.sin(a * 4 + t * 3)), scale: () => [1.0, 1.25], lift: (t, a) => smooth(0.85, 1, t) * 0.35 * k * nz.n2(a * 1.6 + off, 6), attr: col });
    const rp = f.ringPts[9], c = f.pts[9], cy = rp.reduce((s, p) => s + p[1], 0) / rp.length;
    m.surface(12, 2, (i, j) => { const q = [1, 0.86, 0.5][j], p = rp[i]; return [c[0] + (p[0] - c[0]) * q, j === 0 ? p[1] : cy - 0.1 - j * 0.6 * k, c[2] + (p[2] - c[2]) * q]; },
      (x, y, zz, i, j) => (j === 0 ? mul(RUST_DARK, 0.7) : [0.03, 0.03, 0.03]), { wrapU: true, mode: -1, ref: (i) => [c[0], rp[i][1] - 0.3, c[2]] });
    cols.push([0, y0 + h * 0.35, z + lean * 0.1, r * 1.3, 1], [0, y0 + h * 0.75, z + lean * 0.55, r * 1.2, 1]);
  };
  const mast = (z, y0, h, lean = 0.3, o = {}) => {
    const r = o.r ?? 0.24 * k;
    sweep(m, { path: (t) => [0, y0 - 0.3 + t * h, z + lean * t], rings: 6, sides: 6, radius: (t) => r * (1 - 0.4 * t), capEnd: true, capH: 0.1, attr: o.wood ? woodCol2 : metalCol });
    for (const [f, w, tilt] of o.yards || []) limb(m, [-w * k, y0 + h * f, z + lean * f], [w * k, y0 + h * f + tilt, z + lean * f], r * 0.3, r * 0.2, 4, 2, o.wood ? woodCol2 : metalCol, { capStart: true });
    cols.push([0, y0 + h * 0.25, z + lean * 0.2, Math.max(0.9, r * 3), 1]);
  };
  const woodCol2 = (x, y, z) => woodCol(x, y, z, 0);
  const crane = (z, side, h = 4.9) => {
    sweep(m, { path: (t) => [0, yDeck - 0.3 + t * h * k, z], rings: 5, sides: 7, radius: (t) => (0.28 - 0.06 * t) * k, capEnd: true, capH: 0.3, attr: metalCol });
    const bt = [0, yDeck + (h - 0.4) * k, z], bend = [side * 2.8 * k, yDeck + 1.1 * k, z + 2.2 * kz];
    limb(m, bt, bend, 0.15 * k, 0.1 * k, 5, 4, metalCol);
    limb(m, bend, [bend[0] + 0.05, bend[1] - 1.6 * k, bend[2]], 0.03 * k, 0.03 * k, 3, 2, metalCol);
    cols.push([0, yDeck + 2 * k, z, 1.0 * k + 0.4, 1]);
  };
  const hatch = (z0, z1, w, col = paintCol) => {
    const hh = 0.55 * k, t = 0.12 * k, c = (x, y, z, hx, hz) => boxM([x, y, z], [hx, hh * 0.5, hz], (px, py, pz) => mul(col(px, py, pz, yDeck + 1), 0.8));
    c(-w, yDeck + hh * 0.5, (z0 + z1) / 2, t, (z1 - z0) / 2); c(w, yDeck + hh * 0.5, (z0 + z1) / 2, t, (z1 - z0) / 2);
    c(0, yDeck + hh * 0.5, z0, w, t); c(0, yDeck + hh * 0.5, z1, w, t);
  };
  const anchor = (x, y, z, yaw) => {
    const from = m.nv;
    limb(m, [0, 0, -1.2], [0, 0, 1.2], 0.12, 0.12, 5, 2, metalCol, { capStart: true });
    limb(m, [-0.9, 0, 1.2], [0.9, 0, 1.2], 0.1, 0.1, 5, 2, metalCol, { capStart: true });
    limb(m, [0, 0, -1.2], [0.85, 0, -0.5], 0.1, 0.1, 5, 2, metalCol); limb(m, [0, 0, -1.2], [-0.85, 0, -0.5], 0.1, 0.1, 5, 2, metalCol);
    place(from, [0.2, yaw, 0.3], [x, y, z]);
  };
  /** the faint glowing brass bell on a post with its plaque: the sign of a rare wreck */
  const beacon = (x, y, z) => {
    const post = (px, py, pz) => mul(metalCol(px, py, pz), 0.9);
    limb(m, [x, y, z], [x, y + 1.9 * k, z], 0.07 * k + 0.03, 0.06 * k + 0.02, 5, 2, post, { capStart: true });
    limb(m, [x, y + 1.9 * k, z], [x + 0.55 * k, y + 1.9 * k, z], 0.05 * k + 0.02, 0.05 * k + 0.02, 4, 1, post);
    ellipsoid(m, [x + 0.55 * k, y + 1.55 * k, z], [0.24 * k + 0.05, 0.3 * k + 0.07, 0.24 * k + 0.05], 8, 5, { attr: () => BRASS(0.6) });
    const from = m.nv;
    boxM([0, 0, 0], [0.4 * k + 0.1, 0.26 * k + 0.07, 0.03], () => BRASS(0.45));
    place(from, [-0.5, 0.4, 0], [x - 0.2, y + 0.8 * k, z + 0.1]);
    cols.push([x, y + 1.0, z, 0.8, 1]);
  };
  const lifeboat = (x, y, z, yaw, len = 3) => {
    const from = m.nv;
    ellipsoid(m, [0, 0, 0], [0.55 * k + 0.2, 0.32 * k + 0.1, len * 0.5], 8, 5, { attr: (px, py, pz) => mul(growth([0.55, 0.5, 0.42], px + x, py + y, pz + z, 0.2), 0.8), yMin: -0.05 });
    place(from, [0.1, yaw, 0.35], [x, y, z]);
  };
  const turret = (z, y, sc, nB, yaw = 0) => {
    const from = m.nv, tc = (px, py, pz) => mul(mix(T.a, RUSTC, 0.4 + 0.3 * nz.n3(px * 2 + off, py * 2, pz * 2)), 0.75);
    sweep(m, { path: (t) => [0, t * 1.0 * sc, 0], rings: 2, sides: 10, radius: () => 1.9 * sc, capEnd: false, attr: (px, py, pz) => growth(tc(px, py, pz), px, py + yDeck, pz + z, 0.2) });
    boxM([0, 1.5 * sc, -0.1 * sc], [1.55 * sc, 0.55 * sc, 1.45 * sc], tc);
    boxM([0, 2.15 * sc, 0.3 * sc], [1.25 * sc, 0.12 * sc, 1.0 * sc], tc);
    for (let q = 0; q < nB; q++) {
      const bx = (nB === 1 ? 0 : (q / (nB - 1) - 0.5) * 1.5) * sc, drop = q === 1 && nB === 2 ? -0.5 : 0.1;
      limb(m, [bx, 1.55 * sc, 1.3 * sc], [bx, 1.35 * sc + drop * sc, (q === 0 && nB > 1 ? 4.4 : 5.4) * sc], 0.2 * sc, 0.16 * sc, 6, 2, metalCol, { capStart: false });
    }
    place(from, [0, yaw, 0], [0, y, z]);
    cols.push([0, y + 1.2 * sc, z, 2.1 * sc, 1]);
  };
  // cargo
  const truck = (x, y, z, yaw, tilt = 0, big = 1) => {
    const from = m.nv, tc = (px, py, pz) => mul(mix(T.top, [0.25, 0.3, 0.2], 0.55 + 0.3 * nz.n3(px * 2 + x, py * 2, pz * 2)), 0.85), cc = (px, py, pz) => mul(growth([0.3, 0.28, 0.22], px + x, py + y, pz + z, 0.3), 0.8);
    boxM([0, 0.55, 0], [0.55, 0.12, 1.5], cc); boxM([0, 0.98, 0.95], [0.5, 0.42, 0.42], tc); boxM([0, 0.85, -0.3], [0.48, 0.32, 0.95], tc);
    for (const [wx, wz] of [[0.6, 0.95], [-0.6, 0.95], [0.6, -0.8], [-0.6, -0.8]]) wheel(wx, 0.38, wz, 0.38, 0.1);
    const f = rotFn(tilt, yaw, tilt * 0.6); m.map(from, (p) => { const q = f([p[0] * big, p[1] * big, p[2] * big]); return [q[0] + x, q[1] + y, q[2] + z]; });
    cols.push([x, y + 0.7, z, 1.5 * big, 1]);
  };
  const locomotive = (x, y, z, yaw, tilt = 0) => {
    const from = m.nv, lc = (px, py, pz) => mul(growth([0.1, 0.1, 0.11], px + x, py + y, pz + z, 0.3), 0.9);
    limb(m, [0, 1.45, -1.6], [0, 1.45, 2.6], 0.62, 0.58, 9, 3, lc, { capStart: true });
    boxM([0, 1.95, -2.2], [0.9, 1.0, 1.1], lc); boxM([0, 0.7, 0.4], [0.5, 0.2, 3.4], lc);
    limb(m, [0, 2.0, 2.2], [0, 3.0, 2.2], 0.22, 0.3, 7, 2, lc); limb(m, [0, 2.0, 1.0], [0, 2.4, 1.0], 0.28, 0.2, 7, 1, lc);
    for (const wz of [-1.6, -0.2, 1.2, 2.4]) for (const wx of [-0.62, 0.62]) wheel(wx, 0.6, wz, 0.6, 0.07);
    const f = rotFn(tilt, yaw, tilt * 0.5); m.map(from, (p) => { const q = f(p); return [q[0] + x, q[1] + y, q[2] + z]; });
    cols.push([x, y + 1.5, z, 1.7, 1], [x, y + 1.5, z + Math.cos(yaw) * 2, 1.4, 1], [x, y + 1.5, z - Math.cos(yaw) * 2, 1.4, 1]);
  };
  const crate = (x, y, z, s, yaw) => boxM([x, y + s * 0.5, z], [s * 0.5, s * 0.5, s * 0.5], (px, py, pz) => mul(growth(mix([0.4, 0.32, 0.22], [0.3, 0.26, 0.2], fract(Math.sin(px * 7 + pz * 3) * 99)), px, py + yDeck, pz, 0.5), 0.8), [0, yaw, 0]);
  const aircraft = (x, y, z, yaw, tilt = 0) => {
    const from = m.nv, ac = (px, py, pz) => mul(growth(mix([0.4, 0.45, 0.38], [0.28, 0.3, 0.25], 0.4), px + x, py + y, pz + z, 0.3), 0.85);
    limb(m, [0, 0, -3.2], [0, 0, 2.2], 0.55, 0.5, 8, 3, ac, { capStart: true }); limb(m, [0, 0, -3.2], [0, 0.4, -4.4], 0.4, 0.1, 6, 1, ac);
    boxM([0, 0.0, 0.2], [3.6, 0.07, 0.7], ac); boxM([0, 0.25, -4.0], [1.2, 0.05, 0.4], ac); boxM([0, 0.7, -3.9], [0.05, 0.6, 0.45], ac);
    limb(m, [0, 0, 2.2], [0, 0, 2.5], 0.16, 0.16, 6, 1, (px, py, pz) => mul(RUSTC, 0.7)); limb(m, [-1.4, 0, 2.55], [1.4, 0, 2.55], 0.07, 0.05, 4, 1, metalCol, { capStart: true });
    const f = rotFn(tilt, yaw, tilt * 0.4); m.map(from, (p) => { const q = f(p); return [q[0] + x, q[1] + y, q[2] + z]; });
    cols.push([x, y, z, 1.8, 1], [x - Math.sin(yaw) * 2.5, y, z - Math.cos(yaw) * 2.5, 1.2, 1]);
  };
  const amphora = (x, y, z, rng2, sc = 1) => {
    const from = m.nv, ac = (px, py, pz) => mul(growth(mix([0.58, 0.4, 0.26], [0.45, 0.32, 0.22], 0.5 + 0.4 * nz.n3(px * 3 + x, py * 3, pz * 3)), px + x, py + y, pz + z, 0.1), 0.9);
    ellipsoid(m, [0, 0, 0], [0.3, 0.5, 0.3], 7, 5, { attr: ac });
    limb(m, [0, 0.4, 0], [0, 0.85, 0], 0.1, 0.07, 6, 1, ac); limb(m, [0.06, 0.8, 0], [0.26, 0.5, 0], 0.025, 0.025, 3, 1, ac);
    const f = rotFn(rng2() * 2.4 + 0.3, rng2() * TAU, rng2() * 0.6); m.map(from, (p) => { const q = f([p[0] * sc, p[1] * sc, p[2] * sc]); return [q[0] + x, q[1] + y, q[2] + z]; });
  };
  const bomb = (x, y, z, yaw) => {
    const from = m.nv, bc = (px, py, pz) => mul(growth([0.3, 0.32, 0.2], px + x, py + y, pz + z, 0.2), 0.85);
    limb(m, [0, 0, -0.9], [0, 0, 0.8], 0.2, 0.2, 7, 2, bc, { capStart: true }); limb(m, [0, 0, -0.9], [0, 0, -1.4], 0.18, 0.05, 6, 1, bc);
    boxM([0, 0, -1.1], [0.3, 0.02, 0.18], bc); boxM([0, 0, -1.1], [0.02, 0.3, 0.18], bc);
    place(from, [0, yaw, 0], [x, y, z]);
    cols.push([x, y, z, 0.7, 1]);
  };
  const ingot = (x, y, z, yaw) => {
    const from = m.nv, ic = (px, py, pz) => mul(growth(mix([0.55, 0.33, 0.18], [0.35, 0.4, 0.25], 0.3 + 0.4 * nz.n3(px * 5 + x, py * 5, pz * 5)), px + x, py + y, pz + z, 0.1), 0.9);
    boxM([0, 0, 0], [0.5, 0.05, 0.32], ic);
    for (const [ex, ez] of [[-0.5, -0.32], [0.5, -0.32], [-0.5, 0.32], [0.5, 0.32]]) boxM([ex * 1.05, 0, ez * 1.05], [0.12, 0.05, 0.1], ic);
    place(from, [0, yaw, 0], [x, y, z]);
  };
  const cannon = (x, y, z, side, rotY = 0) => {
    const from = m.nv, cc = (px, py, pz) => mul(mix([0.14, 0.14, 0.15], RUSTC, 0.3 + 0.2 * nz.n3(px * 4 + off, py * 4, pz * 4)), 0.9);
    limb(m, [0, 0, -0.9], [0, 0, 0.9], 0.2 * k + 0.08, 0.14 * k + 0.06, 6, 2, cc, { capStart: true });
    boxM([0, -0.25, -0.1], [0.28, 0.12, 0.6], woodCol2);
    place(from, [0.05, side > 0 ? Math.PI / 2 + rotY : -Math.PI / 2 + rotY, 0], [x, y, z]);
  };
  const barrelPipe = (a, b, r) => limb(m, a, b, r, r, 8, Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 3)), (px, py, pz) => mul(growth(mix(T.a, RUSTC, 0.4), px, py, pz, 0.2), 0.8), { capStart: true });

  // =============================================================================== per-hull layouts
  const V = spec.hull;
  const sideDir = () => (rng() < 0.5 ? -1 : 1);
  if (V === 'freighter' || V === 'ferry') {
    deckSlab(zOf(0.72), zOf(0.93), 8, 0.1, (i, j) => (i >= 6 && i < 8 && j >= 2 && j < 4) || nz.n3(i * 0.8 + off, j * 0.8, 3) > 0.62);
    deckSlab(zOf(0.1), zOf(0.42), 12, 0.25, (i, j) => nz.n3(i * 0.7, j * 0.7 + off, 9) > 0.55);
    const dhTop = yDeck + (V === 'ferry' ? 0.9 : 0.43) * B;
    const dh = { x0: -0.34 * B, x1: 0.34 * B, y0: yDeck - 0.3, y1: dhTop, z0: zOf(V === 'ferry' ? 0.52 : 0.03) + 1.2 * kz, z1: zOf(V === 'ferry' ? 0.52 : 0.03) + (V === 'ferry' ? 0.3 * L : 10.2 * kz) };
    house(dh, { broken: 'right', roofHole: true, sag: 0.5 });
    const br = { x0: -0.28 * B, x1: 0.28 * B, y0: dh.y1 - 0.1, y1: dh.y1 + 0.26 * B, z0: dh.z1 - 4.0 * kz, z1: dh.z1 - 0.5 * kz };
    house(br, { broken: 'left', sag: 0.2 });
    m.surface(3, 2, (i, j) => [lerp(-0.38 * B, 0.38 * B, i / 3), br.y0 + 1.0 * k + 0.04 * nz.n2(i, j), lerp(br.z0 + 0.4, br.z1 - 0.2, j / 2)], (x, y, z) => mul(paintCol(x, y, z, br.y0), 0.85), { mode: 1, ref: () => [0, br.y0 - 6, 0], skip: (i, j) => i === 2 && j === 0 });
    const fz = V === 'ferry' ? zOf(0.2) : dh.z0 + 2.4 * kz;
    funnel(fz, V === 'ferry' ? yDeck : dh.y1 - 0.3, 4.9 * k * (V === 'ferry' ? 1.15 : 1), 1.2 * k, -0.7 - rng() * 0.5, { band: spec.funnelBand });
    mast(zOf(0.64), yDeck, 6.5 * k, 0.25, { yards: [[0.85, 1.3, 0.3], [0.65, 0.9, 0.1]] });
    limb(m, [0.4, br.y1, br.z0 + 1.4], [0.5, br.y1 + 1.8 * k, br.z0 + 1.45], 0.12 * k, 0.08 * k, 5, 2, metalCol, { capStart: true });
    const cs = sideDir();
    if (V === 'freighter') { crane(zOf(0.8), cs); crane(zOf(0.45), -cs, 4.3); hatch(zOf(0.46), zOf(0.62), 0.2 * B); hatch(zOf(0.7), zOf(0.78), 0.2 * B); }
    beacon(dh.x1 + 0.3, yDeck, dh.z1 - 3 * kz);
    // cargo
    const kind = spec.cargo || 'crates', n = Math.round((spec.cargoN || 8) * clamp(L / 60, 0.6, 1.4));
    const zr = V === 'ferry' ? [zOf(0.1), zOf(0.48)] : [zOf(0.3), zOf(0.92)];
    for (let q = 0; q < n; q++) {
      const zc = lerp(zr[0], zr[1], (q + 0.5) / n + (rng() - 0.5) * 0.03), sd = q % 2 ? 1 : -1, xx = sd * (0.12 + rng() * 0.12) * B, yy = V === 'ferry' ? 0.5 * H + rng() * 0.1 * H : 0.9 + rng() * 0.6;
      if (kind === 'trucks') truck(xx, yy, zc, (rng() - 0.5) * 1.4 + (rng() < 0.5 ? 0 : Math.PI), (rng() - 0.5) * 0.3, V === 'ferry' ? 1.25 : 1);
      else if (kind === 'trains') { if (q % 3 === 0) locomotive(xx * 0.4, yy + 0.2, zc, (rng() - 0.5) * 0.4 + (rng() < 0.5 ? 0 : Math.PI), (rng() - 0.5) * 0.25); else truck(xx, yy, zc, (rng() - 0.5) * 1.4, (rng() - 0.5) * 0.3); }
      else if (kind === 'planes') { if (q % 2 === 0) aircraft(xx * 0.5, yy + 0.4, zc, (rng() - 0.5) * 1.2, (rng() - 0.5) * 0.3); else crate(xx, yy, zc, 1.3 + rng(), rng() * 3); }
      else if (kind === 'bombs') { const yw = rng() * 0.3; for (let c2 = 0; c2 < 4; c2++) bomb(xx + (c2 - 1.5) * 0.7, yy + 0.2, zc + (rng() - 0.5) * 0.6, yw); if (q % 5 === 2) truck(-xx, yy, zc, rng() * 6, 0.2, 0.7); }
      else for (let c2 = 0; c2 < 3; c2++) crate(xx + (rng() - 0.5) * 2, yy + c2 * 0.15, zc + (rng() - 0.5) * 2, 0.8 + rng() * 1.1, rng() * 3);
    }
    if (V === 'ferry') for (let q = 0; q < 3; q++) truck(sideDir() * 0.2 * B, yDeck - 0.4, zOf(0.55 + q * 0.12), rng() * 6, 0.3);
  } else if (V === 'liner') {
    deckSlab(zOf(0.08), zOf(0.16), 5, 0.2, (i, j) => nz.n3(i * 0.7, j * 0.7 + off, 9) > 0.45);
    deckSlab(zOf(0.8), zOf(0.95), 6, 0.2, (i, j) => nz.n3(i * 0.7, j * 0.7 + off, 7) > 0.45);
    const t1 = { x0: -0.42 * B, x1: 0.42 * B, y0: yDeck - 0.3, y1: yDeck + 0.32 * B, z0: zOf(0.14), z1: zOf(0.76) };
    house(t1, { broken: 'right', roofHole: true, sag: 0.6, rot: true });
    const t2 = { x0: -0.34 * B, x1: 0.34 * B, y0: t1.y1 - 0.1, y1: t1.y1 + 0.28 * B, z0: zOf(0.22), z1: zOf(0.68) };
    house(t2, { broken: 'left', sag: 0.5, rot: true });
    const t3 = { x0: -0.27 * B, x1: 0.27 * B, y0: t2.y1 - 0.1, y1: t2.y1 + 0.24 * B, z0: zOf(0.55), z1: zOf(0.67) };
    house(t3, { broken: 'right', sag: 0.2 });
    const nF = spec.funnels || 2, span = nF === 1 ? [0.4] : nF === 2 ? [0.32, 0.46] : [0.28, 0.4, 0.52];
    span.forEach((f, q) => funnel(zOf(f), t2.y1 - 0.4, 5.6 * k * (1 - 0.05 * q), 1.3 * k, -0.5 - rng() * 0.8 - q * 0.2, { band: spec.funnelBand, base: spec.funnelBase }));
    mast(zOf(0.82), yDeck, 8 * k, 0.4, { yards: [[0.85, 1.6, 0.2], [0.6, 1.1, 0.1]] }); mast(zOf(0.1), yDeck, 5.5 * k, -0.3, { yards: [[0.8, 1.0, 0.2]] });
    const sd = sideDir();
    for (let q = 0; q < 5; q++) { const zz = zOf(0.24 + q * 0.1); lifeboat(sd * (t2.x1 + 0.7), t1.y1 + 0.6 * k, zz, 0.08 * (q - 2), 3 + k); if (q % 2 === 0) lifeboat(-sd * (t2.x1 + 0.7), t1.y1 + 0.4 * k, zz + 1, 0.2, 3 + k); }
    crane(zOf(0.9), sd, 3.6); beacon(t1.x1 + 0.3, yDeck, zOf(0.78));
    const kind = spec.cargo;
    if (kind === 'trucks') for (let q = 0; q < 6; q++) truck(sideDir() * 0.15 * B, 0.9, zOf(0.1 + q * 0.14), rng() * 6, 0.25);
    else if (kind === 'crates') for (let q = 0; q < 8; q++) crate((rng() - 0.5) * 0.4 * B, 0.9, zOf(0.1 + rng() * 0.8), 0.8 + rng(), rng() * 3);
  } else if (V === 'warship') {
    deckSlab(zOf(0.05), zOf(0.25), 8, 0.15, (i, j) => nz.n3(i * 0.7, j * 0.7 + off, 4) > 0.3, steelDeckCol);
    const tw = spec.tower || 0.5, tl = (spec.towerLen || 0.12) * L;
    const t1 = { x0: -0.3 * B, x1: 0.3 * B, y0: yDeck - 0.3, y1: yDeck + 0.34 * B, z0: zOf(tw) - tl / 2, z1: zOf(tw) + tl / 2 };
    house(t1, { broken: 'right', roofHole: true, sag: 0.5, rot: true });
    const t2 = { x0: -0.22 * B, x1: 0.22 * B, y0: t1.y1 - 0.1, y1: t1.y1 + 0.26 * B, z0: t1.z0 + tl * 0.3, z1: t1.z1 - 0.1 * tl };
    house(t2, { broken: 'left', sag: 0.25 });
    for (const [f, nB, sc] of spec.turrets || [[0.82, 2, 1]]) turret(zOf(f), yDeck + 0.2, sc * k, nB, f > 0.5 ? 0 : Math.PI + (rng() - 0.5) * 0.4);
    const nF = spec.funnels || 1;
    for (let q = 0; q < nF; q++) funnel(lerp(t1.z0 - 2, zOf(Math.max(0.1, tw - 0.2)), nF === 1 ? 0 : q / (nF - 1)) + (nF === 1 ? -tl * 0.3 : 0), yDeck - 0.1, 4.2 * k, 1.1 * k, -0.6 - rng() * 0.6, { band: spec.funnelBand, base: spec.funnelBase || [0.2, 0.22, 0.24] });
    mast(zOf(tw) + tl * 0.1, t2.y1 - 0.2, 6.5 * k, -0.6, { yards: [[0.7, 1.4, 0.3], [0.45, 0.9, 0.1]] });
    if (spec.aftCrane) { crane(zOf(0.18), 1, 5.5); }
    beacon(t1.x1 + 0.3, yDeck, t1.z1 + 1);
    if (spec.cargo === 'crates') for (let q = 0; q < 6; q++) crate((rng() - 0.5) * 0.4 * B, 0.9, zOf(0.1 + rng() * 0.3), 0.8 + rng(), rng() * 3);
  } else if (V === 'tanker') {
    deckSlab(zOf(0.28), zOf(0.62), 14, 0.2, (i, j) => nz.n3(i * 0.6 + off, j * 0.6, 8) > 0.5, steelDeckCol);
    deckSlab(zOf(0.64), zOf(0.8), 8, 0.2, (i, j) => nz.n3(i * 0.6, j * 0.6 + off, 2) > 0.45, steelDeckCol);
    const dh = { x0: -0.36 * B, x1: 0.36 * B, y0: yDeck - 0.3, y1: yDeck + 0.46 * B, z0: zOf(0.02) + 1.0 * kz, z1: zOf(0.02) + 9.5 * kz };
    house(dh, { broken: 'right', roofHole: true, sag: 0.5 });
    const br = { x0: -0.3 * B, x1: 0.3 * B, y0: dh.y1 - 0.1, y1: dh.y1 + 0.26 * B, z0: dh.z1 - 4.0 * kz, z1: dh.z1 - 0.5 * kz };
    house(br, { broken: 'left', sag: 0.2 });
    funnel(dh.z0 + 2.2 * kz, dh.y1 - 0.3, 4.2 * k, 1.1 * k, -0.6, { band: spec.funnelBand, base: [0.12, 0.12, 0.13] });
    const fo = { x0: -0.2 * B, x1: 0.2 * B, y0: yDeck - 0.2, y1: yDeck + 0.18 * B, z0: zOf(0.88), z1: zOf(0.88) + 4.5 * kz };
    house(fo, { sag: 0.2, broken: 'left' });
    // catwalk, pipes and tank hatches
    const gz0 = dh.z1 + 1, gz1 = zOf(0.84);
    boxM([0, yDeck + 1.1 * k, (gz0 + gz1) / 2], [0.4 * k, 0.05, (gz1 - gz0) / 2], (x, y, z) => mul(metalCol(x, y, z), 1));
    for (const px of [-1.4 * k, 1.4 * k]) barrelPipe([px, yDeck + 0.35 * k, gz0], [px, yDeck + 0.35 * k, gz1], 0.26 * k);
    for (let q = 0; q < 6; q++) { const zz = lerp(zOf(0.3), zOf(0.78), q / 5), x0c = sideDir() * 1.6 * k; sweep(m, { path: (t) => [x0c, yDeck + t * 0.5 * k, zz], rings: 1, sides: 8, radius: () => 0.62 * k, capEnd: false, attr: metalCol }); }
    for (let q = 0; q < 4; q++) limb(m, [0, yDeck + 1.1 * k, lerp(gz0, gz1, (q + 0.5) / 4)], [(q % 2 ? 1 : -1) * 0.34 * B, yDeck + 0.5 * k, lerp(gz0, gz1, (q + 0.5) / 4)], 0.09 * k, 0.09 * k, 4, 2, metalCol);
    mast(zOf(0.9), yDeck, 6 * k, 0.4, { yards: [[0.8, 1.0, 0.1]] });
    beacon(dh.x1 + 0.3, yDeck, dh.z1 + 1);
    for (let q = 0; q < 2; q++) { const zz = zOf(0.4 + q * 0.18); cols.push([0, yDeck + 0.6, zz, 1.5, 1]); }
  } else if (V === 'trawler') {
    deckSlab(zOf(0.1), zOf(0.4), 7, 0.12, (i, j) => nz.n3(i * 0.7, j * 0.7 + off, 4) > 0.4);
    const wh = { x0: -0.3 * B, x1: 0.3 * B, y0: yDeck - 0.3, y1: yDeck + 0.38 * B, z0: zOf(0.52), z1: zOf(0.74) };
    house(wh, { broken: 'right', roofHole: true, sag: 0.4, rot: true });
    const br = { x0: -0.26 * B, x1: 0.26 * B, y0: wh.y1 - 0.1, y1: wh.y1 + 0.22 * B, z0: wh.z0 + 0.6, z1: wh.z1 - 0.8 };
    house(br, { broken: 'left', sag: 0.2 });
    funnel(wh.z0 - 1.0, wh.y1 - 0.3, 3.0 * k, 0.8 * k, -0.4, { band: spec.funnelBand, base: spec.funnelBase });
    mast(zOf(0.84), yDeck, 9 * k, 0.5, { yards: [[0.85, 1.6, 0.2], [0.6, 1.0, 0.1]] }); mast(zOf(0.3), yDeck, 8 * k, -0.4, { yards: [[0.8, 1.3, 0.15]] });
    // stern A-frame
    const az = zOf(0.07);
    limb(m, [-0.28 * B, yDeck, az], [-0.04 * B, yDeck + 5.2 * k, az + 0.6], 0.14 * k, 0.1 * k, 5, 3, metalCol); limb(m, [0.28 * B, yDeck, az], [0.04 * B, yDeck + 5.2 * k, az + 0.6], 0.14 * k, 0.1 * k, 5, 3, metalCol);
    limb(m, [-0.06 * B, yDeck + 5.2 * k, az + 0.6], [0.06 * B, yDeck + 5.2 * k, az + 0.6], 0.1 * k, 0.1 * k, 4, 1, metalCol);
    ellipsoid(m, [0, yDeck + 0.2, zOf(0.4)], [0.9 * k, 0.35 * k, 0.65 * k], 8, 4, { exp: 0.4, attr: metalCol });
    crane(zOf(0.46), sideDir(), 3.6);
    beacon(wh.x1 + 0.2, yDeck, wh.z1 + 0.6);
    cols.push([0, yDeck + 1.2, az, 1.8, 1]);
  } else if (V === 'galleon') {
    deckSlab(zOf(0.05), zOf(0.3), 9, 0.15, (i, j) => nz.n3(i * 0.6, j * 0.6 + off, 4) > 0.2);
    deckSlab(zOf(0.46), zOf(0.88), 14, 0.2, (i, j) => nz.n3(i * 0.6 + off, j * 0.6, 4) > 0.15);
    const guns = !spec.merchant;
    if (spec.masts === 2) {
      mast(zOf(0.62), yDeck - 0.3, 10 * k, 0.5, { wood: true, r: 0.4 * k, yards: [[0.75, 2.6, 0.4], [0.5, 2.0, 0.1]] });
      mast(zOf(0.3), yDeck - 0.3, 9 * k, -0.4, { wood: true, r: 0.36 * k, yards: [[0.7, 2.2, 0.2]] });
    } else {
      mast(zOf(0.7), yDeck - 0.3, 9 * k, 0.5, { wood: true, r: 0.42 * k, yards: [[0.75, 2.8, 0.4], [0.5, 2.2, 0.1]] });
      mast(zOf(0.4), yDeck - 0.3, 11 * k, -0.4, { wood: true, r: 0.5 * k, yards: [[0.7, 3.2, 0.2], [0.45, 2.5, 0.05]] });
      mast(zOf(0.12), yDeck + 0.5, 7 * k, -0.7, { wood: true, r: 0.34 * k, yards: [[0.8, 2.0, 0.15]] });
    }
    limb(m, [0, yDeck + 0.4 * H, zOf(0.97)], [0, yDeck + 0.9 * H, zOf(1.1)], 0.3 * k, 0.15 * k, 6, 3, woodCol2);
    const nC = Math.max(6, Math.round(L / 6));
    if (guns) for (let side of [-1, 1]) for (let q = 0; q < nC; q++) {
      const s = lerp(0.3, 0.9, q / (nC - 1)), p = hullPt(s, 0.82, side, 0.3 * k);
      if (missing(side, s, 0.8) || rng() < 0.25) continue;
      cannon(p[0] * 0.92, p[1] - 0.1, p[2], side, (rng() - 0.5) * 0.3);
    }
    if (guns) for (let q = 0; q < 6; q++) cannon((rng() - 0.5) * 0.3 * B, 1.0, zOf(0.3 + rng() * 0.5), 1, rng() * 3);
    anchor(0.3 * B, 1.3, zOf(0.84), 0.8);
    beacon(0.2 * B, yDeck, zOf(0.22));
    for (let q = 0; q < (spec.cargoN || 5); q++) crate((rng() - 0.5) * 0.3 * B, 0.6, zOf(0.4 + rng() * 0.5), 0.6 + rng() * 0.7, rng() * 3);
  } else if (V === 'ancient') {
    const r2 = mulberry32(spec.seed + 5), n = spec.cargoN || 40;
    for (let q = 0; q < n; q++) { const zz = zOf(0.15 + 0.7 * r2()), w = hullXAtY(clamp((zz - X0) / L), 0.9) * 0.8; amphora((r2() - 0.5) * 2 * w, 0.55 + r2() * 0.5 + (q > n * 0.6 ? 0.45 : 0), zz, r2, 1.1); }
    for (let q = 0; q < 9; q++) { const sd = q % 2 ? 1 : -1; amphora(sd * (B * 0.5 + 0.4 + r2() * 1.6), 0.25, zOf(0.2 + r2() * 0.6), r2, 1.0); }
    if (spec.ingots) {
      for (let q = 0; q < 7; q++) { const cx = (r2() - 0.5) * 0.35 * B, cz = zOf(0.3 + 0.4 * r2()); for (let h = 0; h < 2 + Math.floor(r2() * 3); h++) ingot(cx + (r2() - 0.5) * 0.3, 0.55 + h * 0.13, cz + (r2() - 0.5) * 0.3, r2() * 3); cols.push([cx, 0.9, cz, 1.3, 1]); }
      for (let q = 0; q < 4; q++) { const zz = zOf(0.2 + r2() * 0.6), sd = q % 2 ? 1 : -1, from = m.nv; ellipsoid(m, [0, 0, 0], [0.6, 0.35, 0.5], 7, 4, { attr: (px, py, pz) => mul(growth([0.5, 0.46, 0.4], px + zz, py, pz, 0.2), 0.85) }); place(from, [0, r2() * 3, 0], [sd * (0.12 * B + r2() * 0.2 * B), 0.8, zz]); }
    } else {
      for (let q = 0; q < 3; q++) { const zz = zOf(0.35 + q * 0.12), x = (q - 1) * 0.5; limb(m, [x - 0.1, 1.3, zz], [x + 0.9, 1.5, zz + 0.4], 0.5 * k, 0.5 * k, 9, 1, (px, py, pz) => mul(growth([0.62, 0.6, 0.55], px, py, pz, 0.1), 0.85), { capStart: true }); }
      anchor(B * 0.55, 0.5, zOf(0.78), 1.2);
    }
    beacon(-0.25 * B, 1.3, zOf(0.5));
    cols.push([0, 1.2, zOf(0.5), 2.2, 1], [0, 1.2, zOf(0.35), 2.0, 1], [0, 1.2, zOf(0.65), 2.0, 1]);
  }

  // ---- debris plates beside the hull ------------------------------------------------------------------------------
  for (let q = 0; q < 3; q++) {
    const side = q % 2 ? 1 : -1, px = side * (B / 2 + 1.2 + rng() * 2.5), pz = (rng() - 0.5) * L * 0.6, rot = (rng() - 0.5) * 0.9, from = m.nv, w = (2.4 + rng() * 1.4) * Math.max(1, k), l = (2.0 + rng() * 1.5) * Math.max(1, k);
    m.surface(4, 3, (u, v) => [(u / 4 - 0.5) * w, 0.1 * Math.sin(u + q) + 0.04 * nz.n3(u + q, v, 5), (v / 3 - 0.5) * l], (x, y, z) => outerCol(x + px, y + H * 0.3, z + pz), { mode: 1, ref: () => [0, -5, 0] });
    const rf = rotFn(0.12 * side, rot, 0.2 * side); m.map(from, (p) => { const q2 = rf(p); return [q2[0] + px, q2[1] + 0.35, q2[2] + pz]; });
  }

  // ---- colliders along the hull ------------------------------------------------------------------------------------
  const rs = clamp(B * 0.19, 1.2, 2.5), spacing = rs * 1.45, nSt = Math.max(3, Math.round((L - 2) / spacing));
  for (let q = 0; q <= nSt; q++) {
    const s = 0.03 + (q / nSt) * 0.94;
    if (inGap(s)) continue;
    for (const side of [-1, 1]) for (const g of S.cut ? [0.3, 0.55] : [0.3, 0.62, 0.92]) {
      if (g === 0.92 && q % 2) continue;
      if (missing(side, s, g) && (g > 0.8 || side === holeSide)) continue;
      const p = hullPt(s, g, side, 0);
      if (widthProf(s) < 0.2 && g < 0.5) continue;
      cols.push([p[0], p[1], p[2], rs, 1]);
    }
    if (q % 2 === 0 && widthProf(s) > 0.3) { const p = hullPt(s, 0, 1, 0); cols.push([0, p[1] + 0.2, p[2], rs, 1]); }
  }
  cols.push([0, 1.0, X0 - 1.1, 1.5, 1]);

  // ---- pieces --------------------------------------------------------------------------------------------------------
  const bz = L > 70 ? 10 : 7.5, bin = (x, y, z) => `${Math.floor((z + 1) / bz)},${x < 0 ? 0 : 1},${Math.floor(y / 6)}`;
  const pieces = [...m.bin(bin, { facet: 0.3 }).values()].map((tpl) => makePiece(tpl));
  assignColliders(pieces, cols);
  const height = Math.max(...pieces.map((p) => tplBounds(p.tpl).max[1]));
  return { pieces, length: L, beam: B, height, tris: pieces.reduce((s, p) => s + p.tpl.count / 3, 0) };
}

// =====================================================================================================================
/** a submarine on its side of the world: pressure hull, conning tower, deck gun, hydroplanes and propellers */
function buildSub(spec) {
  const L = spec.length, B = spec.beam, R = B / 2, k = B / 6;
  const rng = mulberry32(spec.seed * 4093 + 71), nz = noiseKit(spec.seed * 13 + 9), off = rng() * 60;
  const T = TONES[spec.tone || 'grey'];
  const m = new Mesh(), cols = [], X0 = -L / 2, cy = R * 1.05;
  const prof = (t) => (t < 0.08 ? Math.sqrt(1 - Math.pow(1 - t / 0.08, 2)) * 0.9 + 0.1 * (t / 0.08) : t > 0.9 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.9) / 0.1, 1.8))) * 0.9 + 0.1 * (1 - t) / 0.1 * 0.3 : 1);
  const growth = (col, x, y, z, up) => {
    col = mix(col, ALGAE, smooth(0.1, 0.55, nz.n3(x * 0.9 + off, y * 0.8, z * 0.9)) * (0.4 + up * 0.3));
    col = mix(col, CRUST, smooth(0.5, 0.75, nz.n3(x * 1.7 - off, y * 1.5, z * 1.7)) * 0.4);
    const cp = smooth(0.45, 0.75, nz.n3(x * 0.5 + off * 1.7, y * 0.45, z * 0.5)) * 0.55;
    if (cp > 0.01) col = mix(col, mul(CORALS[Math.floor((nz.n3(x * 0.18 + 9, y * 0.2, z * 0.18) + 1) * 2) & 3], 0.95), cp * 1.2);
    return mul(col, 0.94 + 0.12 * nz.n3(x * 7, y * 7, z * 7));
  };
  const hullCol = (x, y, z) => mul(growth(mix(T.a, T.b, smooth(-0.3, 0.5, nz.n3(x * 0.5 + off, y * 0.4, z * 0.5))), x, y, z, 0.3), 0.55 + 0.45 * smooth(-R, R * 2, y));
  const metal = (x, y, z) => mul(growth(mix(T.a, RUSTC, 0.4), x, y, z, 0.2), 0.8);
  const boxM = (c, h, col) => {
    const [x, y, z] = c, [hx, hy, hz] = h;
    const faces = [
      [[x - hx, y - hy, z + hz], [2 * hx, 0, 0], [0, 2 * hy, 0]], [[x + hx, y - hy, z - hz], [-2 * hx, 0, 0], [0, 2 * hy, 0]],
      [[x + hx, y - hy, z + hz], [0, 0, -2 * hz], [0, 2 * hy, 0]], [[x - hx, y - hy, z - hz], [0, 0, 2 * hz], [0, 2 * hy, 0]],
      [[x - hx, y + hy, z - hz], [2 * hx, 0, 0], [0, 0, 2 * hz]], [[x - hx, y - hy, z + hz], [2 * hx, 0, 0], [0, 0, -2 * hz]],
    ];
    for (const [o, u, v] of faces) m.surface(2, 2, (i, j) => [o[0] + u[0] * i / 2 + v[0] * j / 2, o[1] + u[1] * i / 2 + v[1] * j / 2, o[2] + u[2] * i / 2 + v[2] * j / 2], col, { mode: 1, ref: () => c });
  };
  // pressure hull: swept ellipse, one side blasted open
  const holeA = 1.2 + rng() * 0.6, holeT = 0.45 + rng() * 0.15;
  sweep(m, {
    path: (t) => [0, cy, X0 + t * L], rings: Math.round(L / 1.6), sides: 14, radius: (t, a) => R * prof(t) * (1 - 0.5 * Math.max(0, 1 - Math.hypot((t - holeT) / 0.05, (((a - holeA + Math.PI * 3) % TAU) - Math.PI) / 0.5)) * 0.35),
    scale: () => [1, 0.92], capEnd: true, capStart: true, capH: 0.3, attr: (x, y, z) => hullCol(x, y, z), lift: (t, a) => 0.06 * nz.n3(t * 40, a * 2, 3),
  });
  // casing / deck plates (a few missing), keel ridge, saddle tanks as ribs
  m.surface(8, Math.round(L / 1.8), (i, j) => { const t = 0.08 + 0.8 * (j / Math.round(L / 1.8)); return [(i / 8 - 0.5) * R * 0.9, cy + R * 0.92 + 0.12 + 0.03 * nz.n2(i, j), X0 + t * L]; }, (x, y, z, i, j) => mul(growth(mix(T.a, [0.28, 0.2, 0.12], 0.5 + 0.4 * ((i + j) % 2)), x, y, z, 0.6), 0.8), { mode: 1, ref: () => [0, cy, 0], skip: (i, j) => nz.n3(i * 0.9 + off, j * 0.5, 2) > 0.4 });
  for (let q = 0; q < Math.round(L / 3.2); q++) { const z = X0 + L * (0.1 + 0.8 * q / Math.round(L / 3.2)); sweep(m, { path: (t) => { const a = Math.PI * (0.15 + 0.7 * t); return [Math.cos(a) * R * 1.02, cy - Math.sin(a) * R * 0.95, z]; }, rings: 6, sides: 4, radius: () => 0.07 * k + 0.03, capEnd: true, capStart: true, attr: metal }); }
  // conning tower (fairwater) with periscopes and a rail
  const tz = X0 + L * 0.56, ty = cy + R * 0.9;
  sweep(m, { path: (t) => [0, ty + t * R * 1.5, tz], rings: 3, sides: 10, radius: (t) => R * 0.55 * (1 - 0.15 * t), scale: () => [0.8, 1.7], capEnd: true, capH: 0.1, attr: (x, y, z) => mul(growth(mix(T.a, T.b, 0.4), x, y, z, 0.7), 0.85) });
  boxM([0, ty + R * 1.55, tz - R * 0.2], [R * 0.4, 0.1 * k + 0.05, R * 0.7], metal);
  limb(m, [0.15 * k, ty + R * 1.5, tz + R * 0.1], [0.2 * k, ty + R * 3.0, tz + R * 0.15], 0.07 * k, 0.05 * k, 5, 3, metal); limb(m, [-0.2 * k, ty + R * 1.5, tz], [-0.1 * k, ty + R * 2.4, tz - R * 0.05], 0.06 * k, 0.04 * k, 5, 2, metal);
  // deck gun and flak gun
  const gz = X0 + L * 0.76;
  limb(m, [0, ty, gz], [0, ty + 0.5 * k, gz], 0.36 * k, 0.3 * k, 7, 1, metal, { capStart: true }); limb(m, [0, ty + 0.45 * k, gz - 0.2], [0.1, ty + 0.6 * k, gz + 2.6 * k], 0.12 * k, 0.09 * k, 6, 2, metal);
  limb(m, [0, ty, X0 + L * 0.4], [0, ty + 0.9 * k, X0 + L * 0.4], 0.2 * k, 0.15 * k, 6, 2, metal);
  // stern: hydroplanes, rudder, twin propellers
  for (const side of [-1, 1]) {
    boxM([side * R * 1.5, cy - 0.1, X0 + 1.4], [R * 0.7, 0.05 * k + 0.02, 0.9 * k], metal);
    const px = side * R * 0.55, pz = X0 - 0.6;
    limb(m, [px, cy - R * 0.3, X0 + 1.2], [px, cy - R * 0.3, pz], 0.11 * k, 0.1 * k, 5, 2, (x, y, z) => mul(BRONZE, 0.7), { capEnd: true });
    for (let b = 0; b < 3; b++) { const a0 = (b / 3) * TAU + side; limb(m, [px, cy - R * 0.3, pz], [px + Math.cos(a0) * R * 0.5, cy - R * 0.3 + Math.sin(a0) * R * 0.5, pz - 0.1], 0.1 * k, 0.03 * k, 4, 1, (x, y, z) => mul(BRONZE, 0.85)); }
  }
  boxM([0, cy - R * 0.2, X0 + 0.6], [0.05 * k + 0.02, R * 0.9, 0.6 * k], metal);
  // net cutter on the bow and a few torpedo-tube doors
  limb(m, [0, cy + R * 0.7, X0 + L * 0.97], [0, cy + R * 0.9, X0 + L * 0.84], 0.07 * k, 0.05 * k, 4, 3, metal);
  // glowing bell on the casing
  const bx = R * 0.7, bz = X0 + L * 0.3;
  limb(m, [bx, ty, bz], [bx, ty + 1.7 * k, bz], 0.07 * k + 0.02, 0.06 * k + 0.02, 5, 2, metal, { capStart: true });
  ellipsoid(m, [bx + 0.35, ty + 1.5 * k, bz], [0.25 * k + 0.05, 0.3 * k + 0.07, 0.25 * k + 0.05], 8, 5, { attr: () => BRASS(0.6) });
  limb(m, [bx, ty + 1.7 * k, bz], [bx + 0.35, ty + 1.7 * k, bz], 0.05 * k, 0.05 * k, 4, 1, metal);
  // colliders: the cylinder
  const n = Math.round(L / (R * 1.3));
  for (let q = 0; q <= n; q++) { const t = 0.03 + (q / n) * 0.94, r = Math.max(0.8, R * prof(t)); cols.push([0, cy, X0 + t * L, r + 0.2, 1]); }
  cols.push([0, ty + R * 1.0, tz, R * 0.85, 1], [0, ty + R * 2.0, tz, R * 0.6, 1]);
  const bz2 = 7.5, pieces = [...m.bin((x, y, z) => `${Math.floor((z + 1) / bz2)},${x < 0 ? 0 : 1}`, { facet: 0.3 }).values()].map((tpl) => makePiece(tpl));
  assignColliders(pieces, cols);
  const height = Math.max(...pieces.map((p) => tplBounds(p.tpl).max[1]));
  return { pieces, length: L, beam: B, height, tris: pieces.reduce((s, p) => s + p.tpl.count / 3, 0) };
}
