/**
 * Animal and landmark contacts around the sub for the hydrophone and the sonar.
 * Reads the core fauna directly and asks every plug-in group for its `sightings(emit)` (the same contract the photo scorer uses).
 * A contact: { x, y, z, d (distance, m), name, kind, big (large animal), count }.
 */
const BIG_KINDS = new Set(['big', 'pod', 'whale', 'giantsquid']);

/**
 * `range` metres around the sub; `bigOnly` keeps whales, orcas, dolphins, giant squid and plug-in animals that report a big kind
 * (or are at least 8 m long). Landmarks (field.featuresNear, when the terrain provides it) are added when `landmarks` is set.
 */
export function collectContacts(game, { range = 120, bigOnly = false, landmarks = false, max = 48 } = {}) {
  const { fauna, sub, field } = game, out = [], px = sub.pos.x, py = sub.pos.y, pz = sub.pos.z;
  const push = (name, kind, big, x, y, z, count = 1, len = 0) => {
    const d = Math.hypot(x - px, y - py, z - pz);
    if (d > range || d < 1) return;
    if (bigOnly && !big) return;
    out.push({ x, y, z, d, name, kind, big, count, len });
  };
  const w = fauna.whale; if (w.active) push(w.sp ? w.sp.name : 'whale', 'whale', true, w.pos.x, w.pos.y, w.pos.z, 1, w.len);
  for (const c of fauna.cruisers) if (c.active) { const gs = c.sp && c.sp.id === 'giantsquid'; push(c.sp ? c.sp.name : 'animal', gs ? 'giantsquid' : 'manta', gs, c.pos.x, c.pos.y, c.pos.z, 1, c.len); }
  for (const p of fauna.pods) if (p.active) push(p.sp ? p.sp.name : 'pod', 'pod', true, p.pos.x, p.pos.y, p.pos.z, p.n, p.len);
  if (!bigOnly) {
    for (const s of fauna.sharks) if (s.active) push(s.sp ? s.sp.name : 'shark', 'shark', false, s.pos.x, s.pos.y, s.pos.z, 1, s.len);
    for (const s of fauna.swarms) if (s.active) push(s.sp ? s.sp.name : 'school', 'school', false, s.c.x, s.c.y, s.c.z, s.n, 0);
  }
  // plug-in groups report individuals; merge everything of one species inside the same 10 m cell into one contact
  if (fauna.groups.length) {
    const cells = new Map();
    const emit = (sp, kind, len, x, y, z, o) => {
      const big = BIG_KINDS.has(kind) || len >= 8; if (bigOnly && !big) return;
      const d = Math.hypot(x - px, y - py, z - pz); if (d > range || d < 1) return;
      const key = `${sp && sp.id}|${Math.round(x / 10)}|${Math.round(y / 10)}|${Math.round(z / 10)}`, e = cells.get(key);
      const n = (o && o.count) || 1;
      if (e) { e.count += n; return; }
      cells.set(key, { x, y, z, d, name: (sp && (sp.name || sp.id)) || 'animal', kind, big, count: n, len });
    };
    emit.occluded = () => false;
    for (const g of fauna.groups) if (g.sightings) { try { g.sightings(emit); } catch { /* a misbehaving group must not break the instruments */ } }
    for (const e of cells.values()) out.push(e);
  }
  if (landmarks && field.featuresNear) {
    for (const f of field.featuresNear(px, pz, range) || []) {
      const d = Math.hypot(f.x - px, (f.y ?? py) - py, f.z - pz);
      if (d <= range) out.push({ x: f.x, y: f.y ?? py, z: f.z, d, name: f.type, kind: 'landmark', big: false, count: 1, len: f.r || 0 });
    }
  }
  out.sort((a, b) => a.d - b.d);
  if (out.length > max) out.length = max;
  return out;
}

/** bearing of (x, z) relative to the sub's heading: radians, 0 = ahead, +right (towards the screen's right), +-PI = behind */
export function relBearing(sub, x, z) {
  const dx = x - sub.pos.x, dz = z - sub.pos.z, fx = sub.fwd.x, fz = sub.fwd.z, f = Math.hypot(fx, fz) || 1;
  return Math.atan2((dx * -fz + dz * fx) / f, (dx * fx + dz * fz) / f);
}
