import { ventTemplates } from './landmarks-vents.js';
import { coralTemplates } from './landmarks-coral.js';
import { rockTemplates } from './landmarks-rocks.js';

export { buildWreck } from './landmarks-wreck.js';
export { buildArch, buildCave } from './landmarks-structures.js';

/**
 * Procedural landmark geometry for the streaming seabed.
 *
 * Templates: { pos, nor, col, sway, glow, count } (Float32Arrays, count = vertex count, y up, base at y~0, centred on x=z=0).
 *  'full' colour sets (real colours): chimneys, chimneysSmall, tubeworms, mats, lavaRocks
 *  'lum' sets (luminance only, tinted per instance): basalt, pillows, spires, slabs, bommies, towers, plates, gorgonians, thickets
 * chimneys / chimneysSmall carry extra own properties: top = [x,y,z] smoke emission point, r = base radius, h = height.
 */
export function buildLandmarkTemplates(seed = 777) {
  const v = ventTemplates(seed), c = coralTemplates(seed), r = rockTemplates(seed);
  return {
    chimneys: v.chimneys, chimneysSmall: v.chimneysSmall, tubeworms: v.tubeworms, mats: v.mats,
    basalt: v.basalt, pillows: v.pillows, lavaRocks: v.lavaRocks,
    spires: r.spires, slabs: r.slabs,
    bommies: c.bommies, towers: c.towers, plates: c.plates, gorgonians: c.gorgonians, thickets: c.thickets,
  };
}
