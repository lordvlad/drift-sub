/**
 * Chunk decor for the rare wrecks (src/wrecks/data.js): the assembly (hull variant of src/wrecks/models.js) and the little extras a
 * rare wreck gets over a common one: slow bubble strings seeping from the hull and a few more reef animals' hiding places.
 * Hooked from landmarks.js (assembly() / structure()).
 */
import * as THREE from 'three';
import { PLUME } from './plumes.js';
import { buildRareWreck } from './wrecks/models.js';
import { hash2, mulberry32 } from './noise.js';

/** the geometry assembly of a feature's rare wreck (f.rare, f.length, f.hullBeam from biomes.js / wrecks/place.js) */
export function rareAssembly(f) {
  const w = f.rare;
  return buildRareWreck({ ...w.model, length: f.length, beam: f.hullBeam, seed: w.seed });
}

/** quiet bubble strings from a few spots on the wreck, each owned by the chunk holding it; M is the wreck's placement matrix */
export function rareExtras(f, c, asm, M) {
  const rng = mulberry32(hash2(f.x | 0, f.z | 0, 4711)), v = new THREE.Vector3(), n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const pc = asm.pieces[Math.floor(rng() * asm.pieces.length)], k = pc.colliders[Math.floor(rng() * pc.colliders.length)];
    if (!k) continue;
    v.set(k[0], k[1] + k[3] * 0.6, k[2]).applyMatrix4(M);
    if (v.x < c.x0 || v.x >= c.x0 + c.CS || v.z < c.z0 || v.z >= c.z0 + c.CS) continue;
    c.emitters.push(v.x, v.y, v.z, PLUME.BUBBLE, 0.5 + rng() * 0.3, 0.5 + rng() * 0.4);
  }
}
