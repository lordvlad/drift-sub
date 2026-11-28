/**
 * Wardrobe: paint schemes, headlight beam colours and propeller blades per submarine (cosmetic only, zero stat effect).
 * Some items unlock with the sub's logbook level; most are bought with pearls (wallet.spend). Persisted in localStorage 'drift-wardrobe'.
 * Choices apply immediately to the in-game sub; the panel is a side sheet so the sub stays visible as a live preview.
 */
import { addPanel, addTool, addStyle, registerIcons } from '../ui.js';
import { SUBS } from '../fleet.js';
import { levelOf } from './logbook.js';
import { SLOTS, SLOT_NAMES, itemsFor, isDefault, priceFor } from './cosmetics.js';

const KEY = 'drift-wardrobe';
const fmt = (n) => n.toLocaleString('en-US');
const hex = (c) => '#' + (c ?? 0).toString(16).padStart(6, '0');

let owned = {}, sel = {};   // owned[sub] = ['paint:mint', ...]; sel[sub] = { paint, lamp, prop } (item ids)
try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j) { owned = j.owned || {}; sel = j.sel || {}; } } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ owned, sel })); } catch {} };

registerIcons({ wardrobe: 'M12 3a9 9 0 1 0 0 18c1.4 0 2.1-.8 2.1-1.8 0-1-.7-1.4-.7-2.2 0-.8.7-1.4 1.6-1.4H17a4 4 0 0 0 4-4c0-4.4-4-8.6-9-8.6z M7.6 11.2a1 1 0 1 0 .01 0 M10.2 7.6a1 1 0 1 0 .01 0 M14.6 7.6a1 1 0 1 0 .01 0' });

let game, panel, wallet;
const find = (slot, sub, id) => itemsFor(slot, sub).find((i) => i.id === id);
const keyOf = (slot, it) => slot + ':' + it.id;

/** 'free' (default or level-unlocked), 'owned', 'buy' (can be bought now), 'locked' (needs a higher logbook level) */
function statusOf(slot, sub, it) {
  if (isDefault(it)) return 'free';
  const lv = levelOf(sub);
  if (!it.cost) return lv >= it.level ? 'free' : 'locked';
  if ((owned[sub] || []).includes(keyOf(slot, it))) return 'owned';
  return it.level && lv < it.level ? 'locked' : 'buy';
}
const usable = (slot, sub, it) => { const s = statusOf(slot, sub, it); return s === 'free' || s === 'owned'; };
function chosen(slot, sub) {
  const items = itemsFor(slot, sub), it = find(slot, sub, (sel[sub] || {})[slot]);
  return it && usable(slot, sub, it) ? it : items[0];
}

/** push the active sub's chosen cosmetics into its 3D model */
function apply() {
  const sub = game.fleet.active, m = game.subModel; if (!m || !m.setPaint) return;
  const p = chosen('paint', sub), l = chosen('lamp', sub), pr = chosen('prop', sub), pc = isDefault(p) ? {} : p;   // the default scheme keeps the model's built-in materials
  m.setPaint({ base: pc.base, trim: pc.trim, accent: pc.accent, lamp: l.color, prop: pr.color });
}
function equip(slot, sub, it) { (sel[sub] ||= {})[slot] = it.id; save(); if (sub === game.fleet.active) apply(); }

function buy(slot, sub, it) {
  const price = priceFor(sub, it.cost);
  if (!wallet.spend(price)) { game.toast('not enough pearls'); return; }
  (owned[sub] ||= []).push(keyOf(slot, it)); equip(slot, sub, it);
  game.toast(`${it.name} fitted · ◎ ${fmt(price)}`); render();
}

function render() {
  const sub = game.fleet.active, body = panel.body, scroll = body.scrollTop, lv = levelOf(sub);
  body.textContent = '';
  const head = document.createElement('div'); head.className = 'wd-head';
  head.innerHTML = `<div><b>${SUBS[sub].name}</b><div class="muted">logbook level ${lv} · looks only, no effect on performance</div></div><span class="gold">◎ ${fmt(wallet.n)}</span>`;
  body.appendChild(head);
  for (const slot of SLOTS) {
    const h = document.createElement('h3'); h.textContent = SLOT_NAMES[slot]; body.appendChild(h);
    if (slot === 'lamp' && !game.fleet.has('lamp')) { const n = document.createElement('div'); n.className = 'muted'; n.textContent = 'Headlights are not fitted yet (shop). Colours show once they are.'; body.appendChild(n); }
    const grid = document.createElement('div'); grid.className = 'wd-grid';
    const cur = chosen(slot, sub);
    for (const it of itemsFor(slot, sub)) {
      const st = statusOf(slot, sub, it), card = document.createElement('div'); card.className = 'wd-card' + (it === cur ? ' on' : '') + (st === 'locked' ? ' lock' : '');
      const sw = document.createElement('div'); sw.className = 'wd-sw';
      if (slot === 'paint') sw.innerHTML = [it.base, it.trim ?? it.base, it.accent].map((c) => `<i style="background:${hex(c)}"></i>`).join('');
      else sw.innerHTML = it.color == null ? `<i class="def"></i>` : `<i style="background:${hex(it.color)}"></i>`;
      const nm = document.createElement('div'); nm.className = 'wd-name'; nm.textContent = it.name;
      const act = document.createElement('button');
      if (it === cur) { act.textContent = 'Fitted'; act.disabled = true; }
      else if (st === 'free' || st === 'owned') { act.textContent = 'Fit'; act.addEventListener('click', () => { equip(slot, sub, it); render(); }); }
      else if (st === 'buy') { const p = priceFor(sub, it.cost); act.textContent = `◎ ${fmt(p)}`; act.classList.add('primary'); act.disabled = wallet.n < p; act.addEventListener('click', () => buy(slot, sub, it)); }
      else { act.textContent = `Level ${it.level}`; act.disabled = true; }
      card.append(sw, nm, act); grid.appendChild(card);
    }
    body.appendChild(grid);
  }
  body.scrollTop = scroll;
}

export const wardrobe = { apply, render: () => render(), statusOf, chosen, buy, equip, get owned() { return owned; }, get sel() { return sel; } };

export default {
  name: 'wardrobe',
  init(g) {
    game = g; wallet = g.wallet; g.wardrobe = wardrobe; window.__wardrobe = wardrobe;
    addStyle(`#wardrobePanel{background:transparent;backdrop-filter:none;pointer-events:none;align-items:flex-end}
#wardrobePanel .fbar{pointer-events:auto;width:min(380px,100%);box-sizing:border-box;background:#031420e8;border-radius:16px 16px 0 0;margin-top:0}
#wardrobePanel .fbody{pointer-events:auto;flex:none;max-height:calc(100vh - 140px);width:min(380px,100%);max-width:none;margin:0;background:#031420e8;border-radius:0 0 0 16px;padding-bottom:20px}
@media (max-width:700px){#wardrobePanel{justify-content:flex-end}#wardrobePanel .fbody{max-height:44vh;width:100%;border-radius:0}#wardrobePanel .fbar{width:100%;border-radius:0}}
.wd-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.wd-head b{font-size:18px;font-weight:500}
.wd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.wd-card{background:#ffffff0d;border:1px solid transparent;border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:6px}
.wd-card.on{border-color:#ffd21f88;background:#ffd21f12}.wd-card.lock{opacity:.55}.wd-name{font-size:13px}.wd-card button{padding:5px 10px;font-size:12px}
.wd-sw{display:flex;gap:4px}.wd-sw i{width:22px;height:22px;border-radius:50%;border:1px solid #ffffff55;display:block}.wd-sw i.def{background:conic-gradient(#c9d2da,#8a95a0,#dfe6ec,#8a95a0,#c9d2da)}`);
    panel = addPanel('wardrobePanel', 'Wardrobe');
    panel.onOpen = render;
    addTool('wardrobeBtn', 'wardrobe', 'Wardrobe', () => panel.open());
    g.bus.on('swap', () => { apply(); if (panel.isOpen) render(); });
    g.fleet.onChange(() => { if (panel.isOpen) render(); });
    apply();
  },
  update() {
    // live preview: while the panel is open the headlights burn so the beam colour can be judged
    if (panel.isOpen && game.fleet.has('lamp') && game.subModel) game.subModel.setLamps(1);
  },
};
