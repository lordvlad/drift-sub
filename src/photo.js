import * as THREE from 'three';
import { CS } from './terrain.js';

const v = new THREE.Vector3(), tmp = new THREE.Vector3();
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const FISH_LEN = 1.1, BIG_LEN = 1.12;

/** Line of sight from camera to p is blocked if the seabed rises above the ray. */
function occluded(field, cam, p) {
  for (let i = 1; i <= 7; i++) {
    const t = i / 8, x = cam.x + (p.x - cam.x) * t, z = cam.z + (p.z - cam.z) * t, y = cam.y + (p.y - cam.y) * t;
    if (field.heightAt(x, z) > y + 0.4) return true;
  }
  return false;
}

/** NDC projection if the point is inside the view volume, else null */
function inView(camera, x, y, z, out) {
  out.set(x, y, z).project(camera);
  return out.z > -1 && out.z < 1 && Math.abs(out.x) < 1 && Math.abs(out.y) < 1 ? out : null;
}

export function scorePhoto(ctx) {
  const { camera, fauna, terrain, field, shafts, daylight, depth, damage = 0 } = ctx;
  camera.updateMatrixWorld(true);
  const cp = camera.position, tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 2;
  const seen = new Map();
  const see = (sp, kind, len, x, y, z, maxDist, minFrac) => {
    const d = Math.hypot(x - cp.x, y - cp.y, z - cp.z);
    if (d > maxDist || d < 0.5) return false;
    const frac = len / d / tanH;
    if (frac < minFrac) return false;
    const n = inView(camera, x, y, z, tmp); if (!n) return false;
    let e = seen.get(sp.id); if (!e) seen.set(sp.id, e = { sp, kind, count: 0, frac: 0, cent: 0, cx: 0, cy: 0 });
    e.count++; e.cx += n.x; e.cy += n.y; e.frac = Math.max(e.frac, frac); e.cent += 1 - clamp(Math.hypot(n.x, n.y) / 1.2, 0, 1);
    return true;
  };

  // ---- animals ----
  for (const sw of fauna.swarms) {
    if (!sw.active) continue;
    v.set(sw.c.x, sw.c.y, sw.c.z);
    if (Math.hypot(v.x - cp.x, v.z - cp.z) > 140 || occluded(field, cp, v)) continue;
    for (let i = 0; i < sw.n; i++) see(sw.sp, 'fish', FISH_LEN * sw.SZ[i], sw.P[i * 3], sw.P[i * 3 + 1], sw.P[i * 3 + 2], 110, 0.006);
  }
  for (const s of fauna.sharks) {
    if (!s.active) continue;
    v.copy(s.pos); if (occluded(field, cp, v)) continue;
    see(s.sp, 'shark', s.len * BIG_LEN, s.pos.x, s.pos.y, s.pos.z, 160, 0.01);
  }
  const w = fauna.whale; let calf = false;
  if (w.active && !occluded(field, cp, w.pos)) {
    see(w.sp, 'whale', w.len * BIG_LEN, w.pos.x, w.pos.y, w.pos.z, 260, 0.02);
    if (w.hasCalf) { const c = w.calfPos; if (see({ id: 'calf', name: 'Whale calf', value: 0 }, 'calf', w.len * 0.4 * BIG_LEN, c.x, c.y, c.z, 260, 0.02)) calf = true; }
  }

  // ---- environment ----
  let coral = 0, weed = 0;
  const ccx = Math.floor(cp.x / CS), ccz = Math.floor(cp.z / CS);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const ch = terrain.chunks.get(terrain.key(ccx + dx, ccz + dz)); if (!ch) continue;
    for (const [arr, which] of [[ch.corals, 0], [ch.weeds, 1]]) {
      const st = which ? 4 : 3;
      for (let i = 0; i < arr.length; i += st) {
        const py = which ? arr[i + 1] + arr[i + 3] * 0.5 : arr[i + 1];
        const d = Math.hypot(arr[i] - cp.x, py - cp.y, arr[i + 2] - cp.z);
        if (d < 4 || d > 85 || !inView(camera, arr[i], py, arr[i + 2], tmp)) continue;
        which ? weed++ : coral++;
      }
    }
  }
  // light rays: replicate the shaft placement of the shader
  let rays = 0; const str = shafts.u.uInt.value;
  if (str > 0.01) {
    const sun = shafts.u.uSun.value;
    for (let i = 0; i < shafts.count; i++) {
      const bx = shafts.base[i * 3], bz = shafts.base[i * 3 + 1];
      const mod = (a, m) => a - m * Math.floor(a / m);
      const tx = mod(bx - cp.x + 150, 300) - 150 + cp.x, tz = mod(bz - cp.z + 150, 300) - 150 + cp.z;
      let vis = false;
      for (const t of [0.1, 0.4, 0.7]) {
        const x = tx + sun.x * 110 * t, y = 3 + sun.y * 110 * t, z = tz + sun.z * 110 * t, d = Math.hypot(x - cp.x, y - cp.y, z - cp.z);
        if (d > 12 && d < 150 && inView(camera, x, y, z, tmp)) { vis = true; break; }
      }
      if (vis) rays++;
    }
  }
  const rayStr = clamp(str / 0.22, 0, 1.2);

  // ---- price ----
  for (const c of fauna.cruisers) {
    if (!c.active || occluded(field, cp, c.pos)) continue;
    see(c.sp, 'big', c.len * BIG_LEN, c.pos.x, c.pos.y, c.pos.z, 200, 0.012);
  }
  for (const p of fauna.pods) {
    if (!p.active || occluded(field, cp, p.pos)) continue;
    for (let i = 0; i < p.n; i++) see(p.sp, 'pod', p.SC[i] * BIG_LEN, p.P[i * 3], p.P[i * 3 + 1], p.P[i * 3 + 2], 200, 0.012);
  }
  const emit = (sp, kind, len, x, y, z, o = {}) => {
    if (o.skipOcclusion !== true && !o.checked && occluded(field, cp, v.set(x, y, z))) return;
    see(sp, kind, len, x, y, z, o.maxDist ?? 140, o.minFrac ?? 0.008);
  };
  emit.occluded = (x, y, z) => occluded(field, cp, v.set(x, y, z));
  for (const g of fauna.groups) if (g.sightings) g.sightings(emit);
  const items = []; let animals = 0; const names = [];
  for (const e of seen.values()) {
    if (e.kind === 'calf') continue;
    const cent = e.cent / e.count, sizeF = clamp(0.35 + e.frac * 10, 0.35, 2.0), centF = 0.7 + 0.3 * cent;
    const amt = e.sp.value * (1 + 0.6 * Math.log2(e.count)) * sizeF * centF;
    animals += amt; names.push(e.sp.name);
    items.push([`${e.sp.name}${e.count > 1 ? ' ×' + e.count : ''}${e.sp.rare ? ' (rare)' : ''}`, amt]);
  }
  if (calf) { const amt = w.sp.value * 0.35; animals += amt; items.push(['Mother and calf', amt]); }
  const types = seen.size - (calf ? 1 : 0);
  let mult = 1; const notes = [];
  if (types >= 2) { const m = Math.min(1.5, 1 + 0.12 * (types - 1)); mult *= m; notes.push([`Variety (${types} species)`, m]); }
  if (animals > 0 && coral > 0) { const m = 1 + 0.35 * Math.min(coral, 16) / 16; mult *= m; notes.push([`Coral backdrop (${coral})`, m]); }
  let flat = 2; items.unshift(['Seascape', 2]);
  if (rays > 0) { const a = 6 * Math.min(rays, 5) * rayStr; flat += a; items.push([`Light rays (${rays})`, a]); }
  if (coral > 0) { const a = 1.5 * Math.min(coral, 16); flat += a; items.push([`Coral (${coral})`, a]); }
  if (weed > 0) { const a = 0.6 * Math.min(weed, 20); flat += a; items.push([`Seaweed (${weed})`, a]); }
  let total = (animals + flat);
  for (const [label, m] of notes) { items.push([label, null, m]); }
  total *= mult;
  const ph = daylight.phase;
  if (ph === 'morning' || ph === 'dawn' || ph === 'evening') { total *= 1.1; items.push(['Golden hour', null, 1.1]); }
  if (depth >= 40) { total *= 1.1; items.push(['Deep dive', null, 1.1]); }
  if (damage > 0.04) { const m = Math.max(0.15, 1 - 1.8 * damage); total *= m; items.push(['Cracked lens', null, m]); }
  const value = Math.max(1, Math.round(total));
  // composition fingerprint: species + rough group size + which third of the frame + scenery buckets + depth band + light
  const parts = [...seen.values()].filter((e) => e.kind !== 'calf').sort((a, b) => (a.sp.id < b.sp.id ? -1 : 1))
    .map((e) => `${e.sp.id}:${Math.min(3, Math.round(Math.log2(e.count)))}:${Math.min(2, Math.floor((e.cx / e.count + 1) * 1.5))}`);
  if (calf) parts.push('calf');
  parts.push(`c${coral ? 1 + Math.min(2, Math.floor(coral / 6)) : 0}`, `r${rays ? 1 : 0}`, `d${Math.floor(depth / 15)}`, ph === 'night' ? 'n' : ph === 'day' ? 'd' : 'g');
  let h = 5381; const sig = parts.join('|'); for (let i = 0; i < sig.length; i++) h = ((h * 33) ^ sig.charCodeAt(i)) >>> 0;
  const key = 'k' + h.toString(36);
  return {
    value, key, species: names,
    spots: [...seen.values()].filter((e) => e.kind !== 'calf').map((e) => ({ id: e.sp.id, x: e.cx / e.count, y: e.cy / e.count, frac: e.frac, school: e.count > 3 })),
    items: items.map(([label, amt, m]) => m ? [label, '×' + m.toFixed(2)] : [label, '+' + Math.round(amt)]),
  };
}
