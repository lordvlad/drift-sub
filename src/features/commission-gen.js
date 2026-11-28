/**
 * Commission generation + matching (pure functions; no DOM). A commission is plain JSON:
 *   { id, kind (template key), client, flavor, text, reward (pearls, paid when the matching snapshot is sold),
 *     rule (see `matches`), created, exp, status: 'open' | 'done', rec? (album record id once fulfilled) }
 * Rules are checked against the Photo-shot descriptor of a snapshot (`rec.shot`); missing fields never throw.
 */
import { BESTIARY, FISH, SQUID } from '../species.js';

export const CLIENTS = {
  aquarium: { name: 'Coral Cove Aquarium', lines: ['Our new tank needs a reference image.', 'The children keep asking about this one.', 'We are redesigning the main hall.', 'A calm, honest picture would do nicely.'] },
  magazine: { name: 'Tideline Quarterly', lines: ['Our cover story needs a hero image.', 'We have a page to fill, and no rush.', 'Readers wrote in asking for this.', 'A quiet double-page spread is waiting.'] },
  station: { name: 'Halcyon Research Station', lines: ['For the survey archive, with thanks.', 'We could not get a camera out there ourselves.', 'Our field notes are missing a picture.', 'Any decent frame helps the survey.'] },
};
export const LIFETIME = 36 * 3600e3;       // an unfulfilled commission quietly makes way for a new one after ~1.5 days
export const SLOTS = 3;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r5 = (x) => Math.round(x / 5) * 5;
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const wpick = (items, w) => { let t = items.reduce((s, x) => s + w(x), 0), r = Math.random() * t; for (const x of items) { r -= w(x); if (r <= 0) return x; } return items[items.length - 1]; };

/** shallowest sub depth needed to reach each landmark kind (conservative) */
const LM_DEPTH = { arch: 5, bigreef: 5, wreck: 15, cave: 20, vent: 30, magma: 30, volcano: 25, trench: 60 };
const LM_TEXT = {
  vent: ['Your first photo of a hydrothermal vent', 'A hydrothermal vent in the frame', 130],
  magma: ['A glowing magma rift, in the frame', 'A glowing magma rift, in the frame', 180],
  volcano: ['An undersea volcano, in the frame', 'An undersea volcano, in the frame', 180],
  wreck: ['A wreck resting on the seabed', 'A wreck resting on the seabed', 90],
  arch: ['A natural rock arch, in the frame', 'A natural rock arch, in the frame', 70],
  cave: ['A cave mouth, in the frame', 'A cave mouth, in the frame', 100],
  trench: ['The edge of a trench, in the frame', 'The edge of a trench, in the frame', 200],
  bigreef: ['A great reef, in the frame', 'A great reef, in the frame', 90],
};
const HABITAT_SPECIAL = new Set(['vent', 'magma', 'volcano', 'cave', 'trench', 'wreck']);
const PRED = new Set(['blacktip', 'greyreef', 'tiger', 'orca', 'giantsquid']);
const PREY = new Set([...FISH, ...SQUID].map((s) => s.id));
const spotOk = (s, min = 0.03) => (s.frac || 0) >= min;

/**
 * Does a snapshot descriptor satisfy a rule? Rule fields (all optional, all must hold):
 *   sp (species id) + minFrac (animal height / frame height), phases[], lm[] (a landmark of one of these types in frame),
 *   species (n distinct species), school (n animals of one species), rare, minDepth, calf, sharp, pod {sp, n},
 *   predator (a predator and prey together), glow (n animals of a glowing species), dark (lamps off, and night or deeper than 30 m), scenic {coral, rays}
 */
export function matches(rule, sh) {
  if (!sh) return false;
  const spots = (sh.spots || []).filter((s) => spotOk(s, 0.02));
  if ((sh.damage ?? 0) > 0.5) return false;
  if (rule.sharp && (sh.blur ?? 0) > 0.3) return false;
  if (rule.phases && !rule.phases.includes(sh.phase)) return false;
  if (rule.lm && !(sh.landmarks || []).some((l) => rule.lm.includes(l.type))) return false;
  if (rule.minDepth && (sh.depth || 0) < rule.minDepth) return false;
  if (rule.calf && !sh.calf) return false;
  if (rule.sp && !spots.some((s) => s.id === rule.sp && (s.frac || 0) >= (rule.minFrac ?? 0.03))) return false;
  if (rule.species && new Set(spots.map((s) => s.id)).size < rule.species) return false;
  if (rule.school && !spots.some((s) => (s.count || 1) >= rule.school)) return false;
  if (rule.rare && !spots.some((s) => s.rare && (s.frac || 0) >= 0.05)) return false;
  if (rule.pod && !spots.some((s) => s.id === rule.pod.sp && (s.count || 1) >= rule.pod.n)) return false;
  if (rule.predator) {
    const pr = spots.some((s) => (PRED.has(s.id) || s.kind === 'shark') && (s.frac || 0) >= 0.1);
    const prey = spots.some((s) => (PREY.has(s.id) || s.kind === 'fish' || s.kind === 'squid') && (s.frac || 0) >= 0.03);
    if (!pr || !prey) return false;
  }
  if (rule.glow && !spots.some((s) => (s.count || 1) >= rule.glow && BESTIARY.find((b) => b.id === s.id)?.glow)) return false;
  if (rule.dark && (sh.lit || !(sh.phase === 'night' || (sh.depth || 0) >= 30))) return false;
  if (rule.scenic && ((sh.coral || 0) < rule.scenic.coral || (sh.rays || 0) < rule.scenic.rays)) return false;
  return true;
}

/** Generation context from the live game. */
export function context(game) {
  const f = game.fleet, owned = f.owned || ['lemon'];
  const maxDepth = Math.max(...owned.map((s) => { try { return f.stats(s).maxDepth; } catch { return 60; } }), 30);
  const found = game.bestiary.found || {}, disc = BESTIARY.filter((s) => found[s.id]).length;
  const g = clamp(0.6 * (disc / Math.max(1, BESTIARY.length)) + 0.4 * ((owned.length - 1) / 3), 0, 1);
  const lm = typeof game.field?.biomeAt === 'function' || typeof game.field?.featuresNear === 'function';
  return { maxDepth, found, g, owned: owned.length, lm };
}

const accessible = (ctx) => BESTIARY.filter((s) => s.min + 2 <= ctx.maxDepth && (!HABITAT_SPECIAL.has(s.habitat) || ctx.found[s.id]));

const lmList = (ctx) => Object.keys(LM_TEXT).filter((t) => LM_DEPTH[t] <= ctx.maxDepth);
const when = [['evening', 'at dusk'], ['dawn', 'at dawn'], ['morning', 'in the morning light'], ['night', 'at night']];

/** Templates: each returns { text, rule, base (typical value of such a shot, pearls), d (difficulty 0..1), clients, once? } or null. */
const TEMPLATES = {
  portrait: { w: 3, make(ctx) {
    const sp = wpick(accessible(ctx), (s) => (s.rare ? 0.3 + ctx.g : 1) * (ctx.found[s.id] ? 1.3 : 1) * (s.weight || 1) ** 0.3);
    if (!sp) return null;
    const big = sp.len && sp.len[0] > 10, frac = big ? 0.25 : 0.3;
    const rule = { sp: sp.id, minFrac: frac, sharp: true }; let text = `${/^[aeiou]/i.test(sp.name) ? 'An' : 'A'} ${sp.name}`;
    const night = sp.glow || (sp.max >= 40 && sp.min >= 25);   // deep dwellers are fine whenever
    if (!night && Math.random() < 0.5) { const [ph, label] = pickOne(when.filter((w) => w[0] !== 'night')); rule.phases = ph === 'evening' || ph === 'dawn' ? [ph] : [ph, 'day']; text += ' ' + label; }
    text += `, filling ${frac >= 0.3 ? 'a third' : 'a quarter'} of the frame`;
    return { text, rule, base: (sp.value || 10) * 1.4 + 12, d: clamp((sp.value || 10) / 400 + (rule.phases ? 0.25 : 0) + (sp.rare ? 0.2 : 0), 0, 1), clients: ['aquarium', 'magazine'] };
  } },
  duo: { w: 1.6, make(ctx) {
    const hasLM = ctx.lm && lmList(ctx).includes('bigreef');
    const n = ctx.g > 0.5 && Math.random() < 0.5 ? 3 : 2;
    const rule = { species: n }; let text = `${n === 2 ? 'Two' : 'Three'} species in one frame`;
    if (hasLM && Math.random() < 0.7) { rule.lm = ['bigreef']; text += ' at the big reef'; }
    return { text, rule, base: 35 + 25 * n, d: 0.2 + 0.2 * (n - 2) + (rule.lm ? 0.2 : 0), clients: ['magazine', 'aquarium'] };
  } },
  school: { w: 2, make(ctx) {
    const n = [20, 30, 40, 60][Math.min(3, Math.floor(ctx.g * 3.2 + Math.random() * 1.2))];
    return { text: `A school of at least ${n} fish, sharp`, rule: { school: n, sharp: true }, base: 25 + n * 0.8, d: n / 90, clients: ['aquarium', 'magazine'] };
  } },
  rareDeep: { w: 1.6, make(ctx) {
    const rare = BESTIARY.filter((s) => s.rare && s.min + 2 <= ctx.maxDepth && !HABITAT_SPECIAL.has(s.habitat));
    let depth = clamp(r5(ctx.maxDepth * (0.5 + 0.25 * ctx.g)), 20, 70);
    while (depth > 15 && !rare.some((s) => s.max >= depth + 2 && s.min <= depth)) depth -= 5;
    if (depth < 15 || !rare.length) return null;
    return { text: `A rare animal below ${depth} m`, rule: { rare: true, minDepth: depth }, base: 70 + depth, d: depth / 80 + 0.2, clients: ['station'] };
  } },
  landmark: { w: 1.8, make(ctx) {
    if (!ctx.lm) return null;
    const once = lmList(ctx).filter((t) => !(ctx.once || []).includes('lm:' + t));
    if (!once.length) return null;
    const t = pickOne(once), [first, plain, base] = LM_TEXT[t];
    return { text: t === 'vent' ? first : plain, rule: { lm: [t], sharp: true }, base, d: Math.min(1, base / 220), clients: ['station', 'magazine'], once: 'lm:' + t };
  } },
  calf: { w: 0.7, make(ctx) {
    if (!BESTIARY.some((s) => s.id === 'humpback' || s.id === 'blue')) return null;
    return { text: 'A whale mother and her calf', rule: { calf: true }, base: 260, d: 0.7, clients: ['station', 'magazine'] };
  } },
  pod: { w: 1, make(ctx) {
    const sp = pickOne(BESTIARY.filter((s) => (s.id === 'dolphin' || s.id === 'orca') && s.min + 2 <= ctx.maxDepth));
    if (!sp) return null;
    const n = sp.id === 'dolphin' ? 4 + Math.floor(ctx.g * 3) : 3;
    return { text: `${sp.id === 'dolphin' ? 'Dolphins' : 'Orcas'}: at least ${n} together in one frame`, rule: { pod: { sp: sp.id, n }, sharp: true }, base: (sp.value || 100) * 1.2 + 20 * n, d: 0.5, clients: ['magazine', 'aquarium'] };
  } },
  hunt: { w: 1, make() { return { text: 'A predator and its prey in one frame', rule: { predator: true, sharp: true }, base: 100, d: 0.55, clients: ['aquarium', 'station'] }; } },
  glow: { w: 0.9, make(ctx) {
    const sp = BESTIARY.filter((s) => (s.glow || s.biolum) && s.min + 2 <= ctx.maxDepth);
    if (!sp.length) return null;
    return { text: 'Glowing animals in the dark: lamps off, in the frame', rule: { dark: true, glow: 6, sharp: true }, base: 55, d: 0.5, clients: ['station', 'magazine'] };
  } },
  scenic: { w: 0.9, make() { return { text: 'Light rays falling over a coral reef', rule: { scenic: { coral: 8, rays: 2 } }, base: 40, d: 0.3, clients: ['magazine'] }; } },
};

/** Build one new commission that differs from the open ones. `ctx.once` = finished one-off templates, `ctx.recent` = recent kinds. */
export function generate(game, have = [], extra = {}) {
  const ctx = { ...context(game), ...extra };
  const used = new Set(have.map((c) => c.kind)), texts = new Set(have.map((c) => c.text));
  for (let tries = 0; tries < 30; tries++) {
    const keys = Object.keys(TEMPLATES);
    const key = wpick(keys, (k) => TEMPLATES[k].w * (used.has(k) ? 0.05 : 1) * ((ctx.recent || []).includes(k) ? 0.5 : 1));
    const m = TEMPLATES[key].make(ctx);
    if (!m || texts.has(m.text)) continue;
    const mult = 1.5 + 1.5 * clamp(m.d * 0.6 + ctx.g * 0.4, 0, 1);
    const client = pickOne(m.clients), now = Date.now();
    return { id: now.toString(36) + Math.random().toString(36).slice(2, 6), kind: key, client, flavor: pickOne(CLIENTS[client].lines), text: m.text, rule: m.rule,
      reward: Math.min(1500, Math.max(30, r5(m.base * mult))), created: now, exp: now + LIFETIME, status: 'open', once: m.once };
  }
  return null;
}
