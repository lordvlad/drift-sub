/**
 * Tiny event bus shared by all features.
 * Events: 'frame' {dt, t} · 'snapshot' {shot, rec, zoom} (after a snapshot was stored; rec.id set) · 'sold' {rec, price}
 *         'swap' {id} (active submarine changed) · 'hit' {speed, k} (hull impact) · 'dive' {depth} (new max depth reached)
 */
const handlers = new Map();
export const bus = {
  on(ev, fn) { (handlers.get(ev) || handlers.set(ev, []).get(ev)).push(fn); return () => bus.off(ev, fn); },
  off(ev, fn) { const l = handlers.get(ev); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
  emit(ev, data) { const l = handlers.get(ev); if (l) for (const fn of l.slice()) fn(data); },
};
