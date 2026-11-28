import { mulberry32 } from '../noise.js';
import {
  Mesh, sweep, limb, ellipsoid, noiseKit, rotFn, TAU, clamp, lerp, smooth, lum, add3, sub3, scale3, norm3, dot3, cross3, lerp3,
} from './landmarks-kit.js';

const L = (v) => [v, v, v];

// ---- bommies: big lobed coral heads --------------------------------------------------------------
function bommie(seed, k) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0xb0), off = rng() * 40;
  const m = new Mesh();
  const R = [2.8, 3.0, 2.6, 2.9][k], RY = [2.0, 2.1, 2.15, 2.05][k];
  const dirOf = (th, ph) => [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
  const pits = [];
  for (let i = 0; i < 2 + (k % 2); i++) pits.push({ d: dirOf(1.1 + rng() * 0.4, rng() * TAU), s: 10 + rng() * 6 });
  const pitF = (dx, dy, dz) => { let s = 0; for (const p of pits) s = Math.max(s, Math.exp(-(1 - dot3(p.d, [dx, dy, dz])) * p.s)); return s; };
  const grooves = (x, y, z) => smooth(0.42, 0.8, 1 - Math.abs(nz.n3(x * 2.4 + off, y * 2.4, z * 2.4)));
  // lobe: local direction (ldy: -1..1 within the lobe) gives crevice darkening, world y the global AO
  const shade = (x, y, z, dx, dy, dz, ldy, tone) => {
    const pit = pitF(dx, dy, dz);
    const v = tone * (0.4 + 0.6 * smooth(-0.3, 0.9, dy)) * (0.5 + 0.5 * smooth(-0.9, 0.35, ldy)) * (1 - 0.62 * grooves(x, y, z)) * (1 - 0.9 * smooth(0.25, 0.85, pit)) * (0.3 + 0.7 * smooth(-0.3, 1.3, y)) * (1 + 0.12 * nz.n3(x * 4, y * 4, z * 4));
    return L(v);
  };
  const BR = 0.86;
  ellipsoid(m, [0, 0.4, 0], [R * BR, RY * BR, R * BR], 14, 9, {
    yMin: -0.3,
    disp: (dx, dy, dz) => (1 + 0.07 * nz.n3(dx * 2.2 + off, dy * 2.2, dz * 2.2)) * (1 + 0.12 * Math.exp(-(((dy + 0.1) / 0.3) ** 2))) * (1 - 0.7 * pitF(dx, dy, dz)),
    attr: (x, y, z, dx, dy, dz) => shade(x, y, z, dx, dy, dz, -0.3, 0.8),
  });
  const nLobes = 8;
  for (let i = 0; i < nLobes; i++) {
    let dv = null;
    for (let tryN = 0; tryN < 20; tryN++) {
      const a = (i / nLobes) * TAU + (rng() - 0.5) * 0.7, el = i === 0 ? 1.35 : 0.1 + rng() * 1.15;
      const d = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
      if (pits.every((p) => dot3(p.d, d) < 0.85)) { dv = d; break; }
    }
    if (!dv) continue;
    const rad = 0.95 + rng() * 0.6, up = dv[1] > 0.7 ? 1.1 : 0.85;
    const c = [dv[0] * R * 0.78, 0.4 + dv[1] * RY * 0.78, dv[2] * R * 0.78];
    const tone = 0.85 + rng() * 0.3;
    ellipsoid(m, c, [rad, rad * up, rad], 8, 4, {
      yMin: -0.3,
      disp: (dx, dy, dz) => 1 + 0.14 * nz.n3(dx * 3 + i * 5, dy * 3, dz * 3),
      attr: (x, y, z, dx, dy, dz) => shade(x, y, z, dv[0] * 0.5 + dx * 0.5, dv[1] * 0.5 + dy * 0.5, dv[2] * 0.5 + dz * 0.5, dy, tone),
    });
  }
  return m.template({ facet: 0.25 });
}

// ---- towers: coral pinnacles with finger lobes ------------------------------------------------------
function tower(seed, k) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0x70), off = rng() * 40;
  const m = new Mesh();
  const H = [5.2, 6.0, 4.5, 5.4][k], R0 = [1.4, 1.5, 1.35, 1.3][k];
  const lean = [rng() - 0.5, rng() - 0.5].map((v) => v * 1.4), nl = 3 + (k % 3), tw = rng() * TAU;
  const path = (t) => [lean[0] * t * t + Math.sin(t * 4 + off) * 0.15, -0.3 + t * (H + 0.3), lean[1] * t * t + Math.cos(t * 3.4 + off) * 0.12];
  const prof = (t) => R0 * (0.34 + 0.66 * Math.pow(1 - t, 1.35)) * (1 + 0.2 * Math.sin(t * 9 + off) * (1 - t * 0.5));
  const shade = (x, y, z, t, a) => {
    const rid = Math.sin(a * nl + t * 5 + tw);
    const v = (0.5 + 0.42 * smooth(0, 1, t)) * (1 + 0.14 * rid) * (0.4 + 0.6 * smooth(-0.3, 1.4, y)) * (1 + 0.1 * nz.n3(x * 3, y * 3, z * 3));
    return L(v);
  };
  const sw = sweep(m, {
    path, rings: 12, sides: 10, capH: 0.6,
    radius: (t, a, cx, cy, cz) => prof(t) * (1 + 0.2 * Math.sin(a * nl + t * 5 + tw) + 0.14 * nz.n3(cx * 1.5 + Math.cos(a) * 1.7 + off, cy * 0.9, cz * 1.5 + Math.sin(a) * 1.7)),
    attr: shade,
  });
  // side fingers
  const fingers = 5;
  for (let i = 0; i < fingers; i++) {
    const t0 = 0.15 + (i / fingers) * 0.62 + rng() * 0.08, a = rng() * TAU + i * 2.4;
    const p0 = path(t0), out = prof(t0) * 0.8;
    const base = [p0[0] + Math.cos(a) * out, p0[1], p0[2] + Math.sin(a) * out];
    const len = 1.3 + rng() * 0.8, el = 0.9 + rng() * 0.8;
    const d = norm3([Math.cos(a) * 0.9, el, Math.sin(a) * 0.9]);
    limb(m, base, add3(base, scale3(d, len)), 0.4 - t0 * 0.1, 0.18, 5, 3, (x, y, z) => shade(x, y + 0.4, z, clamp(t0 + 0.25), a), { capH: 0.7 });
  }
  // fingers crowning the top
  const top = sw.pts[12];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + rng(), d = norm3([Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4]), len = 1.1 + rng() * 0.7;
    const b = add3(top, [Math.cos(a) * 0.1, -0.3, Math.sin(a) * 0.1]);
    limb(m, b, add3(b, scale3(d, len)), 0.3, 0.16, 5, 2, (x, y, z) => shade(x, y, z, 1, a), { capH: 0.8 });
  }
  return m.template({ facet: 0.2 });
}

// ---- table coral plates --------------------------------------------------------------------------
function plateTop(m, nz, o) {
  const { R, yc, ph, off, notch = 0, nu = 24, nv = 6, wave = 0.18 } = o;
  const outline = (a) => R * (0.88 + 0.12 * nz.n2(Math.cos(a) * 1.4 + off, Math.sin(a) * 1.4) - notch * Math.exp(-(((Math.cos(a - ph) - 1) * 6) ** 2)) * 0.5);
  const ypos = (a, rho) => yc - 0.3 * rho * rho + wave * Math.pow(rho, 1.5) * Math.sin(a * 5 + ph) + 0.1 * rho * nz.n2(Math.cos(a) * rho * 2 + off, Math.sin(a) * rho * 2) + 0.1 * smooth(0.85, 1, rho) * Math.sin(a * 11 + off);
  const topPos = (i, j) => { const a = (i / nu) * TAU, rho = j / nv; return [Math.cos(a) * outline(a) * rho, ypos(a, rho), Math.sin(a) * outline(a) * rho]; };
  m.surface(nu, nv, topPos, (x, y, z, i, j) => {
    const rr = Math.hypot(x, z) / R;
    const ring = 0.5 + 0.5 * Math.sin(Math.hypot(x, z) * 8 + 0.6 * nz.n3(x, 0, z));
    const v = 0.5 + 0.24 * rr + 0.12 * ring - 0.1 * (1 - smooth(0, 0.3, rr)) + 0.22 * smooth(0.93, 1, rr);
    return L(v);
  }, { wrapU: true, ref: () => [0, yc - 8, 0] });
  const nv2 = 4;
  m.surface(nu, nv2, (i, j) => {
    const a = (i / nu) * TAU, rho = 1 - j / nv2;
    const px = Math.cos(a) * outline(a) * rho, pz = Math.sin(a) * outline(a) * rho;
    return [px, ypos(a, rho) - 0.07 - 0.28 * (1 - rho) * (1 - rho), pz];
  }, (x, y, z, i, j) => {
    const rr = Math.hypot(x, z) / R, a = Math.atan2(z, x);
    const v = (0.28 + 0.25 * rr) * (1 + 0.25 * Math.sin(a * 22 + off));
    return L(v);
  }, { wrapU: true, ref: () => [0, yc + 12, 0] });
}

function plate(seed, k) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0xd7), off = rng() * 40;
  const m = new Mesh();
  const lean = (rng() - 0.5) * 0.5;
  const yc = 2.4;
  const sw = sweep(m, {
    path: (t) => [lean * t, -0.4 + t * (yc + 0.2 + 0.4), lean * 0.4 * t],
    rings: 4, sides: 8, capEnd: false,
    radius: (t, a) => (0.6 - 0.18 * Math.sin(t * 2.6) + 0.5 * smooth(0.75, 1, t)) * (1 + 0.1 * Math.sin(a * 3 + off)),
    attr: (x, y, z, t) => L(0.34 + 0.2 * smooth(-0.4, 2.4, y) + 0.05 * nz.n3(x * 4, y * 3, z * 4)),
  });
  const from = m.nv;
  const cfg = [
    { R: 3.5, ph: rng() * TAU, notch: 0, wave: 0.18 },
    { R: 3.3, ph: rng() * TAU, notch: 0, wave: 0.22 },
    { R: 3.6, ph: rng() * TAU, notch: 1.2, wave: 0.28 },
  ][k];
  plateTop(m, nz, { ...cfg, yc, off });
  // tilt plate about its stem top
  const tilt = [0.05, 0.14, 0.1][k], ta = rng() * TAU;
  const rf = rotFn(Math.sin(ta) * tilt, 0, Math.cos(ta) * tilt, [lean, yc, lean * 0.4]);
  m.map(from, rf);
  if (k === 1) {
    // a smaller tier above, offset to one side
    const f2 = m.nv;
    plateTop(m, nz, { R: 1.8, yc: 3.55, ph: 1.2, off: off + 7, nu: 14, nv: 3, wave: 0.12 });
    m.map(f2, (p) => [p[0] + 0.5, p[1], p[2] - 0.3]);
    limb(m, [lean + 0.1, 2.3, lean * 0.4], [0.5, 3.45, -0.3], 0.34, 0.26, 6, 2, (x, y) => L(0.42 + 0.1 * (y - 2)), { capEnd: false });
  }
  return m.template({ facet: 0.1 });
}

// ---- gorgonian sea fans: radial ribs with concentric lattice links ----------------------------------
function gorgonian(seed, k) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0x6a), off = rng() * 40;
  const m = new Mesh();
  const N = [11, 12, 10][k], phiMax = [0.52, 0.57, 0.45][k], curve = [0.32, 0.42, 0.24][k], Rmax = [3.1, 3.05, 3.2][k];
  const sway = (y) => 0.35 * clamp(y / 3) ** 2;
  const colour = (y, v0) => { const v = v0 * (0.5 + 0.5 * smooth(-0.1, 0.7, y)) * (0.9 + 0.2 * nz.n2(y * 2 + off, v0)); return [v, v, v, 0, sway(y)]; };
  const outline = (phi) => Rmax * (0.86 + 0.14 * nz.n2(phi * 3 + off, 1.7));
  const radii = [0, 0.5, 0.85, 1.2, 1.55, 1.9, 2.25, 2.6, 3.0];
  // ribs: primary (full length) + forks beginning at r >= 1.2
  const ribs = [];
  for (let j = 0; j < N; j++) {
    const phi0 = -phiMax + (2 * phiMax * j) / (N - 1);
    ribs.push({ phi0, r0: 0, r1: outline(phi0) * (0.92 + rng() * 0.1), j: j * 2 });
    if (j < N - 1) ribs.push({ phi0: phi0 + phiMax / (N - 1), r0: 1.2, r1: outline(phi0) * (0.8 + rng() * 0.16), j: j * 2 + 1, fork: true });
  }
  const pt = (rib, r) => {
    const phi = rib.phi0 * (1 + 0.18 * (r / Rmax)) + 0.05 * Math.sin(r * 2.3 + rib.j);
    const x = r * Math.sin(phi), y = 0.15 + r * Math.cos(phi) * 0.98;
    return [x, y, curve * (x / 1.6) ** 2 + 0.1 * nz.n2(x * 0.9 + off, y * 0.9)];
  };
  const quad2 = (a, b, wa, wb, v, both) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const q = [[a[0] + nx * wa, a[1] + ny * wa, a[2]], [a[0] - nx * wa, a[1] - ny * wa, a[2]], [b[0] - nx * wb, b[1] - ny * wb, b[2]], [b[0] + nx * wb, b[1] + ny * wb, b[2]]];
    const ids = q.map((p, i) => m.v(p[0], p[1], p[2], colour(p[1], v + (i > 1 ? 0.12 : 0))));
    m.quad(ids[0], ids[1], ids[2], ids[3], 0);
    if (both) {
      const q2 = [[a[0], a[1], a[2] + wa], [a[0], a[1], a[2] - wa], [b[0], b[1], b[2] - wb], [b[0], b[1], b[2] + wb]];
      const i2 = q2.map((p, i) => m.v(p[0], p[1], p[2], colour(p[1], v + (i > 1 ? 0.12 : 0))));
      m.quad(i2[0], i2[1], i2[2], i2[3], 0);
    }
  };
  // stem
  limb(m, [0, -0.35, 0], [0, 0.2, 0], 0.13, 0.1, 5, 1, (x, y) => colour(y, 0.5), { capEnd: false });
  // ribs as short segments between the lattice radii
  for (const rib of ribs) {
    const rs = radii.filter((r) => r >= rib.r0 && r < rib.r1);
    if (rib.r0 === 0 && rs[0] === 0) rs[0] = 0.15; // start just above the stem
    rs.push(rib.r1);
    for (let i = 0; i + 1 < rs.length; i++) {
      const a = pt(rib, rs[i]), b = pt(rib, rs[i + 1]), t = rs[i] / Rmax;
      quad2(a, b, 0.07 * (1 - 0.55 * t), 0.07 * (1 - 0.55 * (rs[i + 1] / Rmax)), 0.95, rs[i] < 1.0);
    }
  }
  // concentric links between neighbouring ribs that both reach the radius
  for (const r of radii) {
    if (r < 0.45) continue;
    const live = ribs.filter((rb) => rb.r0 <= r && rb.r1 > r + 0.05).sort((p, q) => pt(p, r)[0] - pt(q, r)[0]);
    for (let i = 0; i + 1 < live.length; i++) {
      if (rng() < 0.08) continue; // a few torn cells
      const a = pt(live[i], r), b = pt(live[i + 1], r);
      quad2(a, b, 0.026, 0.026, 0.72, false);
    }
  }
  return m.template({ facet: 0 });
}

// ---- staghorn thickets ---------------------------------------------------------------------------
function thicket(seed, k) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0x2e), off = rng() * 40;
  const m = new Mesh();
  const colour = (y, tip) => L((0.48 + 0.4 * smooth(0, 1.8, y) + 0.25 * tip) * (0.9 + 0.2 * nz.n2(y * 3 + off, tip)));
  const tris = () => m.T.length / 4;
  const grow = (b, dir, len, r, depth) => {
    const e = add3(b, scale3(dir, len));
    const leaf = depth >= 3;
    limb(m, b, e, r, leaf ? 0.01 : r * 0.7, 4, 1, (x, y) => [...colour(y, leaf ? 1 : 0), 0, 0.02 * clamp(y) * clamp(y)], { capEnd: false });
    if (leaf || tris() > 660) return;
    const kids = rng() < 0.3 ? 3 : 2;
    for (let i = 0; i < kids; i++) {
      const sgn = i === 2 ? 0 : i ? 1 : -1;
      const perp = norm3(cross3(dir, [rng() - 0.5, 0.2 + rng(), rng() - 0.5]));
      const ang = 0.45 + rng() * 0.45;
      const d2 = norm3(add3(add3(scale3(dir, Math.cos(ang)), scale3(perp, Math.sin(ang) * (sgn || 0.2))), [0, 0.42, 0]));
      grow(e, d2, len * (0.76 + rng() * 0.12), r * 0.7, depth + 1);
    }
  };
  const clumps = 6;
  for (let c = 0; c < clumps; c++) {
    const a = (c / clumps) * TAU + rng() * 0.8, d = c === 0 ? 0.1 : 0.6 + rng() * 0.8;
    const base = [Math.cos(a) * d, -0.1, Math.sin(a) * d];
    const tilt = 0.35 + rng() * 0.4, ta = a + (rng() - 0.5) * 0.8;
    const dir = norm3([Math.cos(ta) * Math.sin(tilt) * (c === 0 ? 0.3 : 1), Math.cos(tilt) + 0.5, Math.sin(ta) * Math.sin(tilt) * (c === 0 ? 0.3 : 1)]);
    grow(base, dir, 0.55 + rng() * 0.15, 0.13, 0);
  }
  m.centerXZ();
  return m.template({ facet: 0.3 });
}

export function coralTemplates(seed) {
  return {
    bommies: [0, 1, 2, 3].map((k) => bommie(seed + 53 * k + 8, k)),
    towers: [0, 1, 2, 3].map((k) => tower(seed + 59 * k + 9, k)),
    plates: [0, 1, 2].map((k) => plate(seed + 61 * k + 10, k)),
    gorgonians: [0, 1, 2].map((k) => gorgonian(seed + 67 * k + 11, k)),
    thickets: [0, 1, 2].map((k) => thicket(seed + 71 * k + 12, k)),
  };
}
