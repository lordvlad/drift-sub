/**
 * Submarine logbook: per-sub distance, dives, time submerged and snapshots; slow levels 1..10 that unlock tiny handling
 * tweaks (never more than +15% per stat) and cosmetics (see cosmetics.js). Persisted in localStorage 'drift-logbook'.
 */
import { addPanel, addTool, addStyle, registerIcons } from '../ui.js';
import { SUBS } from '../fleet.js';
import { atLevel, SLOT_NAMES } from './cosmetics.js';

const KEY = 'drift-logbook';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const MAX_LEVEL = 10;

/** cumulative points needed for level 2..10 (a few hundred points per hour of play: level 10 takes many hours) */
const LEVEL_AT = [0, 0, 30, 80, 160, 280, 440, 650, 920, 1250, 1650];
/** handling tweaks gained at a level, in percent per stat. Sum per stat stays under +15%. */
export const TWEAKS = {
  2: { turn: 3 }, 3: { repair: 4 }, 4: { bump: 4 }, 5: { thrust: 3 }, 6: { turn: 4 }, 7: { bump: 4, repair: 4 },
  8: { thrust: 4 }, 9: { turn: 5, repair: 5 }, 10: { bump: 4, thrust: 4 },
};
const TWEAK_TEXT = { turn: (p) => `Tighter turning +${p}%`, thrust: (p) => `Thrust efficiency +${p}%`, bump: (p) => `Softer hull bumps −${p}% damage`, repair: (p) => `Self-repair +${p}% faster` };

const blank = () => ({ dist: 0, time: 0, dives: 0, d30: 0, d60: 0, d90: 0, maxDepth: 0, shots: 0, lvl: 1 });
let data = {};
try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && typeof j === 'object') for (const s of Object.keys(SUBS)) if (j[s]) data[s] = { ...blank(), ...j[s] }; } catch {}
const rec = (sub) => data[sub] ||= blank();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} };

/** weighted combination of everything the log tracks */
export function points(sub) {
  const s = rec(sub);
  return s.dist / 1000 * 6 + s.time / 60 + s.shots * 0.8 + Math.min(s.maxDepth, 100) * 0.5 + s.dives * 0.5 + s.d30 * 4 + s.d60 * 8 + s.d90 * 12;
}
export function levelOf(sub) {
  const p = points(sub); let l = 1;
  while (l < MAX_LEVEL && p >= LEVEL_AT[l + 1]) l++;
  return l;
}
/** { level, points, frac (0..1 progress towards the next level), next (points needed, null at max) } */
export function info(sub) {
  const p = points(sub), l = levelOf(sub);
  return { level: l, points: p, next: l >= MAX_LEVEL ? null : LEVEL_AT[l + 1], frac: l >= MAX_LEVEL ? 1 : clamp((p - LEVEL_AT[l]) / (LEVEL_AT[l + 1] - LEVEL_AT[l]), 0, 1) };
}
export const stats = (sub) => ({ ...rec(sub) });
/** multipliers for Sub.tweaks at the given level */
export function tweaksFor(level) {
  const sum = { turn: 0, thrust: 0, bump: 0, repair: 0 };
  for (let l = 2; l <= level; l++) for (const [k, p] of Object.entries(TWEAKS[l] || {})) sum[k] += p;
  return { turn: 1 + sum.turn / 100, thrust: 1 + sum.thrust / 100, bump: 1 - sum.bump / 100, repair: 1 + sum.repair / 100 };
}
/** human-readable list of what a level gives for a sub: [text] */
export function unlocksAt(sub, level) {
  const out = [];
  for (const [k, p] of Object.entries(TWEAKS[level] || {})) out.push(TWEAK_TEXT[k](p));
  for (const { slot, item } of atLevel(sub, level)) out.push(item.cost ? `${item.name} ${SLOT_NAMES[slot].toLowerCase()} can be bought in the wardrobe` : `${item.name} ${SLOT_NAMES[slot].toLowerCase()} unlocked`);
  return out;
}

registerIcons({ logbook: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z M5 18a2 2 0 0 1 2-2h12 M12 6.4a1 1 0 1 0 .01 0 M12 7.6V13 M9.8 9.4h4.4 M9.2 11.8c.5 1.3 1.5 1.9 2.8 1.9s2.3-.6 2.8-1.9' });

const fmtDist = (m) => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';
const fmtTime = (s) => { const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`; };

let game, panel, shown = null, lastPos = null, lastSub = null, ex = null, saveT = 0, checkT = 0, renderT = 0;
const started = () => document.getElementById('intro')?.classList.contains('gone');
const newExcursion = () => ({ max: 0, d30: false, d60: false, d90: false, counted: false });

function applyTweaks() {
  if (!game) return;
  const t = tweaksFor(levelOf(game.fleet.active));
  Object.assign(game.sub.tweaks, t);
}

/** announce level changes of the active sub (also called after loading to sync the stored level silently) */
function checkLevel(announce = true) {
  const id = game.fleet.active, s = rec(id), l = levelOf(id);
  if (l === s.lvl) return;
  const up = l > s.lvl, from = s.lvl; s.lvl = l; applyTweaks(); save();
  if (up && announce) {
    const extra = []; for (let k = from + 1; k <= l; k++) for (const u of atLevel(id, k)) if (!u.item.cost) extra.push(u.item.name.toLowerCase() + ' ' + (u.slot === 'paint' ? 'paint' : u.slot === 'lamp' ? 'beam' : 'blades'));
    game.say(`logbook: ${SUBS[id].name} level ${l}${extra.length ? ' · ' + extra.join(', ') + ' unlocked' : ''}`, 4200);
  }
  if (panel && panel.isOpen) render();
}

/** advance the logbook (called every frame by the game loop; exported for tests) */
function track(dt, g = game) {
  const sub = g.sub, id = g.fleet.active;
  if (id !== lastSub) { lastSub = id; lastPos = null; ex = newExcursion(); applyTweaks(); }
  if (!started()) { lastPos = null; return; }
  const s = rec(id), p = sub.pos;
  if (lastPos) { const d = Math.hypot(p.x - lastPos.x, p.y - lastPos.y, p.z - lastPos.z); if (d < 30) s.dist += d; lastPos.set(p.x, p.y, p.z); }
  else lastPos = p.clone();
  const depth = -p.y;
  if (depth > 3) s.time += dt;
  s.maxDepth = Math.max(s.maxDepth, depth);
  // a dive is one excursion below 10 m; each of 30 / 60 / 90 m is counted once per excursion; surfacing (< 8 m) ends it
  if (depth > ex.max) ex.max = depth;
  if (depth > 10 && !ex.counted) { ex.counted = true; s.dives++; }
  for (const m of [30, 60, 90]) if (depth >= m && !ex['d' + m]) { ex['d' + m] = true; s['d' + m]++; }
  if (depth < 8 && ex.counted) ex = newExcursion();
  checkT += dt; saveT += dt; renderT += dt;
  if (checkT > 1) { checkT = 0; checkLevel(); }
  if (renderT > 3) { renderT = 0; if (panel && panel.isOpen) render(); }
  if (saveT > 5) { saveT = 0; save(); }
}

function render() {
  if (!game) return;
  const body = panel.body, scroll = body.scrollTop, owned = game.fleet.owned;
  if (!owned.includes(shown)) shown = game.fleet.active;
  body.textContent = '';
  const tabs = document.createElement('div'); tabs.className = 'lb-tabs';
  for (const id of owned) {
    const b = document.createElement('button'); b.textContent = `${SUBS[id].name} · ${levelOf(id)}`; if (id === shown) b.classList.add('on');
    b.addEventListener('click', () => { shown = id; render(); }); tabs.appendChild(b);
  }
  body.appendChild(tabs);
  const id = shown, s = rec(id), inf = info(id);
  const h = document.createElement('h3'); h.innerHTML = `${SUBS[id].name} <span class="gold">level ${inf.level}</span>${inf.level >= MAX_LEVEL ? ' · full logbook' : ''}`; body.appendChild(h);
  const bar = document.createElement('div'); bar.className = 'lb-bar'; const fill = document.createElement('i'); fill.style.width = (inf.frac * 100).toFixed(1) + '%'; bar.appendChild(fill); body.appendChild(bar);
  const grid = document.createElement('div'); grid.className = 'lb-stats';
  const cell = (k, v) => { const d = document.createElement('div'); d.innerHTML = `<span class="muted">${k}</span><b>${v}</b>`; grid.appendChild(d); };
  cell('Distance travelled', fmtDist(s.dist)); cell('Time submerged', fmtTime(s.time)); cell('Deepest dive', s.maxDepth.toFixed(0) + ' m'); cell('Dives', s.dives);
  cell('Dives below 30 m', s.d30); cell('Dives below 60 m', s.d60); cell('Dives below 90 m', s.d90); cell('Snapshots taken', s.shots);
  body.appendChild(grid);
  const h2 = document.createElement('h3'); h2.textContent = 'Levels'; body.appendChild(h2);
  const list = document.createElement('div'); list.className = 'lb-levels';
  for (let l = 2; l <= MAX_LEVEL; l++) {
    const row = document.createElement('div'); row.className = 'lb-row' + (inf.level >= l ? ' got' : '');
    const n = document.createElement('b'); n.textContent = l; const t = document.createElement('span'); t.innerHTML = unlocksAt(id, l).map((x) => `<div>${x}</div>`).join('');
    row.append(n, t); list.appendChild(row);
  }
  body.appendChild(list);
  const note = document.createElement('p'); note.className = 'muted'; note.textContent = 'Each submarine keeps its own log. Levels come slowly with distance, depth, time at sea and snapshots; they never cost anything and only grant small handling refinements and paint.'; body.appendChild(note);
  body.scrollTop = scroll;
}

export const logbook = { stats, info, levelOf, points, tweaksFor, unlocksAt, track, render: () => render(), get data() { return data; }, save };

export default {
  name: 'logbook',
  init(g) {
    game = g; g.logbook = logbook; window.__logbook = logbook;
    addStyle(`.lb-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.lb-tabs button.on{background:#ffd21f;color:#06222f;border:0}
.lb-bar{height:8px;border-radius:99px;background:#ffffff1a;overflow:hidden}.lb-bar i{display:block;height:100%;background:linear-gradient(90deg,#4fd1ff,#ffd21f);border-radius:99px;transition:width .6s}
.lb-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-top:14px}.lb-stats div{display:flex;flex-direction:column;background:#ffffff0d;border-radius:12px;padding:8px 12px}.lb-stats b{font-weight:500;font-size:17px}
.lb-row{display:flex;gap:14px;align-items:center;padding:8px 12px;border-radius:12px;background:#ffffff08;margin-bottom:6px;opacity:.5}.lb-row.got{opacity:1;background:#ffd21f14}
.lb-row>b{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;border:1px solid #9fe3ff55;flex:none;font-weight:500;font-size:13px}.lb-row.got>b{background:#ffd21f;color:#06222f;border:0}`);
    panel = addPanel('logbookPanel', 'Logbook');
    panel.onOpen = () => { shown = g.fleet.active; render(); };
    addTool('logbookBtn', 'logbook', 'Logbook', () => panel.open());
    lastSub = g.fleet.active; ex = newExcursion();
    g.bus.on('snapshot', () => { rec(g.fleet.active).shots++; if (panel.isOpen) render(); });
    g.bus.on('swap', () => { applyTweaks(); });
    checkLevel(false); applyTweaks();
    addEventListener('pagehide', save); addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  },
  update(dt, g) { track(dt, g); },
};
