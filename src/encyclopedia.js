import { addStyle } from './ui.js';
import { ib } from './icons.js';
import { sections, enc, registerSection, esc, wikiUrl, showWikiImage } from './encyclopedia/api.js';

addStyle(`#bGrid{grid-auto-rows:max-content}
#bTabs{display:flex;gap:6px;padding:0 16px 8px;overflow-x:auto;overflow-y:hidden;flex:none;scrollbar-width:none;touch-action:pan-x;-webkit-overflow-scrolling:touch}
#bTabs::-webkit-scrollbar{display:none}
#bTabs button{flex:none;border-radius:999px !important;padding:7px 14px !important;font-size:14px;white-space:nowrap;display:inline-flex;align-items:baseline;gap:8px}
#bTabs button em{font-style:normal;font-size:11px;opacity:.65}
#bTabs button.on{background:#ffd21f !important;color:#06222f !important;border-color:#ffd21f !important}#bTabs button.on em{opacity:.75}
#bTabs[hidden]{display:none}
.bimgs.one{grid-template-columns:1fr;max-width:520px}.bfacts b{font-weight:600;opacity:.7;margin-right:5px}
.bmissing{display:grid;place-items:center;aspect-ratio:4/3;border-radius:10px;background:#ffffff0d;font-size:12px;opacity:.7;text-align:center;padding:0 12px}
@media (max-width:560px){#bTabs{padding:0 12px 8px}.bbar{padding:10px 12px !important}}`);

/** A registered section (Flora, Wrecks, Terrain, ...) drawn with the generic page layout. Same view interface as Bestiary (Fauna). */
class SectionView {
  constructor(def) { this.def = def; }
  get id() { return this.def.id; }
  get title() { return this.def.title; }
  get size() { return this.def.entries.length; }
  get count() { return enc.count(this.def.id); }
  summary() { return `${this.count} / ${this.size} discovered`; }
  pageLabel(i) { return `No. ${String(i + 1).padStart(2, '0')} / ${this.size}`; }
  leave() {}
  escape() { return false; }
  renderGrid(grid, open) {
    grid.textContent = '';
    this.def.entries.forEach((e, i) => {
      const f = enc.get(this.def.id, e.id), b = document.createElement('button');
      b.className = 'bcard' + (f ? '' : ' locked');
      b.innerHTML = `<span class="bno">${String(i + 1).padStart(2, '0')}</span>` + (f ? (f.img ? `<img alt="" src="${f.img}">` : '') + `<span class="bname">${esc(e.name)}</span>` : '<span class="bq">?</span>');
      b.title = f ? e.name : `Page ${i + 1}: not yet found`;
      b.addEventListener('click', () => open(i));
      grid.appendChild(b);
    });
  }
  renderPage(i, body, alive = () => true) {
    const d = this.def, e = d.entries[i], f = enc.get(d.id, e.id), sh = e.sheet || {}, no = String(i + 1).padStart(2, '0');
    if (!f) {
      body.innerHTML = `<div class="blocked"><div class="bq big">?</div><h2>Page ${no} — undiscovered</h2>
        <p>${esc(d.unlockText || 'Photograph this with the viewfinder to unlock its page.')}</p>${e.hint ? `<p class="bhint">${esc(e.hint)}</p>` : ''}</div>`;
      return;
    }
    const depth = Array.isArray(e.depth) ? `<span>Depth ${e.depth[0]}–${e.depth[1]} m</span>` : '';
    const facts = (e.facts || []).map(([k, v]) => `<span><b>${esc(k)}</b>${esc(v)}</span>`).join('');
    const links = [...(sh.wiki ? [['Wikipedia', wikiUrl(sh.wiki)]] : []), ...(sh.links || [])];
    body.innerHTML = `
      <h2>${esc(e.name)}</h2>${e.sci ? `<div class="bsci">${esc(e.sci)}</div>` : '<div class="bsci"></div>'}
      <div class="bfacts">${depth}${facts}<span>First photographed ${new Date(f.t).toLocaleDateString()}</span></div>
      <div class="bimgs${sh.wiki ? '' : ' one'}"><figure>${f.img ? `<img alt="Your snapshot" src="${f.img}">` : '<div class="bmissing">Your snapshot could not be kept (device storage is full)</div>'}<figcaption>Your snapshot</figcaption></figure>
        ${sh.wiki ? `<figure><div class="bweb"><span>loading…</span></div><figcaption>Photo via <a target="_blank" rel="noopener" href="${wikiUrl(sh.wiki)}">Wikipedia / Wikimedia Commons</a></figcaption></figure>` : ''}</div>
      ${(sh.text || []).map((p) => `<p>${esc(p)}</p>`).join('')}
      ${sh.fun ? `<div class="bfun"><b>Fun fact</b> ${esc(sh.fun)}</div>` : ''}
      ${links.length ? `<div class="blinks">${links.map(([label, url]) => `<a target="_blank" rel="noopener" href="${esc(url)}">${esc(label)} ↗</a>`).join('')}</div>` : ''}`;
    if (sh.wiki) showWikiImage(body.querySelector('.bweb'), sh.wiki, e.name, alive);
  }
}

/**
 * The Encyclopedia: full-screen panel (#bestiary in index.html) with a tab per section. Fauna is the Bestiary (src/bestiary.js);
 * every registerSection() (src/encyclopedia/api.js) adds a tab drawn with the generic page layout.
 */
export class Encyclopedia {
  constructor(bestiary, { toast, onCount } = {}) {
    this.api = { sections, enc, registerSection };   // for tests / plug-ins reaching the Encyclopedia through game.encyclopedia
    this.fauna = bestiary; this.onCount = onCount || (() => {}); this.tab = 0; this.cur = -1; this.token = 0; this.views = [bestiary]; 
    enc.hooks.toast = toast || null;
    const $ = (id) => document.getElementById(id);
    this.root = $('bestiary'); this.tabs = $('bTabs'); this.grid = $('bGrid'); this.page = $('bPage'); this.body = $('bBody'); this.num = $('bNum'); this.count = $('bCount');
    ib($('bClose'), 'close', 'Close encyclopedia'); ib($('bBack'), 'back', 'All pages'); ib($('bPrev'), 'chevL', 'Previous page'); ib($('bNext'), 'chevR', 'Next page');
    $('bClose').addEventListener('click', () => this.close());
    $('bBack').addEventListener('click', () => this.toGrid());
    $('bPrev').addEventListener('click', () => this.show((this.cur - 1 + this.view.size) % this.view.size));
    $('bNext').addEventListener('click', () => this.show((this.cur + 1) % this.view.size));
    addEventListener('keydown', (e) => {
      if (this.root.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      const pageOpen = !this.page.hidden;
      if (e.code === 'Escape') { if (!this.view.escape()) pageOpen ? this.toGrid() : this.close(); e.stopPropagation(); e.preventDefault(); }
      else if (pageOpen && e.code === 'ArrowLeft') $('bPrev').click();
      else if (pageOpen && e.code === 'ArrowRight') $('bNext').click();
      else if (e.code === 'Tab') { e.preventDefault(); this.setTab((this.tab + (e.shiftKey ? -1 : 1) + this.views.length) % this.views.length); }
      else if (/^(Digit|Numpad)[1-9]$/.test(e.code) && +e.code.slice(-1) <= this.views.length) this.setTab(+e.code.slice(-1) - 1);
      else return;
      e.stopPropagation();
    }, true);
    enc.onChange(() => this.changed());
    this.syncViews(); this.updateCount();
  }
  get view() { return this.views[this.tab]; }
  get isOpen() { return !this.root.hidden; }
  /** total unlocked pages over all tabs (the top-bar button's number) */
  get total() { return this.views.reduce((n, v) => n + v.count, 0); }
  updateCount() { this.onCount(this.total); }
  /** the Fauna's page count changed (called by the Bestiary) or a section did */
  changed() {
    this.syncViews(); this.updateCount();
    if (this.isOpen) { this.renderTabs(); if (this.page.hidden) this.renderGrid(); else if (this.view !== this.fauna) this.renderPage(); }
  }
  syncViews() {
    const keep = this.view && this.view.id;
    this.views = [this.fauna, ...sections.map((d) => { const old = this.views.find((v) => v.def === d); return old || new SectionView(d); })];
    const i = this.views.findIndex((v) => v.id === keep); this.tab = i >= 0 ? i : 0;
  }
  open() {
    if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
    this.syncViews(); this.root.hidden = false; this.page.hidden = true; this.renderTabs(); this.renderGrid();
  }
  close() { this.view.leave(); this.root.hidden = true; }
  setTab(i) {
    if (i === this.tab && this.page.hidden) return;
    this.view.leave(); this.tab = i; this.page.hidden = true; this.renderTabs(); this.renderGrid();
    const on = this.tabs.querySelector('.on'); on && on.scrollIntoView && on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  renderTabs() {
    this.tabs.hidden = this.views.length < 2;
    this.tabs.textContent = '';
    this.views.forEach((v, i) => {
      const b = document.createElement('button'), n = v.count;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', i === this.tab); b.className = i === this.tab ? 'on' : '';
      b.innerHTML = `${esc(v.title)} <em>${n} / ${v.size}</em>`; b.title = `${v.title} (${i + 1})`;
      b.addEventListener('click', () => this.setTab(i));
      this.tabs.appendChild(b);
    });
  }
  renderGrid() {
    const v = this.view; this.count.textContent = v.summary();
    v.renderGrid(this.grid, (i) => this.show(i)); this.grid.scrollTop = 0;
  }
  toGrid() { this.view.leave(); this.page.hidden = true; this.renderGrid(); }
  show(i) { this.cur = i; this.page.hidden = false; this.body.scrollTop = 0; this.renderPage(); }
  renderPage() {
    const v = this.view, i = this.cur, want = ++this.token;
    this.num.textContent = v.pageLabel(i);
    v.renderPage(i, this.body, () => this.token === want && this.cur === i && this.view === v && !this.page.hidden);
  }
}
