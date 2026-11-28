/**
 * Cosmetic catalogue (pure data, shared by the logbook and the wardrobe). Purely visual: no stat effects.
 * Every sub owns its cosmetics separately. Availability of an item:
 *   - no `cost` and no `level`  → default, always available
 *   - `level` only              → unlocked free by reaching that logbook level of the sub
 *   - `cost` (pearls)           → bought in the wardrobe (if `level` is also given: purchasable from that level on)
 * Colours are hex numbers. Paint: base = hull, trim = fins / secondary parts, accent = stripes and trim colour.
 */
export const COSMETIC_SUBS = ['lemon', 'manta', 'barracuda', 'squid'];

/** price multiplier by submarine tier (so the pricier boats' paint jobs cost more); prices are clamped to 500..8000 */
const TIER = { lemon: 1, manta: 1.5, barracuda: 2, squid: 2.5 };
export const priceFor = (sub, cost) => cost ? Math.max(500, Math.min(8000, Math.round(cost * (TIER[sub] || 1) / 50) * 50)) : 0;

const GOLD = { id: 'gold', name: 'Gold', base: 0xd9a521, trim: 0x8d6a12, accent: 0xfff1b8, level: 8, cost: 3200 };

export const PAINTS = {
  lemon: [
    { id: 'yellow', name: 'Lemon yellow', base: 0xffcc1a, trim: 0xe0a000, accent: 0xd8432a },
    { id: 'coral', name: 'Coral', base: 0xff7a6a, trim: 0xd9574a, accent: 0xfff0d8, level: 3 },
    { id: 'mint', name: 'Mint', base: 0x6fe0b8, trim: 0x3fb08a, accent: 0x1c5d6b, cost: 1000 },
    { id: 'midnight', name: 'Midnight', base: 0x1c2f5e, trim: 0x12204a, accent: 0x5ad1ff, cost: 1800 },
    GOLD,
  ],
  manta: [
    { id: 'teal', name: 'Reef teal', base: 0x1b8ea0, trim: 0x2678b5, accent: 0xff8a3d },
    { id: 'sunset', name: 'Sunset', base: 0xff8a5c, trim: 0xc9456b, accent: 0xffd36b, level: 3 },
    { id: 'pearl', name: 'Pearl', base: 0xe8eef2, trim: 0x9fb4c4, accent: 0x2aa6b8, cost: 1000 },
    { id: 'violet', name: 'Violet', base: 0x7b5fd1, trim: 0x4b3a99, accent: 0xffc857, cost: 1800 },
    GOLD,
  ],
  barracuda: [
    { id: 'silver', name: 'Silver', base: 0xc4ccd4, trim: 0x30363d, accent: 0xff4a1a },
    { id: 'gunmetal', name: 'Gunmetal', base: 0x6b7580, trim: 0x1c2127, accent: 0xffd21f, level: 3 },
    { id: 'racing', name: 'Racing green', base: 0x1f6b4a, trim: 0x14382a, accent: 0xf2e8c9, cost: 1000 },
    { id: 'arctic', name: 'Arctic', base: 0xeaf6ff, trim: 0x4a90c2, accent: 0x1fa7ff, cost: 1800 },
    GOLD,
  ],
  squid: [
    { id: 'white', name: 'Bathyscaphe white', base: 0xf1efe8, accent: 0xff7a1a },
    { id: 'abyss', name: 'Abyss', base: 0x2b4a6a, accent: 0x7fe0ff, level: 3 },
    { id: 'moss', name: 'Moss', base: 0x7a9a6a, accent: 0xe8d26a, cost: 1000 },
    { id: 'rose', name: 'Rose', base: 0xf3d1d8, accent: 0xc2477a, cost: 1800 },
    GOLD,
  ],
};

/** headlight beam colours; null = the sub's built-in cool white */
export const LAMPS = [
  { id: 'cool', name: 'Cool white', color: null },
  { id: 'warm', name: 'Warm white', color: 0xffe2a8, cost: 500 },
  { id: 'amber', name: 'Amber', color: 0xffa63a, level: 5 },
  { id: 'green', name: 'Soft green', color: 0x8dffb4, cost: 1100 },
];

/** propeller blade colours; null = brushed steel */
export const PROPS = [
  { id: 'steel', name: 'Brushed steel', color: null },
  { id: 'brass', name: 'Brass', color: 0xc89b3c, cost: 600 },
  { id: 'coral', name: 'Coral red', color: 0xff6f5e, cost: 800 },
  { id: 'teal', name: 'Teal', color: 0x2fc4b2, cost: 900 },
  { id: 'gold', name: 'Gold', color: 0xf5c542, level: 7, cost: 1800 },
];

export const SLOTS = ['paint', 'lamp', 'prop'];
export const SLOT_NAMES = { paint: 'Paint scheme', lamp: 'Headlight beam', prop: 'Propeller blades' };
export const itemsFor = (slot, sub) => slot === 'paint' ? PAINTS[sub] || [] : slot === 'lamp' ? LAMPS : PROPS;
export const isDefault = (it) => !it.cost && !it.level;
/** [{ slot, item }] unlocked or made purchasable at exactly this logbook level for this sub */
export function atLevel(sub, level) {
  const out = [];
  for (const slot of SLOTS) for (const item of itemsFor(slot, sub)) if (item.level === level) out.push({ slot, item });
  return out;
}
