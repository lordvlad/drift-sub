import { createNoise } from './noise.js';
import { createBiomes, PROFILES, PROFILE_IDS } from './biomes.js';

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Pure, deterministic seabed field: everything is a function of (seed, profile, x, z). Nothing is stored.
 * The profile (the active submarine kind) steers the terrain character and which places (landmarks) occur; see biomes.js.
 */
export function createField(seed) {
  const n1 = createNoise(seed), n2 = createNoise(seed + 101), n3 = createNoise(seed + 202), n4 = createNoise(seed + 303), n5 = createNoise(seed + 404);
  const fbm = (n, x, y, oct) => {
    let a = 1, f = 1, s = 0, m = 0;
    for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * a; m += a; a *= 0.5; f *= 2.03; }
    return s / m;
  };
  let P = PROFILES.lemon;
  const reefBase = (x, z) => sstep(0.3 - P.reef, 0.6 - P.reef, n4(x * 0.003 + 700, z * 0.003 - 200));
  const rockBase = (x, z) => sstep(0.3 - P.rock, 0.7 - P.rock, n3(x * 0.0045 - 300, z * 0.0045 + 120));
  const weedAt = (x, z) => sstep(0.1, 0.5, n2(x * 0.0065 + 31, z * 0.0065 + 8));
  /** seabed without any landmark shaping */
  function heightBase(x, z) {
    let h = -64 + P.bias + fbm(n1, x * 0.0021, z * 0.0021, 3) * 44 * P.amp;
    if (P.shelf) h += P.shelf * 11 * Math.tanh(n5(x * 0.0017 + 40, z * 0.0017 - 90) * 3);   // long gentle shelves
    h += fbm(n2, x * 0.011, z * 0.011, 3) * 5 * P.detail;
    const rm = rockBase(x, z);
    const ridge = 1 - Math.abs(n3(x * 0.0105 + 9, z * 0.0105 - 4));
    h += rm * (ridge * ridge * ridge * 18 * (0.4 + 0.6 * P.detail) - 3);
    const reef = reefBase(x, z);
    h += reef * 0.7 * (-23 + fbm(n4, x * 0.03, z * 0.03, 2) * 3 - h);
    h += n1(x * 0.09, z * 0.07) * 0.22 * (1 - rm * 0.7);
    return Math.min(h, -6);
  }
  const B = createBiomes(seed, { height: heightBase, rock: rockBase, reef: reefBase, n: { n1, n2, n3, n4, n5 } });
  const heightAt = (x, z) => Math.min(B.height(x, z, heightBase(x, z)), -6);
  const rockAt = (x, z) => B.rock(x, z, rockBase(x, z));
  const reefAt = (x, z) => B.reef(x, z, reefBase(x, z));
  function normalAt(x, z, out) {
    const e = 0.7;
    const dx = heightAt(x + e, z) - heightAt(x - e, z);
    const dz = heightAt(x, z + e) - heightAt(x, z - e);
    const l = Math.hypot(dx, 2 * e, dz);
    out[0] = -dx / l; out[1] = (2 * e) / l; out[2] = -dz / l;
    return out;
  }

  const smoothstep = sstep;
  /** biome weights 0..1: { reef, bigreef, open, deep, vent, magma, cave, trench, wreck } */
  function biomeAt(x, z, out) {
    const w = out || {};
    w.bigreef = 0; w.vent = 0; w.magma = 0; w.cave = 0; w.trench = 0; w.wreck = 0;
    B.weights(x, z, w);
    const h = heightAt(x, z);
    w.reef = reefAt(x, z);
    w.deep = smoothstep(52, 95, -h);
    w.open = Math.max(0, 1 - Math.max(w.reef * 0.9, w.bigreef, w.vent, w.magma, w.cave, w.trench, w.wreck, rockAt(x, z) * 0.6));
    return w;
  }

  const field = {
    heightAt, normalAt, reefAt, rockAt, weedAt, reefBase, clearAt: (x, z) => B.clear(x, z), noise: n1, biomeAt, seed,
    get profile() { return P.name; },
    /** switch to a submarine kind's world; returns true if it changed (callers rebuild nearby terrain) */
    setProfile(kind) { const ch = B.setProfile(kind); P = B.profile; return ch; },
    profiles: PROFILE_IDS,
    /** deterministic landmarks whose disc (radius r) intersects the disc around (x,z): [{ type, id, x, y, z, r, f }] */
    featuresNear(x, z, radius) { return B.featuresNear(x, z, radius, field); },
    /** nearest landmark of a type (string or array of strings) within maxR, or null */
    findFeature(type, x, z, maxR = 2000) { return B.findFeature(type, x, z, maxR, field); },
    /** internals for terrain.js / landmarks.js */
    places: B,
    /** colour/glow info of the ground at (x,z): out = { k (tint strength), r, g, b, glow } */
    surfaceAt(x, z, out) { out.r = 0; out.g = 0; out.b = 0; return B.surface(x, z, out); },
  };

  /** pleasant start: reefy, not too deep, near origin, clear of hazards */
  field.findStart = function findStart() {
    let best = [0, 0], bs = -1e9;
    const w = {};
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
      const x = i * 40, z = j * 40, h = heightAt(x, z);
      biomeAt(x, z, w);
      const dep = -h;
      const s = reefAt(x, z) * 2 + weedAt(x, z) - rockAt(x, z) * 3 - Math.hypot(x, z) / 500 - Math.max(0, dep - 40) * 0.05 - Math.max(0, 22 - dep) * 0.4
        - (w.vent + w.magma + w.trench) * 6 - w.cave * 1.5 + w.bigreef * 0.6;
      if (s > bs) { bs = s; best = [x, z]; }
    }
    return best;
  };
  return field;
}
