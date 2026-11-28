import { mulberry32 } from '../noise.js';
import {
  Mesh, sweep, limb, ellipsoid, noiseKit, rotFn, TAU, clamp, lerp, smooth, fract, mix, mul,
  add3, scale3, makePiece, assignColliders, tplBounds,
} from './landmarks-kit.js';

// ---- palette ------------------------------------------------------------------------------------
const RUST = [0.55, 0.27, 0.11];
const RUST_DARK = [0.27, 0.14, 0.09];
const STEEL = [0.17, 0.2, 0.23];
const STEEL_LIGHT = [0.33, 0.37, 0.4];
const ALGAE = [0.2, 0.38, 0.17];
const CRUST = [0.72, 0.68, 0.5];
const WOOD = [0.4, 0.31, 0.22];
const PAINT = [0.62, 0.52, 0.38];
const GLASS = [0.015, 0.025, 0.035];
const BRONZE = [0.36, 0.42, 0.28];

const HULL_P = 2.8; // section squareness

/**
 * Sunken steel cargo ship. Local frame: x starboard, y up (keel ~0..0.5), +z bow, centred on z=0.
 * Open-topped hull with rotted plating, ribs, deck remnants, deckhouse + bridge at the stern third, funnel,
 * masts, crane, winch, bollards, rudder and propeller.
 */
export function buildWreck(seed, { length = 36, beam = 9 } = {}) {
  const rng = mulberry32(seed * 4093 + 71), nz = noiseKit(seed * 13 + 9), off = rng() * 60;
  const L = length, B = beam, X0 = -L / 2, sz = L / 36, sx = B / 9;
  const m = new Mesh();
  const NU = Math.round(L / 1.2), NV = 10;
  const yDeck = 3.4;

  // ---- hull geometry --------------------------------------------------------------------------
  const widthProf = (s) => (s < 0.2 ? lerp(0.82, 1, smooth(0, 0.2, s)) : s < 0.56 ? 1 : Math.max(0, 1 - Math.pow((s - 0.56) / 0.44, 1.9)));
  const Hof = (s) => 4.8 + 0.9 * smooth(0.55, 1, s) - 0.25 * smooth(0.25, 0, s);
  const keelRise = (s) => 0.5 * Math.pow(smooth(0.72, 1, s), 1.5) + 0.2 * smooth(0.1, 0, s);
  const hullPt = (s, g, side, inset = 0) => {
    const bw = Math.max((B / 2) * widthProf(s) - inset, 0), H = Hof(s);
    const phi = (g * Math.PI) / 2, cs = Math.pow(Math.cos(phi), 2 / HULL_P), sn = Math.pow(Math.sin(phi), 2 / HULL_P), Y = 1 - cs;
    const rag = smooth(0.82, 1, g) * 0.7 * (0.5 + 0.5 * nz.n3(s * 11 + side * 4, 2.2, g)) * (s > 0.04 && s < 0.97 ? 1 : 0.3);
    const x = side * bw * sn * (1 + 0.05 * Y);
    const y = H * Y + (keelRise(s) + inset) * (1 - Y) - rag;
    const z = X0 + s * L + 2.6 * smooth(0.9, 1, s) * Math.pow(Y, 1.5) - 0.8 * Y * (1 - smooth(0, 0.12, s));
    return [x, y, z];
  };
  const hullXAtY = (s, y, inset = 0) => {
    const H = Hof(s), Y = clamp((y - keelRise(s)) / (H - keelRise(s))), sn = Math.pow(1 - Math.pow(1 - Y, HULL_P), 1 / HULL_P);
    return Math.max((B / 2) * widthProf(s) - inset, 0) * sn * (1 + 0.05 * Y);
  };
  // damage pattern: which plate cells are gone
  const holeSide = rng() < 0.5 ? -1 : 1, hs = 0.4 + rng() * 0.14, hg = 0.36 + rng() * 0.1;
  const missing = (side, s, g) => {
    if (g > 0.58 && nz.n3(s * 9 + side * 3.7, g * 6, 1.3) > 0.2 + (1 - g) * 2.3) return true;
    if (side === holeSide) {
      const d = Math.hypot((s - hs) / 0.09, (g - hg) / 0.22);
      if (d < 1 + 0.4 * nz.n2(s * 14 + off, g * 9)) return true;
    }
    return false;
  };
  const refZ = (i) => X0 + (i / NU) * L;

  // ---- colour ---------------------------------------------------------------------------------
  const plateTone = (x, y, z) => {
    const id = Math.floor(z / 2.4) * 7 + Math.floor(y / 1.25) + (x > 0 ? 31 : 0);
    return (((Math.sin(id * 12.9898 + off) * 43758.5453) % 1) + 1) % 1;
  };
  const growth = (col, x, y, z, up) => {
    col = mix(col, ALGAE, smooth(0.1, 0.55, nz.n3(x * 0.9 + off, y * 0.8, z * 0.9)) * (Math.max(smooth(3.7, 5, y), 0.7 * smooth(1.2, 0, Math.abs(y - 2.5) - 0.9)) * 0.6 + up * 0.25));
    col = mix(col, CRUST, smooth(0.5, 0.75, nz.n3(x * 1.7 - off, y * 1.5, z * 1.7)) * (0.25 + 0.35 * smooth(1, 4, y)));
    return mul(col, 0.94 + 0.12 * nz.n3(x * 7, y * 7, z * 7)); // barnacle noise
  };
  const outerCol = (x, y, z) => {
    const tone = plateTone(x, y, z);
    let col = mix(STEEL, RUST, smooth(-0.3, 0.45, nz.n3(x * 0.5 + off, y * 0.35, z * 0.5) * 0.7 + (tone - 0.5) * 0.8 + 0.3 * smooth(0, 3, y)));
    col = mix(col, STEEL_LIGHT, smooth(0.65, 1, tone) * 0.25);
    // rust streaks running down from the rail
    col = mix(col, RUST_DARK, smooth(0.5, 0.9, nz.n2(z * 1.3 + off, x * 0.6)) * 0.4);
    return mul(growth(col, x, y, z, 0.0), 0.55 + 0.45 * smooth(-0.3, 2.2, y));
  };
  const innerCol = (x, y, z) => {
    let col = mix(RUST_DARK, RUST, 0.25 + 0.5 * smooth(-0.4, 0.8, nz.n3(x * 0.6 + off, y * 0.5, z * 0.6)));
    col = mix(col, STEEL, 0.25 * smooth(0.3, 0.9, plateTone(x, y, z)));
    return mul(growth(col, x, y, z, 0.2), 0.45 + 0.4 * smooth(-0.2, 3.5, y));
  };
  const ribCol = (x, y, z) => mul(growth(mix(RUST, RUST_DARK, 0.3 + 0.4 * nz.n3(x * 1.3 + off, y, z * 1.3)), x, y, z, 0.2), 0.55 + 0.45 * smooth(0, 3.5, y));
  const woodCol = (x, y, z, plank) => mul(growth(mix(WOOD, [0.28, 0.24, 0.2], 0.4 * (plank % 2) + 0.3 * nz.n3(x * 1.4, 1, z * 0.7)), x, y, z, 0.6), 0.8);
  const paintCol = (x, y, z, y1) => {
    let col = mix(PAINT, [0.55, 0.52, 0.44], smooth(0.2, 0.8, nz.n3(x * 0.7 + off, y * 0.5, z * 0.7)));
    col = mix(col, RUST, smooth(0.45, 0.85, nz.n2((x + z) * 2.4 + off, y * 0.25)) * (0.35 + 0.5 * smooth(y1, y1 - 1.5, y)));
    col = mix(col, RUST_DARK, smooth(0.65, 0.95, nz.n3(x * 2, y * 2, z * 2)) * 0.3);
    return mul(growth(col, x, y, z, 0.3), 0.7 + 0.3 * smooth(3.4, 5.5, y));
  };

  // ---- hull skins --------------------------------------------------------------------------------
  for (const side of [-1, 1]) {
    m.surface(NU, NV, (i, j) => hullPt(i / NU, j / NV, side), (x, y, z) => outerCol(x, y, z), {
      mode: 1, ref: (i) => [-side * 3, 2.4, refZ(i)], skip: (i, j) => missing(side, (i + 0.5) / NU, (j + 0.5) / NV),
    });
    m.surface(NU, NV, (i, j) => hullPt(i / NU, j / NV, side, 0.2), (x, y, z) => innerCol(x, y, z), {
      mode: -1, ref: (i, j) => [-side * 2, 3, refZ(i)], skip: (i, j) => missing(side, (i + 0.5) / NU, (j + 0.5) / NV),
    });
  }
  // flat transom
  {
    const NT = 14, NR = 8, s0 = 0;
    const tp = (i, j) => {
      const Y = j / NR, H = Hof(s0), sn = Math.pow(1 - Math.pow(1 - Y, HULL_P), 1 / HULL_P), xh = (B / 2) * widthProf(s0) * sn * (1 + 0.05 * Y);
      return [lerp(-xh, xh, i / NT), H * Y + keelRise(s0) * (1 - Y), X0 - 0.8 * Y];
    };
    m.surface(NT, NR, tp, (x, y, z) => outerCol(x, y, z), {
      mode: 1, ref: () => [0, 2.4, X0 + 6], skip: (i, j) => j >= NR - 2 && nz.n3(i * 0.9 + off, j, 5) > 0.1,
    });
  }
  // keel
  sweep(m, {
    path: (t) => { const s = 0.02 + t * 0.96; return [0, hullPt(s, 0, 1)[1] - 0.12, X0 + s * L]; },
    rings: 12, sides: 5, radius: () => 0.3, capEnd: true, capStart: true,
    attr: (x, y, z) => mul(mix(RUST_DARK, ALGAE, 0.25 * smooth(0.1, 0.6, nz.n3(x, y, z))), 0.7),
  });
  // ribs (frames) along the inside of the plating, some broken off
  const nRibs = Math.round(L / 2.4) - 1;
  for (let k = 0; k < nRibs; k++) {
    const s = (k + 1) / (nRibs + 1);
    const gm = [rng() < 0.55 ? 1 : 0.45 + rng() * 0.4, rng() < 0.55 ? 1 : 0.45 + rng() * 0.4];
    sweep(m, {
      path: (t) => { const u = (t - 0.5) * 2, side = u < 0 ? -1 : 1; return hullPt(s, Math.min(Math.abs(u) * gm[side < 0 ? 0 : 1], 1), side, 0.24); },
      rings: 16, sides: 4, radius: (t) => 0.13 * (1 + 0.25 * Math.sin(t * 20 + k)), capEnd: true, capStart: true, capH: 0.3,
      attr: (x, y, z) => ribCol(x, y, z),
    });
  }
  // longitudinal stringers
  for (const side of [-1, 1]) {
    for (const g of [0.45, 0.8]) {
      const s0 = 0.08 + rng() * 0.06, s1 = 0.8 + rng() * 0.12;
      sweep(m, {
        path: (t) => hullPt(lerp(s0, s1, t), g, side, 0.24), rings: 12, sides: 4, radius: () => 0.1, capEnd: true, capStart: true,
        attr: (x, y, z) => ribCol(x, y, z),
      });
    }
  }
  // deck beams across the open hold, some snapped
  for (let k = 2; k < nRibs; k += 2) {
    const s = (k + 1) / (nRibs + 1), hw = hullXAtY(s, yDeck, 0.2), z = X0 + s * L;
    const a0 = rng() < 0.3 ? 0.35 : 1, a1 = rng() < 0.3 ? 0.35 : 1;
    limb(m, [-hw * a0, yDeck - 0.12, z], [hw * a1, yDeck - 0.12 + (rng() - 0.5) * 0.2, z], 0.15, 0.15, 4, 3, (x, y, zz) => ribCol(x, y + 1, zz), { capStart: true });
  }

  // ---- deck remnants ---------------------------------------------------------------------------
  const deckSlab = (zA, zB, nrows, sagAmp, skipFn) => {
    const NC = 14;
    const sAt = (z) => clamp((z - X0) / L);
    m.surface(NC, nrows, (i, j) => {
      const z = lerp(zA, zB, j / nrows), s = sAt(z), hw = Math.max(hullXAtY(s, yDeck, 0.35), 0.3), u = i / NC * 2 - 1;
      return [u * hw, yDeck - sagAmp * (1 - u * u) * Math.sin((j / nrows) * Math.PI) + 0.06 * nz.n2(i * 1.3 + off, j * 1.1), z];
    }, (x, y, z, i, j) => woodCol(x, y, z, i), { mode: 1, ref: () => [0, -8, 0], skip: skipFn });
  };
  deckSlab(zOf(0.74), zOf(0.93), 8, 0.1, (i, j) => (i >= 6 && i < 8 && j >= 2 && j < 4) || nz.n3(i * 0.8 + off, j * 0.8, 3) > 0.62);
  deckSlab(zOf(0.1), zOf(0.4), 12, 0.25, (i, j) => nz.n3(i * 0.7, j * 0.7 + off, 9) > 0.55);
  // collapsed panels leaning into the hold
  const panels = [[-2.3, 2.3, 2.5, 0.7, 0.55, 0.3], [2.1, 1.7, 5.0, -0.5, -0.4, 1.1], [-1.2, 1.2, -2.5, 0.35, 0.8, -0.6], [1.6, 2.0, 8.5, -0.3, 0.2, 0.4]];
  for (const [px, py, pz, rx, rz, ry] of panels) {
    const from = m.nv, w = 3.2 * sx, l = 2.8 * sz;
    m.surface(6, 5, (i, j) => [(i / 6 - 0.5) * w, 0.07 * nz.n3(i + px, j, 2), (j / 5 - 0.5) * l], (x, y, z) => woodCol(x + px, y + py, z + pz, Math.floor((x + 5) / 0.55)), {
      mode: 1, ref: () => [0, -6, 0], skip: (i, j) => nz.n3(i * 1.1 + px, j * 1.1, 4) > 0.45,
    });
    const rf = rotFn(rx, ry, rz);
    m.map(from, (p) => { const q = rf(p); return [q[0] + px * sx, q[1] + py, q[2] + pz * sz]; });
  }

  // ---- deckhouse, bridge, funnel -----------------------------------------------------------------
  function zOf(f) { return X0 + f * L; }
    const house = (b, cell, winCfg) => {
    const { x0, x1, y0, y1, z0, z1 } = b, ctr = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    const faces = [
      ['front', [x0, y0, z1], [x1 - x0, 0, 0], [0, y1 - y0, 0], [0, 0, 1]],
      ['back', [x1, y0, z0], [x0 - x1, 0, 0], [0, y1 - y0, 0], [0, 0, -1]],
      ['right', [x1, y0, z1], [0, 0, z0 - z1], [0, y1 - y0, 0], [1, 0, 0]],
      ['left', [x0, y0, z0], [0, 0, z1 - z0], [0, y1 - y0, 0], [-1, 0, 0]],
      ['roof', [x0, y1, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], [0, 1, 0]],
    ];
    for (const [name, o, u, v, n] of faces) {
      const nu = Math.max(2, Math.round(Math.hypot(...u) / cell)), nv = Math.max(2, Math.round(Math.hypot(...v) / cell));
      const wins = [];
      if (name !== 'roof') {
        const j0 = Math.max(1, Math.floor(nv / 2) - 1);
        for (let i = 1; i + 2 <= nu - 1; i += 4) wins.push([i, j0, 2, 2]);
        if (name === winCfg.broken && wins.length) { const w = wins[Math.floor(wins.length / 2)]; w[2] = 3; w[3] = 3; }
      }
      const inWin = (i, j) => wins.some(([a, c, w, h]) => i >= a && i < a + w && j >= c && j < c + h);
      const roofHole = name === 'roof' && winCfg.roofHole;
      const holeAt = (i, j) => roofHole && i >= 2 && i < 5 && j >= 2 && j < 4;
      const pos = (i, j) => {
        const p = add3(add3(o, scale3(u, i / nu)), scale3(v, j / nv));
        if (name === 'roof') p[1] -= 0.35 * Math.sin((i / nu) * Math.PI) * Math.sin((j / nv) * Math.PI) * winCfg.sag + 0.06 * nz.n2(i * 0.9 + off, j * 0.9);
        else return add3(p, scale3(n, 0.05 * nz.n3(i * 0.9 + off, j * 0.9, 1)));
        return p;
      };
      const idx = m.surface(nu, nv, pos, (x, y, z) => (name === 'roof' ? mul(growth(mix([0.2, 0.18, 0.17], RUST_DARK, 0.4), x, y, z, 0.8), 0.9) : paintCol(x, y, z, y1)), {
        mode: 1, ref: () => ctr, skip: (i, j) => inWin(i, j) || holeAt(i, j),
      });
      for (const [a, c, w, h] of wins) {
        const loop = [];
        for (let i = a; i < a + w; i++) loop.push([i, c]);
        for (let j = c; j < c + h; j++) loop.push([a + w, j]);
        for (let i = a + w; i > a; i--) loop.push([i, c + h]);
        for (let j = c + h; j > c; j--) loop.push([a, j]);
        const pts = loop.map(([i, j]) => m.pt(idx(i, j)));
        const cen = pts.reduce((s, p) => add3(s, p), [0, 0, 0]).map((q) => q / pts.length);
        const depth = 0.35;
        const axisRef = add3(cen, scale3(n, -depth * 0.5));
        for (let k = 0; k < pts.length; k++) {
          const p1 = pts[k], p2 = pts[(k + 1) % pts.length];
          const q1 = add3(p1, scale3(n, -depth)), q2 = add3(p2, scale3(n, -depth));
          const col = (p, deep) => (deep ? mul(RUST_DARK, 0.35) : mul(mix(PAINT, RUST, 0.5), 0.9));
          const ids = [p1, p2, q2, q1].map((p, q) => m.v(p[0], p[1], p[2], col(p, q >= 2), axisRef));
          m.quad(ids[0], ids[1], ids[2], ids[3], -1);
        }
        const deepRef = add3(cen, scale3(n, -3));
        const corners = [loop[0], loop[w], loop[w + h], loop[2 * w + h]].map(([i, j]) => add3(m.pt(idx(i, j)), scale3(n, -depth)));
        const ids = corners.map((p) => m.v(p[0], p[1], p[2], GLASS, deepRef));
        m.quad(ids[0], ids[1], ids[2], ids[3], 1);
      }
    }
  };
  const dh = { x0: -3.1 * sx, x1: 3.1 * sx, y0: yDeck - 0.3, y1: yDeck + 3.5, z0: zOf(0.03) + 1.2 * sz, z1: zOf(0.03) + 10.2 * sz };
  house(dh, 0.45, { broken: 'right', roofHole: true, sag: 0.5 });
  const br = { x0: -2.5 * sx, x1: 2.5 * sx, y0: dh.y1 - 0.1, y1: dh.y1 + 2.3, z0: dh.z1 - 4.0 * sz, z1: dh.z1 - 0.5 * sz };
  house(br, 0.45, { broken: 'left', roofHole: false, sag: 0.2 });
  // bridge wing overhang
  m.surface(3, 2, (i, j) => [lerp(-3.4 * sx, 3.4 * sx, i / 3), br.y0 + 1.0 + 0.04 * nz.n2(i, j), lerp(br.z0 + 0.4, br.z1 - 0.2, j / 2)], (x, y, z) => mul(paintCol(x, y, z, br.y0), 0.85), { mode: 1, ref: () => [0, br.y0 - 6, 0], skip: (i, j) => i === 2 && j === 0 });
  // funnel
  {
    const fz = dh.z0 + 2.4 * sz, fy0 = dh.y1 - 0.3, fh = 4.9, lean = -0.7 - rng() * 0.5, fr = 1.2;
    const path = (t) => [0.15 * Math.sin(t * 2), fy0 + t * fh, fz + lean * t * t];
    const col = (x, y, z, t, a) => {
      let c = mix([0.2, 0.19, 0.19], RUST_DARK, 0.3 + 0.5 * smooth(0.2, 0.8, nz.n3(x * 1.1 + off, y * 0.7, z * 1.1)));
      c = mix(c, [0.55, 0.16, 0.1], smooth(0.5, 0.58, t) * smooth(0.8, 0.72, t) * 0.8);
      c = mix(c, [0.04, 0.04, 0.04], smooth(0.84, 0.95, t));
      c = mix(c, RUST, smooth(0.45, 0.8, nz.n2(a * 2.2 + off, t * 1.3)) * 0.35);
      return mul(growth(c, x, y, z, 0.3), 0.85);
    };
    const f = sweep(m, {
      path, rings: 9, sides: 12, capEnd: false, radius: (t, a) => fr * (1 - 0.1 * t) * (1 + 0.03 * Math.sin(a * 4 + t * 3)), scale: () => [1.0, 1.25],
      lift: (t, a) => smooth(0.85, 1, t) * 0.35 * nz.n2(a * 1.6 + off, 6), attr: col,
    });
    // band collar
    const bp = (t) => path(t);
    sweep(m, {
      path: (t) => bp(0.58 + t * 0.1), rings: 1, sides: 12, capEnd: false, radius: () => fr * 1.07, scale: () => [1.0, 1.25],
      attr: (x, y, z) => mul(mix([0.5, 0.14, 0.09], RUST, 0.3 + 0.3 * nz.n3(x, y, z)), 0.9),
    });
    const rp = f.ringPts[9], c = f.pts[9], cy = rp.reduce((s, p) => s + p[1], 0) / rp.length;
    m.surface(12, 2, (i, j) => { const k = [1, 0.86, 0.5][j], p = rp[i]; return [c[0] + (p[0] - c[0]) * k, j === 0 ? p[1] : cy - 0.1 - j * 0.6, c[2] + (p[2] - c[2]) * k]; },
      (x, y, z, i, j) => (j === 0 ? mul(RUST_DARK, 0.7) : [0.03, 0.03, 0.03]), { wrapU: true, mode: -1, ref: (i) => [c[0], rp[i][1] - 0.3, c[2]] });
    void cy;
  }

  // ---- masts, crane, winch, bollards ----------------------------------------------------------------
  const mastCol = (x, y, z) => mul(growth(mix(RUST, RUST_DARK, 0.4), x, y, z, 0.2), 0.85);
  // foremast stub (snapped)
  {
    const mz = zOf(0.64), top = 9.4;
    sweep(m, { path: (t) => [0, yDeck - 0.3 + t * (top - yDeck + 0.3), mz + 0.25 * t], rings: 6, sides: 6, radius: (t) => 0.24 - 0.1 * t, capEnd: true, capH: 0.1, attr: mastCol });
    limb(m, [-1.3, 7.6, mz + 0.2], [1.5, 7.9, mz + 0.2], 0.07, 0.05, 4, 2, mastCol, { capStart: true });
    limb(m, [0.0, 6.2, mz + 0.12], [0.9, 8.4, mz + 0.4], 0.04, 0.03, 4, 1, mastCol);
  }
  // radar post on the bridge roof
  limb(m, [0.4, br.y1, br.z0 + 1.4], [0.5, br.y1 + 1.8, br.z0 + 1.45], 0.12, 0.08, 5, 2, mastCol, { capStart: true });
  // derrick crane on the foredeck
  {
    const cz = zOf(0.8), side = rng() < 0.5 ? -1 : 1;
    sweep(m, { path: (t) => [0, yDeck - 0.3 + t * 4.9, cz], rings: 5, sides: 7, radius: (t) => 0.28 - 0.06 * t, capEnd: true, capH: 0.3, attr: mastCol });
    const bt = [0, yDeck + 4.5, cz], bend = [side * 2.8 * sx, yDeck + 1.1, cz + 2.2 * sz];
    limb(m, bt, bend, 0.15, 0.1, 5, 4, mastCol);
    limb(m, bend, [bend[0] + 0.05, bend[1] - 1.6, bend[2]], 0.03, 0.03, 3, 2, mastCol);
  }
  // winch: base + drums
  {
    const wz = zOf(0.62) + 3.2 * sz;
    ellipsoid(m, [0, yDeck + 0.1, wz], [0.9, 0.35, 0.65], 8, 4, { exp: 0.4, attr: (x, y, z) => mastCol(x, y, z) });
    limb(m, [-1.0, yDeck + 0.65, wz], [1.0, yDeck + 0.65, wz], 0.34, 0.34, 7, 2, mastCol, { capStart: true });
  }
  // bollards on the rails (near the bow and stern)
  for (const [fs, side] of [[0.84, -1], [0.84, 1], [0.12, -1], [0.12, 1], [0.58, 1]]) {
    const s = fs, p = hullPt(s, 0.93, side, 0.35), bx = p[0], bz = p[2];
    sweep(m, {
      path: (t) => [bx, p[1] - 0.15 + t * 0.7, bz], rings: 3, sides: 6, capEnd: true,
      radius: (t) => [0.24, 0.17, 0.17, 0.27][Math.min(3, Math.round(t * 3))], attr: mastCol,
    });
  }

  // ---- rudder + propeller ---------------------------------------------------------------------
  {
    const rz = X0 - 1.0, from = m.nv;
    ellipsoid(m, [0, 0.9, 0], [0.12, 1.8, 0.62], 8, 6, { exp: 0.45, attr: (x, y, z) => mul(growth(mix(RUST, RUST_DARK, 0.5), x, y + 1, z, 0.2), 0.8) });
    const ry = rotFn(0, 0.45 * (rng() < 0.5 ? 1 : -1), 0);
    m.map(from, (p) => { const q = ry(p); return [q[0], q[1] + 0.2, q[2] + rz]; });
    // propeller
    const pz = X0 - 2.0, py = 1.25;
    limb(m, [0, py, X0 + 0.3], [0, py, pz + 0.3], 0.13, 0.12, 5, 3, (x, y, z) => mul(BRONZE, 0.7), { capEnd: true });
    ellipsoid(m, [0, py, pz], [0.28, 0.28, 0.42], 8, 5, { attr: () => BRONZE });
    for (let b = 0; b < 4; b++) {
      const len = b === 2 ? 0.85 : 1.6, a0 = b * (Math.PI / 2) + 0.4;
      const rb = rotFn(0, 0, a0);
      const f3 = m.nv;
      m.surface(3, 2, (i, j) => {
        const r = 0.3 + (len - 0.3) * (i / 3), cw = 0.7 * Math.sin(Math.PI * (0.12 + 0.88 * (i / 3)) * 0.95 + 0.05) + 0.1, v = j / 2 - 0.5;
        const pitch = 0.55;
        return [v * cw * Math.cos(pitch), r, pz + v * cw * Math.sin(pitch)];
      }, (x, y, z) => mul(mix(BRONZE, ALGAE, 0.25 * smooth(0, 1, nz.n3(x * 2, y * 2, z * 2))), 0.9), { mode: 0 });
      m.map(f3, (p) => { const q = rb([p[0], p[1] - 0, p[2] - pz]); return [q[0], q[1] + py, q[2] + pz]; });
    }
  }

  // ---- debris: hull plates lying beside the wreck ------------------------------------------------------
  for (let i = 0; i < 3; i++) {
    const side = i % 2 ? 1 : -1, px = side * (B / 2 + 1.2 + rng() * 2.5), pz = (rng() - 0.5) * L * 0.6, rot = (rng() - 0.5) * 0.9;
    const from = m.nv, w = 2.4 + rng() * 1.4, l = 2.0 + rng() * 1.5;
    m.surface(4, 3, (u, v) => [(u / 4 - 0.5) * w, 0.1 * Math.sin(u + i) + 0.04 * nz.n3(u + i, v, 5), (v / 3 - 0.5) * l], (x, y, z) => outerCol(x + px, y + 1.5, z + pz), { mode: 1, ref: () => [0, -5, 0] });
    const rf = rotFn(0.12 * side, rot, 0.2 * side);
    m.map(from, (p) => { const q = rf(p); return [q[0] + px, q[1] + 0.35, q[2] + pz]; });
  }

  // ---- pieces ----------------------------------------------------------------------------------------
  const key = (x, y, z) => `${Math.floor((z + 1) / 7.5)},${x < 0 ? 0 : 1},${Math.floor(y / 6)}`;
  const pieces = [...m.bin(key, { facet: 0.3 }).values()].map((tpl) => makePiece(tpl));

  // ---- colliders ---------------------------------------------------------------------------------------
  const cols = [];
  const rs = 1.7, spacing = rs * 1.45, nSt = Math.max(3, Math.round((L - 2) / spacing));
  for (let k = 0; k <= nSt; k++) {
    const s = 0.03 + (k / nSt) * 0.94;
    for (const side of [-1, 1]) {
      for (const g of [0.3, 0.62, 0.92]) {
        if (g === 0.92 && k % 2) continue;
        if (missing(side, s, g) && (g > 0.8 || side === holeSide)) continue;
        const p = hullPt(s, g, side, 0.0);
        if (widthProf(s) < 0.2 && g < 0.5) continue;
        cols.push([p[0], p[1], p[2], rs, 1]);
      }
    }
    if (k % 2 === 0 && widthProf(s) > 0.3) { const p = hullPt(s, 0, 1, 0.0); cols.push([0, p[1] + 0.2, p[2], rs, 1]); }
  }
  const dhx = (dh.x0 + dh.x1) / 2, dhy = (dh.y0 + dh.y1) / 2;
  for (const dzz of [0.18, 0.5, 0.82]) for (const xx of [-1.5 * sx, 1.5 * sx]) cols.push([dhx + xx, dhy, lerp(dh.z0, dh.z1, dzz), 2.0, 1]);
  cols.push([0, (br.y0 + br.y1) / 2, (br.z0 + br.z1) / 2, 2.1, 1]);
  cols.push([0, dh.y1 + 2.3, dh.z0 + 2.4 * sz, 1.6, 1], [0, dh.y1 + 4.3, dh.z0 + 2.4 * sz - 0.6, 1.4, 1]);
  cols.push([0, 1.0, X0 - 1.1, 1.5, 1]);
  assignColliders(pieces, cols);
  const height = Math.max(...pieces.map((p) => tplBounds(p.tpl).max[1]));
  return { pieces, length, beam, height };
}
