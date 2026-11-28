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

const PRICE = 3.4;   // pearls for a rarity-1 subject filling ~the frame, well composed, sharp and lit
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** How much of the frame a subject of this size (body length / frame height) fills: a speck is worth nothing, a full frame everything. */
export const fillCurve = (frac) => 1 - Math.exp(-Math.pow(frac / 0.5, 2.2));

/** Composition 0..1 of a subject at NDC (x, y): dead centre scores well, rule-of-thirds power points and thirds lines nearly as well, the frame edge poorly. */
export function composition(x, y) {
  const ax = Math.abs(x), ay = Math.abs(y);
  const centre = 1 - Math.hypot(ax * 0.85, ay) / 1.1;
  const power = 1 - Math.hypot(ax - 1 / 3, ay - 1 / 3) / 0.5;
  const line = 1 - Math.abs(ax - 1 / 3) / 0.4;
  let c = Math.max(centre, 0.92 * power, 0.82 * line * (1 - ay * 0.4));
  if (ax > 0.88 || ay > 0.88) c *= 0.6;   // cropped by the frame edge
  return clamp(c, 0, 1);
}

export function scorePhoto(ctx) {
  const { camera, fauna, terrain, field, shafts, daylight, depth, damage = 0, zoom = 1, blur = 0, profile = null, strobe = false, lamp = null, sampleLuma = null } = ctx;
  const lit = ctx.lit ?? (lamp ? lamp.level > 0.3 : false);
  camera.updateMatrixWorld(true);
  const cp = camera.position, tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 2;
  const seen = new Map();
  const see = (sp, kind, len, x, y, z, maxDist, minFrac) => {
    const d = Math.hypot(x - cp.x, y - cp.y, z - cp.z);
    if (d > maxDist || d < 0.5) return false;
    const frac = len / d / tanH;
    if (frac < minFrac) return false;
    const n = inView(camera, x, y, z, tmp); if (!n) return false;
    let e = seen.get(sp.id); if (!e) seen.set(sp.id, e = { sp, kind, count: 0, frac: 0, cent: 0, cx: 0, cy: 0, x0: 9, x1: -9, y0: 9, y1: -9 });
    e.count++; e.cx += n.x; e.cy += n.y; e.frac = Math.max(e.frac, frac); e.cent += composition(n.x, n.y);
    if (n.x < e.x0) e.x0 = n.x; if (n.x > e.x1) e.x1 = n.x; if (n.y < e.y0) e.y0 = n.y; if (n.y > e.y1) e.y1 = n.y;
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
  // ---- price: skill first (frame fill, composition, sharpness, light), then rarity, group, variety, scenery ----
  const ph = daylight.phase;
  const ambient = sampleLuma ? sampleLuma(0, 0, 0.5) : 0.5;   // 9 coarse samples across the whole frame
  const lightAt = (x, y, frac) => sampleLuma ? 0.3 + 0.7 * smooth(0.05, 0.28, 0.7 * sampleLuma(x, y, clamp(frac * 0.12, 0.008, 0.05)) + 0.3 * ambient) : 1;
  const sharp = 1 - 0.85 * Math.pow(clamp((blur - 0.06) / 0.94, 0, 1), 0.8);
  const items = []; let animals = 0, best = 0, qualified = 0, lightSum = 0, lightN = 0; const names = [];
  for (const e of seen.values()) {
    if (e.kind === 'calf') continue;
    names.push(e.sp.name);
    const n = e.count, comp = e.cent / n, over = e.frac > 1.2 ? 1 / (1 + (e.frac - 1.2) * 0.7) : 1;
    let fill = fillCurve(e.frac);
    if (n >= 3) {   // a school or pod counts by the area it covers, not by the size of its smallest member
      const cover = Math.sqrt(Math.max(0, e.x1 - e.x0) * Math.max(0, e.y1 - e.y0)) / 2;
      fill = Math.max(fill, 0.8 * fillCurve(cover * 0.8) * clamp(Math.log2(n) / 4, 0.25, 1));
    }
    fill *= over; best = Math.max(best, fill); if (fill >= 0.12) qualified++;
    const lightF = lightAt(e.cx / n, e.cy / n, e.frac), centF = 0.55 + 0.45 * comp, groupF = 1 + 0.5 * Math.log2(Math.min(n, 64));
    const amt = e.sp.value * PRICE * fill * centF * groupF * lightF * sharp;
    animals += amt; if (fill > 0.05) { lightSum += lightF; lightN++; }
    items.push([`${e.sp.name}${n > 1 ? ' ×' + n : ''}${e.sp.rare ? ' (rare)' : ''}`, amt]);
  }
  if (calf) { const c = seen.get('calf'), amt = w.sp.value * 0.35 * PRICE * fillCurve(c.frac) * (0.55 + 0.45 * c.cent / c.count) * sharp; animals += amt; items.push(['Mother and calf', amt]); }
  const lightF = lightN ? lightSum / lightN : 0.3 + 0.7 * smooth(0.05, 0.28, ambient);
  // scenery is a backdrop: next to nothing on its own, a multiplier behind a well-framed animal
  let flat = 1; items.unshift(['Seascape', 1]);
  if (rays > 0) { const a = 0.4 * Math.min(rays, 5) * rayStr; flat += a; items.push([`Light rays (${rays})`, a]); }
  if (coral > 0) { const a = 0.08 * Math.min(coral, 16); flat += a; items.push([`Coral (${coral})`, a]); }
  if (weed > 0) { const a = 0.04 * Math.min(weed, 20); flat += a; items.push([`Seaweed (${weed})`, a]); }
  // visible landmarks (vents, reefs, wrecks ...) from the terrain's feature list
  const landmarks = [];
  if (field.featuresNear) {
    const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)), sph = new THREE.Sphere();
    for (const f of field.featuresNear(cp.x, cp.z, 220) || []) {
      const d = Math.hypot(f.x - cp.x, (f.y ?? cp.y) - cp.y, f.z - cp.z);
      if (d > 240 || !fr.intersectsSphere(sph.set(v.set(f.x, f.y ?? cp.y, f.z), Math.max(1, f.r || 1)))) continue;
      landmarks.push({ type: f.type, dist: Math.round(d) });
    }
    landmarks.sort((a, b) => a.dist - b.dist); landmarks.length = Math.min(landmarks.length, 6);
  }
  if (landmarks.length) { const a = 1.5 * Math.min(landmarks.length, 2); flat += a; items.push([`Landmark (${landmarks[0].type})`, a]); }
  let total = (animals + flat * lightF * sharp), mult = 1; const notes = [];
  const gate = smooth(0.05, 0.3, best);
  if (qualified >= 2) { const m = Math.min(1.75, 1 + 0.15 * (qualified - 1)); mult *= m; notes.push([`Variety (${qualified} species)`, m]); }
  if (gate > 0 && coral > 0) { const m = 1 + 0.3 * gate * Math.min(coral, 16) / 16; mult *= m; notes.push([`Coral backdrop (${coral})`, m]); }
  if (gate > 0 && rays > 0 && rayStr > 0.1) { const m = 1 + 0.2 * gate * Math.min(rays, 5) / 5 * Math.min(rayStr, 1); mult *= m; notes.push([`Light rays backdrop (${rays})`, m]); }
  if (gate > 0 && landmarks.length) { const m = 1 + 0.12 * gate * Math.min(landmarks.length, 3); mult *= m; notes.push([`Landmark backdrop (${landmarks[0].type})`, m]); }
  for (const [label, m] of notes) { items.push([label, null, m]); }
  total *= mult;
  if (sharp < 0.97) items.push(['Motion blur', null, sharp]);
  if (lightF < 0.95) items.push(['Poor light', null, lightF]);
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
  // ---- shot descriptor (JSON-small, consumed by commissions / bestiary stars / logbook) ----
  const r2 = (x) => Math.round(x * 100) / 100;
  const bw = field.biomeAt ? field.biomeAt(cp.x, cp.z) : null, biomes = {}; let biome = 'open', bmax = -1;
  if (bw) for (const k in bw) { if (bw[k] > bmax) { bmax = bw[k]; biome = k; } if (bw[k] > 0.05) biomes[k] = r2(bw[k]); }
  const shot = {
    spots: [...seen.values()].filter((e) => e.kind !== 'calf').map((e) => ({
      id: e.sp.id, name: e.sp.name, kind: e.kind, rare: !!e.sp.rare, frac: r2(e.frac), x: r2(e.cx / e.count), y: r2(e.cy / e.count), count: e.count, school: e.count > 3, cent: r2(e.cent / e.count),
    })),
    calf, phase: ph, depth: Math.round(depth), profile, biome, biomes, landmarks, rays, coral, weed, blur: r2(blur), damage: r2(damage), zoom, fov: Math.round(camera.fov * 10) / 10, lit, strobe: !!strobe, light: r2(lightF),
  };
  return {
    value, key, species: names, shot,
    spots: [...seen.values()].filter((e) => e.kind !== 'calf').map((e) => ({ id: e.sp.id, x: e.cx / e.count, y: e.cy / e.count, frac: e.frac, school: e.count > 3 })),
    items: items.map(([label, amt, m]) => m ? [label, '×' + m.toFixed(2)] : [label, '+' + Math.round(amt)]),
  };
}
