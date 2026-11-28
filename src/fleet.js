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

/** Every item price on a sub is multiplied by that sub's factor (consumables too). */
export const PRICE_MULT = { lemon: 1, manta: 1.5, barracuda: 2, squid: 3 };
export const BASE_ALBUM = 100;

/**
 * Shop catalogue (base prices, Lemon). `group` only sorts the shop list; `requires` is an earlier tier; `shared` items belong to the whole
 * profile (the album) instead of one sub. The repair kit is priced by damage: base * (0.3 + 1.7 * damage).
 */
export const ITEMS = [
  { id: 'lamp',   group: 'Hull & drive',  name: 'Headlights',           price: 400,  effect: 'Twin headlights for the dark and the deep (F).' },
  { id: 'repair', group: 'Hull & drive',  name: 'Hull repair kit',      price: 150,  consumable: true, effect: 'Fully repairs this sub’s hull at once. Cheap scratches, dear wrecks: the price follows the damage.' },
  { id: 'prop2',  group: 'Hull & drive',  name: 'Propeller Mk II',      price: 2000, effect: '+20% thrust.' },
  { id: 'prop3',  group: 'Hull & drive',  name: 'Propeller Mk III',     price: 6000, requires: 'prop2', effect: '+40% thrust (total).' },
  { id: 'quiet1', group: 'Hull & drive',  name: 'Quiet propeller Mk I', price: 5000, effect: 'Animals notice you from 20% less far away, and the propeller hums softer.' },
  { id: 'quiet2', group: 'Hull & drive',  name: 'Quiet propeller Mk II', price: 14000, requires: 'quiet1', effect: 'Animals notice you from 40% less far away (total), and the propeller is nearly silent.' },
  { id: 'hull1',  group: 'Hull & drive',  name: 'Hull strengthener I',  price: 1500, effect: '+10 m maximum dive depth.' },
  { id: 'hull2',  group: 'Hull & drive',  name: 'Hull strengthener II', price: 5000, requires: 'hull1', effect: '+20 m maximum dive depth (total).' },
  { id: 'strafe', group: 'Hull & drive',  name: 'Manoeuvring kit',      price: 3500, effect: 'Sideways thrusters: strafe left / right (Q / E, or the touch joystick).' },
  { id: 'redlight', group: 'Lights & lenses', name: 'Red-light filter', price: 3000, requires: 'lamp', effect: 'A fourth lamp mode: red light. Animals are not startled by it (white lamps mildly alarm shy animals at night within 15 m).' },
  { id: 'zoom2',  group: 'Lights & lenses', name: 'Zoom objective 2×',  price: 1200, effect: 'Viewfinder zoom: step to 2× (zoom button, mouse wheel, + / −).' },
  { id: 'zoom4',  group: 'Lights & lenses', name: 'Zoom objective 4×',  price: 4000, requires: 'zoom2', effect: 'Viewfinder zoom up to 4× for distant animals.' },
  { id: 'wide',   group: 'Lights & lenses', name: 'Wide-angle lens',    price: 6500, effect: 'Adds a 0.6× viewfinder step (about 86° field of view) for reefs and big animals up close.' },
  { id: 'strobe', group: 'Lights & lenses', name: 'Strobe light',       price: 9000, effect: 'A toggle in the viewfinder: the shutter fires a bright flash that lights a dark shot (2 s to recharge).' },
  { id: 'hydro',  group: 'Instruments', name: 'Hydrophone',             price: 8000, effect: 'Listen mode: a compass arc at the top shows bearing and distance of whales, orcas, dolphins and giant squid within 250 m, with soft pings.' },
  { id: 'sonar',  group: 'Instruments', name: 'Sonar ping',             price: 12000, effect: 'A ping button (12 s to recharge): a gentle ring sweeps out and a small radar shows animals and landmarks within 120 m for 6 s.' },
  { id: 'album1', group: 'Album', shared: true, slots: 50,  name: 'Album expansion I',   price: 3500,  effect: '+50 album slots (150 total). Applies to all submarines.' },
  { id: 'album2', group: 'Album', shared: true, slots: 100, name: 'Album expansion II',  price: 9000,  requires: 'album1', effect: '+100 album slots (250 total). Applies to all submarines.' },
  { id: 'album3', group: 'Album', shared: true, slots: 200, name: 'Album expansion III', price: 22000, requires: 'album2', effect: '+200 album slots (450 total). Applies to all submarines.' },
];
export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const GROUPS = [...new Set(ITEMS.map((i) => i.group))];

export class Fleet {
  constructor() {
    this.active = 'lemon'; this.owned = ['lemon']; this.items = {}; this.damage = {};
    this.shared = [];   // items that belong to the whole profile (album expansions), not to one sub
    this.sub = null; this.listeners = [];
    try {
      const j = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (j) {
        this.owned = ['lemon', ...SUB_IDS.filter((s) => s !== 'lemon' && (j.owned || []).includes(s))];
        this.active = this.owned.includes(j.active) ? j.active : 'lemon';
        for (const s of this.owned) {
          this.items[s] = (j.items?.[s] || []).filter((i) => ITEM[i] && !ITEM[i].consumable && !ITEM[i].shared);
          this.damage[s] = Math.min(1, Math.max(0, Number(j.damage?.[s]) || 0));
        }
        this.shared = (j.shared || []).filter((i) => ITEM[i]?.shared);
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
    try { localStorage.setItem(KEY, JSON.stringify({ active: this.active, owned: this.owned, items: this.items, damage: this.damage, shared: this.shared })); } catch {}
  }
  onChange(fn) { this.listeners.push(fn); }
  _emit(kind) { this.save(); for (const fn of this.listeners) fn(kind); }

  owns(sub) { return this.owned.includes(sub); }
  has(item, sub = this.active) { return ITEM[item]?.shared ? this.shared.includes(item) : (this.items[sub] || []).includes(item); }
  /** Album capacity: 100 plus the expansions bought (applies to every submarine). */
  albumSlots() { return BASE_ALBUM + ITEMS.reduce((n, i) => n + (i.shared && i.slots && this.shared.includes(i.id) ? i.slots : 0), 0); }
  /** Effective pearl price of an item on a sub: base x the sub's factor; the repair kit scales with its hull damage (0.3 .. 2.0 x base). */
  priceOf(id, sub = this.active) {
    const it = ITEM[id]; if (!it) return 0;
    const base = id === 'repair' ? it.price * (0.3 + 1.7 * this.damageOf(sub)) : it.price;
    return Math.max(1, Math.round(base * (PRICE_MULT[sub] || 1)));
  }
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
      zoomLevels: [...(h('wide') ? [0.6] : []), 1, ...(h('zoom2') ? [2] : []), ...(h('zoom4') ? [4] : [])],   // ascending; zoom4 without zoom2 is not buyable
      lateral: h('strafe'),
      noise: h('quiet2') ? 0.6 : h('quiet1') ? 0.8 : 1,   // multiplies how far animals notice the sub
      redLight: h('redlight'), wide: h('wide'), strobe: h('strobe'), hydro: h('hydro'), sonar: h('sonar'),
    };
  }

  /** '' when the item can be bought for the active sub, otherwise the reason. */
  itemBlock(id, wallet) {
    const it = ITEM[id]; if (!it) return 'unknown item';
    if (!it.consumable && this.has(id)) return 'owned';
    if (it.requires && !this.has(it.requires)) return 'needs ' + ITEM[it.requires].name;
    if (id === 'repair' && this.damageOf() < 0.005) return 'undamaged';
    if (wallet.n < this.priceOf(id)) return 'pearls';
    return '';
  }
  buyItem(id, wallet) {
    const why = this.itemBlock(id, wallet); if (why) return { ok: false, reason: why };
    const it = ITEM[id], price = this.priceOf(id); wallet.spend(price);
    if (it.consumable) { if (id === 'repair' && this.sub) this.sub.damage = 0; this.damage[this.active] = 0; }
    else if (it.shared) this.shared.push(id);
    else this.items[this.active].push(id);
    this._emit('items');
    return { ok: true, item: it, price };
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
