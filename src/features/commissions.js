/**
 * Commissions board: three rotating photo requests (aquarium / magazine / research station).
 * A snapshot that satisfies one is flagged `rec.commission = id` and carries `rec.bonus` (pearls); the bonus is paid by
 * AlbumUI.sell() when THAT snapshot is sold (never shown as a price before). Done / expired commissions rotate out.
 * State persists in localStorage 'drift-commissions'. See commission-gen.js for the generator and the matching rules.
 */
import { addPanel, addTool, addStyle, registerIcons } from '../ui.js';
import { bus } from '../bus.js';
import { generate, matches, SLOTS, CLIENTS, LIFETIME } from './commission-gen.js';

const KEY = 'drift-commissions';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let st = { slots: [], once: [], recent: [] };
try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && Array.isArray(j.slots)) st = { slots: j.slots.slice(0, SLOTS), once: j.once || [], recent: j.recent || [] }; } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };

registerIcons({ clipboard: 'M9 4h6v3H9z M7 5.5H5.5a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1H17 M8 12h8 M8 16h5' });

export default {
  name: 'commissions',
  init(game) {
    const { store } = game;
    const panel = addPanel('commissionsPanel', 'Commissions');
    addStyle(`.ccard{border:1px solid #9fe3ff33;background:#ffffff0d;border-radius:16px;padding:14px 16px;margin:12px 0}
.ccard.done{border-color:#ffd21f88;background:#ffd21f12}.ccard .cclient{font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.6}
.ccard .creq{font-size:18px;margin:4px 0 2px}.ccard .cflav{font-size:13px;opacity:.7;font-style:italic}
.ccard .cfoot{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:13px;flex-wrap:wrap}.ccard .cfoot .sp{flex:1}
.cintro{opacity:.7;font-size:13px;margin:4px 0 0}`);
    const render = () => {
      const now = Date.now();
      const cards = st.slots.map((c, i) => {
        if (!c) return '';
        const hrs = Math.max(1, Math.round((c.exp - now) / 3600e3)), done = c.status === 'done';
        return `<div class="ccard${done ? ' done' : ''}"><div class="cclient">${esc(CLIENTS[c.client]?.name || c.client)}</div>
          <div class="creq">${esc(c.text)}</div><div class="cflav">\u201C${esc(c.flavor)}\u201D</div>
          <div class="cfoot"><span class="gold">\u25CE ${c.reward} bonus</span>
          ${done ? '<span>Photographed \u2013 sell that snapshot to collect it.</span>' : `<span class="muted">about ${hrs} h left</span><span class="sp"></span><button data-i="${i}" class="decline">Not now</button>`}</div></div>`;
      }).join('');
      panel.body.innerHTML = `<p class="cintro">Requests for photographs. Take a picture that fits, then sell that very picture to collect the bonus. No hurry \u2013 new requests arrive as old ones are done.</p>${cards}`;
      for (const b of panel.body.querySelectorAll('.decline')) b.addEventListener('click', () => {
        const i = +b.dataset.i, others = st.slots.filter((c, k) => c && k !== i);
        st.slots[i] = generate(game, others, { once: st.once, recent: st.recent }) || null; refill(); render();
      });
    };
    const refill = () => {
      const now = Date.now();
      st.slots = st.slots.map((c) => (c && c.status === 'open' && c.exp < now ? null : c));
      for (let i = 0; i < SLOTS; i++) if (!st.slots[i]) {
        const have = st.slots.filter(Boolean);
        st.slots[i] = generate(game, have, { once: st.once, recent: st.recent });
      }
      st.slots = st.slots.filter(Boolean); save();
    };
    /** A fulfilled commission whose snapshot is gone (deleted instead of sold) is offered again. */
    const validate = async () => {
      const ids = new Set((await store.list()).map((r) => r.id)); let ch = false;
      for (const c of st.slots) if (c.status === 'done' && !ids.has(c.rec)) { c.status = 'open'; delete c.rec; c.exp = Date.now() + LIFETIME / 3; ch = true; }
      if (ch) save();
      return ch;
    };
    const onSnapshot = ({ rec, shot }) => {
      const sh = shot || rec.shot, now = Date.now();
      if (!sh || rec.commission) return null;
      let best = null;
      for (const c of st.slots) if (c.status === 'open' && c.exp >= now && matches(c.rule, sh) && (!best || c.reward > best.reward)) best = c;
      if (!best) return null;
      best.status = 'done'; best.rec = rec.id; rec.commission = best.id; rec.bonus = best.reward; save();
      store.update(rec).catch(() => {});
      bus.emit('commission', { commission: best, rec });
      if (panel.isOpen) render();
      return best;
    };
    const onSold = ({ rec }) => {
      if (!rec || !rec.commission) return;
      const i = st.slots.findIndex((c) => c && c.id === rec.commission && c.status === 'done');
      if (i < 0) return;
      const c = st.slots[i]; if (c.once && !st.once.includes(c.once)) st.once.push(c.once);
      st.recent = [...st.recent, c.kind].slice(-5); st.slots.splice(i, 1); refill(); if (panel.isOpen) render();
    };
    bus.on('snapshot', onSnapshot); bus.on('sold', onSold);
    panel.onOpen = () => { refill(); render(); validate().then((ch) => { if (ch && panel.isOpen) render(); }); };
    addTool('commBtn', 'clipboard', 'Commissions', () => panel.open());
    refill(); store.ready.then(validate);
    game.commissions = { get state() { return st; }, refill, render, onSnapshot, onSold, validate, panel };
  },
};
