import * as THREE from 'three';

const R = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/**
 * Every species lives in a depth band [min, max] metres below the surface and has a base value (pearls) used when
 * a snapshot is sold. Rarer / bigger / deeper species are worth more.
 */
export const FISH = [
  // reef dwellers (follow the seabed)
  { id: 'anthias',  name: 'Orange anthias',   habitat: 'reef', min: 2,  max: 28, value: 4,  colors: ['#ff7a1a', '#ff4f8b'], size: [0.25, 0.55], weight: 3 },
  { id: 'tang',     name: 'Yellow tang',      habitat: 'reef', min: 2,  max: 30, value: 5,  colors: ['#ffd60a'],            size: [0.35, 0.7],  weight: 3 },
  { id: 'chromis',  name: 'Blue chromis',     habitat: 'reef', min: 3,  max: 40, value: 4,  colors: ['#1e6bff', '#0b2f9a'], size: [0.2, 0.5],   weight: 3 },
  { id: 'damsel',   name: 'Cyan damselfish',  habitat: 'reef', min: 3,  max: 32, value: 6,  colors: ['#35e0ff', '#2a7bff'], size: [0.3, 0.6],   weight: 2 },
  { id: 'wrasse',   name: 'Green wrasse',     habitat: 'reef', min: 4,  max: 38, value: 5,  colors: ['#58e08a', '#2fb4a0'], size: [0.4, 0.8],   weight: 2 },
  { id: 'snapper',  name: 'Coral snapper',    habitat: 'reef', min: 15, max: 55, value: 8,  colors: ['#e8453c', '#ff8a5c'], size: [0.5, 0.9],   weight: 2 },
  { id: 'basslet',  name: 'Violet basslet',   habitat: 'reef', min: 8,  max: 48, value: 14, colors: ['#a66bff', '#ff6bd5'], size: [0.3, 0.55],  weight: 1, rare: true },
  // open water schools
  { id: 'sardine',  name: 'Silver sardine',   habitat: 'open', min: 3,  max: 50, value: 3,  colors: ['#c9d6e2', '#9fb3c6'], size: [0.2, 0.4],   weight: 4 },
  { id: 'trevally', name: 'Golden trevally',  habitat: 'open', min: 6,  max: 45, value: 7,  colors: ['#e9b54a', '#ffd98a'], size: [0.4, 0.8],   weight: 2 },
  { id: 'mackerel', name: 'Blue mackerel',    habitat: 'open', min: 8,  max: 60, value: 4,  colors: ['#9fb3c6', '#5d6f86'], size: [0.3, 0.6],   weight: 3 },
  { id: 'fusilier', name: 'Sunset fusilier',  habitat: 'open', min: 5,  max: 40, value: 6,  colors: ['#ff9f1c', '#ffe066'], size: [0.3, 0.6],   weight: 2 },
  { id: 'ghost',    name: 'Ghost cardinal',   habitat: 'open', min: 28, max: 60, value: 16, colors: ['#ffffff', '#ffd1a1'], size: [0.35, 0.7],  weight: 1, rare: true },
  { id: 'prism',    name: 'Prism school',     habitat: 'open', min: 5,  max: 55, value: 25, colors: null /* rainbow */,     size: [0.3, 0.6],   weight: 0.5, rare: true },
];

export const SHARKS = [
  { id: 'blacktip', name: 'Blacktip reef shark', min: 3,  max: 35, value: 70,  len: [2.6, 3.6], hue: 0.09, hueJ: 0.05, sat: [0.2, 0.45],  val: [0.8, 1],    weight: 3 },
  { id: 'greyreef', name: 'Grey reef shark',     min: 5,  max: 45, value: 90,  len: [3.4, 4.6], hue: 0.58, hueJ: 0.06, sat: [0.2, 0.5],   val: [0.82, 1],   weight: 3 },
  { id: 'tiger',    name: 'Tiger shark',         min: 12, max: 60, value: 150, len: [4.6, 6.0], hue: 0.12, hueJ: 0.05, sat: [0.3, 0.55],  val: [0.7, 0.92], weight: 1, rare: true },
];

export const WHALES = [
  { id: 'humpback', name: 'Humpback whale', min: 8,  max: 50, value: 400, len: [14, 19], hue: 0.62, hueJ: 0.1,  sat: [0.12, 0.4],  val: [0.85, 1],   weight: 3, rare: true },
  { id: 'blue',     name: 'Blue whale',     min: 15, max: 60, value: 800, len: [24, 30], hue: 0.6,  hueJ: 0.05, sat: [0.35, 0.6],  val: [0.8, 1],    weight: 1, rare: true },
];

/** Weighted pick among species whose shallowest depth is reachable (seabed deep enough). */
export function pick(list, maxAvail, filter) {
  let c = list.filter((s) => (!filter || filter(s)) && s.min <= maxAvail);
  if (!c.length) c = list.filter((s) => !filter || filter(s)).sort((a, b) => a.min - b.min).slice(0, 1);
  let t = c.reduce((a, s) => a + s.weight, 0), r = Math.random() * t;
  for (const s of c) { r -= s.weight; if (r <= 0) return s; }
  return c[c.length - 1];
}

/** y (world) kept inside the species' depth band, but never below the seabed + margin, never above -2. */
export function bandY(sp, y, ground, margin = 1.5) {
  return Math.min(-2, Math.max(clamp(y, -sp.max, -sp.min), ground + margin));
}

const _w = new THREE.Color(1, 1, 1);
/** Random body tint for sharks / whales: a hue near the species' own, occasionally an off-palette individual. */
export function bodyTint(sp, out = new THREE.Color(), exoticChance = 0.12) {
  const exotic = Math.random() < exoticChance;
  const h = exotic ? Math.random() : (sp.hue + R(-sp.hueJ, sp.hueJ) + 1) % 1;
  const s = exotic ? R(0.35, 0.6) : R(sp.sat[0], sp.sat[1]);
  out.setHSL(h, 1, 0.5).lerp(_w, 1 - s).multiplyScalar(R(sp.val[0], sp.val[1]));
  return out;
}

// small squid swim in loose schools (instanced like fish); firefly squid glow faintly
export const SQUID = [
  { id: 'reefsquid', name: 'Bigfin reef squid', habitat: 'open', min: 2,  max: 30, value: 9,  colors: ['#f0b49c', '#d9907a'], size: [0.5, 0.9],  count: [5, 18],  weight: 3 },
  { id: 'firefly',   name: 'Firefly squid',     habitat: 'open', min: 25, max: 60, value: 18, colors: ['#8fd8ff', '#b59cff'], size: [0.25, 0.45], count: [30, 90], weight: 1.2, rare: true, glow: true },
];
export const GIANT_SQUID = [
  { id: 'giantsquid', name: 'Giant squid', min: 40, max: 60, value: 900, len: [9, 13], hue: 0.02, hueJ: 0.04, sat: [0.45, 0.7], val: [0.7, 0.95], weight: 1, rare: true },
];
export const MANTAS = [
  { id: 'manta', name: 'Manta ray', min: 3, max: 40, value: 220, len: [4, 6.5], hue: 0.6, hueJ: 0.06, sat: [0.05, 0.25], val: [0.8, 1], weight: 1, rare: true },
];
export const ORCAS = [
  { id: 'orca', name: 'Orca', min: 2, max: 40, value: 300, len: [6, 8], pod: [2, 6], weight: 1, rare: true },
];
export const DOLPHINS = [
  { id: 'dolphin', name: 'Bottlenose dolphin', min: 1, max: 25, value: 120, len: [2.2, 3], pod: [3, 9], weight: 1 },
];
