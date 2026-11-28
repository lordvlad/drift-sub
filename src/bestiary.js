import { BESTIARY } from './species.js';
import { SHEETS } from './bestiary-data.js';
import { addStyle } from './ui.js';
import { bus } from './bus.js';
import { rate, grantFor, thirdStarHint } from './stars.js';
import { svg } from './icons.js';
import { esc, wikiUrl, showWikiImage } from './encyclopedia/api.js';
import { openViewer } from './encyclopedia/viewer.js';
import { hasModel } from './models/registry.js';
import './models/registry-core.js';   // 3D-view models of the core species (the groups register their own)

const KEY = 'drift-bestiary';
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

const STAR = '\u2605', STAR0 = '\u2606';
addStyle(`.bstars{position:absolute;right:7px;top:5px;z-index:1;font-size:13px;letter-spacing:1px;color:#ffd21f;text-shadow:0 1px 4px #000}
.bstars i{font-style:normal;opacity:.4;color:#fff}
.bpstars{font-size:20px;letter-spacing:3px;color:#ffd21f;margin:2px 0 0}.bpstars i{font-style:normal;opacity:.3;color:#fff}
.bnext{font-size:13px;opacity:.7;margin:2px 0 10px}`);
const starHtml = (n) => STAR.repeat(n) + (n < 3 ? `<i>${STAR0.repeat(3 - n)}</i>` : '');

/**
 * Discovered pages: { id: { t, img (jpeg data URL cropped from the snapshot), frac (how big the animal is in that picture),
 * stars (1..3, highest earned; saves from before stars existed count as 1), istar (stars the shown picture earned) } }.
 * A later snapshot replaces the picture if it earned more stars, or the same stars with the animal shown larger.
 * Research grants (pearls) are paid once per page unlock / star: stars never decrease, so a star is never paid twice.
 */
export class Bestiary {
  constructor(onCount, wallet) {
    this.found = load(KEY); this.onCount = onCount; this.wallet = wallet; this.viewer = null;
    for (const f of Object.values(this.found)) { f.stars = f.stars || 1; f.istar = f.istar || 1; }   // pre-star saves: one star, no retroactive grants
    onCount(this.count);
  }
  // ---- Encyclopedia tab ("Fauna"): the shell (src/encyclopedia.js) draws the chrome, this class draws the grid and pages ----
  get id() { return 'fauna'; }
  get title() { return 'Fauna'; }
  get size() { return BESTIARY.length; }
  get species() { return BESTIARY; }
  get count() { return BESTIARY.filter((s) => this.found[s.id]).length; }
  /**
   * Record animals seen on a snapshot. spots: [{ id, frac, crop: () => dataURL }]; shot: the Photo-shot descriptor (optional).
   * Pays research grants (once per page / star) and returns short notes for the toast, e.g. 'New page: Grey reef shark +◎135'.
   */
  record(spots, shot) {
    const notes = [], grants = [], touched = []; let fresh = false;
    for (const sp of spots) {
      const sd = (shot && shot.spots && shot.spots.find((o) => o.id === sp.id)) || {}, spot = { ...sp, ...sd, frac: sd.frac ?? sp.frac };
      const species = BESTIARY.find((s) => s.id === sp.id), name = species?.name || sp.id;
      const stars = rate(spot, shot, species), old = this.found[sp.id];
      const better = !old || stars > old.istar || (stars === old.istar && sp.frac > old.frac);
      const have = old ? old.stars : 0, now = Math.max(have, stars);
      if (!better && now === have) continue;
      const entry = old ? { ...old } : { t: Date.now(), frac: sp.frac, img: '', stars: 1, istar: 1 };
      if (better) { entry.frac = sp.frac; entry.istar = stars; entry.img = sp.crop(); }
      entry.stars = now; this.found[sp.id] = entry; touched.push([entry, old ? old.img : '']);
      if (!old) fresh = true;
      if (now > have) {
        let grant = 0; for (let k = have + 1; k <= now; k++) grant += grantFor(species || { value: 0 }, k);
        grants.push({ id: sp.id, stars: now, grant, fresh: !old, note: !old ? `New page: ${name} +\u25CE${grant}` : `${name} ${STAR.repeat(now)} +\u25CE${grant}` });
      }
    }
    if (!touched.length) return notes;
    if (!save(KEY, this.found)) { for (const [e, img] of touched) e.img = img; save(KEY, this.found); }   // storage full: keep the old pictures
    // the new star levels are persisted BEFORE paying, so a grant can never be paid twice
    for (const g of grants) { if (this.wallet && g.grant) this.wallet.add(g.grant); notes.push(g.note); bus.emit('stars', { id: g.id, stars: g.stars, grant: g.grant, fresh: g.fresh }); }
    if (fresh) this.onCount(this.count);
    return notes;
  }
  summary() {
    const stars = BESTIARY.reduce((n, s) => n + (this.found[s.id]?.stars || 0), 0);
    return `${this.count} / ${BESTIARY.length} discovered · ${stars} / ${BESTIARY.length * 3} \u2605`;
  }
  pageLabel(i) { return `No. ${String(i + 1).padStart(2, '0')} / ${BESTIARY.length}`; }
  renderGrid(grid, open) {
    grid.textContent = '';
    BESTIARY.forEach((s, i) => {
      const f = this.found[s.id], b = document.createElement('button');
      b.className = 'bcard' + (f ? '' : ' locked');
      b.innerHTML = `<span class="bno">${String(i + 1).padStart(2, '0')}</span>` + (f ? `<span class="bstars" aria-label="${f.stars} of 3 stars">${starHtml(f.stars)}</span><img alt="" src="${f.img}"><span class="bname">${esc(s.name)}</span>` : '<span class="bq">?</span>');
      b.title = f ? `${s.name} \u00b7 ${f.stars} of 3 stars` : `Page ${i + 1}: not yet photographed`;
      b.addEventListener('click', () => open(i));
      grid.appendChild(b);
    });
  }
  /** close the 3D view (page change, tab change, panel closed) */
  leave() { if (this.viewer) { this.viewer.close(); this.viewer = null; } }
  /** Esc: closes the 3D view first; true when it consumed the key */
  escape() { if (this.viewer) { this.leave(); return true; } return false; }
  renderPage(i, body, alive = () => true) {
    this.leave();
    const s = BESTIARY[i], f = this.found[s.id], sh = SHEETS[s.id] || {}, no = String(i + 1).padStart(2, '0');
    if (!f) {
      body.innerHTML = `<div class="blocked"><div class="bq big">?</div><h2>Page ${no} — undiscovered</h2>
        <p>Photograph this animal with the viewfinder to unlock its page.</p><p class="bhint">It lives around ${s.min}–${s.max} m${s.rare ? ' and is rare' : ''}.</p></div>`;
      return;
    }
    const links = [[wikiUrl(sh.wiki || s.name), 'Wikipedia'], ['https://www.inaturalist.org/taxa/search?q=' + encodeURIComponent(sh.sci ? sh.sci.split(' /')[0].split(' and')[0] : s.name), 'iNaturalist']];
    if (s.habitat) links.push(['https://www.fishbase.se/search.php?lang=English&what=species&q=' + encodeURIComponent(sh.sci?.split(' ').slice(0, 2).join(' ') || s.name), 'FishBase']);
    const hint3 = thirdStarHint(s), model = hasModel(s.id);
    body.innerHTML = `
      <h2>${esc(s.name)}</h2><div class="bsci">${esc(sh.sci || '')}</div>
      <div class="bpstars" aria-label="${f.stars} of 3 stars">${starHtml(f.stars)}</div>
      <div class="bnext">${f.stars >= 3 ? 'Every star earned.' : f.stars === 1 ? 'Next star: a closer, sharper portrait?' : 'Next star: ' + (hint3 === 'something special?' ? hint3 : `something special? (${esc(hint3)})`)}</div>
      <div class="bfacts"><span>Depth ${s.min}–${s.max} m</span>${s.rare ? '<span>Rare</span>' : ''}<span>First photographed ${new Date(f.t).toLocaleDateString()}</span></div>
      ${model ? (f.stars >= 3 ? '<button class="b3btn" id="b3Open"><span class="ib" data-i="cube"></span>View in 3D</button>'
        : `<div class="b3lock">${svg('lock', 18)}Earn 3 stars to inspect it in 3D</div>`) : ''}
      <div id="b3Host"></div>
      <div class="bimgs"><figure><img alt="Your snapshot" src="${f.img}"><figcaption>Your snapshot</figcaption></figure>
        <figure><div class="bweb"><span>loading…</span></div><figcaption>Photo via <a target="_blank" rel="noopener" href="${wikiUrl(sh.wiki || s.name)}">Wikipedia / Wikimedia Commons</a></figcaption></figure></div>
      ${(sh.text || []).map((p) => `<p>${esc(p)}</p>`).join('')}
      ${sh.fun ? `<div class="bfun"><b>Fun fact</b> ${esc(sh.fun)}</div>` : ''}
      <div class="blinks">${links.map(([u, l]) => `<a target="_blank" rel="noopener" href="${u}">${l} ↗</a>`).join('')}</div>`;
    const open3 = body.querySelector('#b3Open');
    if (open3) {
      open3.querySelector('.ib').innerHTML = svg('cube', 20);
      open3.addEventListener('click', () => {
        open3.hidden = true;
        this.viewer = openViewer(body.querySelector('#b3Host'), s.id, { name: s.name, onClose: () => { this.viewer = null; if (alive()) open3.hidden = false; } });
        if (!this.viewer) { open3.hidden = false; return; }
        body.querySelector('#b3Host').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
    showWikiImage(body.querySelector('.bweb'), sh.wiki || s.name, s.name, alive);
  }
}
