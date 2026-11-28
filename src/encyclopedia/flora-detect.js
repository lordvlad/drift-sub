import * as THREE from 'three';
import { FLORA } from '../templates.js';
import { CS } from '../terrain.js';

const p = new THREE.Vector3();
const r2 = (x) => Math.round(x * 100) / 100;
const MAX_DIST = 45, MAX_TESTED = 140, MAX_ENTRIES = 8;
const SOLID = new Set(['brain-coral', 'star-coral', 'table-coral', 'sea-fan', 'pillar-coral', 'porites'].map((id) => FLORA.indexOf(id)));   // big opaque-ish kinds that hide what is behind them

/**
 * Flora visible in the current camera frame, from the chunks' `flora` arrays (x, y, z, size, kind; see terrain.js / templates.js FLORA).
 * Returns [{ id, count, x, y, frac, near }] sorted by frac, at most 8: `count` = unoccluded plants whose centre is inside the frame within 45 m,
 * `frac` = apparent size (extent / frame height) of the most prominent one, (x, y) its NDC position, `near` = distance to the closest (m).
 * `occluded(field, camPos, point)` is the seabed line-of-sight test from photo.js.
 */
export function detectFlora(camera, terrain, field, tanH, occluded) {
  const cp = camera.position, ccx = Math.floor(cp.x / CS), ccz = Math.floor(cp.z / CS), cand = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const ch = terrain.chunks.get(terrain.key(ccx + dx, ccz + dz)); if (!ch || !ch.flora) continue;
    const a = ch.flora;
    for (let i = 0; i < a.length; i += 5) {
      const size = a[i + 3], cy = a[i + 1] + size * 0.5, ox = a[i] - cp.x, oy = cy - cp.y, oz = a[i + 2] - cp.z;
      const d = Math.sqrt(ox * ox + oy * oy + oz * oz);
      if (d > MAX_DIST || d < 0.6) continue;
      const frac = size / d / tanH;
      if (frac < 0.012) continue;
      p.set(a[i], cy, a[i + 2]).project(camera);
      if (!(p.z > -1 && p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1)) continue;
      cand.push({ k: a[i + 4], x: p.x, y: p.y, frac, d, wx: a[i], wy: a[i + 1] + size * 0.8, wz: a[i + 2] });
    }
  }
  if (!cand.length) return [];
  cand.sort((u, v) => v.frac - u.frac);
  const blockers = cand.filter((c) => c.frac >= 0.45 && SOLID.has(c.k)), asp = camera.aspect || 1;
  const hidden = (c) => blockers.some((b) => b !== c && b.d < c.d * 0.8 && b.frac > c.frac && Math.hypot((b.x - c.x) * asp, b.y - c.y) < 0.8 * b.frac);   // behind a big foreground coral
  const by = new Map();
  for (let i = 0; i < cand.length && i < MAX_TESTED; i++) {
    const c = cand[i];
    if (hidden(c) || occluded(field, cp, p.set(c.wx, c.wy, c.wz))) continue;
    let e = by.get(c.k);
    if (!e) by.set(c.k, e = { k: c.k, count: 0, score: -1, x: 0, y: 0, frac: 0, near: 1e9 });
    e.count++; if (c.d < e.near) e.near = c.d;
    const s = c.frac * (1 - 0.35 * Math.hypot(c.x * 0.85, c.y) / 1.3);   // prominent and not at the frame edge
    if (s > e.score) { e.score = s; e.x = c.x; e.y = c.y; e.frac = c.frac; }
  }
  return [...by.values()].sort((u, v) => v.frac - u.frac).slice(0, MAX_ENTRIES)
    .map((e) => ({ id: FLORA[e.k], count: e.count, x: r2(e.x), y: r2(e.y), frac: Math.round(e.frac * 1000) / 1000, near: Math.round(e.near) }));
}
