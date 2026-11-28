import { ib } from './icons.js';
import { addStyle } from './ui.js';
import { SUBS, SUB_IDS, ITEMS, ITEM, GROUPS, PRICE_MULT } from './fleet.js';

const fmt = (n) => n.toLocaleString('en-US');

/** Shop overlay: upgrades for the active sub, plus the four submarines. Styled like the album / bestiary panels. */
export class ShopUI {
  constructor(fleet, wallet, { toast, onSwitch }) {
    this.fleet = fleet; this.wallet = wallet; this.toast = toast; this.onSwitch = onSwitch;
    addStyle('#shopBody h3.sgroup{margin:16px 0 6px;font-weight:500;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#9fe3ff;opacity:.85}');
    const $ = (id) => document.getElementById(id);
    this.root = $('shop'); this.body = $('shopBody'); this.coins = $('shopCoins');
    ib($('shopClose'), 'close', 'Close shop');
    $('shopClose').addEventListener('click', () => this.close());
    addEventListener('keydown', (e) => { if (!this.root.hidden && e.code === 'Escape') { this.close(); e.stopPropagation(); } }, true);
    fleet.onChange(() => { if (this.isOpen) this.render(); });
  }
  get isOpen() { return !this.root.hidden; }
  open() { if (document.exitPointerLock) document.exitPointerLock(); this.root.hidden = false; this.render(); }
  close() { this.root.hidden = true; }

  _btn(label, cls, disabled, onClick) {
    const b = document.createElement('button'); b.textContent = label; b.className = cls; b.disabled = disabled;
    if (!disabled && onClick) b.addEventListener('click', onClick);
    return b;
  }
  _row(title, text, state, right) {
    const r = document.createElement('div'); r.className = 'srow';
    const m = document.createElement('div'); m.className = 'smain';
    const t = document.createElement('b'); t.textContent = title; m.appendChild(t);
    const d = document.createElement('span'); d.textContent = text; m.appendChild(d);
    if (state) { const s = document.createElement('em'); s.textContent = state; m.appendChild(s); }
    r.appendChild(m); r.appendChild(right); return r;
  }
  render() {
    const { fleet, wallet } = this, body = this.body, scroll = body.scrollTop;
    this.coins.textContent = `◎ ${fmt(wallet.n)} pearls`;
    body.textContent = '';
    const active = SUBS[fleet.active];

    const h1 = document.createElement('h2'); h1.textContent = `Upgrades · ${active.name}`; body.appendChild(h1);
    const note = document.createElement('p'); note.className = 'snote';
    const mult = PRICE_MULT[fleet.active] || 1;
    note.textContent = 'Upgrades are fitted to this submarine only; they do not move to another sub (album expansions are the exception: they apply to the whole album).' + (mult !== 1 ? ` Everything on the ${active.name} costs ×${mult} (consumables too).` : '');
    body.appendChild(note);
    for (const group of GROUPS) {
      const gh = document.createElement('h3'); gh.className = 'sgroup'; gh.textContent = group; body.appendChild(gh);
      for (const it of ITEMS.filter((i) => i.group === group)) {
        const owned = !it.consumable && fleet.has(it.id), why = fleet.itemBlock(it.id, wallet), price = fleet.priceOf(it.id);
        let state = '', btn;
        if (owned) { btn = this._btn('Owned ✓', 'sbtn owned', true); }
        else {
          if (why.startsWith('needs')) state = `Requires ${ITEM[it.requires].name}`;
          else if (why === 'undamaged') state = 'Hull is undamaged';
          else if (it.id === 'repair') state = `Hull damage ${Math.round(fleet.damageOf() * 100)}%`;
          btn = this._btn(`◎ ${fmt(price)}`, 'sbtn buy', !!why, () => {
            const r = fleet.buyItem(it.id, wallet);
            if (r.ok) this.toast(it.consumable ? `Hull repaired · ◎ ${fmt(r.price)}` : `${it.name} fitted · ◎ ${fmt(r.price)}`);
            this.render();
          });
        }
        body.appendChild(this._row(it.name, it.effect, state || (owned && it.shared ? 'Applies to all submarines' : ''), btn));
      }
    }

    const h2 = document.createElement('h2'); h2.textContent = 'Submarines'; body.appendChild(h2);
    const n2 = document.createElement('p'); n2.className = 'snote'; n2.textContent = 'Submarines are very expensive. Each keeps its own upgrades and its own hull damage.'; body.appendChild(n2);
    for (const id of SUB_IDS) {
      const s = SUBS[id], owned = fleet.owns(id), isActive = id === fleet.active, es = fleet.stats(id);
      const stats = `max depth ${es.maxDepth} m · damage taken ×${s.fragility} · thrust ×${s.thrust} · turning ×${s.turn}`;
      let btn;
      if (isActive) btn = this._btn('Active', 'sbtn owned', true);
      else if (owned) btn = this._btn('Switch', 'sbtn buy', false, () => { this.onSwitch(id); this.render(); });
      else {
        const why = fleet.subBlock(id, wallet);
        btn = this._btn(`◎ ${fmt(s.price)}`, 'sbtn buy', !!why, () => {
          const r = fleet.buySub(id, wallet);
          if (r.ok) this.toast(`${s.name} bought · ◎ ${fmt(s.price)}`);
          this.render();
        });
      }
      const row = this._row(s.name, `${s.desc}`, stats, btn);
      row.classList.add('ssub'); if (isActive) row.classList.add('cur');
      body.appendChild(row);
    }
    body.scrollTop = scroll;
  }
}
