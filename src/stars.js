import { FISH, SQUID, SHARKS, MANTAS, DOLPHINS, ORCAS, GIANT_SQUID, WHALES } from './species.js';

/**
 * Bestiary star rules. A page holds 1-3 stars:
 *   1  seen (any recognisable shot)
 *   2  good portrait: the animal fills >= ~30% of the frame height (or a school / pod fills the frame), reasonably centred,
 *      sharp, lens not heavily cracked
 *   3  special moment, defined per species / class from the Photo-shot descriptor (see rules below)
 * Everything tolerates a missing descriptor / missing fields.
 */
export const STAR_GRANT = [0, 1.5, 3, 6];   // x species value (value floor 40/1.5 so that a one-star page pays at least 40)
export const grantFor = (sp, star) => Math.round(Math.max(sp.value || 0, 40 / 1.5) * STAR_GRANT[star] / 5) * 5;

const ids = (l) => new Set(l.map((s) => s.id));
const CLASS_OF = new Map();
for (const [cls, list] of [['fish', FISH], ['squid', SQUID], ['shark', SHARKS], ['ray', MANTAS], ['dolphin', DOLPHINS], ['orca', ORCAS], ['giantsquid', GIANT_SQUID], ['whale', WHALES]])
  for (const id of ids(list)) CLASS_OF.set(id, cls);
const PREDATOR = new Set(['shark', 'orca', 'giantsquid']);
const PREY = new Set(['fish', 'squid']);
/** landmark types a habitat is "signature" for */
const HABITAT_LM = { vent: ['vent'], magma: ['magma', 'volcano'], volcano: ['magma', 'volcano'], cave: ['cave'], trench: ['trench'], wreck: ['wreck'], reef: ['bigreef'], bigreef: ['bigreef'], arch: ['arch'] };

const classOf = (sp, spot) => CLASS_OF.get(sp?.id) || sp?.cls || sp?.kind || spot?.kind || 'other';
const KNOWN = new Set(CLASS_OF.values());

const centred = (s) => (typeof s.x === 'number' && typeof s.y === 'number') ? Math.hypot(s.x, s.y) <= 0.75 : typeof s.cent === 'number' ? s.cent >= 0.35 : true;
const sharpShot = (sh) => (sh.blur ?? 0) <= 0.35 && (sh.damage ?? 0) <= 0.35;
const count = (s) => s.count || 1;
/** ★★: a good portrait of this spot */
export function isPortrait(s, sh = {}) {
  if (!sharpShot(sh) || !centred(s)) return false;
  const f = s.frac || 0, n = count(s);
  if (f >= 0.3) return true;
  if (n >= 10 && f >= 0.05) return true;          // a school that fills the frame
  if (n >= 3 && f >= 0.18) return true;           // a pod
  return false;
}

const lms = (sh) => (sh.landmarks || []).map((l) => l.type);
const hasLM = (sh, types) => lms(sh).some((t) => types.includes(t));
const night = (sh) => sh.phase === 'night';
/** predator and prey together: a sizeable predator plus a recognisable prey animal */
const hunt = (s, sh, others) => decent(s, sh, 0.15) && others.some((o) => PREY.has(o.cls) && (o.frac || 0) >= 0.03);
const decent = (s, sh, min = 0.08) => (s.frac || 0) >= min && sharpShot(sh);

/** Species-specific ★★★ rules: id -> { test(ctx), hint } where ctx = { s (spot), sh (shot), sp, cls, others (other spots) } */
const RULES = {
  blue: { test: ({ s, sh }) => (s.frac || 0) >= 0.05 && (sh.blur ?? 0) <= 0.6, hint: 'a giant among giants' },
  giantsquid: { test: ({ s, sh }) => (s.frac || 0) >= 0.05 && (sh.blur ?? 0) <= 0.6, hint: 'it is rarely seen at all' },
  humpback: { test: ({ s, sh }) => !!sh.calf && decent(s, sh, 0.05), hint: 'it is not always alone' },
  orca: { test: ({ s, sh }) => count(s) >= 3 && decent(s, sh, 0.06), hint: 'a family affair' },
  dolphin: { test: ({ s, sh }) => count(s) >= 5 && decent(s, sh, 0.05), hint: 'the more the merrier' },
  manta: { test: ({ s, sh }) => (hasLM(sh, ['arch', 'bigreef']) || count(s) >= 2) && decent(s, sh, 0.1), hint: 'it loves the big architecture of the sea' },
};
const CLASS_RULES = {
  shark: { test: ({ s, sh, others }) => hunt(s, sh, others) || (decent(s, sh, 0.1) && count(s) >= 3), hint: 'dinner is served?' },
  orca: { test: ({ s, sh, others }) => hunt(s, sh, others), hint: 'dinner is served?' },
  whale: { test: ({ s, sh }) => !!sh.calf && decent(s, sh, 0.05), hint: 'it is not always alone' },
  fish: { test: ({ s, sh, others }) => decent(s, sh, 0.03) && others.some((o) => PREDATOR.has(o.cls) && (o.frac || 0) >= 0.15), hint: 'company is not always friendly' },
  squid: { test: ({ s, sh, others }) => decent(s, sh, 0.03) && others.some((o) => PREDATOR.has(o.cls) && (o.frac || 0) >= 0.15), hint: 'company is not always friendly' },
};
const GLOW = { test: ({ s, sh, sp }) => !!(sp?.glow || sp?.biolum) && !sh.lit && (night(sh) || (sh.depth || 0) >= 30) && decent(s, sh, 0.04) && (count(s) >= 6 || (s.frac || 0) >= 0.1), hint: 'it likes the dark, and lights of its own' };
const SIGNATURE = { test: ({ s, sh, sp }) => { const h = HABITAT_LM[sp?.landmark || sp?.habitat || sp?.biome]; return !!h && hasLM(sh, h) && decent(s, sh, 0.1); }, hint: 'it belongs somewhere particular' };
const UNKNOWN = { test: ({ s, sh, sp }) => !!(s.rare || sp?.rare) && isPortrait(s, sh) && (night(sh) || lms(sh).length > 0), hint: 'something special?' };

const RULE_LIST = (id, cls) => {
  const l = [];
  if (RULES[id]) l.push(RULES[id]);
  if (CLASS_RULES[cls]) l.push(CLASS_RULES[cls]);
  l.push(GLOW, SIGNATURE);
  if (!RULES[id] && !KNOWN.has(cls)) l.push(UNKNOWN);
  return l;
};

/** Species-class hint for the ★★★ condition (kept vague on purpose). */
export function thirdStarHint(sp) {
  const cls = classOf(sp), l = RULE_LIST(sp.id, cls);
  return (RULES[sp.id] || CLASS_RULES[cls] || (sp.glow || sp.biolum ? GLOW : null) || l[l.length - 1]).hint || 'something special?';
}

/**
 * Stars (1..3) one animal earned in one shot.
 * @param spot descriptor spot { id, frac, x, y, count, school, cent, rare }
 * @param shot Photo-shot descriptor (may be undefined)
 * @param sp species table entry (may be undefined)
 */
export function rate(spot, shot, sp) {
  const sh = shot || {}, spots = (sh.spots || []).filter((o) => o.id !== spot.id).map((o) => ({ ...o, cls: CLASS_OF.get(o.id) || o.cls || o.kind || 'other' }));
  const cls = classOf(sp, spot), ctx = { s: spot, sh, sp, cls, others: spots };
  for (const r of RULE_LIST(spot.id, cls)) { let ok = false; try { ok = r.test(ctx); } catch {} if (ok) return 3; }
  return isPortrait(spot, sh) ? 2 : 1;
}
