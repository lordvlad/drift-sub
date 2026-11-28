/**
 * Rare rock formations as places (hooked into biomes.js, see the `RK` lines there): sea-stack forests, blue holes,
 * natural bridges (double arches), basalt column fields, mushroom-rock clusters and terraced rock-pool stairways.
 * Same contract as the other places: pure functions of (seed, profile, x, z); meshes are built in landmarks-rock.js.
 *
 * Odds per km² for [lemon, manta, barracuda, squid]; ~0.1–0.45 each (the sites are picky, so real densities are lower).
 */

export const ROCK_RATES = {
  stacks:   [0.25, 0.42, 0.2, 0.14],   // manta likes headlands
  bluehole: [0.28, 0.34, 0.3, 0.26],   // lemon / manta: shallow shelves
  bridge:   [0.2, 0.46, 0.16, 0.2],    // manta: arches and bridges
  basalt:   [0.2, 0.18, 0.12, 0.46],   // squid: volcanic country
  mushroom: [0.22, 0.32, 0.14, 0.22],
  terrace:  [0.14, 0.18, 0.36, 0.3],   // barracuda: long shelves
};
export const ROCK_TYPES = Object.keys(ROCK_RATES);

/**
 * @param H { site, depthAt, avgDepth, P (() => profile), base, N, sstep, clamp, mixTint, LDset? }
 */
export function createRockPlaces(H) {
  const { site, depthAt, avgDepth, P, base, N, sstep, clamp, mixTint } = H;
  const TY = new Set(ROCK_TYPES);
  const rr = (rng, a, b) => a + rng() * (b - a);

  // ------------------------------------------------------------------ makers
  const MAKE = {
    stacks(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z); return d < 22 || d > P().reach + 10 ? -1 : 0.4 + base.rock(x, z) + (d < P().reach ? 0.3 : 0); });
      if (!s) return null;
      const r = rr(rng, 30, 50), want = Math.round(9 + r * 0.2), sp = [];   // x, z, height (m), radius (m), variant, yaw
      for (let t = 0; t < want * 6 && sp.length < want * 6; t++) {
        const a = rng() * 6.283, d = r * Math.sqrt(rng()), x = s[0] + Math.cos(a) * d, z = s[1] + Math.sin(a) * d, rad = rr(rng, 1.6, 3.6);
        let ok = true;
        for (let i = 0; i < sp.length; i += 6) if (Math.hypot(sp[i] - x, sp[i + 1] - z) < sp[i + 3] + rad + 2.5) { ok = false; break; }
        if (ok) sp.push(x, z, 9 + Math.pow(rng(), 1.3) * 17, rad, Math.floor(rng() * 3), rng() * 6.283);
      }
      return { x: s[0], z: s[1], r, R: r * 1.3 + 8, sp, o: rng() * 90, y0: -Math.min(avgDepth(s[0], s[1], 20), P().reach + 6) };
    },
    bluehole(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z); return d < 18 || d > 48 ? -1 : 0.6 + (1 - base.rock(x, z)) * 0.4 + base.reef(x, z) * 0.4; });
      if (!s) return null;
      const r = rr(rng, 30, 50), dep = avgDepth(s[0], s[1], r * 1.3);
      return { x: s[0], z: s[1], r, R: r * 1.75 + 8, depth: rr(rng, 26, 42), o: rng() * 90, y0: -clamp(dep, 18, 48) };
    },
    bridge(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z); return d < 18 || d > P().reach + 12 ? -1 : 0.3 + base.rock(x, z) + (d < P().reach ? 0.4 : 0); });
      if (!s) return null;
      const yaw = rng() * 6.283, c = Math.cos(yaw), sn = Math.sin(yaw);
      const span = rr(rng, 12, 16), pier = rr(rng, 3.8, 5.2), wz = rr(rng, 3.6, 4.8), height = rr(rng, 8.5, 11.5);
      const A = span + pier / 2 + 5, surf = avgDepth(s[0], s[1], 14), lim = P().reach + 4, lift = Math.max(0, surf - lim);
      return { x: s[0], z: s[1], yaw, c, s: sn, span, pier, wz, height, A, odd: Math.floor(rng() * 1000), hx: A + 3, z0: -(wz + 6), z1: wz + 6, r: A, y0: -Math.min(surf, lim), fall: 12 + lift * 1.1,
        R: Math.hypot(A + 3 + 12 + lift * 1.1, wz + 6 + 12 + lift * 1.1) };
    },
    basalt(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z), rk = base.rock(x, z); return d < 20 || d > P().reach + 10 ? -1 : 0.3 + rk + (d < P().reach ? 0.3 : 0); });
      if (!s) return null;
      const r = rr(rng, 22, 36), surf = avgDepth(s[0], s[1], 16), lim = P().reach + 4;
      return { x: s[0], z: s[1], r, R: r * 1.5 + 8, ang: rng() * 6.283, o: rng() * 90, y0: -Math.min(surf, lim), tall: rr(rng, 4.5, 8) };
    },
    mushroom(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z); return d < 20 || d > P().reach + 8 ? -1 : 0.4 + base.rock(x, z) * 0.8; });
      if (!s) return null;
      const r = rr(rng, 14, 24), want = 5 + Math.floor(rng() * 5), sp = [];   // x, z, scale, variant, yaw, lean
      for (let t = 0; t < want * 8 && sp.length < want * 6; t++) {
        const a = rng() * 6.283, d = r * Math.sqrt(rng()), x = s[0] + Math.cos(a) * d, z = s[1] + Math.sin(a) * d, sc = rr(rng, 0.7, 1.2);
        let ok = true;
        for (let i = 0; i < sp.length; i += 6) if (Math.hypot(sp[i] - x, sp[i + 1] - z) < (sp[i + 2] + sc) * 3.6) { ok = false; break; }
        if (ok) sp.push(x, z, sc, Math.floor(rng() * 3), rng() * 6.283, (rng() - 0.5) * 0.14);
      }
      return { x: s[0], z: s[1], r, R: r * 1.3 + 8, sp, o: rng() * 90 };
    },
    terrace(rng, ix, iz) {
      const s = site(rng, ix, iz, (x, z) => { const d = depthAt(x, z); return d < 26 || d > P().reach + 14 ? -1 : 0.6 + (1 - Math.abs(base.rock(x, z) - 0.5)); });
      if (!s) return null;
      const d = avgDepth(s[0], s[1], 30), len = rr(rng, 46, 62), wid = rr(rng, 26, 38), n = 6 + Math.floor(rng() * 3);
      const hs = Math.min(rr(rng, 11, 16), (d - 8) / 0.6);
      if (hs < 5) return null;
      return { x: s[0], z: s[1], r: Math.max(len, wid) * 0.8, R: Math.max(len, wid) * 1.15 + 14, ang: rng() * 6.283, len, wid, n, hs, o: rng() * 90, y0: -d };
    },
  };

  // ------------------------------------------------------------------ shapes
  let LX = 0, LZ = 0;
  const toLocal = (f, x, z) => { const dx = x - f.x, dz = z - f.z; LX = dx * f.c - dz * f.s; LZ = dx * f.s + dz * f.c; };
  const bridgeW = (f, x, z) => {
    toLocal(f, x, z);
    return (1 - sstep(f.hx, f.hx + f.fall, Math.abs(LX))) * sstep(f.z0 - f.fall, f.z0, LZ) * (1 - sstep(f.z1, f.z1 + f.fall, LZ));
  };
  // terrace: a, b = along / across the stairway (m); returns step height fraction 0..n and tread phase
  let TA = 0, TB = 0, TK = 0, TT = 0, TQ = 0;
  const terraceLocal = (f, x, z) => {
    const dx = x - f.x, dz = z - f.z, c = Math.cos(f.ang), s = Math.sin(f.ang);
    TA = dx * c + dz * s; TB = -dx * s + dz * c;
    TQ = Math.hypot(TA / f.len, TB / f.wid);
    const k = clamp((TA / f.len * 0.5 + 0.5) * f.n + 0.35 * N.n2(TB * 0.03 + f.o, TA * 0.012) + 0.15 * N.n1(TB * 0.09, TA * 0.05), 0, f.n);
    TK = Math.floor(Math.min(k, f.n - 1e-6)); TT = k - TK;
  };
  const colV = (f, x, z) => {          // basalt column field: u across stair direction
    const dx = x - f.x, dz = z - f.z, c = Math.cos(f.ang), s = Math.sin(f.ang);
    LX = dx * c + dz * s; LZ = -dx * s + dz * c;
  };

  function shapeH(f, x, z, h) {
    switch (f.type) {
      case 'stacks': {
        const d = Math.hypot(x - f.x, z - f.z);
        if (d >= f.R) return h;
        const w = 1 - sstep(f.r * 0.55, f.r * 1.2, d);
        return h + 2.4 * w * (0.6 + 0.4 * N.n1(x * 0.06 + f.o, z * 0.06));
      }
      case 'bluehole': {
        const dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz);
        if (d >= f.R) return h;
        const th = Math.atan2(dz, dx), rho = f.r * (1 + 0.1 * N.n2(Math.cos(th) * 1.2 + f.o, Math.sin(th) * 1.2 - f.o)), u = d / rho;
        const shelf = 1 - sstep(1.1, 1.75, u), wall = 1 - sstep(0.6, 0.95, u);
        const y = h + (f.y0 - h) * shelf;
        return y - f.depth * wall + 0.5 * Math.exp(-(((u - 1.0) / 0.12) ** 2)) + 0.4 * N.n1(x * 0.2, z * 0.2) * wall;
      }
      case 'bridge': {
        const w = bridgeW(f, x, z);
        return w > 0 ? h + (f.y0 - h) * w : h;
      }
      case 'basalt': {
        const d = Math.hypot(x - f.x, z - f.z);
        if (d >= f.R) return h;
        const w = 1 - sstep(f.r * 0.95, f.r * 1.4, d);
        return w > 0 ? h + (f.y0 - 1.2 - h) * w : h;
      }
      case 'mushroom': {
        const d = Math.hypot(x - f.x, z - f.z);
        return d >= f.R ? h : h + 0.9 * (1 - sstep(0, f.r * 1.15, d)) * (0.5 + N.n1(x * 0.07 + f.o, z * 0.07));
      }
      case 'terrace': {
        if (Math.hypot(x - f.x, z - f.z) >= f.R) return h;
        terraceLocal(f, x, z);
        const w = 1 - sstep(0.72, 1.12, TQ + 0.08 * N.n2(x * 0.05 + f.o, z * 0.05));
        if (w <= 0) return h;
        const stair = TK + sstep(0.9, 1, TT), ht = f.y0 + f.hs * (stair / f.n - 0.4) - 0.7 * Math.sin(Math.PI * clamp(TT / 0.9, 0, 1)) + 0.15 * N.n1(x * 0.3, z * 0.3);   // concave pools behind each rim
        return h + (ht - h) * w;
      }
    }
    return h;
  }

  function rockK(f, x, z) {
    switch (f.type) {
      case 'stacks': return 1 - sstep(f.r * 0.6, f.r * 1.2, Math.hypot(x - f.x, z - f.z));
      case 'bluehole': { const d = Math.hypot(x - f.x, z - f.z); return d >= f.R ? 0 : 0.85 * (1 - sstep(f.r * 0.9, f.r * 1.3, d)); }
      case 'bridge': { const w = bridgeW(f, x, z); return w > 0.2 ? 1 : 0.7 * w / 0.2; }
      case 'basalt': return 1 - sstep(f.r * 0.9, f.r * 1.4, Math.hypot(x - f.x, z - f.z));
      case 'mushroom': return 1 - sstep(f.r * 0.7, f.r * 1.3, Math.hypot(x - f.x, z - f.z));
      case 'terrace': { if (Math.hypot(x - f.x, z - f.z) >= f.R) return 0; terraceLocal(f, x, z); return 0.9 * (1 - sstep(0.8, 1.15, TQ)); }
    }
    return 0;
  }

  /** biome weights: rocky formations count as cave country (rock dwellers) */
  function biomeK(f, x, z, w) {
    let k = 0;
    switch (f.type) {
      case 'stacks': case 'mushroom': k = 0.8 * (1 - sstep(f.r * 0.5, f.r * 1.2, Math.hypot(x - f.x, z - f.z))); break;
      case 'bluehole': k = 1 - sstep(f.r * 0.7, f.r * 1.3, Math.hypot(x - f.x, z - f.z)); break;
      case 'bridge': k = bridgeW(f, x, z); break;
      case 'basalt': k = 0.8 * (1 - sstep(f.r * 0.7, f.r * 1.3, Math.hypot(x - f.x, z - f.z))); break;
    }
    if (k > w.cave) w.cave = k;
  }

  function shapeSurface(f, x, z, o) {
    switch (f.type) {
      case 'bluehole': {
        const dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz);
        if (d >= f.R) return;
        const th = Math.atan2(dz, dx), u = d / (f.r * (1 + 0.1 * N.n2(Math.cos(th) * 1.2 + f.o, Math.sin(th) * 1.2 - f.o)));
        const m = 0.85 + 0.3 * N.n3(x * 0.6, z * 0.6);
        mixTint(o, 0.8 * Math.exp(-(((u - 1.08) / 0.3) ** 2)), 0.88 * m, 0.9 * m, 0.78 * m);                          // pale sand rim
        mixTint(o, 0.85 * (1 - sstep(0.5, 0.95, u)), 0.13 * m, 0.24 * m, 0.38 * m);                                    // deep blue walls and floor
        break;
      }
      case 'basalt': {
        const d = Math.hypot(x - f.x, z - f.z); if (d >= f.R) return;
        const m = 0.85 + 0.3 * N.n3(x * 0.5, z * 0.5);
        mixTint(o, 0.85 * (1 - sstep(f.r * 0.9, f.r * 1.4, d)), 0.2 * m, 0.2 * m, 0.22 * m);
        break;
      }
      case 'bridge': { const w = bridgeW(f, x, z); mixTint(o, w * 0.5, 0.78, 0.7, 0.5); break; }
      case 'stacks': {
        const d = Math.hypot(x - f.x, z - f.z); if (d >= f.R) return;
        const m = 0.85 + 0.3 * N.n3(x * 0.4, z * 0.4);
        mixTint(o, 0.6 * (1 - sstep(f.r * 0.6, f.r * 1.2, d)), 0.62 * m, 0.55 * m, 0.4 * m);
        break;
      }
      case 'terrace': {
        if (Math.hypot(x - f.x, z - f.z) >= f.R) return;
        terraceLocal(f, x, z);
        const w = 1 - sstep(0.75, 1.18, TQ);
        if (w <= 0) return;
        const m = 0.85 + 0.3 * N.n3(x * 0.7, z * 0.7), pool = N.n1(x * 0.11 + f.o, z * 0.11) + 0.4 * N.n2(x * 0.35, z * 0.35);
        if (TT > 0.88) mixTint(o, w * 0.95, 0.7 * m, 0.32 * m, 0.12 * m);                      // rust-coloured risers
        else if (pool > -0.1 && TT > 0.08 && TT < 0.84) mixTint(o, w * 0.95, 0.14 * m, 0.56 * m, 0.55 * m);   // teal pools on the treads
        else mixTint(o, w * 0.95, 0.92 * m, 0.88 * m, 0.7 * m);                                // cream travertine-like rims
        break;
      }
    }
  }

  /** true where generic rocks / coral / weed must keep out */
  function clear(f, x, z) {
    switch (f.type) {
      case 'bluehole': return Math.hypot(x - f.x, z - f.z) < f.r * 1.05;
      case 'bridge': return bridgeW(f, x, z) > 0.12;
      case 'basalt': return Math.hypot(x - f.x, z - f.z) < f.r * 1.1;
      case 'terrace': { if (Math.hypot(x - f.x, z - f.z) >= f.R) return false; terraceLocal(f, x, z); return TQ < 0.9; }
    }
    return false;
  }

  return { types: TY, make: MAKE, shapeH, rockK, biomeK, shapeSurface, clear, bridgeW, terraceLocal: (f, x, z) => { terraceLocal(f, x, z); return { a: TA, b: TB, q: TQ, k: TK, t: TT }; }, colV: (f, x, z) => { colV(f, x, z); return [LX, LZ]; } };
}
