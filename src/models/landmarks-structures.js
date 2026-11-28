import { mulberry32 } from '../noise.js';
import {
  Mesh, sweep, limb, ellipsoid, noiseKit, TAU, clamp, lerp, smooth, fract, mix, mul, spow,
  add3, scale3, makePiece, assignColliders, tplBounds,
} from './landmarks-kit.js';

const ROCK = [0.46, 0.42, 0.36];
const ROCK_DARK = [0.3, 0.27, 0.24];
const ALGAE = [0.26, 0.44, 0.2];
const CORAL_PINK = [0.78, 0.42, 0.44];
const SAND = [0.62, 0.56, 0.42];

/** split a mesh into pieces by 3D cell of the triangle centroid */
function splitPieces(m, cell, o = {}) {
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor((y + 8) / cell)},${Math.floor(z / cell)}`;
  return [...m.bin(key, o).values()].map((tpl) => makePiece(tpl));
}

// ---- natural rock arch -------------------------------------------------------------------------
export function buildArch(seed, { span = 18, height = 11, thick = 4 } = {}) {
  const rng = mulberry32(seed * 7919 + 17), nz = noiseKit(seed * 31 + 5), off = rng() * 40;
  const m = new Mesh();
  const a = span / 2, yb = -4, crownY = height - thick / 2, Ht = crownY - yb, N = 3.4, yMid = height * 0.3;
  const tiltY = (rng() - 0.5) * 0.9, skew = (rng() - 0.5) * 1.2, asym = 0.1 + rng() * 0.08;
  const path = (t) => {
    const phi = Math.PI * (1 - t), x = a * spow(Math.cos(phi), 2 / N);
    return [x + skew * Math.sin(Math.PI * t) * 0.6, yb + Ht * spow(Math.sin(phi), 2 / N) + tiltY * (x / a), 0];
  };
  const flare = (y) => 1 + 0.6 * smooth(3, -3.5, y);
  const rp = (t, y) => (thick / 2) * flare(y) * (1 + asym * (1 - 2 * t));
  const depth = (t) => 1.45 + 0.25 * Math.sin(t * 9 + off);
  const RINGS = 52, SIDES = 18;
  const colour = (x, y, z, t) => {
    const c = path(t);
    const nx = -c[0], ny = yMid - c[1], nl = Math.hypot(nx, ny) || 1;
    const rx = x - c[0], ry = y - c[1], rl = Math.hypot(rx, ry) || 1;
    const innerFace = smooth(0.1, 0.7, (rx * nx + ry * ny) / (rl * nl));
    const band = 0.5 + 0.5 * Math.sin(y * 1.7 + 2.5 * nz.n2(x * 0.3 + off, z * 0.3));
    let col = mix(ROCK_DARK, ROCK, 0.45 + 0.35 * band + 0.2 * nz.n3(x * 0.8, y * 0.6, z * 0.8));
    col = mix(col, SAND, smooth(0.3, 0.8, nz.n3(x * 0.4 + off, y * 0.35, z * 0.4)) * 0.25);
    col = mul(col, 0.92 + 0.12 * nz.n3(x * 3.1, y * 3.1, z * 3.1));
    // algae on the upper surfaces, coral-pink and green under the lintel and on the inner faces
    const up = smooth(0.2, 1, ry / (thick * 0.6));
    col = mix(col, ALGAE, smooth(0.15, 0.55, nz.n3(x * 0.9 + off, y * 0.7, z * 0.9)) * (0.3 + 0.55 * up));
    col = mix(col, CORAL_PINK, smooth(0.25, 0.65, nz.n3(x * 1.1 - off, y * 1.2, z * 1.1)) * innerFace * 0.8);
    col = mix(col, ALGAE, smooth(0.35, 0.7, nz.n3(x * 1.4, y * 1.4 + off, z * 1.4)) * innerFace * 0.5);
    return mul(col, 0.55 + 0.45 * smooth(-1.5, 3.5, y));
  };
  const sw = sweep(m, {
    path, rings: RINGS, sides: SIDES, u0: [0, 0, 1], capEnd: false,
    radius: (t, ang, cx, cy, cz) => {
      let r = rp(t, cy);
      r *= 1 + 0.08 * (fract(cy * 0.45 + off * 0.1) - 0.5);
      r *= 1 + 0.2 * nz.n3(cx * 0.5 + Math.cos(ang) * 1.6 + off, cy * 0.4, Math.sin(ang) * 1.6 + cz * 0.5) + 0.07 * nz.n3(cx * 1.6 + off, cy * 1.6 + Math.cos(ang) * 2, Math.sin(ang) * 2);
      return r;
    },
    scale: (t) => [depth(t), 1],
    attr: (x, y, z, t) => colour(x, y, z, t),
  });
  // buried feet: cap both ends
  for (const j of [0, RINGS]) {
    const c = sw.pts[j];
    m.cap(sw.ringPts[j], c, (x, y, z) => colour(x, y, z, j / RINGS), [c[0], c[1] + 3, c[2]]);
  }
  // fallen boulders around the feet
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1, outside = i < 4;
    const x = side * (outside ? a + 3 + rng() * 3.2 : a - 3.0 + rng() * 0.6), z = (rng() - 0.5) * 8;
    const rad = outside ? 0.9 + rng() * 1.0 : 0.7 + rng() * 0.4;
    ellipsoid(m, [x, rad * 0.35, z], [rad * 1.15, rad * 0.8, rad], 8, 5, {
      yMin: -0.4,
      disp: (dx, dy, dz) => 1 + 0.18 * nz.n3(dx * 2 + i * 7, dy * 2, dz * 2),
      attr: (X, Y, Z) => colour(X, Y + 1.5, Z, x > 0 ? 0.08 : 0.92),
    });
  }
  const pieces = splitPieces(m, 6, { facet: 0.3 });
  // colliders: solid spheres inside the arch body, centred on the arch centreline
  const cols = [];
  let total = 0, prev = path(0);
  for (let k = 1; k <= 200; k++) { const q = path(k / 200); total += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; }
  const count = Math.round(total / 2.7);
  for (let k = 0; k <= count; k++) {
    const t = k / count, c = path(t), rr = rp(t, c[1]), r0 = rr * 0.9;
    if (c[1] + r0 < 0.3) continue;
    cols.push([c[0], c[1], 0, r0, 1]);
    const dzz = 0.55 * rr * depth(t), rs = r0 * 0.82;
    if (rs >= 1.3) { cols.push([c[0], c[1], dzz, rs, 1]); cols.push([c[0], c[1], -dzz, rs, 1]); }
  }
  assignColliders(pieces, cols);
  return { pieces, span, height };
}

// ---- cave: rock mound with a tunnel -------------------------------------------------------------------
/**
 * Tunnel along +z, entrance at z=0 (open to -z). Passage axis x = result.axisX(z), floor y=0.
 * Even seeds have a rear exit at z=length; odd seeds end in a rounded chamber.
 */
export function buildCave(seed, { length = 34, radius = 4.2 } = {}) {
  const rng = mulberry32(seed * 6151 + 29), nz = noiseKit(seed * 17 + 3), off = rng() * 50, ph = rng() * TAU;
  const open = Math.abs(Math.floor(seed)) % 2 === 0;
  const m = new Mesh();
  const NT = 18, nzI = Math.round(length / 1.0), dz = length / nzI;
  const Tmax = radius * 2.2, cd = radius * 1.3, zc = length - cd;
  const zEndO = length + radius * 0.9, cdO = radius * 3.0, zcO = zEndO - cdO;
  const nzO = open ? nzI : nzI + Math.round((zEndO - length) / dz);
  const zOf = (j) => j * dz;
  const axisX = (z) => { let q = radius * Math.sin(z * 0.12 + ph) * smooth(1.5, 10, z); if (open) q *= smooth(1.5, 10, length - z); return q; };
  const domeI = (z) => (open || z <= zc ? 1 : Math.sqrt(Math.max(0, 1 - ((z - zc) / cd) ** 2)));
  const domeO = (z) => (open || z <= zcO ? 1 : Math.sqrt(Math.max(0, 1 - ((z - zcO) / cdO) ** 2)));
  const baseR = (z) => radius * (1.0 + 0.1 * (0.5 + 0.5 * nz.n2(z * 0.15 + off, 3.3)) + (open ? 0 : 0.25 * smooth(length - 12, length - 5, z)));
  const rough = (th, z) => (0.5 + 0.5 * nz.n3(Math.cos(th) * 1.8 + off, z * 0.4, Math.sin(th) * 1.8)) * radius * 0.13;
  const Rin = (th, z) => (baseR(z) + rough(th, z)) * domeI(z);
  const Tof = (th, z) => {
    const front = lerp(0.45, 1, smooth(0, 9, z));
    const back = open ? lerp(0.45, 1, smooth(0, 9, length - z)) : 1;
    return Tmax * front * back * (0.85 + 0.3 * nz.n3(Math.cos(th) * 1.2 + off, z * 0.12, Math.sin(th) * 1.2 + 7)) * (0.6 + 0.4 * Math.sin(th));
  };
  const dArea = (z) => (open ? Math.min(z, length - z) : z);
  const inShape = (th, z) => { const r = Rin(th, z); return [r, 0.95 * r]; };
  const outShape = (th, z) => {
    const d = domeO(z), r = Rin(th, z), t = Tof(th, z);
    const bump = radius * 0.3 * (nz.n3(Math.cos(th) * 2.6 + off, z * 0.32, Math.sin(th) * 2.6) + 0.45 * nz.n3(Math.cos(th) * 6 + off, z * 0.8, Math.sin(th) * 6 + 3)) * smooth(1, 8, dArea(z));
    return [d * (r + 1.2 * t + bump), d * 0.95 * (r + t + bump)];
  };
  // profile: 0 = buried skirt (+x), 1..NT+1 = arc theta 0..PI, NT+2 = buried skirt (-x)
  const NU = NT + 2;
  const prof = (i, shape, z) => {
    const cx = axisX(z);
    if (i === 0) return [cx + shape(0, z)[0], -3.2, z];
    if (i === NU) return [cx - shape(Math.PI, z)[0], -3.2, z];
    const th = ((i - 1) / NT) * Math.PI, [rx, ry] = shape(th, z);
    return [cx + rx * Math.cos(th), ry * Math.sin(th), z];
  };
  const innerPt = (i, j) => prof(i, inShape, zOf(j));
  const outerPt = (i, j) => prof(i, outShape, zOf(j));
  // colours
  const accent = (x, y, z, d) => {
    const near = smooth(6, 0, d);
    const p = smooth(0.3, 0.7, nz.n3(x * 1.2 + off, y * 1.2, z * 1.2));
    return { pink: near * p * smooth(0.2, 0.7, nz.n3(x * 0.9 - off, y, z)), green: near * smooth(0.0, 0.5, nz.n3(x * 0.8, y * 0.8 + off, z * 0.8)) };
  };
  const inCol = (x, y, z, zz) => {
    const d = dArea(zz), dark = 0.25 + 0.75 * (1 - smooth(0, 11, d));
    let col = mix(ROCK_DARK, ROCK, 0.4 + 0.45 * (0.5 + 0.5 * nz.n3(x * 0.9, y * 0.7, z * 0.9)));
    col = mul(col, 0.9 + 0.2 * nz.n3(x * 3, y * 3, z * 3));
    const ac = accent(x, y, z, d);
    col = mix(col, ALGAE, ac.green * 0.55);
    col = mix(col, CORAL_PINK, ac.pink * 0.6);
    return mul(col, 1.25 * dark * (0.7 + 0.3 * smooth(0, 2.5, y)) * (1 + 0.45 * smooth(2.5, 0, d)));
  };
  const outCol = (x, y, z, zz) => {
    const d = dArea(zz);
    const band = 0.5 + 0.5 * Math.sin(y * 1.5 + 2.2 * nz.n2(x * 0.25 + off, z * 0.25));
    let col = mix(ROCK_DARK, ROCK, 0.4 + 0.4 * band + 0.2 * nz.n3(x * 0.7, y * 0.5, z * 0.7));
    col = mul(col, 0.92 + 0.12 * nz.n3(x * 3, y * 3, z * 3));
    col = mix(col, ALGAE, smooth(0.1, 0.55, nz.n3(x * 0.8 + off, y * 0.6, z * 0.8)) * (0.25 + 0.6 * smooth(2, 9, y)));
    col = mix(col, CORAL_PINK, accent(x, y, z, d).pink * 0.5);
    col = mix(col, SAND, 0.15);
    return mul(col, (0.55 + 0.45 * smooth(-1, 3, y)) * (1 + 0.25 * smooth(5, 0, d)));
  };
  // skylights: holes are lattice cell blocks present in both shells
  const holes = [];
  for (let h = 0; h < (open ? 1 : 2); h++) holes.push({ i0: Math.floor(NU / 2) - 1 + (h % 2), cw: 2, j0: Math.floor(nzI * (open ? 0.5 : 0.35 + 0.28 * h)), ch: 1 });
  const inHole = (i, j) => holes.some((h) => i >= h.i0 && i < h.i0 + h.cw && j >= h.j0 && j < h.j0 + h.ch);
  const refAxis = (j) => [axisX(zOf(j)), 1.4, zOf(j)];
  m.surface(NU, nzI, innerPt, (x, y, z, i, j) => inCol(x, y, z, zOf(j)), { mode: -1, ref: (i, j) => refAxis(j), skip: inHole });
  m.surface(NU, nzO, outerPt, (x, y, z, i, j) => outCol(x, y, z, zOf(j)), { mode: 1, ref: (i, j) => refAxis(j), skip: inHole });
  // entrance (and exit) rims joining the two shells
  const rim = (j, dirZ) => m.surface(NU, 1, (i, jj) => (jj === 0 ? innerPt(i, j) : outerPt(i, j)), (x, y, z, i, jj) => (
    jj === 0 ? mul(inCol(x, y, z, zOf(j)), 1.6) : mix(outCol(x, y, z, zOf(j)), [0.78, 0.72, 0.6], 0.22)
  ), { mode: 1, ref: () => [axisX(zOf(j)), 2, zOf(j) + dirZ * 6] });
  rim(0, 1);
  if (open) rim(nzI, -1);
  // skylight shafts: lighter rim walls from the inner to the outer shell
  for (const h of holes) {
    const loop = [];
    for (let i = h.i0; i < h.i0 + h.cw; i++) loop.push([i, h.j0]);
    for (let j = h.j0; j < h.j0 + h.ch; j++) loop.push([h.i0 + h.cw, j]);
    for (let i = h.i0 + h.cw; i > h.i0; i--) loop.push([i, h.j0 + h.ch]);
    for (let j = h.j0 + h.ch; j > h.j0; j--) loop.push([h.i0, j]);
    const mean = (f) => loop.reduce((s, [i, j]) => add3(s, f(i, j)), [0, 0, 0]).map((v) => v / loop.length);
    const cin = mean(innerPt), cout = mean(outerPt);
    const refp = [(cin[0] + cout[0]) / 2, (cin[1] + cout[1]) / 2, (cin[2] + cout[2]) / 2];
    const lightC = mix(ROCK, [0.84, 0.8, 0.66], 0.5);
    for (let k = 0; k < loop.length; k++) {
      const [i1, j1] = loop[k], [i2, j2] = loop[(k + 1) % loop.length];
      const pts = [innerPt(i1, j1), innerPt(i2, j2), outerPt(i2, j2), outerPt(i1, j1)];
      const ids = pts.map((p, q) => m.v(p[0], p[1], p[2], mul(lightC, q < 2 ? 1.2 : 0.75), refp));
      m.quad(ids[0], ids[1], ids[2], ids[3], -1);
    }
  }
  // stalactite pendants near the mouths
  const mouths = open ? [[0.8, 5.5], [length - 5.5, length - 0.8]] : [[0.8, 5.5], [length - cd, length - 3]];
  for (const [z0, z1] of mouths) {
    for (let i = 0; i < 4; i++) {
      const z = lerp(z0, z1, rng()), th = Math.PI / 2 + (rng() - 0.5) * 1.4;
      const [rx, ry] = inShape(th, z), cx = axisX(z);
      const p = [cx + rx * Math.cos(th), ry * Math.sin(th), z], len = 0.7 + rng() * 1.3;
      limb(m, [p[0], p[1] + 0.25, p[2]], [p[0] + (rng() - 0.5) * 0.15, p[1] - len, p[2]], 0.3 + rng() * 0.1, 0.04, 5, 2,
        (x, y, zz) => mul(mix(ROCK, [0.75, 0.7, 0.6], 0.35), 0.2 + 0.8 * (0.25 + 0.75 * (1 - smooth(0, 11, dArea(zz))))), { capEnd: false });
    }
  }
  // boulders outside the mouths and hugging the walls inside
  const boulder = (x, z, rad, k) => ellipsoid(m, [x, rad * 0.35, z], [rad * 1.2, rad * 0.8, rad], 8, 5, {
    yMin: -0.5,
    disp: (dx, dy, dzz) => 1 + 0.18 * nz.n3(dx * 2 + k * 7, dy * 2, dzz * 2),
    attr: (X, Y, Z) => mul(outCol(X, Y + 0.5, Z, 1), 0.95),
  });
  for (let i = 0; i < 5; i++) {
    const side = i % 2 ? 1 : -1;
    boulder(axisX(0) + side * (radius + 1.6 + rng() * 5), -1.5 - rng() * 4, 0.8 + rng() * 1.1, i);
  }
  if (open) {
    for (let i = 0; i < 3; i++) boulder(axisX(length) + (i % 2 ? 1 : -1) * (radius + 2 + rng() * 4), length + 1.5 + rng() * 3, 0.8 + rng() * 1.0, i + 9);
  }
  for (let i = 0; i < 3; i++) {
    const z = 6 + rng() * (length - 12), side = rng() < 0.5 ? -1 : 1;
    boulder(axisX(z) + side * (baseR(z) - 0.2), z, 0.7 + rng() * 0.35, i + 20);
  }
  const pieces = splitPieces(m, 7, { facet: 0.4 });
  // colliders tiling the shell just outside the free passage
  const cols = [];
  const rs = clamp(radius * 0.5, 1.7, 2.5), sp = rs * 1.4;
  const nA = Math.max(3, Math.ceil((Math.PI * (radius + rs)) / sp) + 1), nR = Math.max(2, Math.round(length / sp));
  for (let r = 0; r <= nR; r++) {
    const z = clamp(0.8 + (r / nR) * (length - 1.6), 0, length - 0.5);
    for (let k = 0; k < nA; k++) {
      const th = 0.06 + (k / (nA - 1)) * (Math.PI - 0.12), Rn = Rin(th, z);
      if (Rn < 0.8 * radius) continue;
      const D = Rn + rs - 0.15;
      cols.push([axisX(z) + D * Math.cos(th), D * 0.95 * Math.sin(th), z, rs, 1]);
    }
  }
  if (!open) cols.push([axisX(length - 0.2), 1.4, length + rs * 0.35, rs, 1]);
  assignColliders(pieces, cols);
  let top = 0;
  for (const p of pieces) top = Math.max(top, tplBounds(p.tpl).max[1]);
  return { pieces, length, radius, height: top, open, axisX };
}
