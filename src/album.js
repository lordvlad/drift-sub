import { ib } from './icons.js';

const DB = 'drift-album', ST = 'shots';
export const MAX_SHOTS = 100;

/** Snapshot storage: IndexedDB (falls back to memory when unavailable). Oldest shots are dropped beyond MAX_SHOTS. */
export class Store {
  constructor() { this.db = null; this.mem = []; this.nextId = 1; this.ready = this._open(); }
  _open() {
    return new Promise((res) => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id', autoIncrement: true });
        r.onsuccess = () => { this.db = r.result; res(); };
        r.onerror = r.onblocked = () => res();
      } catch { res(); }
    });
  }
  _req(mode, fn) {
    return new Promise((res, rej) => {
      const tx = this.db.transaction(ST, mode), st = tx.objectStore(ST), r = fn(st);
      tx.oncomplete = () => res(r && r.result); tx.onerror = tx.onabort = () => rej(tx.error);
    });
  }
  async list() { // newest first
    await this.ready;
    const all = this.db ? await this._req('readonly', (s) => s.getAll()) : this.mem.slice();
    return all.sort((a, b) => b.id - a.id);
  }
  async add(rec) {
    await this.ready;
    if (!this.db) { rec.id = this.nextId++; this.mem.push(rec); while (this.mem.length > MAX_SHOTS) this.mem.shift(); return; }
    await this._req('readwrite', (s) => s.add(rec));
    const keys = await this._req('readonly', (s) => s.getAllKeys());
    if (keys.length > MAX_SHOTS) await this._req('readwrite', (s) => { for (const k of keys.slice(0, keys.length - MAX_SHOTS)) s.delete(k); });
  }
  async remove(id) {
    await this.ready;
    if (!this.db) this.mem = this.mem.filter((r) => r.id !== id); else await this._req('readwrite', (s) => s.delete(id));
  }
}

/**
 * Pearls earned by selling snapshots (kept on this device only), plus a memory of which compositions were already sold:
 * each sale of a composition makes the next similar shot worth less (x0.55 per earlier sale, floor x0.1). Capped at 400 keys.
 */
export class Wallet {
  constructor() {
    this.n = 0; this.sold = new Map();
    try { this.n = Number(localStorage.getItem('drift-pearls')) || 0; this.sold = new Map(JSON.parse(localStorage.getItem('drift-sold') || '[]')); } catch {}
  }
  _save() { try { localStorage.setItem('drift-pearls', String(this.n)); localStorage.setItem('drift-sold', JSON.stringify([...this.sold])); } catch {} }
  add(v) { this.n += v; this._save(); }
  repeats(key) { return key ? this.sold.get(key) || 0 : 0; }
  mult(key) { return Math.max(0.1, Math.pow(0.55, this.repeats(key))); }
  price(rec) { return Math.max(1, Math.round((rec.value ?? 2) * this.mult(rec.key))); }
  markSold(key) {
    if (!key) return;
    const n = this.sold.get(key) || 0; this.sold.delete(key); this.sold.set(key, n + 1); // re-insert = most recent
    while (this.sold.size > 400) this.sold.delete(this.sold.keys().next().value);
    this._save();
  }
}

const pad = (n) => String(n).padStart(2, '0');
export const fileName = (t) => { const d = new Date(t); return `drift-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.jpg`; };
export function download(rec) {
  const u = URL.createObjectURL(rec.full), a = document.createElement('a');
  a.href = u; a.download = fileName(rec.t); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

/** Album overlay: thumbnail grid + single-image viewer with download / delete. */
export class AlbumUI {
  constructor(store, wallet, onChange, say) {
    this.store = store; this.wallet = wallet; this.onChange = onChange; this.say = say; this.urls = []; this.items = []; this.cur = -1; this.fullUrl = null;
    const $ = (id) => document.getElementById(id);
    this.root = $('album'); this.grid = $('albumGrid'); this.count = $('albumCount'); this.viewer = $('albumView'); this.img = $('albumImg'); this.cap = $('albumCap'); this.coins = $('albumCoins'); this.sellBtn = $('viewSell');
    ib($('albumClose'), 'close', 'Close album'); ib($('viewClose'), 'back', 'Back to album'); ib($('viewPrev'), 'chevL', 'Older'); ib($('viewNext'), 'chevR', 'Newer');
    ib($('viewDl'), 'download', 'Download'); ib($('viewDel'), 'trash', 'Delete'); ib($('viewSell'), 'coin', 'Sell this snapshot');
    $('albumClose').addEventListener('click', () => this.close());
    $('viewClose').addEventListener('click', () => this.closeViewer());
    $('viewPrev').addEventListener('click', () => this.show(this.cur + 1));   // list is newest-first: "previous" = older
    $('viewNext').addEventListener('click', () => this.show(this.cur - 1));
    $('viewDl').addEventListener('click', () => download(this.items[this.cur]));
    $('viewDel').addEventListener('click', () => this.del());
    this.sellBtn.addEventListener('click', () => this.sell());
    addEventListener('keydown', (e) => {
      if (this.root.hidden) return;
      if (e.code === 'Escape') this.viewer.hidden ? this.close() : this.closeViewer();
      else if (!this.viewer.hidden && e.code === 'ArrowLeft') this.show(this.cur + 1);
      else if (!this.viewer.hidden && e.code === 'ArrowRight') this.show(this.cur - 1);
    }, true);
  }
  get isOpen() { return !this.root.hidden; }
  async open() {
    if (document.exitPointerLock) document.exitPointerLock();
    this.root.hidden = false; await this.refresh();
  }
  close() { this.closeViewer(); this.root.hidden = true; this._revoke(); this.grid.textContent = ''; }
  _revoke() { for (const u of this.urls) URL.revokeObjectURL(u); this.urls = []; }
  async refresh() {
    this.items = await this.store.list(); this._revoke(); this.grid.textContent = '';
    this.count.textContent = `${this.items.length} / ${MAX_SHOTS}`; this.updateCoins();
    this.root.classList.toggle('empty', !this.items.length);
    this.items.forEach((rec, i) => {
      const u = URL.createObjectURL(rec.thumb); this.urls.push(u);
      const b = document.createElement('button'); b.className = 'thumb'; b.style.backgroundImage = `url(${u})`; b.title = new Date(rec.t).toLocaleString();
      b.addEventListener('click', () => this.show(i)); this.grid.appendChild(b);
    });
    this.onChange(this.items.length);
  }
  show(i) {
    if (i < 0 || i >= this.items.length) return;
    this.cur = i; const rec = this.items[i];
    if (this.fullUrl) URL.revokeObjectURL(this.fullUrl);
    this.fullUrl = URL.createObjectURL(rec.full); this.img.src = this.fullUrl;
    this.cap.textContent = `${new Date(rec.t).toLocaleString()} · ${rec.meta || ''}`;
    this.viewer.hidden = false;
  }
  closeViewer() { this.viewer.hidden = true; this.img.removeAttribute('src'); if (this.fullUrl) { URL.revokeObjectURL(this.fullUrl); this.fullUrl = null; } }
  updateCoins() {
    this.coins.textContent = `◎ ${this.wallet.n} pearls`;
  }
  async sell() {
    const rec = this.items[this.cur]; if (!rec) return;
    const v = this.wallet.price(rec); this.wallet.add(v); this.wallet.markSold(rec.key); await this.store.remove(rec.id);
    const next = Math.min(this.cur, this.items.length - 2);
    await this.refresh(); next >= 0 ? this.show(next) : this.closeViewer();
    this.say(`Sold for ◎ ${v} · ${this.wallet.n} pearls`);
  }
  async del() {
    const rec = this.items[this.cur]; if (!rec) return;
    await this.store.remove(rec.id); const next = Math.min(this.cur, this.items.length - 2);
    await this.refresh(); next >= 0 ? this.show(next) : this.closeViewer();
  }
}
