/**
 * Places: deterministic landmark features (big reefs, hydrothermal vents, magma rifts, volcanoes, caves, arches,
 * canyons, wrecks, rock gardens, trenches, drop-offs, seamount ridges) on a 256 m cell grid.
 * Everything is a pure function of (seed, profile, x, z); only a small bounded cache of cells is kept.
 *
 * The profile is the active submarine kind ('lemon' | 'manta' | 'barracuda' | 'squid'). It tilts the odds of every
 * kind of place and the base terrain character, but never zeroes anything: all places can occur for every sub.
 */
import { mulberry32, hash2 } from './noise.js';

export const CELL = 256;
const INV = 1 / CELL, CELL_KM2 = (CELL * CELL) / 1e6;
const EMPTY = [];

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Terrain character per submarine kind. bias: mean depth shift (m, negative = deeper). reach: deepest seabed worth placing sub-oriented places on. */
export const PROFILES = {
  lemon:     { id: 0, name: 'lemon',     bias: 0,   amp: 1,    detail: 1,    shelf: 0, rock: 0,     reef: 0.02,  reach: 58 },
  manta:     { id: 1, name: 'manta',     bias: 3,   amp: 1.1,  detail: 1.25, shelf: 0, rock: 0.08,  reef: 0.0,   reach: 44 },
  barracuda: { id: 2, name: 'barracuda', bias: -6,  amp: 0.8,  detail: 0.3,  shelf: 1, rock: -0.12, reef: -0.05, reach: 44 },
  squid:     { id: 3, name: 'squid',     bias: -20, amp: 1.1,  detail: 1,    shelf: 0, rock: 0.1,   reef: -0.03, reach: 92 },
};
export const PROFILE_IDS = Object.keys(PROFILES);

// Odds per km² for [lemon, manta, barracuda, squid]. Every entry stays > 0 so every kind of place can appear for every sub.
const RATES = {
  bigreef: [1.0, 1.0, 0.5, 0.45],
  vent:    [0.8, 0.7, 0.4, 2.4],
  magma:   [0.9, 0.9, 0.45, 2.4],
  volcano: [0.5, 0.5, 0.3, 1.8],
  cave:    [0.55, 2.0, 0.25, 0.6],
  arch:    [0.6, 2.2, 0.3, 0.5],
  canyon:  [0.5, 2.0, 0.25, 0.6],
  garden:  [0.55, 2.0, 0.3, 0.5],
  wreck:   [0.55, 1.6, 0.4, 0.5],
  trench:  [0.2, 0.2, 0.5, 1.7],
  dropoff: [0.4, 0.35, 1.9, 0.7],
  seamount:[0.3, 0.25, 1.7, 0.7],
};

// ---- polylines --------------------------------------------------------------------------------------------------
function makeLine(pts) {
  const len = []; let total = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) { const l = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]); len.push(l); total += l; }
  return { pts, len, total: total || 1 };
}
function walk(rng, x, z, ang, n, step, turn, jitter = 0) {
  const pts = [x, z];
  for (let i = 0; i < n; i++) {
    ang += (rng() - 0.5) * 2 * turn;
    const s = step * (0.7 + rng() * 0.6);
    x += Math.cos(ang) * s + (jitter ? (rng() - 0.5) * jitter : 0); z += Math.sin(ang) * s + (jitter ? (rng() - 0.5) * jitter : 0);
    pts.push(x, z);
  }
  return makeLine(pts);
}
/** a line centred on (cx, cz): walks half forward and half backward */
function centredWalk(rng, cx, cz, ang, n, step, turn, jitter) {
  const a = walk(rng, cx, cz, ang, n >> 1, step, turn, jitter), b = walk(rng, cx, cz, ang + Math.PI, n >> 1, step, turn, jitter);
  const pts = [];
  for (let i = b.pts.length - 2; i >= 2; i -= 2) pts.push(b.pts[i], b.pts[i + 1]);
  for (let i = 0; i < a.pts.length; i += 2) pts.push(a.pts[i], a.pts[i + 1]);
  return makeLine(pts);
}
let LD = 0, LT = 0, LS = 0; // nearest distance, position along line 0..1, side (+1 / -1)
function lineDist(L, x, z) {
  const p = L.pts; let best = 1e18, bt = 0, bs = 1, acc = 0;
  for (let i = 0, s = 0; i + 3 < p.length; i += 2, s++) {
    const ax = p[i], az = p[i + 1], ex = p[i + 2] - ax, ez = p[i + 3] - az, l = L.len[s];
    let t = l > 0 ? ((x - ax) * ex + (z - az) * ez) / (l * l) : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - (ax + ex * t), dz = z - (az + ez * t), d2 = dx * dx + dz * dz;
    if (d2 < best) { best = d2; bt = acc + t * l; bs = ex * dz - ez * dx >= 0 ? 1 : -1; }
    acc += l;
  }
  LD = Math.sqrt(best); LT = bt / L.total; LS = bs;
}

/**
 * @param seed world seed
 * @param base { height(x,z) (no features), rock(x,z), reef(x,z), n: {n1..n5} }
 */
export function createBiomes(seed, base) {
  const N = base.n;
  let P = PROFILES.lemon;
  const cells = new Map(), nearCache = new Map();
  let mKey = NaN, mList = EMPTY;
  const ckey = (ix, iz) => (ix + 32768) * 65536 + (iz + 32768);

  // ---------------------------------------------------------------- site selection helpers
  const depthAt = (x, z) => -base.height(x, z);
  function site(rng, ix, iz, score, tries = 8) {
    let best = null, bs = -1;
    for (let k = 0; k < tries; k++) {
      const x = (ix + 0.12 + rng() * 0.76) * CELL, z = (iz + 0.12 + rng() * 0.76) * CELL;
      const s = score(x, z);
      if (s > bs) { bs = s; best = [x, z]; }
    }
    return best;
  }
  const avgDepth = (x, z, r) => (depthAt(x, z) * 2 + depthAt(x + r, z) + depthAt(x - r, z) + depthAt(x, z + r) + depthAt(x, z - r)) / 6;

  // ---------------------------------------------------------------- feature makers
  const MAKE = {
    bigreef(rng, ix, iz) {
      const maze = rng() < (P.id === 1 ? 0.4 : 0.14);
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z); return d > 64 || d < 8 ? -1 : 0.5 + (1 - base.rock(x, z)) * 0.8 + base.reef(x, z) * 0.7 + (d < 56 ? 0.5 : 0); });
      if (!s) return null;
      const r = maze ? 62 + rng() * 48 : 72 + Math.pow(rng(), 1.25) * 112;
      return { x: s[0], z: s[1], r, R: r * 1.2 + 8, maze, lagoon: !maze && r > 95 && rng() < 0.75, o: rng() * 90, amp: 8 + rng() * 3.5, plat: -22 - rng() * 4,
        k: Math.max(8, Math.round(r / 7)) };
    },
    vent(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z); return d < 30 ? -1 : 0.3 + base.rock(x, z) + (d < 58 ? (P.id === 3 ? 0.1 : 0.9) : P.id === 3 ? 0.7 : 0.1); });
      if (!s) return null;
      const d = avgDepth(s[0], s[1], 20), deep = d > 60;
      const r = deep ? 30 + rng() * 40 : 20 + rng() * 22;
      const nCh = deep ? 8 + Math.floor(rng() * 9) : 5 + Math.floor(rng() * 6);
      const ch = []; // x, z, scale, variant, tint
      for (let i = 0; i < nCh; i++) {
        const a = rng() * 6.283, rr = r * 0.8 * Math.sqrt(rng()) * (i === 0 ? 0.15 : 1);
        ch.push(s[0] + Math.cos(a) * rr, s[1] + Math.sin(a) * rr, deep ? 1.0 + rng() * 0.9 : 0.8 + rng() * 0.7, Math.floor(rng() * 4), rng());
      }
      return { x: s[0], z: s[1], r, R: r * 1.35 + 6, deep, ch, mound: 1.2 + rng() * 1.6, o: rng() * 90 };
    },
    magma(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z), rk = base.rock(x, z); return rk < 0.5 || d < 22 ? -1 : rk + (d < 62 ? 0.6 : 0.1); });
      if (!s) return null;
      const L = 80 + rng() * 130, ang = rng() * 6.283, n = 6;
      const main = centredWalk(rng, s[0], s[1], ang, n, L / n, 0.5, 5);
      const lines = [main];
      const nb = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < nb; i++) {
        const k = 2 + Math.floor(rng() * (main.pts.length / 2 - 3)), bx = main.pts[k * 2], bz = main.pts[k * 2 + 1];
        lines.push(walk(rng, bx, bz, ang + (rng() < 0.5 ? 1 : -1) * (0.5 + rng() * 0.8), 3, 11 + rng() * 14, 0.7, 3));
      }
      return { x: s[0], z: s[1], r: L * 0.5, R: L * 0.5 + 44, lines, w: 0.9 + rng() * 1.1 };
    },
    volcano(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z), rk = base.rock(x, z); return rk < 0.4 || d < 38 ? -1 : rk + (d > 54 ? 0.4 : 0); });
      if (!s) return null;
      const d = avgDepth(s[0], s[1], 40), deepSub = P.id === 3 && rng() < 0.6;
      const summit = deepSub ? 34 + rng() * 22 : 17 + rng() * 22;      // rim depth in metres
      if (d < summit + 14) return null;
      const r = 42 + rng() * 48, craterR = 7 + rng() * 7;
      const rivers = [], nr = 3 + Math.floor(rng() * 4);
      for (let i = 0; i < nr; i++) {
        const a = rng() * 6.283, c = Math.cos(a), sn = Math.sin(a), r0 = craterR * 1.1, r1 = r * (0.45 + rng() * 0.3);
        const p = [s[0] + c * r0, s[1] + sn * r0]; let aa = a;
        for (let k = 1; k <= 5; k++) { aa += (rng() - 0.5) * 0.5; const rr = r0 + (r1 - r0) * k / 5; p.push(s[0] + Math.cos(aa) * rr, s[1] + Math.sin(aa) * rr); }
        rivers.push(makeLine(p));
      }
      return { x: s[0], z: s[1], r, R: r * 1.15 + 4, summit, craterR, rimR: craterR * 1.45, lake: rng() < 0.85, rivers, o: rng() * 90, ell: 0.85 + rng() * 0.3, ea: rng() * 6.283 };
    },
    cave(rng, ix, iz) { return oriented(rng, ix, iz, 'cave'); },
    arch(rng, ix, iz) { return oriented(rng, ix, iz, 'arch'); },
    wreck(rng, ix, iz) { return oriented(rng, ix, iz, 'wreck'); },
    canyon(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z); return d < 24 || d > P.reach + 22 ? -1 : 0.3 + base.rock(x, z) + (d < P.reach ? 0.3 : 0); });
      if (!s) return null;
      const L = 170 + rng() * 90, line = centredWalk(rng, s[0], s[1], rng() * 6.283, 8, L / 8, 0.55, 4);
      const hw = P.id === 1 ? 5 + rng() * 3.5 : 6.5 + rng() * 4.5;
      return { x: s[0], z: s[1], r: L * 0.5, R: L * 0.5 + hw * 2.2 + 20, line, hw, depth: 13 + rng() * 14, o: rng() * 90 };
    },
    trench(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => 3 - depthAt(x, z) / 30);
      if (!s) return null;
      const L = 220 + rng() * 80, hw = 36 + rng() * 40, line = centredWalk(rng, s[0], s[1], rng() * 6.283, 6, L / 6, 0.4, 6);
      const depth = P.id === 3 ? 48 + rng() * 40 : 28 + rng() * 26;
      return { x: s[0], z: s[1], r: L * 0.5, R: L * 0.5 + hw * 1.1 + 10, line, hw, depth };
    },
    dropoff(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z); return d > P.reach + 28 || d < 20 ? -1 : 1; });
      if (!s) return null;
      const L = 190 + rng() * 80, line = centredWalk(rng, s[0], s[1], rng() * 6.283, 6, L / 6, 0.3, 4);
      return { x: s[0], z: s[1], r: L * 0.5, R: L * 0.5 + 120, line, wd: 16 + rng() * 12, depth: 30 + rng() * 22, lat: 110 };
    },
    seamount(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z); return d < 38 ? -1 : 1 + (d > 56 ? 0.5 : 0); });
      if (!s) return null;
      const L = 180 + rng() * 80, line = centredWalk(rng, s[0], s[1], rng() * 6.283, 6, L / 6, 0.35, 4), hw = 38 + rng() * 30;
      const d = avgDepth(s[0], s[1], 40), crest = 16 + rng() * 14;
      return { x: s[0], z: s[1], r: L * 0.5, R: L * 0.5 + hw + 6, line, hw, rise: Math.max(14, d - crest), o: rng() * 90 };
    },
    garden(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z); return d < 18 || d > P.reach + 14 ? -1 : 0.3 + base.rock(x, z) * 1.2; });
      if (!s) return null;
      const r = 28 + rng() * 40, n = Math.round(r * 0.55), sp = []; // x, z, scale, variant, kind (0 spire, 1 slab), yaw
      for (let i = 0; i < n; i++) {
        const a = rng() * 6.283, rr = r * Math.sqrt(rng());
        sp.push(s[0] + Math.cos(a) * rr, s[1] + Math.sin(a) * rr, 0.6 + rng() * 0.9, Math.floor(rng() * 4), rng() < 0.28 ? 1 : 0, rng() * 6.283);
      }
      return { x: s[0], z: s[1], r, R: r * 1.25 + 8, sp };
    },
  };

  /** cave / arch / wreck: structures with a local frame (assembly), standing on a flat pad */
  function oriented(rng, ix, iz, kind) {
    const s = site(rng, ix, iz, (x, z) => {
      const d = depthAt(x, z), rk = base.rock(x, z);
      if (kind === 'wreck') return d < 16 || d > P.reach + 6 ? -1 : 0.4 + (1 - rk) * 0.5 + (d < P.reach ? 0.4 : 0);
      return d < 16 || d > P.reach + 14 ? -1 : 0.3 + rk * 1.0 + (d < P.reach ? 0.4 : 0);
    });
    if (!s) return null;
    const yaw = rng() * 6.283, c = Math.cos(yaw), sn = Math.sin(yaw);
    const surf = avgDepth(s[0], s[1], 14), lim = P.reach + 4, y0 = -Math.min(surf, lim), lift = Math.max(0, surf - lim);
    const f = { x: s[0], z: s[1], yaw, c, s: sn, y0, fall: 12 + lift * 1.1, lift };
    if (kind === 'cave') {
      const length = 28 + rng() * 14, radius = 3.8 + rng() * 1.0;
      Object.assign(f, { length, radius, odd: Math.floor(rng() * 1000), hx: 16, z0: -7, z1: length + 8, r: length * 0.5 + 8 });
      f.ox = f.x - sn * length * 0.5; f.oz = f.z - c * length * 0.5;   // entrance; local +z = (sin yaw, cos yaw)
      f.R = Math.hypot(f.hx + f.fall, length * 0.5 + 8 + f.fall);
    } else if (kind === 'arch') {
      const span = 15 + rng() * 10, height = 9 + rng() * 5, thick = 3.6 + rng() * 1.6;
      Object.assign(f, { span, height, thick, odd: Math.floor(rng() * 1000), hx: span / 2 + thick + 3, z0: -(thick + 6), z1: thick + 6, r: span / 2 + thick });
      f.ox = f.x; f.oz = f.z; f.R = Math.hypot(f.hx + f.fall, f.z1 + f.fall);
    } else {
      const length = 30 + rng() * 14, beam = 8 + rng() * 3;
      Object.assign(f, { length, beam, odd: Math.floor(rng() * 1000), heel: (rng() < 0.5 ? -1 : 1) * (0.12 + rng() * 0.3), pitch: (rng() - 0.5) * 0.25, r: length * 0.5 });
      f.ox = f.x; f.oz = f.z; f.R = length * 0.5 + 10 + f.fall;
      f.y0 -= 0.2;
    }
    return f;
  }

  // ---------------------------------------------------------------- cells
  const TYPE_IDS = Object.keys(RATES);
  const isLine = { canyon: 1, trench: 1, dropoff: 1, seamount: 1 };
  function cellFeatures(ix, iz) {
    const key = ckey(ix, iz);
    let list = cells.get(key);
    if (list) return list;
    list = [];
    for (let ti = 0; ti < TYPE_IDS.length; ti++) {
      const type = TYPE_IDS[ti], p = Math.min(0.9, RATES[type][P.id] * CELL_KM2);
      const rng = mulberry32(hash2(ix * 131 + ti, iz * 7 + ti * 3, seed * 31 + P.id * 977 + 5));
      if (rng() >= p) continue;
      const f = MAKE[type](rng, ix, iz);
      if (!f) continue;
      f.type = type; f.id = hash2(ix + ti * 1000, iz, seed ^ (P.id * 7919 + ti)); f.seed = hash2(ix, iz + ti * 77, seed + P.id);
      if (!isLine[type]) { let clash = false; for (const g of list) if (!isLine[g.type] && Math.hypot(g.x - f.x, g.z - f.z) < (g.r + f.r) * 0.9 + 8) { clash = true; break; } if (clash) continue; }
      list.push(f);
    }
    if (cells.size > 400) cells.clear();
    cells.set(key, list);
    return list;
  }
  function near(x, z) {
    const ix = Math.floor(x * INV), iz = Math.floor(z * INV), key = ckey(ix, iz);
    if (key === mKey) return mList;
    let list = nearCache.get(key);
    if (!list) {
      list = [];
      const x0 = ix * CELL, z0 = iz * CELL;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const f of cellFeatures(ix + dx, iz + dz)) {
        const ox = Math.max(x0 - f.x, 0, f.x - (x0 + CELL)), oz = Math.max(z0 - f.z, 0, f.z - (z0 + CELL));
        if (ox * ox + oz * oz < f.R * f.R) list.push(f);
      }
      if (nearCache.size > 300) nearCache.clear();
      nearCache.set(key, list);
    }
    mKey = key; mList = list;
    return list;
  }

  // ---------------------------------------------------------------- shapes
  /** world -> local frame of an oriented feature: sets LX, LZ */
  let LX = 0, LZ = 0;
  const toLocal = (f, x, z) => { const dx = x - f.ox, dz = z - f.oz; LX = dx * f.c - dz * f.s; LZ = dx * f.s + dz * f.c; };
  const padW = (f, x, z) => {
    toLocal(f, x, z);
    const fall = f.fall;
    const px = 1 - sstep(f.hx, f.hx + fall, Math.abs(LX));
    const pz = sstep(f.z0 - fall, f.z0, LZ) * (1 - sstep(f.z1, f.z1 + fall, LZ));
    return px * pz;
  };
  const wreckW = (f, x, z) => {
    toLocal(f, x, z);
    const q = Math.hypot(LX / (f.beam * 0.5 + 8), LZ / (f.length * 0.5 + 8));
    return 1 - sstep(0.7, 1.3, q);
  };
  const orientedW = (f, x, z) => (f.type === 'wreck' ? wreckW(f, x, z) : padW(f, x, z));

  let RU = 0, RW = 0, RLAG = 0;  // bigreef scratch: u, weight, lagoon
  function reefW(f, x, z) {
    const dx = x - f.x, dz = z - f.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d >= f.R) { RW = 0; return 0; }
    const th = Math.atan2(dz, dx), rho = f.r * (1 + 0.24 * N.n2(Math.cos(th) * 1.3 + f.o, Math.sin(th) * 1.3 - f.o));
    RU = d / rho; RW = 1 - sstep(0.8, 1.16, RU);
    RLAG = f.lagoon ? 1 - sstep(0.22, 0.42, RU) : 0;
    return RW;
  }
  function volcanoD(f, x, z) { // elliptical radial distance
    const dx = x - f.x, dz = z - f.z, c = Math.cos(f.ea), s = Math.sin(f.ea), a = dx * c + dz * s, b = -dx * s + dz * c;
    return Math.hypot(a * f.ell, b / f.ell);
  }
  function minLines(lines, x, z) { let best = 1e9; for (let i = 0; i < lines.length; i++) { lineDist(lines[i], x, z); if (LD < best) best = LD; } return best; }
  const taper = (t, e) => sstep(0, e, t) * sstep(1, 1 - e, t);

  function shapeH(f, x, z, h) {
    switch (f.type) {
      case 'bigreef': {
        if (reefW(f, x, z) <= 0) return h;
        const w = RW, u = RU;
        let rel;
        if (f.maze) {
          const m = 1 - Math.abs(N.n3(x * 0.035 + f.o, z * 0.035 - f.o));
          rel = f.amp * (0.1 + 0.9 * sstep(0.6, 0.8, m)) + 2.2 * N.n1(x * 0.12, z * 0.12) * sstep(0.6, 0.8, m);
        } else {
          const th = Math.atan2(z - f.z, x - f.x), rg = 1 - Math.abs(N.n3(x * 0.05 + f.o, z * 0.05));
          const sg = 0.5 + 0.5 * Math.cos(th * f.k + 2.5 * N.n2(x * 0.02, z * 0.02)), edge = sstep(0.45, 0.9, u);
          rel = f.amp * (0.3 + 0.7 * sstep(0.25, 0.9, rg)) * (1 - edge * (0.8 - 0.8 * sg));
          rel += 5 * sstep(0.72, 0.95, N.n4(x * 0.017 + f.o, z * 0.017)) * (1 - sstep(0.6, 0.9, u));
        }
        let ht = f.plat + rel + N.n1(x * 0.3, z * 0.3) * 0.45 * (1 - RLAG);
        if (RLAG > 0) ht += (-18.5 + N.n2(x * 0.1, z * 0.1) * 0.3 - ht) * RLAG;
        return h + (ht - h) * w;
      }
      case 'vent': {
        const d = Math.hypot(x - f.x, z - f.z);
        if (d >= f.R) return h;
        return h + f.mound * (1 - sstep(0, f.r * 1.15, d)) + N.n1(x * 0.15 + f.o, z * 0.15) * 0.5 * (1 - sstep(0, f.r, d));
      }
      case 'magma': {
        if (Math.hypot(x - f.x, z - f.z) >= f.R) return h;
        const d = minLines(f.lines, x, z);
        const w = f.w;
        return h + 2.4 * (1 - sstep(3, 24, d)) - 1.9 * (1 - sstep(0.3, 3.6 + w, d)) + 0.75 * Math.exp(-(((d - 4.4 - w) / 1.7) ** 2));
      }
      case 'volcano': {
        const d = volcanoD(f, x, z);
        if (d >= f.r) return h;
        const yR = -f.summit;
        if (d < f.rimR) {
          const yF = yR - 4.8, k = sstep(f.craterR * 0.55, f.rimR, d);
          return yF + (yR + 0.6 - yF) * k * k;
        }
        const t = clamp((d - f.rimR) / (f.r - f.rimR), 0, 1);
        const th = Math.atan2(z - f.z, x - f.x), gul = 1 + 0.1 * N.n3(th * 3.1 + f.o, d * 0.04) + 0.06 * N.n2(x * 0.09, z * 0.09);
        const g = 1 - Math.pow(1 - t, 2.1 * gul);
        return yR + (h - yR) * g + 0.7 * Math.exp(-(((d - f.rimR) / 2.4) ** 2));
      }
      case 'cave': case 'arch': case 'wreck': {
        const w = orientedW(f, x, z);
        return w > 0 ? h + (f.y0 - h) * w : h;
      }
      case 'canyon': {
        if (Math.hypot(x - f.x, z - f.z) >= f.R) return h;
        lineDist(f.line, x, z);
        const d = LD + N.n2(x * 0.09 + f.o, z * 0.09) * 2.2, tp = taper(LT, 0.1);
        return h - f.depth * tp * (1 - sstep(f.hw * 0.5, f.hw * 2.0, d));
      }
      case 'trench': {
        if (Math.hypot(x - f.x, z - f.z) >= f.R) return h;
        lineDist(f.line, x, z);
        return h - f.depth * taper(LT, 0.16) * (1 - sstep(f.hw * 0.35, f.hw, LD + N.n2(x * 0.02, z * 0.02) * 6));
      }
      case 'dropoff': {
        if (Math.hypot(x - f.x, z - f.z) >= f.R) return h;
        lineDist(f.line, x, z);
        const side = LS * LD, lat = 1 - sstep(f.lat * 0.6, f.lat, Math.abs(side));
        // raised shelf on the +side, a sheer wall of 2*wd across the line
        return h + f.depth * taper(LT, 0.14) * lat * sstep(-f.wd, f.wd, side + N.n2(x * 0.03, z * 0.03) * 6);
      }
      case 'seamount': {
        if (Math.hypot(x - f.x, z - f.z) >= f.R) return h;
        lineDist(f.line, x, z);
        const k = 1 - sstep(f.hw * 0.12, f.hw, LD + N.n2(x * 0.03 + f.o, z * 0.03) * 5);
        return h + f.rise * taper(LT, 0.22) * k * (0.85 + 0.15 * N.n1(x * 0.05, z * 0.05));
      }
      case 'garden': {
        const d = Math.hypot(x - f.x, z - f.z);
        return d >= f.R ? h : h + 1.2 * (1 - sstep(0, f.r * 1.1, d)) * (0.5 + N.n1(x * 0.05, z * 0.05));
      }
    }
    return h;
  }

  /** 0..1 how much this place makes the ground "rock" (colour, hardness, rock decor) */
  function rockK(f, x, z) {
    switch (f.type) {
      case 'vent': return (1 - sstep(f.r * 0.3, f.r * 1.2, Math.hypot(x - f.x, z - f.z))) * 0.85;
      case 'magma': return 1 - sstep(10, 32, minLines(f.lines, x, z));
      case 'volcano': return 1 - sstep(f.r * 0.85, f.r * 1.1, volcanoD(f, x, z));
      case 'cave': case 'arch': return padW(f, x, z) > 0.2 ? 1 : 0.7 * padW(f, x, z) / 0.2;
      case 'canyon': { if (Math.hypot(x - f.x, z - f.z) >= f.R) return 0; lineDist(f.line, x, z); return (1 - sstep(f.hw * 1.2, f.hw * 2.5, LD)) * taper(LT, 0.1); }
      case 'garden': return 1 - sstep(f.r * 0.7, f.r * 1.2, Math.hypot(x - f.x, z - f.z));
      case 'trench': { if (Math.hypot(x - f.x, z - f.z) >= f.R) return 0; lineDist(f.line, x, z); return 0.7 * taper(LT, 0.2) * (1 - sstep(f.hw * 0.6, f.hw * 1.15, LD)); }
    }
    return 0;
  }

  /** the dominant biome weights contributed by a feature at (x,z): writes into w */
  function biomeK(f, x, z, w) {
    switch (f.type) {
      case 'bigreef': { const k = reefW(f, x, z); if (k > w.bigreef) w.bigreef = k; break; }
      case 'vent': { const k = 1 - sstep(f.r * 0.5, f.r * 1.3, Math.hypot(x - f.x, z - f.z)); if (k > w.vent) w.vent = k; break; }
      case 'magma': { const k = 1 - sstep(4, 34, minLines(f.lines, x, z)); if (k > w.magma) w.magma = k; break; }
      case 'volcano': { const k = 1 - sstep(f.r * 0.5, f.r * 1.15, volcanoD(f, x, z)); if (k > w.magma) w.magma = k; break; }
      case 'cave': case 'arch': { const k = padW(f, x, z); if (k > w.cave) w.cave = k; break; }
      case 'garden': { const k = 1 - sstep(f.r * 0.6, f.r * 1.25, Math.hypot(x - f.x, z - f.z)); if (k > w.cave) w.cave = k; break; }
      case 'canyon': { if (Math.hypot(x - f.x, z - f.z) >= f.R) break; lineDist(f.line, x, z); const k = (1 - sstep(f.hw * 1.0, f.hw * 3, LD)) * taper(LT, 0.1); if (k > w.cave) w.cave = k; break; }
      case 'wreck': { const k = 1 - sstep(8, 30, Math.hypot(x - f.x, z - f.z)); if (k > w.wreck) w.wreck = k; break; }
      case 'trench': { if (Math.hypot(x - f.x, z - f.z) >= f.R) break; lineDist(f.line, x, z); const k = (1 - sstep(f.hw * 0.7, f.hw * 1.4, LD)) * taper(LT, 0.2); if (k > w.trench) w.trench = k; break; }
      case 'dropoff': { if (Math.hypot(x - f.x, z - f.z) >= f.R) break; lineDist(f.line, x, z); const k = (1 - sstep(f.wd * 0.8, f.wd * 3, LD)) * taper(LT, 0.14); if (k > w.trench) w.trench = k; break; }
    }
  }

  // surface tint: composes onto out = { k, r, g, b, glow }
  const mixTint = (o, k, r, g, b) => { if (k <= 0) return; const t = k / (o.k + k); o.r += (r - o.r) * t; o.g += (g - o.g) * t; o.b += (b - o.b) * t; o.k = Math.max(o.k, k); };
  function shapeSurface(f, x, z, o) {
    switch (f.type) {
      case 'bigreef': {
        if (reefW(f, x, z) <= 0) return;
        const lag = RLAG; mixTint(o, lag * 0.75, 0.9, 0.86, 0.68);
        const m = N.n1(x * 0.09 + f.o, z * 0.09) + 0.5 * N.n2(x * 0.42 + f.o, z * 0.42), m2 = 0.8 + 0.4 * N.n3(x * 0.8, z * 0.8), k = RW * 0.6 * (1 - lag * 0.9);   // coral-covered rock: saturated blotches of pink, orange, olive and teal
        if (m > 0.55) mixTint(o, k, 0.8 * m2, 0.26 * m2, 0.4 * m2); else if (m > 0.15) mixTint(o, k, 0.85 * m2, 0.5 * m2, 0.12 * m2); else if (m > -0.3) mixTint(o, k, 0.5 * m2, 0.5 * m2, 0.16 * m2); else mixTint(o, k, 0.14 * m2, 0.5 * m2, 0.42 * m2);
        break;
      }
      case 'vent': {
        const d = Math.hypot(x - f.x, z - f.z); if (d >= f.R) return;
        const k = Math.min(1, 1.35 * (1 - sstep(f.r * 0.3, f.r * 1.25, d))), n = N.n1(x * 0.11 + f.o, z * 0.11) + 0.4 * N.n2(x * 0.4, z * 0.4), m = 0.85 + 0.3 * N.n3(x * 0.9, z * 0.9);
        if (n > 0.45) mixTint(o, k * 0.95, 0.85 * m, 0.82 * m, 0.7 * m); else if (n > 0.05) mixTint(o, k * 0.9, 0.62 * m, 0.27 * m, 0.08 * m); else if (n > -0.35) mixTint(o, k * 0.9, 0.55 * m, 0.45 * m, 0.1 * m); else mixTint(o, k * 0.9, 0.12 * m, 0.1 * m, 0.09 * m);
        break;
      }
      case 'magma': {
        if (Math.hypot(x - f.x, z - f.z) >= f.R) return;
        const d = minLines(f.lines, x, z);
        mixTint(o, (1 - sstep(3, 26, d)) * 0.9, 0.12, 0.11, 0.12);
        o.glow = Math.max(o.glow, 0.75 * Math.pow(Math.max(0, 1 - d / 9), 2.2));
        break;
      }
      case 'volcano': {
        const d = volcanoD(f, x, z); if (d >= f.r) return;
        const ash = 0.5 + 0.5 * N.n2(x * 0.05 + f.o, z * 0.05), v = 0.14 + ash * 0.12;
        mixTint(o, (1 - sstep(f.r * 0.8, f.r, d)) * 0.93, v, v * 0.96, v * 1.02);
        o.glow = Math.max(o.glow, 0.85 * Math.exp(-Math.max(0, d - f.craterR * 0.7) / 4) * (1 - 0.6 * sstep(0, 10, d - f.rimR)));
        let rd = 1e9; for (const L of f.rivers) { lineDist(L, x, z); if (LD < rd) rd = LD; }
        o.glow = Math.max(o.glow, 0.55 * Math.pow(Math.max(0, 1 - rd / 6.5), 2.2));
        break;
      }
      case 'wreck': {
        const k = wreckW(f, x, z); mixTint(o, k * 0.5, 0.78, 0.7, 0.5); break;
      }
      case 'trench': {
        if (Math.hypot(x - f.x, z - f.z) >= f.R) return;
        lineDist(f.line, x, z); mixTint(o, 0.45 * taper(LT, 0.2) * (1 - sstep(f.hw * 0.7, f.hw * 1.1, LD)), 0.3, 0.32, 0.36); break;
      }
    }
  }

  // ---------------------------------------------------------------- public pieces
  const pubs = new WeakMap();
  const pubOf = (f, field) => {
    let p = pubs.get(f);
    if (!p) {
      p = { type: f.type, id: f.id, x: f.x, z: f.z, r: f.r, f };
      Object.defineProperty(p, 'y', { get: () => field.heightAt(f.x, f.z), enumerable: true });
      pubs.set(f, p);
    }
    return p;
  };

  return {
    get profile() { return P; },
    setProfile(kind) {
      const np = PROFILES[kind] || PROFILES.lemon;
      if (np === P) return false;
      P = np; cells.clear(); nearCache.clear(); mKey = NaN; mList = EMPTY;
      return true;
    },
    near, cellFeatures,
    height(x, z, h) { const L = near(x, z); for (let i = 0; i < L.length; i++) h = shapeH(L[i], x, z, h); return h; },
    rock(x, z, r) { const L = near(x, z); for (let i = 0; i < L.length; i++) { const f = L[i]; if (f.type === 'bigreef') { r *= 1 - reefW(f, x, z) * 0.9; } else { const k = rockK(f, x, z); if (k > r) r = k; } } return r; },
    reef(x, z, r) { const L = near(x, z); for (let i = 0; i < L.length; i++) { const f = L[i]; if (f.type === 'bigreef') { const k = reefW(f, x, z); if (k > r) r = k; } } return r; },
    weights(x, z, w) { const L = near(x, z); for (let i = 0; i < L.length; i++) biomeK(L[i], x, z, w); return w; },
    surface(x, z, o) { o.k = 0; o.glow = 0; const L = near(x, z); for (let i = 0; i < L.length; i++) shapeSurface(L[i], x, z, o); return o; },
    pubOf, toLocal, orientedW, volcanoD,
    /** big reef footprint at (x,z): o = { w (0..1 inside the reef), u (distance / local radius), lag (lagoon 0..1) } */
    /** true inside the pad of a cave / arch / wreck: generic rocks, coral and weed keep out */
    clear(x, z) { const L = near(x, z); for (let i = 0; i < L.length; i++) { const t = L[i].type; if ((t === 'cave' || t === 'arch' || t === 'wreck') && orientedW(L[i], x, z) > 0.12) return true; } return false; },
    reefInfo(f, x, z, o) { reefW(f, x, z); o.w = RW; o.u = RU; o.lag = RLAG; return o; },
    /** features whose disc intersects the query disc */
    featuresNear(x, z, radius, field) {
      const out = [], span = Math.ceil((radius + 260) * INV), cx = Math.floor(x * INV), cz = Math.floor(z * INV);
      for (let dz = -span; dz <= span; dz++) for (let dx = -span; dx <= span; dx++) for (const f of cellFeatures(cx + dx, cz + dz)) {
        if (Math.hypot(f.x - x, f.z - z) < radius + f.r) out.push(pubOf(f, field));
      }
      return out;
    },
    findFeature(type, x, z, maxR, field) {
      let best = null, bd = 1e18;
      const span = Math.ceil(maxR * INV), cx = Math.floor(x * INV), cz = Math.floor(z * INV);
      const want = Array.isArray(type) ? type : [type];
      for (let ring = 0; ring <= span + 1; ring++) {
        for (let dz = -ring; dz <= ring; dz++) for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          for (const f of cellFeatures(cx + dx, cz + dz)) {
            if (!want.includes(f.type)) continue;
            const d = Math.hypot(f.x - x, f.z - z);
            if (d < bd && d <= maxR) { bd = d; best = f; }
          }
        }
        if (best && bd < (ring) * CELL) break;
      }
      return best ? pubOf(best, field) : null;
    },
  };
}
