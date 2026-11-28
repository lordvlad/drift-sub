import { mulberry32 } from '../noise.js';
import { Mesh, sweep, ellipsoid, noiseKit, rotFn, TAU, clamp, smooth, fract, lum } from './landmarks-kit.js';

const L = (v) => [v, v, v];

/** stratified rock luminance: bands along height, crevice AO near the ground */
function strata(nz, off, x, y, z, base = 0.5) {
  const band = nz.n2(y * 1.7 + off, 0.5) * 0.5 + 0.5 * Math.sin(y * 3.3 + 2.0 * nz.n2(x * 0.5 + off, z * 0.5));
  const fine = 0.5 * Math.sin(y * 11 + 3 * nz.n2(x * 1.3, z * 1.3 + off));
  return base + 0.16 * band + 0.05 * fine + 0.07 * nz.n3(x * 2.6, y * 1.4, z * 2.6);
}

// ---- rock spires / needles -----------------------------------------------------------------------
function spire(seed, k) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0x55), off = rng() * 40;
  const m = new Mesh();
  const H = [8.0, 6.4, 10.4, 7.4][k], R0 = [1.6, 1.55, 1.7, 1.5][k];
  const lx = (rng() - 0.5) * 2 * [1.2, 1.7, 1.0, 1.5][k], lz = (rng() - 0.5) * 2 * [1.2, 1.7, 1.0, 1.5][k];
  const body = (x0, z0, h, r0, rings, sides, seedOff, lxx, lzz, top) => sweep(m, {
    path: (t) => [x0 + lxx * Math.pow(t, 1.5) + Math.sin(t * 3 + seedOff) * 0.15, -0.6 + t * (h + 0.6), z0 + lzz * Math.pow(t, 1.5)],
    rings, sides, capH: 0.15,
    radius: (t, a, cx, cy, cz) => {
      let r = r0 * (top + (1 - top) * Math.pow(1 - t, 1.05)) * (1 + 0.35 * Math.exp(-t * 14));
      r *= 1 + 0.24 * (fract(cy * 0.8 + seedOff * 0.1) - 0.5); // stepped ledges
      r *= 1 + 0.32 * nz.n3(cx * 0.8 + Math.cos(a) * 1.8 + seedOff, cy * 0.6, cz * 0.8 + Math.sin(a) * 1.8);
      return Math.max(r, 0.12);
    },
    lift: (t, a) => smooth(0.88, 1, t) * 0.5 * nz.n2(a * 1.5 + seedOff, 4),
    attr: (x, y, z, t, a) => {
      const f = fract(y * 0.8 + seedOff * 0.1);
      const v = strata(nz, seedOff, x, y, z) * (0.42 + 0.58 * smooth(-0.6, 3.5, y)) * (0.88 + 0.22 * f) * (1 + 0.1 * Math.sin(a * 3 + y));
      return L(v);
    },
  });
  body(0, 0, H, R0, 22, 9, off, lx, lz, 0.12);
  if (k % 2 === 0) {
    const a = rng() * TAU;
    body(Math.cos(a) * R0 * 1.15, Math.sin(a) * R0 * 1.15, H * (0.38 + rng() * 0.15), R0 * 0.55, 10, 7, off + 11, lx * 0.2, lz * 0.2, 0.1);
  }
  return m.template({ facet: 0.7 });
}

// ---- leaning rock slabs / fins ------------------------------------------------------------------
function slab(seed, k) {
  const rng = mulberry32(seed), nz = noiseKit(seed ^ 0x99), off = rng() * 40;
  const m = new Mesh();
  const part = (c, rad, rx, rz, ex, seedOff, tone) => {
    const from = m.nv;
    ellipsoid(m, [0, rad[1] - 0.3, 0], rad, 16, 10, {
      exp: ex, yMin: -0.9,
      disp: (dx, dy, dz) => 1 + 0.1 * nz.n3(dx * 2.5 + seedOff, dy * 2.5, dz * 2.5) + 0.05 * nz.n3(dx * 6 + seedOff, dy * 6, dz * 6),
      attr: (x, y, z) => {
        const v = strata(nz, seedOff, x, y, z, 0.5) * tone * (0.4 + 0.6 * smooth(-0.8, 3.0, y));
        return L(v);
      },
    });
    const rf = rotFn(rx, 0, rz);
    m.map(from, (p) => { const q = rf(p); return [q[0] + c[0], q[1] + c[1], q[2] + c[2]]; });
  };
  const lean = [0.2, -0.24, 0.3][k], tilt = [0.1, 0.16, -0.1][k];
  part([0, 0, 0], [2.5, 2.1, 0.5], tilt, lean, 0.45, off, 1);
  if (k >= 1) part([(k === 1 ? 1 : -1) * 1.6, 0, 1.0], [1.7, 1.45, 0.34], 0.2, lean * (k === 1 ? -1.8 : 1.6), 0.5, off + 9, 0.9);
  return m.template({ facet: 0.55 });
}

export function rockTemplates(seed) {
  return {
    spires: [0, 1, 2, 3].map((k) => spire(seed + 73 * k + 13, k)),
    slabs: [0, 1, 2].map((k) => slab(seed + 79 * k + 14, k)),
  };
}
