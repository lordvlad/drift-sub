/**
 * Encyclopedia "Terrain" tab: landforms, volcanic features, caves & arches, reefs and open-water areas (28 pages).
 * Page content: src/data/terrain-sheets.js (each entry documents its unlock `criterion`); the rules are below and
 * mirror those strings. Everything is read from the photo-shot descriptor (shot.landmarks / biomes / depth / coral / weed)
 * plus, for reef variants and camera height, the field around the sub at the moment of the snapshot.
 */
import { registerSection, enc } from './api.js';
import { bus } from '../bus.js';
import { TERRAIN_ENTRIES } from '../data/terrain-sheets.js';

registerSection({
  id: 'terrain',
  title: 'Terrain',
  unlockText: 'Photograph this kind of place, with the landform or the surroundings clearly in frame, to unlock the page.',
  entries: TERRAIN_ENTRIES.map((e) => ({ id: e.id, name: e.name, hint: e.hint, depth: e.depth, facts: e.facts.filter(([k]) => k !== 'Depth'), group: e.group, sheet: e.sheet })),   // the page itself already shows a Depth chip
});

const WHOLE = { x: 0, y: 0, frac: 1 };

/** nearest-biggest landmark of `type` within maxD metres filling at least minF of the frame: { x, y, frac } or null */
function lm(shot, type, maxD, minF = 0) {
  let best = null;
  for (const l of shot.landmarks || []) if (l.type === type && l.dist <= maxD && l.frac >= minF && (!best || l.frac > best.frac)) best = l;
  return best && { x: best.x, y: best.y, frac: Math.min(1, Math.max(0.15, best.frac)) };
}

/** a big reef the camera is inside of, or null (needs the raw feature for the lagoon / maze flags) */
function reefAround(game) {
  const p = game.sub.pos;
  for (const f of game.field.featuresNear(p.x, p.z, 0)) if (f.type === 'bigreef' && Math.hypot(f.x - p.x, f.z - p.z) < f.r) return f;
  return null;
}

/**
 * id -> (shot, bio, ctx) => { x, y, frac } | null.   ctx = { game, depth (m), up (camera height above the seabed, m) }
 * Keep in step with `criterion` in src/data/terrain-sheets.js.
 */
export const RULES = {
  // landforms
  seamount: (s) => lm(s, 'seamount', 160, 0.3),
  dropoff: (s) => lm(s, 'dropoff', 110, 0.3),
  canyon: (s) => lm(s, 'canyon', 90, 0.25),
  trench: (s) => lm(s, 'trench', 130, 0.3),
  stacks: (s) => lm(s, 'stacks', 70, 0.2),
  bluehole: (s) => lm(s, 'bluehole', 90, 0.2),
  terrace: (s) => lm(s, 'terrace', 60, 0.2),
  garden: (s) => lm(s, 'garden', 60, 0.2),
  mushroom: (s) => lm(s, 'mushroom', 45, 0.15),
  // volcanic
  volcano: (s) => lm(s, 'volcano', 120, 0.15),
  caldera: (s) => lm(s, 'volcano', 45),
  magma: (s) => lm(s, 'magma', 100, 0.12),
  pillow: (s, b) => lm(s, 'magma', 35) || lm(s, 'volcano', 35) || (b.magma >= 0.5 ? WHOLE : null),
  basalt: (s) => lm(s, 'basalt', 60, 0.2),
  blacksmoker: (s, b, c) => (c.depth > 50 ? lm(s, 'vent', 70) : null),
  shallowvent: (s, b, c) => (c.depth < 50 ? lm(s, 'vent', 60) : null),
  // caves and arches
  arch: (s) => lm(s, 'arch', 60, 0.1),
  bridge: (s) => lm(s, 'bridge', 70, 0.15),
  cave: (s) => lm(s, 'cave', 50, 0.1),
  // reefs
  bigreef: (s) => lm(s, 'bigreef', 160, 0.3),
  lagoon: (s, b, c) => { const f = reefAround(c.game); return f && f.f.lagoon && Math.hypot(f.x - c.game.sub.pos.x, f.z - c.game.sub.pos.z) < f.r * 0.9 ? WHOLE : null; },
  maze: (s, b, c) => { const f = reefAround(c.game); return f && f.f.maze ? WHOLE : null; },
  // areas
  open: (s, b, c) => (b.open >= 0.55 && c.up >= 14 && c.depth > 12 ? WHOLE : null),
  sandplain: (s, b, c) => (b.open >= 0.45 && c.up <= 9 && c.depth > 10 && (s.coral || 0) < 6 ? WHOLE : null),
  reefflat: (s, b) => (b.reef >= 0.45 && b.bigreef < 0.3 && (s.coral || 0) >= 6 ? WHOLE : null),
  meadow: (s, b, c) => ((s.weed || 0) >= 20 && c.game.field.weedAt(c.game.sub.pos.x, c.game.sub.pos.z) >= 0.55 ? WHOLE : null),
  deepdark: (s, b) => (b.deep >= 0.6 && s.depth >= 40 ? WHOLE : null),
  trenchfloor: (s, b) => (b.trench >= 0.5 && s.depth >= 40 ? lm(s, 'trench', 60) && WHOLE : null),
};

/** every terrain page this shot qualifies for: [[id, { x, y, frac }], ...] */
export function terrainHits(shot, game) {
  const bio = new Proxy(shot.biomes || {}, { get: (o, k) => o[k] || 0 });
  const p = game.sub.pos, ctx = { game, depth: shot.depth, up: p.y - game.field.heightAt(p.x, p.z) };
  const hits = [];
  for (const id in RULES) { const at = RULES[id](shot, bio, ctx); if (at) hits.push([id, at]); }
  return hits;
}

export default {
  name: 'terrain',
  init(game) {
    game.terrainHits = (shot) => terrainHits(shot, game).map(([id]) => id);   // debug: pages a shot descriptor qualifies for (call right after staging the view)
    bus.on('snapshot', ({ rec, shot }) => {
      const sh = shot || (rec && rec.shot);
      if (!sh) return;
      for (const [id, at] of terrainHits(sh, game)) Promise.resolve(enc.unlock('terrain', id, rec, at)).catch((e) => console.warn('terrain unlock failed', e));
    });
  },
};
