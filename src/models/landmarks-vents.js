import { mulberry32 } from '../noise.js';
import {
  Mesh, sweep, limb, ellipsoid, noiseKit, TAU, clamp, lerp, smooth, fract, mix, mul, lum, add3, scale3, norm3, lerp3,
} from './landmarks-kit.js';

// ---- palette (real colours, vertex colour space) ----------------------------------------------
const SULF = [0.06, 0.048, 0.042];
const SULF2 = [0.12, 0.09, 0.075];
const RUST = [0.5, 0.22, 0.08];
const OCHRE = [0.74, 0.5, 0.14];
const WY = [0.93, 0.88, 0.58];
const WHITE = [0.95, 0.94, 0.88];
const HOT = [0.035, 0.028, 0.026];
const CREAM = [0.9, 0.84, 0.66];
const ORANGE = [0.9, 0.52, 0.16];

/** shared mineral colouring (world-space) used by the chimneys */
function mineral(nz, x, y, z, a, t, top, seedOff) {
  const o = seedOff;
  let c = mix(SULF, SULF2, smooth(-0.4, 0.6, nz.n3(x * 2.4 + o, y * 2.1, z * 2.4)));
  const rustM = smooth(-0.05, 0.45, nz.n3(x * 1.3 + o, y * 0.9 + 4, z * 1.3));
  c = mix(c, RUST, rustM * 0.9);
  const ochM = smooth(0.25, 0.6, nz.n3(x * 1.9 - o, y * 1.5, z * 1.9 + 3));
  c = mix(c, OCHRE, ochM * 0.85);
  // pale mineral crust on upper reaches
  const crust = smooth(0.55, 0.95, t) * smooth(-0.2, 0.5, nz.n3(x * 2.2, y * 2.2 + o, z * 2.2));
  c = mix(c, WY, crust * 0.7);
  // white bacterial streaks, running down the flanks
  const st = nz.n2(a * 2.3 + o, t * 0.9);
  const streak = smooth(0.42, 0.72, st) * smooth(0.1, 0.5, t) * (0.5 + 0.5 * smooth(-0.2, 0.4, nz.n3(x * 3, y * 0.8, z * 3)));
  c = mix(c, WHITE, streak * 0.65);
  // AO: darker towards the base
  return mul(c, 0.5 + 0.5 * smooth(-0.4, top * 0.55, y));
}

// ---- hydrothermal chimneys -----------------------------------------------------------------
function chimney(seed, variant) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0x51), off = rng() * 40;
  const m = new Mesh();
  const h = [4.4, 5.6, 3.7, 6.3][variant] + (rng() - 0.5) * 0.3;
  const R0 = [1.3, 1.35, 1.2, 1.4][variant];
  const lx = (rng() - 0.5) * 1.4, lz = (rng() - 0.5) * 1.4;
  const bend = (rng() - 0.5) * 0.8;
  const base = -0.55;
  const path = (t) => [lx * t * t + bend * Math.sin(t * 3.1) * 0.25, base + t * (h - base), lz * t * t];
  const prof = (t) => R0 * (0.3 + 0.7 * Math.pow(1 - t, 1.9));
  const ledges = [0.22 + rng() * 0.08, 0.46 + rng() * 0.08, 0.7 + rng() * 0.06];
  const rad = (t, a, cx, cy, cz) => {
    let r = prof(t);
    r *= 1 + 0.2 * nz.n3(cx * 1.2 + Math.cos(a) * 1.6 + off, cy * 1.1, cz * 1.2 + Math.sin(a) * 1.6) + 0.09 * nz.n2(a * 3 + off, t * 6);
    // little shelves along the trunk
    r *= 1 + 0.08 * Math.sin(t * 40 + a * 2) * (0.4 + t);
    return Math.max(r, 0.2);
  };
  const lift = (t, a) => smooth(0.8, 1, t) * (0.3 * nz.n2(a * 1.6 + off, 3.3) + 0.12 * Math.sin(a * 3 + off));
  const sw = sweep(m, {
    path, rings: 14, sides: 11, radius: rad, lift, capEnd: false,
    attr: (x, y, z, t, a) => mineral(nz, x, y, z, a, t, h, off),
  });
  // hot vent mouth: rim, inner wall, dark floor
  const rp = sw.ringPts[14], c = sw.pts[14];
  const cen = [c[0], rp.reduce((s, p) => s + p[1], 0) / rp.length, c[2]];
  const rows = [[1, 0], [0.8, -0.04], [0.56, -0.55], [0.0, -1.0]];
  const rimCol = (j) => [mix(mix(SULF2, OCHRE, 0.5), WY, 0.2), mix(OCHRE, RUST, 0.4), HOT, HOT][j];
  m.surface(11, 3, (i, j) => {
    const p = rp[i], [k, dy] = rows[j];
    return [cen[0] + (p[0] - cen[0]) * k, (j === 0 ? p[1] : cen[1] + dy + (p[1] - cen[1]) * 0.3 * k), cen[2] + (p[2] - cen[2]) * k];
  }, (x, y, z, i, j) => rimCol(j), { wrapU: true, mode: -1, ref: (i, j) => [cen[0], rp[i][1] - 0.3, cen[2]] });
  // flanges / ledges (draped mineral shelves)
  for (let f = 0; f < ledges.length; f++) {
    const t0 = ledges[f], p0 = path(t0), r0 = prof(t0), y0 = p0[1];
    const rf = r0 * (1.2 + rng() * 0.35), droop = 0.25 + rng() * 0.25, thick = 0.25 + rng() * 0.2;
    const aOff = rng() * TAU, n = 12;
    const rr = (i) => rf * (0.72 + 0.4 * nz.n2(i * 1.9 + off + f * 9, 1.3) + 0.12 * (i % 2));
    const above = [p0[0], y0 - 3, p0[2]], below = [p0[0], y0 + 3, p0[2]];
    m.surface(n, 3, (i, j) => {
      const a = (i / n) * TAU + aOff, R = rr(i);
      const r = [r0 * 0.96, R, R * 0.93, r0 * 0.9][j];
      const y = [y0 + 0.04, y0 - droop * 0.3, y0 - droop * 0.3 - thick, y0 - droop * 0.3 - thick - 0.3][j];
      return [p0[0] + Math.cos(a) * r, y, p0[2] + Math.sin(a) * r];
    }, (x, y, z, i, j) => {
      const aa = (i / n) * TAU;
      const body = mineral(nz, x, y, z, aa, t0, h, off + f);
      const top = mix(body, WY, smooth(-0.1, 0.6, nz.n3(x * 2, y, z * 2)) * 0.55);
      return [mix(top, OCHRE, 0.15), mix(RUST, OCHRE, 0.4), mul(RUST, 0.55), mul(SULF2, 0.7)][j];
    }, { wrapU: true, ref: (i, j) => [above, p0, below, below][j] });
  }
  // secondary spires
  for (let s = 0; s < 2; s++) {
    const t0 = 0.28 + rng() * 0.25, p0 = path(t0), a = rng() * TAU, out = prof(t0) * 0.75;
    const a0 = [p0[0] + Math.cos(a) * out, p0[1], p0[2] + Math.sin(a) * out];
    const len = 0.9 + rng() * 0.8, el = 0.9 + rng() * 0.35;
    const a1 = [a0[0] + Math.cos(a) * len * 0.45, a0[1] + len * el, a0[2] + Math.sin(a) * len * 0.45];
    limb(m, a0, a1, 0.3 + rng() * 0.08, 0.1, 6, 2, (x, y, z) => mineral(nz, x, y, z, a + s, 0.9, h * 0.6, off + 5));
  }
  // rubble mound at the base
  ellipsoid(m, [0, -0.25, 0], [R0 * 1.25, 0.75, R0 * 1.25], 10, 4, {
    yMin: -0.7,
    disp: (dx, dy, dz) => 1 + 0.2 * nz.n3(dx * 2 + off, dy * 2, dz * 2) + 0.08 * Math.sin(dx * 9),
    attr: (x, y, z) => mul(mix(mix(SULF2, RUST, 0.45), OCHRE, smooth(0.2, 0.9, nz.n3(x * 2, 0, z * 2)) * 0.6), 0.5 + 0.4 * smooth(-0.4, 0.4, y)),
  });
  const tpl = m.template({ facet: 0.25 });
  tpl.top = [cen[0], cen[1] + 0.12, cen[2]]; tpl.r = R0; tpl.h = h;
  return tpl;
}

function chimneySmall(seed, variant) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0x77), off = rng() * 30;
  const m = new Mesh();
  const defs = [
    [{ x: 0, z: 0, h: 2.3, r: 0.62 }],
    [{ x: 0, z: 0, h: 1.9, r: 0.55 }, { x: 0.65, z: 0.3, h: 1.2, r: 0.38 }],
    [{ x: -0.35, z: 0, h: 1.6, r: 0.5 }, { x: 0.45, z: -0.2, h: 2.35, r: 0.5 }, { x: 0.2, z: 0.6, h: 1.25, r: 0.34 }],
  ][variant];
  let topPt = [0, 0, 0], maxH = 0;
  const colour = (x, y, z, t, a, hh) => {
    const n = nz.n3(x * 3 + off, y * 2, z * 3);
    let c = mix(RUST, ORANGE, smooth(-0.3, 0.5, n));
    c = mix(c, OCHRE, smooth(0.1, 0.8, t) * 0.7);
    c = mix(c, WY, smooth(0.8, 1.0, t) * 0.6 + smooth(0.55, 0.8, nz.n2(a * 2 + off, t * 1.7)) * 0.25);
    return mul(c, 0.55 + 0.45 * smooth(-0.3, hh * 0.5, y));
  };
  for (const d of defs) {
    const lean = (rng() - 0.5) * 0.35;
    const path = (t) => [d.x + lean * t * t * d.h, -0.3 + t * (d.h + 0.3), d.z + lean * 0.5 * t * d.h * t];
    const sw = sweep(m, {
      path, rings: 8, sides: 9, capEnd: false,
      radius: (t, a, cx, cy, cz) => {
        const stair = 1 + 0.16 * (smooth(0.0, 0.3, fract(t * 4.5 + 0.1)) - 0.5) * (1 - t * 0.5);
        return d.r * (0.4 + 0.6 * Math.pow(1 - t, 0.95)) * stair * (1 + 0.14 * nz.n3(cx * 2 + Math.cos(a) * 1.5 + off, cy * 1.4, cz * 2 + Math.sin(a) * 1.5));
      },
      lift: (t, a) => smooth(0.85, 1, t) * 0.16 * nz.n2(a * 1.4 + off, 7),
      attr: (x, y, z, t, a) => colour(x, y, z, t, a, d.h),
    });
    const rp = sw.ringPts[8], c = sw.pts[8];
    const cy = rp.reduce((s, p) => s + p[1], 0) / rp.length;
    m.surface(9, 2, (i, j) => {
      const k = [1, 0.62, 0][j], p = rp[i];
      return [c[0] + (p[0] - c[0]) * k, j === 0 ? p[1] : cy - 0.05 - j * 0.28, c[2] + (p[2] - c[2]) * k];
    }, (x, y, z, i, j) => (j === 0 ? WY : HOT), { wrapU: true, mode: -1, ref: (i, j) => [c[0], rp[i][1] - 0.2, c[2]] });
    if (d.h > maxH) { maxH = d.h; topPt = [c[0], cy + 0.08, c[2]]; }
  }
  const tpl = m.template({ facet: 0.2 });
  tpl.top = topPt; tpl.r = defs[0].r; tpl.h = maxH;
  return tpl;
}

// ---- tube worms ------------------------------------------------------------------------------
function tubeworm(seed) {
  const rng = mulberry32(seed), m = new Mesh();
  const n = 14 + (seed % 3);
  const wsw = (y) => 0.05 + 0.07 * clamp((y + 0.05) / 1.1);
  // small rocky / mat base
  ellipsoid(m, [0, 0.03, 0], [0.45, 0.1, 0.45], 6, 2, {
    yMin: -0.08,
    attr: (x, y, z) => mul(mix([0.2, 0.17, 0.15], CREAM, smooth(0.2, 0.9, Math.sin(x * 9 + z * 7) * 0.5 + 0.5) * 0.45), 0.85),
  });
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * 0.36, h = 0.5 + rng() * 0.6 * (1 - 0.5 * d);
    const tilt = 0.1 + rng() * 0.3, ta = a + (rng() - 0.5) * 1.0;
    const p0 = [Math.cos(a) * d, -0.04, Math.sin(a) * d];
    const p1 = [p0[0] + Math.cos(ta) * tilt * h, p0[1] + h, p0[2] + Math.sin(ta) * tilt * h];
    const r0 = 0.03 + rng() * 0.03, pink = rng() * 0.5;
    const sw = sweep(m, {
      path: (t) => lerp3(p0, p1, t), rings: 1, sides: 4, capEnd: false, radius: (t) => r0 * (1.1 - 0.3 * t),
      attr: (x, y, z, t) => [...mix(mix([0.96, 0.94, 0.88], [0.95, 0.78, 0.78], pink), [0.82, 0.74, 0.7], 0.25 * (1 - t)), 0, wsw(y) * 0.6],
    });
    // small feathery crimson plume, bent a little off the tube axis
    const tip = sw.pts[1], tn = sw.tans[1], pl = 0.11 + rng() * 0.07;
    const bend = [(rng() - 0.5) * 0.5, 0.15, (rng() - 0.5) * 0.5];
    const dir = norm3(add3(tn, bend));
    const red = mix([0.7, 0.03, 0.09], [0.92, 0.12, 0.14], rng());
    limb(m, tip, add3(tip, scale3(dir, pl)), r0 * 0.95, 0, 3, 1, (x, y, z) => [...mix(mix(red, [0.95, 0.55, 0.55], 0.35), red, smooth(0, pl, y - tip[1] + 0.02)), 0, wsw(y)], { capEnd: false });
  }
  return m.template({ facet: 0.3 });
}

// ---- bacterial mats ----------------------------------------------------------------------------
function mat(seed) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0x99), off = rng() * 30;
  const m = new Mesh(), n = 14;
  const R = 1.8 + rng() * 0.35, ph = rng() * TAU;
  const outline = (a) => R * (0.72 + 0.2 * nz.n2(Math.cos(a) * 1.6 + off, Math.sin(a) * 1.6) + 0.08 * Math.sin(a * 3 + ph));
  m.surface(n, 4, (i, j) => {
    const a = (i / n) * TAU, rho = j / 4, r = outline(a) * rho;
    const hy = 0.085 * smooth(1.0, 0.45, rho) * (0.75 + 0.5 * nz.n2(Math.cos(a) * rho * 3 + off, Math.sin(a) * rho * 3));
    return [Math.cos(a) * r, j === 4 ? 0.005 : 0.01 + hy, Math.sin(a) * r];
  }, (x, y, z, i, j) => {
    const n1 = nz.n2(x * 2.2 + off, z * 2.2), n2 = nz.n2(x * 4.5 - off, z * 4.5 + 2);
    let c = mix(CREAM, ORANGE, smooth(0.2, 0.75, n1));
    c = mix(c, WHITE, smooth(0.1, 0.6, n2) * 0.7);
    c = mix(c, [0.98, 0.95, 0.75], smooth(0.5, 0.9, n1 + n2 * 0.5) * 0.4);
    return j === 4 ? mul(c, 0.7) : c;
  }, { wrapU: true, ref: () => [0, -3, 0] });
  return m.template({ facet: 0 });
}

// ---- basalt column bundles -----------------------------------------------------------------
function basalt(seed, variant) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0xba), off = rng() * 20;
  const m = new Mesh();
  const d = 0.92, rc = 0.5;
  const Hmax = [2.1, 2.9, 3.4][variant];
  const cells = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      if (Math.abs(q + r) > 2) continue;
      const x = d * (q + r / 2), z = d * 0.866 * r, dist = Math.hypot(x, z);
      if (dist > 0.9 && rng() < 0.18 + dist * 0.12) continue;
      cells.push([x, z, dist]);
    }
  }
  const lum1 = (y, k, top) => {
    const v = 0.17 + 0.07 * nz.n2(k * 3.7 + off, y * 0.8) + (top ? 0.11 : 0);
    const w = v * (0.5 + 0.5 * smooth(-0.3, 1.4, y)); return [w, w * 0.95, w * 0.9];
  };
  cells.forEach(([x, z, dist], k) => {
    const hh = clamp(Hmax * (1 - 0.3 * dist / 1.8) * (0.62 + 0.55 * rng()), 1.2, 3.5);
    const tx = (rng() - 0.5) * 0.5, tz = (rng() - 0.5) * 0.5, chip = rng() < 0.4 ? Math.floor(rng() * 6) : -1;
    const rot = rng() * 0.3, lx = (rng() - 0.5) * 0.07, lz = (rng() - 0.5) * 0.07;
    const jit = Array.from({ length: 6 }, () => 0.9 + rng() * 0.18);
    const ang = (i) => (i / 6) * TAU + rot;
    const top = (i) => {
      const px = Math.cos(ang(i)) * rc * jit[i], pz = Math.sin(ang(i)) * rc * jit[i];
      return [x + px + lx, hh + tx * px + tz * pz - (i === chip ? 0.35 + rng() * 0.2 : 0), z + pz + lz];
    };
    const tops = Array.from({ length: 6 }, (_, i) => top(i));
    const ymid = hh * 0.5;
    m.surface(6, 2, (i, j) => {
      if (j === 2) return tops[i];
      const px = Math.cos(ang(i)) * rc * jit[i], pz = Math.sin(ang(i)) * rc * jit[i];
      return j === 0 ? [x + px, -0.4, z + pz] : [x + px + lx * 0.6, ymid, z + pz + lz * 0.6];
    }, (X, Y, Z, i, j) => (j === 1 ? lum1(Y, k + i * 0.17, false) : lum1(Y, k + i * 0.17, false)), { wrapU: true, ref: () => [x, hh * 0.4, z] });
    const cen = [x + lx, hh + 0.0 - 0.05, z + lz];
    m.cap(tops, cen, (X, Y, Z, c) => lum1(Y, k, true), [x, hh - 1.0, z]);
  });
  const mx = cells.reduce((s, c) => s + c[0], 0) / cells.length, mz = cells.reduce((s, c) => s + c[1], 0) / cells.length;
  m.map(0, (p) => [p[0] - mx, p[1], p[2] - mz]);
  return m.template({ facet: 0.85 });
}

// ---- pillow lava -------------------------------------------------------------------------------
function pillows(seed) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0x3c), off = rng() * 25;
  const m = new Mesh();
  const lumps = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU, d = i === 0 ? 0 : 0.4 + Math.sqrt(rng()) * 0.85;
    const big = i < 4;
    const rx = (big ? 0.55 : 0.4) + rng() * 0.22;
    const ry = (big ? 0.34 : 0.3) + rng() * 0.12;
    const y = i < 5 ? ry * 0.7 - 0.12 : 0.28 + ry * 0.45;
    lumps.push([[Math.cos(a) * d * (i < 5 ? 1 : 0.55), y, Math.sin(a) * d * (i < 5 ? 1 : 0.55)], [rx, ry, rx * (0.75 + rng() * 0.4)], rng() * TAU]);
  }
  lumps.forEach(([c, rad, rot], k) => {
    const from = m.nv;
    ellipsoid(m, [0, 0, 0], rad, 9, 5, {
      yMin: -rad[1] * 0.45,
      disp: (dx, dy, dz) => 1 + 0.1 * nz.n3(dx * 2 + k * 5 + off, dy * 2, dz * 2) + 0.045 * Math.sin(dx * 7 + dz * 5 + k),
      attr: (x, y, z, dx, dy, dz) => {
        const crack = smooth(0.82, 0.96, 1 - Math.abs(nz.n3((x + c[0]) * 4.5 + off, (y + c[1]) * 4.5, (z + c[2]) * 4.5)));
        const sheen = 0.13 + 0.2 * Math.pow(Math.max(0, dy), 1.5) * (0.6 + 0.4 * nz.n2(x * 5 + off, z * 5));
        const v = (sheen + 0.05 * nz.n3(x * 3 + k, y * 3, z * 3)) * (1 - 0.6 * crack) * (0.55 + 0.45 * smooth(-0.1, 0.55, y + c[1]));
        return [v * 1.0, v * 0.97, v * 0.93];
      },
    });
    const rf = rotFnY(rot);
    m.map(from, (p) => { const q = rf(p); return [q[0] + c[0], q[1] + c[1], q[2] + c[2]]; });
  });
  return m.template({ facet: 0.15 });
}
const rotFnY = (a) => { const c = Math.cos(a), s = Math.sin(a); return (p) => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };

// ---- lava rocks with glowing fissures --------------------------------------------------------------
function lavaRock(seed, variant) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0x1a), off = rng() * 30;
  const m = new Mesh();
  const FREQ = [1.5, 1.8, 1.25][variant];
  const seam = (x, y, z) => {
    const s1 = 1 - Math.abs(nz.n3(x * FREQ + off, y * FREQ, z * FREQ));
    const s2 = 1 - Math.abs(nz.n3(x * FREQ * 1.9 - off, y * FREQ * 1.9 + 3, z * FREQ * 1.9));
    return Math.max(smooth(0.9, 0.98, s1), 0.85 * smooth(0.955, 0.99, s2));
  };
  const parts = [
    [[0, 0.32, 0], [0.62, 0.46, 0.55]],
    ...(variant === 1 ? [[[0.62, 0.18, 0.3], [0.3, 0.22, 0.28]]] : []),
    ...(variant === 2 ? [[[-0.5, 0.15, -0.35], [0.38, 0.2, 0.34]], [[0.4, 0.14, 0.4], [0.28, 0.17, 0.26]]] : []),
  ];
  parts.forEach(([c, rad], k) => {
    const nu = k === 0 ? 17 : 9, nv = k === 0 ? 11 : 5;
    ellipsoid(m, c, rad, nu, nv, {
      yMin: -0.12,
      disp: (dx, dy, dz) => {
        const g = seam(dx * 0.5 + c[0], dy * 0.5 + c[1], dz * 0.5 + c[2]);
        return 1 + 0.2 * nz.n3(dx * 1.8 + off + k * 7, dy * 1.8, dz * 1.8) + 0.07 * nz.n3(dx * 4.5, dy * 4.5 + off, dz * 4.5) - 0.07 * g;
      },
      attr: (x, y, z) => {
        const g = seam(x, y, z);
        const warm = smooth(0.0, 0.8, seam(x * 0.8, y * 0.8, z * 0.8));
        let rock = mul([0.1, 0.085, 0.08], 0.65 + 0.7 * nz.n3(x * 5 + off, y * 5, z * 5) * 0.5 + 0.35);
        rock = mix(rock, [0.3, 0.1, 0.04], warm * 0.4);
        rock = mul(rock, 0.6 + 0.4 * smooth(-0.1, 0.6, y));
        const c = mix(rock, [1.0, 0.5, 0.1], g);
        return [c[0], c[1], c[2], g, 0];
      },
    });
  });
  return m.template({ facet: 0.45 });
}

export function ventTemplates(seed) {
  return {
    chimneys: [0, 1, 2, 3].map((k) => chimney(seed + 11 * k + 1, k)),
    chimneysSmall: [0, 1, 2].map((k) => chimneySmall(seed + 23 * k + 2, k)),
    tubeworms: [0, 1, 2].map((k) => tubeworm(seed + 31 * k + 3)),
    mats: [0, 1, 2].map((k) => mat(seed + 37 * k + 4)),
    basalt: [0, 1, 2].map((k) => basalt(seed + 41 * k + 5, k)),
    pillows: [0, 1, 2].map((k) => pillows(seed + 43 * k + 6)),
    lavaRocks: [0, 1, 2].map((k) => lavaRock(seed + 47 * k + 7, k)),
  };
}
