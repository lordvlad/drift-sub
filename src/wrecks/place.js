/**
 * Where the rare wrecks go: a pure, deterministic pick from (cell hash, seabed depth, profile). Used by biomes.js when it
 * makes a `wreck` feature; the pick sets f.rare (a RARE_WRECKS entry), the feature's real-ship-inspired length / beam / list.
 */
import { RARE_WRECKS, gameDims } from './data.js';

/** chance that a wreck is one of the 20 rare ones (the manta's profile steers towards wrecks and so finds them more often) */
const P_RARE = { 0: 0.14, 1: 0.2, 2: 0.12, 3: 0.14 };

let forced = null;
/** test hook: make every wreck feature the given rare wreck (id) until called with null; the caller clears the biome caches */
export function forceRare(id) { forced = id || null; }
export const forcedRare = () => forced;

/**
 * @param roll  two uniform randoms from a per-cell generator: [chance, pick]
 * @param depth in-game seabed depth the wreck will rest at (m, positive)
 * @param reach deepest seabed the profile's sub can sensibly reach (PROFILES.reach)
 * @param profId profile id
 */
export function pickRare(roll, depth, reach, profId) {
  if (forced) return RARE_WRECKS.find((w) => w.id === forced) || null;
  if (roll[0] >= (P_RARE[profId] ?? 0.14)) return null;
  const c = RARE_WRECKS.filter((w) => depth >= w.depth[0] - 6 && depth <= w.depth[1] + 12 && w.depth[0] <= reach + 2);
  return c.length ? c[Math.floor(roll[1] * c.length) % c.length] : null;
}

/** shape a wreck feature after a rare wreck */
export function applyRare(f, w, rng) {
  const d = gameDims(w), sgn = rng() < 0.5 ? -1 : 1;
  f.rare = w; f.length = d.length; f.hullBeam = d.beam; f.r = d.length * 0.5;
  f.heel = sgn * (w.model.heel ?? 0.25); f.pitch = w.model.pitch ?? 0.05;
  f.dy = (w.model.sink ?? 0) + Math.abs(Math.sin(f.heel)) * d.beam * 0.4;   // a listing hull is raised so its low side is buried, not the whole ship
  f.R = d.length * 0.5 + 10 + f.fall;
  // a heavily listing hull is as wide as it is deep: widen the flat pad under it (f.beam is the pad width, f.hullBeam the ship's)
  f.beam = d.beam * (1 + Math.abs(Math.sin(f.heel)) * 0.7);
  return f;
}
