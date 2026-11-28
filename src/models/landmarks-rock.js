/**
 * Geometry of the rare rock formations (see ../biomes-rock.js, ../landmarks-rock.js):
 *   sea stacks, mushroom rocks and basalt columns are instanced templates (many copies per place);
 *   the natural bridge is one assembly with its own colliders.
 * Template format: see landmarks-kit.js (colours are real colours; place with tint = null).
 */
import { mulberry32 } from '../noise.js';
import { Mesh, sweep, ellipsoid, noiseKit, TAU, clamp, smooth, fract, mix, mul, makePiece, assignColliders } from './landmarks-kit.js';

const GREY = [0.5, 0.47, 0.42], OCHRE = [0.66, 0.5, 0.32], CREAM = [0.82, 0.8, 0.72], RUST = [0.6, 0.34, 0.2];
const ALGAE = [0.28, 0.46, 0.2], CORAL_PINK = [0.78, 0.42, 0.44], ROCK = [0.46, 0.42, 0.36], ROCK_DARK = [0.3, 0.27, 0.24], SAND = [0.62, 0.56, 0.42];

// ---------------------------------------------------------------------------------------------------- sea stacks
/** unit stack: height STACK_H (y from -1 to STACK_H), base radius STACK_R; scale in the decor */
export const STACK_H = 12, STACK_R = 2.2;
/** radius profile (fraction of STACK_R) at t = 0..1 up the stack: wide foot, slim waist, overhanging cap */
export const stackRadius = (t) => 1.3 - 0.55 * smooth(0, 0.6, t) + 0.28 * smooth(0.72, 0.93, t) - 0.9 * smooth(0.96, 1, t);

function stack(seed, k) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0x3c), off = rng() * 40;
  const m = new Mesh();
  const lx = (rng() - 0.5) * [1.2, 2.0, 0.8][k], lz = (rng() - 0.5) * [1.2, 2.0, 0.8][k];
  sweep(m, {
    path: (t) => [lx * Math.pow(t, 1.6) + Math.sin(t * 2.5 + off) * 0.2, -1 + t * (STACK_H + 1), lz * Math.pow(t, 1.6)],
    rings: 30, sides: 11, capH: 0.12,
    radius: (tt, a, cx, cy, cz) => {
      const t = (cy + 1) / (STACK_H + 1);
      let r = STACK_R * stackRadius(t);
      r *= 1 + 0.2 * (fract(cy * 0.55 + off * 0.1) - 0.5);            // stepped ledges
      r *= 1 + 0.26 * nz.n3(cx * 0.7 + Math.cos(a) * 1.6 + off, cy * 0.5, cz * 0.7 + Math.sin(a) * 1.6);
      return Math.max(r, 0.15);
    },
    attr: (x, y, z, t) => {
      const band = 0.5 + 0.5 * Math.sin(y * 1.9 + 2 * nz.n2(x * 0.4 + off, z * 0.4));
      let col = mix(GREY, OCHRE, band * 0.6 + 0.2 * nz.n3(x * 0.9, y * 0.6, z * 0.9));
      col = mul(col, (0.45 + 0.55 * smooth(-0.8, 3.5, y)) * (0.92 + 0.14 * nz.n3(x * 3, y * 3, z * 3)));
      col = mix(col, [0.84, 0.82, 0.76], smooth(0.5, 0.9, nz.n3(x * 1.5 + off, y * 0.25, z * 1.5)) * 0.3 * smooth(0.35, 0.9, t));  // pale streaks high up
      col = mix(col, ALGAE, smooth(0.82, 0.94, t) * (0.55 + 0.4 * nz.n3(x * 1.2, y, z * 1.2)));                                         // green cap
      return col;
    },
  });
  return m.template({ facet: 0.6 });
}

// ---------------------------------------------------------------------------------------------------- mushroom rocks
export const MUSH = [{ H: 5.5, RS: 0.95, RC: 3.0 }, { H: 4.4, RS: 0.8, RC: 2.6 }, { H: 6.4, RS: 1.05, RC: 3.4 }];
const CAP0 = 0.66;
/** radius at height fraction t of mushroom k: slender neck, wide flat-topped cap */
export function mushRadius(k, t) {
  const { RS, RC } = MUSH[k];
  if (t < CAP0) return RS * (1 + 1.1 * Math.exp(-t * 9)) * (1 - 0.18 * smooth(0.25, CAP0, t));
  const u = (t - CAP0) / (1 - CAP0), neck = RS * 0.82;
  const dome = u < 0.3 ? 1 : Math.sqrt(Math.max(0, 1 - ((u - 0.3) / 0.7) ** 2));
  return neck + (RC * dome - neck) * smooth(0, 0.28, u);
}
function mushroom(seed, k) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0x77), off = rng() * 40;
  const m = new Mesh(), { H } = MUSH[k], lean = (rng() - 0.5) * 0.5;
  sweep(m, {
    path: (t) => [lean * t * t, -0.7 + t * (H + 0.7), 0],
    rings: 34, sides: 13, capH: 0.1,
    radius: (tt, a, cx, cy, cz) => {
      const t = (cy + 0.7) / (H + 0.7);
      let r = mushRadius(k, t);
      r *= 1 + 0.13 * nz.n3(cx * 0.6 + Math.cos(a) * 1.5 + off, cy * 0.7, cz * 0.6 + Math.sin(a) * 1.5) + 0.05 * Math.sin(a * 5 + off);
      return Math.max(r, 0.1);
    },
    attr: (x, y, z, t) => {
      const band = 0.5 + 0.5 * Math.sin(y * 3.1 + 1.6 * nz.n2(x * 0.5 + off, z * 0.5));
      let col = mix(RUST, CREAM, 0.25 + 0.5 * band * (0.6 + 0.4 * nz.n3(x * 0.9, y * 0.9, z * 0.9)));
      const under = smooth(CAP0 - 0.02, CAP0 + 0.05, t) * (1 - smooth(CAP0 + 0.05, CAP0 + 0.2, t));        // shadowed underside of the cap
      col = mul(col, 1 - 0.38 * under);
      col = mix(col, ALGAE, smooth(CAP0 + 0.16, 0.95, t) * (0.45 + 0.4 * nz.n3(x * 1.4 + off, y, z * 1.4)));   // algae on the cap top
      col = mix(col, ALGAE, (1 - smooth(0, 0.2, t)) * 0.45 * smooth(0, 0.6, nz.n3(x * 1.1, y * 0.8, z * 1.1)));  // and at the foot
      return mul(col, 0.62 + 0.38 * smooth(-0.6, 1.8, y));
    },
  });
  return m.template({ facet: 0.55 });
}

// ---------------------------------------------------------------------------------------------------- basalt columns
/** unit hexagonal prism: circumradius 1 (pointy along z, flat sides facing x), height 0..1, top chipped slightly */
function column(seed) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0x2b), off = rng() * 30;
  const m = new Mesh();
  const rad = [], topY = [];
  for (let i = 0; i < 6; i++) { rad.push(1 + (rng() - 0.5) * 0.1); topY.push(1 + (rng() - 0.5) * 0.07); }
  const ang = (i) => Math.PI / 2 + (i * Math.PI) / 3;   // vertex 0 points along +z
  const px = (i) => Math.cos(ang(i)) * rad[i % 6], pz = (i) => Math.sin(ang(i)) * rad[i % 6];
  const tone = (y, f) => {
    const v = 0.34 + 0.1 * nz.n3(f * 1.7 + off, y * 0.8, 0.5) + 0.05 * Math.sin(f * 6.3 + off);
    const warm = 0.5 + 0.5 * nz.n3(f * 0.9, y * 0.5, off);
    return mul(mix([0.95, 0.97, 1.0], [1.05, 0.95, 0.85], warm * 0.5), v * (0.55 + 0.45 * smooth(0, 0.5, y)));
  };
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6, ref = [0, 0.5, 0];
    const a = m.v(px(i), 0, pz(i), tone(0, i), ref), b = m.v(px(j), 0, pz(j), tone(0, i), ref);
    const c = m.v(px(j), topY[j], pz(j), tone(1, i), ref), d = m.v(px(i), topY[i], pz(i), tone(1, i), ref);
    m.quad(a, b, c, d, 1);
  }
  const ref = [0, 0.2, 0], tip = (i) => [px(i), topY[i], pz(i)];
  const ids = []; for (let i = 0; i < 6; i++) { const p = tip(i); ids.push(m.v(p[0], p[1], p[2], mul(CREAM, 0.5 + 0.1 * nz.n2(i, off)), ref)); }
  const ctr = m.v(0, 1 + (rng() - 0.5) * 0.08, 0, mul(CREAM, 0.5), ref);
  for (let i = 0; i < 6; i++) m.tri(ids[i], ids[(i + 1) % 6], ctr, 1);
  return m.template({ facet: 1 });
}

export function rockFormationTemplates(seed = 913) {
  return {
    stacks: [0, 1, 2].map((k) => stack(seed + 31 * k + 3, k)),
    mushrooms: [0, 1, 2].map((k) => mushroom(seed + 37 * k + 5, k)),
    columns: [0, 1, 2, 3].map((k) => column(seed + 41 * k + 7)),
  };
}

// ---------------------------------------------------------------------------------------------------- natural bridge
function splitPieces(m, cell, o = {}) {
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor((y + 8) / cell)},${Math.floor(z / cell)}`;
  return [...m.bin(key, o).values()].map((tpl) => makePiece(tpl));
}

/**
 * A broad double-span natural bridge: two openings separated by a thick middle pier, a lumpy rock deck on top.
 * Local frame: spans along x, thickness along z, ground y = 0 (feet buried). Returns { pieces, A } (A = half length).
 */
export function buildBridge(seed, { span = 14, height = 9.5, pier = 4.5, wz = 4.2 } = {}) {
  const rng = mulberry32(seed * 4931 + 11), nz = noiseKit(seed * 13 + 7), off = rng() * 40;
  const m = new Mesh();
  const yb = -3.5, a = span / 2, A = span + pier / 2 + 5, N = 2.7;
  const xs = [-(a + pier / 2), a + pier / 2], hs = [height, height * (0.8 + rng() * 0.3)];
  if (rng() < 0.5) hs.reverse();
  const roof = (x) => {
    for (let i = 0; i < 2; i++) { const u = (x - xs[i]) / a; if (Math.abs(u) < 1) return hs[i] * Math.pow(1 - Math.pow(Math.abs(u), N), 1 / N); }
    return yb;
  };
  const T = 3.0 + rng() * 1.0, hMax = Math.max(hs[0], hs[1]);
  const topY = (x) => {
    const e = 1 - smooth(A - 6, A, Math.abs(x)), crown = (hMax + T) * (1 - 0.14 * (x / A) ** 2) + 0.9 * nz.n2(x * 0.22 + off, 1.7);
    return yb + (crown - yb) * e;
  };
  // slice positions: dense near the arch springings
  const X = new Set([-A, A, xs[0] - a, xs[0] + a, xs[1] - a, xs[1] + a, 0]);
  for (let i = 0; i < 2; i++) for (let q = -15; q <= 15; q++) X.add(xs[i] + a * Math.sin((q / 15) * Math.PI / 2) * 0.999);
  for (let q = 1; q <= 6; q++) { X.add(-(xs[1] + a) - (A - xs[1] - a) * q / 7); X.add(xs[1] + a + (A - xs[1] - a) * q / 7); }
  X.add(-pier / 4); X.add(pier / 4);
  const sl = [...X].filter((x) => Math.abs(x) <= A).sort((p, q) => p - q);
  const SIDES = 18, ex = 0.75;
  const slice = (x) => {
    const bot = roof(x), top = Math.max(topY(x), bot + 0.05);
    const e = 1 - 0.45 * smooth(A - 9, A, Math.abs(x));
    return { bot, top, ymid: (top + bot) / 2, hh: (top - bot) / 2, W: wz * e * (0.85 + 0.3 * nz.n2(x * 0.18 + off, 4.1)) };
  };
  const S = sl.map(slice);
  const colour = (x, y, z, i, j) => {
    const th = (i / SIDES) * TAU, up = Math.sin(th);
    const band = 0.5 + 0.5 * Math.sin(y * 1.6 + 2.4 * nz.n2(x * 0.25 + off, z * 0.3));
    let col = mix(ROCK_DARK, ROCK, 0.4 + 0.4 * band + 0.2 * nz.n3(x * 0.7, y * 0.6, z * 0.7));
    col = mix(col, SAND, smooth(0.3, 0.8, nz.n3(x * 0.4 + off, y * 0.35, z * 0.4)) * 0.22);
    col = mul(col, 0.92 + 0.12 * nz.n3(x * 3.1, y * 3.1, z * 3.1));
    col = mix(col, ALGAE, smooth(0.1, 0.5, nz.n3(x * 0.9 + off, y * 0.7, z * 0.9)) * (0.25 + 0.55 * smooth(0.2, 1, up)));
    col = mix(col, CORAL_PINK, smooth(0.3, 0.7, nz.n3(x * 1.1 - off, y * 1.2, z * 1.1)) * smooth(0.0, -0.6, up) * 0.75);
    col = mix(col, ALGAE, smooth(0.4, 0.75, nz.n3(x * 1.4, y * 1.4 + off, z * 1.4)) * smooth(0.0, -0.6, up) * 0.4);
    return mul(col, 0.55 + 0.45 * smooth(-1.5, 3.5, y));
  };
  m.surface(SIDES, sl.length - 1, (i, j) => {
    const s = S[j], th = (i / SIDES) * TAU, c = Math.cos(th), sn = Math.sin(th);
    const lump = 1 + 0.16 * nz.n3(sl[j] * 0.4 + c * 1.5 + off, s.ymid * 0.4, sn * 1.5);
    return [sl[j], s.ymid + s.hh * Math.sign(sn) * Math.pow(Math.abs(sn), ex) * lump, s.W * Math.sign(c) * Math.pow(Math.abs(c), ex) * lump * (0.9 + 0.2 * nz.n2(sl[j] * 0.3 + off, sn * 2))];
  }, (x, y, z, i, j) => colour(x, y, z, i, j), { wrapU: true, ref: (i, j) => [sl[j], S[j].ymid, 0] });
  // fallen boulders at the feet
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1, x = side * (A * (0.55 + 0.4 * rng())) + (rng() - 0.5) * 3, z = (rng() < 0.5 ? -1 : 1) * (wz + 0.8 + rng() * 2.4), rad = 0.8 + rng() * 1.2;
    ellipsoid(m, [x, rad * 0.35, z], [rad * 1.15, rad * 0.8, rad], 8, 5, {
      yMin: -0.4, disp: (dx, dy, dz) => 1 + 0.18 * nz.n3(dx * 2 + i * 7, dy * 2, dz * 2),
      attr: (X2, Y, Z) => colour(X2, Y + 1.5, Z, 0, Math.min(S.length - 1, Math.max(0, Math.round((X2 + A) / (2 * A) * (S.length - 1))))),
    });
  }
  const pieces = splitPieces(m, 6, { facet: 0.3 });
  // colliders: spheres through the solid, centre line + both flanks; piers and ends are filled top to bottom
  const cols = [];
  for (let x = -A + 1.2; x <= A - 1.2; x += 2.2) {
    const s = slice(x), r0 = Math.min(s.hh, s.W * 0.9) * 0.9;
    if (s.top < 0.8 || r0 < 0.9) continue;
    const nY = Math.max(1, Math.ceil(s.hh * 2 / (r0 * 1.5))), y0 = Math.max(s.bot + r0, 0.6), y1 = s.top - r0;
    for (let q = 0; q < nY; q++) {
      const y = nY > 1 ? y0 + (Math.max(y0, y1) - y0) * q / (nY - 1) : s.ymid;
      if (y + r0 < 0.3) continue;
      cols.push([x, y, 0, r0, 1]);
      if (s.W > 2.8) { cols.push([x, y, s.W * 0.55, r0 * 0.8, 1]); cols.push([x, y, -s.W * 0.55, r0 * 0.8, 1]); }
    }
  }
  assignColliders(pieces, cols);
  return { pieces, A, hMax: hMax + T, wz };
}
