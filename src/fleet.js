/**
 * The fleet: submarine types, the shop's item catalogue, and what the player owns (persisted on this device).
 * Items are bought per submarine and never transfer; each sub also keeps its own hull damage.
 */
const KEY = 'drift-fleet';

export const SUBS = {
  lemon:     { id: 'lemon',     name: 'Lemon',     price: 0,     maxDepth: 60, fragility: 1,   thrust: 1,    turn: 1,   desc: 'The little yellow all-rounder: sturdy, steady and easy to steer.' },
  manta:     { id: 'manta',     name: 'Manta',     price: 45000, maxDepth: 45, fragility: 1.5, thrust: 1.05, turn: 1.6, desc: 'Winged and flexible: it turns on a coin and glides like a ray, but its hull is thin.' },
  barracuda: { id: 'barracuda', name: 'Barracuda', price: 80000, maxDepth: 45, fragility: 1.7, thrust: 1.7,  turn: 1,   desc: 'A needle built for speed. Covers the sea fast, and dents easily.' },
  squid:     { id: 'squid',     name: 'Squid',     price: 150000, maxDepth: 95, fragility: 2.4, thrust: 0.9,  turn: 1,   desc: 'A deep-sea explorer that reaches 95 m. Slow, and the most fragile of all.' },
};
export const SUB_IDS = Object.keys(SUBS);

export const ITEMS = [
  { id: 'lamp',   name: 'Headlights',           price: 400,  effect: 'Twin headlights for the dark and the deep (F).' },
  { id: 'zoom2',  name: 'Zoom objective 2×',    price: 1200, effect: 'Viewfinder zoom: step to 2× (zoom button, mouse wheel, + / −).' },
  { id: 'zoom4',  name: 'Zoom objective 4×',    price: 4000, requires: 'zoom2', effect: 'Viewfinder zoom up to 4× for distant animals.' },
  { id: 'repair', name: 'Hull repair kit',      price: 150,  consumable: true, effect: 'Fully repairs this sub’s hull at once.' },
  { id: 'prop2',  name: 'Propeller Mk II',      price: 2000, effect: '+20% thrust.' },
  { id: 'prop3',  name: 'Propeller Mk III',     price: 6000, requires: 'prop2', effect: '+40% thrust (total).' },
  { id: 'hull1',  name: 'Hull strengthener I',  price: 1500, effect: '+10 m maximum dive depth.' },
  { id: 'hull2',  name: 'Hull strengthener II', price: 5000, requires: 'hull1', effect: '+20 m maximum dive depth (total).' },
  { id: 'strafe', name: 'Manoeuvring kit',      price: 3500, effect: 'Sideways thrusters: strafe left / right (Q / E, or the touch joystick).' },
];
export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export class Fleet {
  constructor() {
    this.active = 'lemon'; this.owned = ['lemon']; this.items = {}; this.damage = {};
    this.sub = null; this.listeners = [];
    try {
      const j = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (j) {
        this.owned = ['lemon', ...SUB_IDS.filter((s) => s !== 'lemon' && (j.owned || []).includes(s))];
        this.active = this.owned.includes(j.active) ? j.active : 'lemon';
        for (const s of this.owned) {
          this.items[s] = (j.items?.[s] || []).filter((i) => ITEM[i] && !ITEM[i].consumable);
          this.damage[s] = Math.min(1, Math.max(0, Number(j.damage?.[s]) || 0));
        }
      }
    } catch {}
    for (const s of this.owned) { this.items[s] ||= []; this.damage[s] ||= 0; }
    addEventListener('pagehide', () => this.save());
    addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    setInterval(() => this.save(), 5000);
  }
  /** The live Sub instance whose hull damage belongs to the active sub. */
  bind(sub) { this.sub = sub; sub.damage = this.damage[this.active] || 0; }
  save() {
    if (this.sub) this.damage[this.active] = this.sub.damage;
    try { localStorage.setItem(KEY, JSON.stringify({ active: this.active, owned: this.owned, items: this.items, damage: this.damage })); } catch {}
  }
  onChange(fn) { this.listeners.push(fn); }
  _emit(kind) { this.save(); for (const fn of this.listeners) fn(kind); }

  owns(sub) { return this.owned.includes(sub); }
  has(item, sub = this.active) { return (this.items[sub] || []).includes(item); }
  damageOf(sub = this.active) { return sub === this.active && this.sub ? this.sub.damage : this.damage[sub] || 0; }

  /** Effective stats of a sub including its purchased upgrades. */
  stats(sub = this.active) {
    const b = SUBS[sub], h = (i) => this.has(i, sub);
    return {
      id: sub, name: b.name,
      maxDepth: b.maxDepth + (h('hull2') ? 20 : h('hull1') ? 10 : 0),
      fragility: b.fragility,
      thrust: b.thrust * (h('prop3') ? 1.4 : h('prop2') ? 1.2 : 1),
      turn: b.turn,
      hasLamp: h('lamp'),
      zoomLevels: h('zoom4') ? [1, 2, 4] : h('zoom2') ? [1, 2] : [1],
      lateral: h('strafe'),
    };
  }

  /** '' when the item can be bought for the active sub, otherwise the reason. */
  itemBlock(id, wallet) {
    const it = ITEM[id]; if (!it) return 'unknown item';
    if (!it.consumable && this.has(id)) return 'owned';
    if (it.requires && !this.has(it.requires)) return 'needs ' + ITEM[it.requires].name;
    if (id === 'repair' && this.damageOf() < 0.005) return 'undamaged';
    if (wallet.n < it.price) return 'pearls';
    return '';
  }
  buyItem(id, wallet) {
    const why = this.itemBlock(id, wallet); if (why) return { ok: false, reason: why };
    const it = ITEM[id]; wallet.spend(it.price);
    if (it.consumable) { if (id === 'repair' && this.sub) this.sub.damage = 0; this.damage[this.active] = 0; }
    else this.items[this.active].push(id);
    this._emit('items');
    return { ok: true, item: it };
  }
  subBlock(id, wallet) {
    if (!SUBS[id]) return 'unknown sub';
    if (this.owns(id)) return 'owned';
    if (wallet.n < SUBS[id].price) return 'pearls';
    return '';
  }
  buySub(id, wallet) {
    const why = this.subBlock(id, wallet); if (why) return { ok: false, reason: why };
    wallet.spend(SUBS[id].price); this.owned.push(id); this.items[id] = []; this.damage[id] = 0;
    this._emit('subs');
    return { ok: true, sub: SUBS[id] };
  }
  /** Make another owned sub active (hull damage moves with the sub it belongs to). */
  switchTo(id) {
    if (!this.owns(id) || id === this.active) return false;
    if (this.sub) this.damage[this.active] = this.sub.damage;
    this.active = id;
    if (this.sub) this.sub.damage = this.damage[id] || 0;
    this._emit('switch');
    return true;
  }
  next() { return this.owned[(this.owned.indexOf(this.active) + 1) % this.owned.length]; }
}
