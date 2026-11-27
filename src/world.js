import { createNoise } from './noise.js';

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Pure, deterministic seabed field: everything is a function of (seed, x, z). Nothing is stored. */
export function createField(seed) {
  const n1 = createNoise(seed), n2 = createNoise(seed + 101), n3 = createNoise(seed + 202), n4 = createNoise(seed + 303);
  const fbm = (n, x, y, oct) => {
    let a = 1, f = 1, s = 0, m = 0;
    for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * a; m += a; a *= 0.5; f *= 2.03; }
    return s / m;
  };
  const reefAt = (x, z) => sstep(0.3, 0.6, n4(x * 0.003 + 700, z * 0.003 - 200));
  const rockAt = (x, z) => sstep(0.3, 0.7, n3(x * 0.0045 - 300, z * 0.0045 + 120));
  const weedAt = (x, z) => sstep(0.1, 0.5, n2(x * 0.0065 + 31, z * 0.0065 + 8));
  function heightAt(x, z) {
    let h = -64 + fbm(n1, x * 0.0021, z * 0.0021, 3) * 44;
    h += fbm(n2, x * 0.011, z * 0.011, 3) * 5;
    const rm = rockAt(x, z);
    const ridge = 1 - Math.abs(n3(x * 0.0105 + 9, z * 0.0105 - 4));
    h += rm * (ridge * ridge * ridge * 18 - 3);
    const reef = reefAt(x, z);
    h += reef * 0.7 * (-23 + fbm(n4, x * 0.03, z * 0.03, 2) * 3 - h);
    h += n1(x * 0.09, z * 0.07) * 0.22 * (1 - rm * 0.7);
    return Math.min(h, -6);
  }
  function normalAt(x, z, out) {
    const e = 0.7;
    const dx = heightAt(x + e, z) - heightAt(x - e, z);
    const dz = heightAt(x, z + e) - heightAt(x, z - e);
    const l = Math.hypot(dx, 2 * e, dz);
    out[0] = -dx / l; out[1] = (2 * e) / l; out[2] = -dz / l;
    return out;
  }
  /** pleasant start: reefy, not too deep, near origin */
  function findStart() {
    let best = [0, 0], bs = -1e9;
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
      const x = i * 40, z = j * 40;
      const s = reefAt(x, z) * 2 + weedAt(x, z) - rockAt(x, z) * 3 - Math.hypot(x, z) / 500 - Math.max(0, -heightAt(x, z) - 40) * 0.05;
      if (s > bs) { bs = s; best = [x, z]; }
    }
    return best;
  }
  return { heightAt, normalAt, reefAt, rockAt, weedAt, findStart, noise: n1 };
}
