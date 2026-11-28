/**
 * Encyclopedia sections (tabs). `Fauna` (the old bestiary) is built in; other tabs register here.
 *
 * registerSection({
 *   id: 'flora' | 'wrecks' | 'terrain' | ...,
 *   title: 'Flora',
 *   entries: [ { id, name, sci?, hint?, depth?: [min,max], facts?: [[label, value], ...],
 *                sheet: { text: [2-3 paragraphs], fun: 'fun fact', wiki: 'English Wikipedia page title' (lead image is fetched at runtime),
 *                         links?: [[label, url], ...] } } ],   // page number = index + 1; locked pages show only the number + `hint`
 *   unlockText?: 'Photograph ... to unlock'   // shown on locked pages
 * });
 *
 * The section's provider listens to bus 'snapshot' ({ rec, shot }) and, when its entry is in frame, calls
 *   enc.unlock(sectionId, entryId, rec, { x, y, frac })   // x,y: NDC centre of the subject in the snapshot, frac: its height as a fraction of frame height
 * (idempotent; a later better/larger shot replaces the picture). Returns a Promise<{ fresh: bool }>; the encyclopedia shows the toast and
 * stores the cropped picture. `enc.found(sectionId, entryId)` tells whether a page is unlocked, `enc.count(sectionId)` how many,
 * `enc.get(sectionId, entryId)` the stored { t, img, frac } record, `enc.onChange(fn)` subscribes to unlocks / new sections.
 * Section unlocks pay no pearls. Storage: localStorage `drift-enc-<section>` = { entryId: { t, img (jpeg data URL), frac } }.
 */
export const sections = [];

const LS = 'drift-enc-';
const store = new Map();            // section id -> { entryId: record }
const listeners = new Set();
const emit = () => { for (const fn of [...listeners]) { try { fn(); } catch (e) { console.warn(e); } } };
const read = (id) => { let s = store.get(id); if (!s) { try { s = JSON.parse(localStorage.getItem(LS + id) || '{}') || {}; } catch { s = {}; } store.set(id, s); } return s; };
const write = (id) => { try { localStorage.setItem(LS + id, JSON.stringify(store.get(id) || {})); return true; } catch { return false; } };

let queue = Promise.resolve();      // unlocks are serialised: each one decodes a full-size JPEG
const NO_TOAST = { toast: null };

/** crop a 4:3 window around the subject (NDC x,y; frac = its height as a fraction of the frame) out of the snapshot Blob */
async function crop(blob, { x = 0, y = 0, frac = 0.3 } = {}) {
  const bmp = await createImageBitmap(blob), w = bmp.width, h = bmp.height;
  try {
    let ch = Math.min(h, Math.max(h * 0.3, frac * h * 1.6)), cw = ch * 4 / 3;
    if (cw > w) { cw = w; ch = cw * 3 / 4; }
    const sx = Math.min(w - cw, Math.max(0, (x + 1) / 2 * w - cw / 2)), sy = Math.min(h - ch, Math.max(0, (1 - y) / 2 * h - ch / 2));
    const c = document.createElement('canvas'); c.width = 520; c.height = 390;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, sx, sy, cw, ch, 0, 0, 520, 390);
    let url = c.toDataURL('image/jpeg', 0.8);
    if (url.length > 70000) url = c.toDataURL('image/jpeg', 0.62);   // keep a page picture under ~50 KB
    return url;
  } finally { bmp.close && bmp.close(); }
}

async function unlockNow(sectionId, entryId, rec, at) {
  const s = read(sectionId), old = s[entryId], frac = Math.max(0, at && at.frac || 0);
  if (old && !(frac > (old.frac || 0) * 1.05 && rec && rec.full)) return { fresh: false };
  let img = '';
  if (rec && rec.full) { try { img = await crop(rec.full, at); } catch (e) { console.warn('encyclopedia crop failed', e); } }
  const prev = s[entryId], entry = { t: prev ? prev.t : Date.now(), frac: img ? frac : (prev ? prev.frac : frac), img: img || (prev ? prev.img : '') };
  s[entryId] = entry;
  if (!write(sectionId)) {                       // storage full: keep the unlock, drop the picture
    entry.img = prev ? prev.img : '';
    if (!write(sectionId)) { entry.img = ''; write(sectionId); }
  }
  const sec = sections.find((o) => o.id === sectionId), def = sec && sec.entries.find((e) => e.id === entryId);
  if (!prev && enc.hooks.toast) enc.hooks.toast(`New page: ${def ? def.name : entryId}`);
  emit();
  return { fresh: !prev };
}

export const enc = {
  hooks: { ...NO_TOAST },
  /** unlock (or improve) a page from a snapshot; resolves { fresh } */
  unlock(sectionId, entryId, rec, at) {
    const p = queue.then(() => unlockNow(sectionId, entryId, rec, at)).catch((e) => { console.warn('encyclopedia unlock failed', e); return { fresh: false }; });
    queue = p;
    return p;
  },
  found: (sectionId, entryId) => !!read(sectionId)[entryId],
  get: (sectionId, entryId) => read(sectionId)[entryId] || null,
  count(sectionId) {
    const s = read(sectionId), sec = sections.find((o) => o.id === sectionId);
    return sec ? sec.entries.filter((e) => s[e.id]).length : Object.keys(s).length;
  },
  /** subscribe: fn() runs after an unlock or when a section is (re)registered; returns an unsubscribe function */
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

export function registerSection(def) {
  const i = sections.findIndex((s) => s.id === def.id);
  if (i >= 0) sections[i] = def; else sections.push(def);
  emit();
}

// ---------------- shared page helpers (Fauna and generic section pages) ----------------
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const wikiUrl = (t) => 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(t).replace(/ /g, '_'));
const jget = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
const pending = new Map();

/** Lead image of a Wikipedia article (REST summary API, cached on this device in `drift-wikiimg`). */
export function wikiImage(title) {
  const cache = jget('drift-wikiimg');
  if (cache[title]) return Promise.resolve(cache[title]);
  if (pending.has(title)) return pending.get(title);
  const p = (async () => {
    const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')));
    if (!r.ok) throw new Error('wiki ' + r.status);
    const j = await r.json(), src = (j.thumbnail || j.originalimage || {}).source;
    if (!src) throw new Error('no image');
    const c = jget('drift-wikiimg'); c[title] = src; try { localStorage.setItem('drift-wikiimg', JSON.stringify(c)); } catch {}
    return src;
  })().finally(() => pending.delete(title));
  pending.set(title, p);
  return p;
}

/** fill `box` (an element) with the Wikipedia lead image of `title`; `alive()` tells whether the page is still shown */
export function showWikiImage(box, title, alt, alive = () => true) {
  wikiImage(title).then((src) => {
    if (!alive()) return;
    const img = new Image(); img.alt = alt + ' (photo)'; img.referrerPolicy = 'no-referrer'; img.src = src;
    img.onerror = () => { box.innerHTML = '<span>image unavailable</span>'; };
    box.textContent = ''; box.appendChild(img);
  }).catch(() => { if (alive()) box.innerHTML = '<span>web image unavailable (offline?)</span>'; });
}
