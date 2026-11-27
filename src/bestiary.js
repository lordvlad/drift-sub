import { BESTIARY } from './species.js';
import { SHEETS } from './bestiary-data.js';
import { ib } from './icons.js';

const KEY = 'drift-bestiary', IMGKEY = 'drift-wikiimg';
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wikiUrl = (t) => 'https://en.wikipedia.org/wiki/' + encodeURIComponent(t.replace(/ /g, '_'));

/** Lead image of a Wikipedia article (cached on this device). */
async function wikiImage(title) {
  const cache = load(IMGKEY);
  if (cache[title]) return cache[title];
  const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')));
  if (!r.ok) throw new Error('wiki ' + r.status);
  const j = await r.json(), src = (j.thumbnail || j.originalimage || {}).source;
  if (!src) throw new Error('no image');
  cache[title] = src; save(IMGKEY, cache);
  return src;
}

/**
 * Discovered pages: { id: { t, img (jpeg data URL cropped from the snapshot), frac (how big the animal was) } }.
 * A later snapshot replaces the picture only if the animal is shown larger.
 */
export class Bestiary {
  constructor(onCount) {
    this.found = load(KEY); this.onCount = onCount; this.cur = -1;
    const $ = (id) => document.getElementById(id);
    this.root = $('bestiary'); this.grid = $('bGrid'); this.page = $('bPage'); this.body = $('bBody'); this.num = $('bNum');
    ib($('bClose'), 'close', 'Close bestiary'); ib($('bBack'), 'back', 'All pages'); ib($('bPrev'), 'chevL', 'Previous page'); ib($('bNext'), 'chevR', 'Next page');
    $('bClose').addEventListener('click', () => this.close());
    $('bBack').addEventListener('click', () => { this.page.hidden = true; this.renderGrid(); });
    $('bPrev').addEventListener('click', () => this.show((this.cur - 1 + BESTIARY.length) % BESTIARY.length));
    $('bNext').addEventListener('click', () => this.show((this.cur + 1) % BESTIARY.length));
    addEventListener('keydown', (e) => {
      if (this.root.hidden) return;
      if (e.code === 'Escape') { this.page.hidden ? this.close() : (this.page.hidden = true, this.renderGrid()); e.stopPropagation(); }
      else if (!this.page.hidden && e.code === 'ArrowLeft') $('bPrev').click();
      else if (!this.page.hidden && e.code === 'ArrowRight') $('bNext').click();
    }, true);
    onCount(this.count);
  }
  get count() { return BESTIARY.filter((s) => this.found[s.id]).length; }
  get isOpen() { return !this.root.hidden; }
  /** Record animals seen on a snapshot. spots: [{ id, frac, crop: () => dataURL }]. Returns names of newly unlocked pages. */
  record(spots) {
    const fresh = [];
    for (const sp of spots) {
      const old = this.found[sp.id];
      if (old && old.frac >= sp.frac) continue;
      const entry = { t: Date.now(), frac: sp.frac, img: sp.crop() };
      if (!old) fresh.push(BESTIARY.find((s) => s.id === sp.id)?.name || sp.id);
      this.found[sp.id] = entry;
      if (!save(KEY, this.found)) { entry.img = old ? old.img : ''; save(KEY, this.found); }
    }
    if (fresh.length) this.onCount(this.count);
    return fresh;
  }
  open() { if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); this.root.hidden = false; this.page.hidden = true; this.renderGrid(); }
  close() { this.root.hidden = true; }
  renderGrid() {
    document.getElementById('bCount').textContent = `${this.count} / ${BESTIARY.length} discovered`;
    this.grid.textContent = '';
    BESTIARY.forEach((s, i) => {
      const f = this.found[s.id], b = document.createElement('button');
      b.className = 'bcard' + (f ? '' : ' locked');
      b.innerHTML = `<span class="bno">${String(i + 1).padStart(2, '0')}</span>` + (f ? `<img alt="" src="${f.img}"><span class="bname">${esc(s.name)}</span>` : '<span class="bq">?</span>');
      b.title = f ? s.name : `Page ${i + 1}: not yet photographed`;
      b.addEventListener('click', () => this.show(i));
      this.grid.appendChild(b);
    });
  }
  show(i) {
    this.cur = i; this.page.hidden = false; this.page.scrollTop = 0;
    const s = BESTIARY[i], f = this.found[s.id], sh = SHEETS[s.id] || {}, no = String(i + 1).padStart(2, '0');
    this.num.textContent = `No. ${no} / ${BESTIARY.length}`;
    if (!f) {
      this.body.innerHTML = `<div class="blocked"><div class="bq big">?</div><h2>Page ${no} — undiscovered</h2>
        <p>Photograph this animal with the viewfinder to unlock its page.</p><p class="bhint">It lives around ${s.min}–${s.max} m${s.rare ? ' and is rare' : ''}.</p></div>`;
      return;
    }
    const links = [[wikiUrl(sh.wiki || s.name), 'Wikipedia'], ['https://www.inaturalist.org/taxa/search?q=' + encodeURIComponent(sh.sci ? sh.sci.split(' /')[0].split(' and')[0] : s.name), 'iNaturalist']];
    if (s.habitat) links.push(['https://www.fishbase.se/search.php?lang=English&what=species&q=' + encodeURIComponent(sh.sci?.split(' ').slice(0, 2).join(' ') || s.name), 'FishBase']);
    this.body.innerHTML = `
      <h2>${esc(s.name)}</h2><div class="bsci">${esc(sh.sci || '')}</div>
      <div class="bfacts"><span>Depth ${s.min}–${s.max} m</span>${s.rare ? '<span>Rare</span>' : ''}<span>First photographed ${new Date(f.t).toLocaleDateString()}</span></div>
      <div class="bimgs"><figure><img alt="Your snapshot" src="${f.img}"><figcaption>Your snapshot</figcaption></figure>
        <figure><div class="bweb"><span>loading…</span></div><figcaption>Photo via <a target="_blank" rel="noopener" href="${wikiUrl(sh.wiki || s.name)}">Wikipedia / Wikimedia Commons</a></figcaption></figure></div>
      ${(sh.text || []).map((p) => `<p>${esc(p)}</p>`).join('')}
      ${sh.fun ? `<div class="bfun"><b>Fun fact</b> ${esc(sh.fun)}</div>` : ''}
      <div class="blinks">${links.map(([u, l]) => `<a target="_blank" rel="noopener" href="${u}">${l} ↗</a>`).join('')}</div>`;
    const box = this.body.querySelector('.bweb'), want = i;
    wikiImage(sh.wiki || s.name).then((src) => {
      if (this.cur !== want) return;
      const img = new Image(); img.alt = s.name + ' (photo)'; img.referrerPolicy = 'no-referrer'; img.src = src;
      img.onerror = () => { box.innerHTML = '<span>image unavailable</span>'; };
      box.textContent = ''; box.appendChild(img);
    }).catch(() => { if (this.cur === want) box.innerHTML = '<span>web image unavailable (offline?)</span>'; });
  }
}
