/**
 * Gallery: pin up to 6 snapshots from the album viewer. Pinned copies (thumbnail + full image) live in their own IndexedDB
 * store 'drift-gallery', so they survive selling or deleting the original. Visitors pay a small entry fee while you play:
 * every PAYOUT_EVERY seconds of play the gallery pays visitors × fee, both derived from a hidden per-shot quality. Per-shot
 * values are never shown. Pin metadata is kept in localStorage 'drift-gallery'.
 */
import { addPanel, addTool, addStyle, registerIcons } from '../ui.js';
import { ib } from '../icons.js';

const KEY = 'drift-gallery', DB = 'drift-gallery', ST = 'frames';
export const MAX_PINS = 6;
export const PAYOUT_EVERY = 300;   // seconds of play between visitor payouts
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

registerIcons({
  pin: 'M9 3h6l-1 6 3 3v2H7v-2l3-3z M12 14v7',
  pinOff: 'M9 3h6l-1 6 3 3v2H7v-2l3-3z M12 14v7 M3 3l18 18',
  gallery: 'M3 6h9v12H3z M15 8h6v8h-6z M5.5 15l2-3 2 2 1-1',
});

/** hidden quality (0.05..1) of a snapshot, from its photo-shot descriptor; falls back to the sale value */
export function shotQuality(r) {
  const s = r.shot, vq = clamp(Math.log(1 + Math.max(0, Number(r.value) || 0)) / Math.log(300), 0, 1);
  if (!s || !Array.isArray(s.spots)) return clamp(0.08 + vq * 0.6, 0.05, 0.7);
  let animal = 0; const ids = new Set();
  for (const p of s.spots) {
    ids.add(p.id);
    animal = Math.max(animal, clamp((p.frac || 0) / 0.3, 0, 1) * (0.65 + 0.35 * (p.cent ?? 0.5)) * (p.rare ? 1.25 : 1) * (p.school ? 1.05 : 1));
  }
  animal = Math.min(1, animal);
  const variety = clamp((ids.size - 1) / 3, 0, 1), sharp = 1 - clamp(s.blur || 0, 0, 1);
  const extra = Math.min(1, ((s.landmarks || []).length) / 2) * 0.05 + (s.calf ? 0.03 : 0) + clamp((s.rays || 0) / 4, 0, 1) * 0.03 + clamp((s.stars || 0) / 3, 0, 1) * 0.05;
  const q = (0.1 + 0.3 * animal + 0.1 * variety + 0.3 * vq + extra) * (0.5 + 0.5 * sharp) * (1 - 0.3 * clamp(s.damage || 0, 0, 1));
  return clamp(q, 0.05, 1);
}

// ---- storage: frames (blobs) in IndexedDB, pin metadata in localStorage ----
let db = null, mem = new Map(), nextPid = 1, dbReady;
function openDb() {
  return new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'pid' });
      r.onsuccess = () => { db = r.result; res(); };
      r.onerror = r.onblocked = () => res();
    } catch { res(); }
  });
}
const tx = (mode, fn) => new Promise((res, rej) => { const t = db.transaction(ST, mode), r = fn(t.objectStore(ST)); t.oncomplete = () => res(r && r.result); t.onerror = t.onabort = () => rej(t.error); });
const putFrame = async (f) => { await dbReady; db ? await tx('readwrite', (s) => s.put(f)) : mem.set(f.pid, f); };
const getFrame = async (pid) => { await dbReady; return db ? tx('readonly', (s) => s.get(pid)) : mem.get(pid); };
const delFrame = async (pid) => { await dbReady; db ? await tx('readwrite', (s) => s.delete(pid)) : mem.delete(pid); };

let pins = [], earned = 0;   // pins: [{ pid, src, t, meta, q, species, cond }]
try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j) { pins = (j.pins || []).slice(0, MAX_PINS); earned = j.earned || 0; nextPid = Number(j.nextPid) || 1; } } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ pins, earned, nextPid })); } catch {} };
const srcKey = (r) => `${r.id}:${r.t}`;
const pinOf = (r) => pins.find((p) => p.src === srcKey(r));

// ---- visitors ----
let game, panel, acc = 0, sessionVisitors = 0, urls = [], pinBtn = null, viewRec = null;
const started = () => document.getElementById('intro')?.classList.contains('gone');

/** hidden gallery quality: sum of per-shot quality, a little extra for variety of species */
function quality() {
  const species = new Set(); for (const p of pins) for (const s of p.species || []) species.add(s);
  return pins.reduce((a, p) => a + p.q, 0) * (1 + 0.04 * Math.max(0, Math.min(species.size, 6) - 1));
}
/** one visitor wave: visitors × fee (modest: theoretical max ≈ 160 pearls per wave, i.e. under ~2k per hour; a typical wall pays ~500/h) */
function payout() {
  if (!pins.length) return 0;
  const G = quality(), avgQ = pins.reduce((a, p) => a + p.q, 0) / pins.length;
  const visitors = Math.max(1, Math.round(G * 3.2 * (0.85 + 0.3 * Math.random()))), fee = Math.round(2 + 4 * avgQ), amount = visitors * fee;
  sessionVisitors += visitors; earned += amount; game.wallet.add(amount); save();
  game.toast(`Gallery visitors left ◎${amount}`);
  if (panel && panel.isOpen) render();
  return amount;
}
/** advance the visitor timer by `dt` seconds of play (the game loop calls this; exported for tests) */
function tick(dt) {
  if (!pins.length) { acc = 0; return; }
  acc += dt;
  for (let i = 0; i < 12 && acc >= PAYOUT_EVERY; i++) { acc -= PAYOUT_EVERY; payout(); }
}

// ---- pinning ----
async function pin(r) {
  if (pinOf(r) || pins.length >= MAX_PINS) return false;
  const pid = nextPid++, meta = { pid, src: srcKey(r), t: r.t, meta: r.meta || '', q: shotQuality(r), species: (r.species || []).slice(0, 4) };
  await putFrame({ pid, full: r.full, thumb: r.thumb });
  pins.push(meta); save(); return true;
}
async function unpin(p) {
  pins = pins.filter((x) => x !== p); save(); await delFrame(p.pid);
  if (pinBtn && viewRec) updateBtn();
  if (panel && panel.isOpen) render();
}

function updateBtn() {
  if (!pinBtn || !viewRec) return;
  const on = !!pinOf(viewRec), full = pins.length >= MAX_PINS && !on;
  ib(pinBtn, on ? 'pinOff' : 'pin', on ? 'Unpin from the gallery' : full ? `Gallery wall is full (${MAX_PINS})` : `Pin to the gallery (${pins.length}/${MAX_PINS})`);
  pinBtn.disabled = full; pinBtn.classList.toggle('on', on);
}
function onView({ rec, bar, before }) {
  viewRec = rec;
  if (!pinBtn) {
    pinBtn = document.createElement('button'); pinBtn.id = 'viewPin';
    pinBtn.addEventListener('click', async () => {
      const r = viewRec; if (!r) return;
      const p = pinOf(r);
      if (p) { await unpin(p); game.toast('unpinned from the gallery'); }
      else if (await pin(r)) game.toast(`Pinned to the gallery (${pins.length}/${MAX_PINS})`);
      updateBtn();
    });
  }
  if (pinBtn.parentNode !== bar) bar.insertBefore(pinBtn, before);
  updateBtn();
}

// ---- panel ----
async function render() {
  const body = panel.body; for (const u of urls) URL.revokeObjectURL(u); urls = [];
  const wall = document.createElement('div'); wall.className = 'gl-wall';
  const frames = [];
  for (const p of pins.slice()) { const f = await getFrame(p.pid); if (!f) { pins = pins.filter((x) => x !== p); save(); continue; } frames.push([p, f]); }
  body.textContent = '';
  const head = document.createElement('div'); head.className = 'gl-head';
  head.innerHTML = `<span>Visitors this session: <b>${sessionVisitors}</b></span><span class="muted">${pins.length} / ${MAX_PINS} frames</span>`;
  body.appendChild(head);
  for (const [p, f] of frames) {
    const u = URL.createObjectURL(f.thumb); urls.push(u);
    const fr = document.createElement('figure'); fr.className = 'gl-frame';
    const im = document.createElement('div'); im.className = 'gl-img'; im.style.backgroundImage = `url(${u})`;
    im.addEventListener('click', () => lightbox(f.full));
    const cap = document.createElement('figcaption'); cap.innerHTML = `<b>${new Date(p.t).toLocaleDateString()}</b><span>${p.meta || ''}</span>`;
    const x = document.createElement('button'); x.className = 'ib gl-x'; ib(x, 'pinOff', 'Unpin'); x.addEventListener('click', () => unpin(p));
    fr.append(im, cap, x); wall.appendChild(fr);
  }
  for (let i = frames.length; i < MAX_PINS; i++) { const e = document.createElement('div'); e.className = 'gl-empty'; e.textContent = i === frames.length && !frames.length ? 'Pin snapshots from the album (pin button in the viewer)' : ''; wall.appendChild(e); }
  body.appendChild(wall);
  const note = document.createElement('p'); note.className = 'muted'; note.textContent = 'Visitors drop by while you dive and leave a small entry fee. Well-framed, sharp, rare and varied pictures draw more of them.'; body.appendChild(note);
}
function lightbox(blob) {
  const u = URL.createObjectURL(blob), o = document.createElement('div'); o.className = 'gl-light';
  o.innerHTML = `<img alt="pinned snapshot">`; o.firstChild.src = u;
  const close = () => { o.remove(); URL.revokeObjectURL(u); removeEventListener('keydown', key, true); };
  const key = (e) => { if (e.code === 'Escape') { close(); e.stopPropagation(); } };
  o.addEventListener('click', close); addEventListener('keydown', key, true); document.body.appendChild(o);
}

export const gallery = { pin, unpin, tick, payout, quality, shotQuality, render: () => render(), get pins() { return pins; }, get acc() { return acc; }, get visitors() { return sessionVisitors; }, get earned() { return earned; } };

export default {
  name: 'gallery',
  init(g) {
    game = g; g.gallery = gallery; window.__gallery = gallery; dbReady = openDb();
    addStyle(`.gl-head{display:flex;justify-content:space-between;align-items:baseline;margin:6px 0 12px}.gl-head b{color:#ffd21f;font-weight:500}
.gl-wall{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px;padding:16px;border-radius:16px;background:radial-gradient(120% 100% at 50% 0,#12384e,#082234)}
.gl-frame{margin:0;position:relative;background:#e9e1cf;padding:9px 9px 6px;border-radius:3px;box-shadow:0 6px 18px #0009,inset 0 0 0 3px #7a5a34}
.gl-img{aspect-ratio:4/3;background-size:cover;background-position:center;cursor:zoom-in;box-shadow:inset 0 0 0 1px #0006}
.gl-frame figcaption{display:flex;flex-direction:column;color:#2a2418;font-size:11px;padding:6px 2px 0;line-height:1.35}.gl-frame figcaption b{font-weight:600}
.gl-x{position:absolute;right:-8px;top:-8px;width:32px!important;height:32px!important;padding:0!important}
.gl-empty{aspect-ratio:4/3;border:2px dashed #9fe3ff33;border-radius:3px;display:grid;place-items:center;text-align:center;font-size:12px;opacity:.55;padding:12px}
.gl-light{position:fixed;inset:0;z-index:40;background:#020d16f5;display:grid;place-items:center;cursor:zoom-out}.gl-light img{max-width:96vw;max-height:94vh;object-fit:contain}
#viewPin.on{background:#ffd21f33!important}`);
    panel = addPanel('galleryPanel', 'Gallery');
    panel.onOpen = render;
    panel.onClose = () => { for (const u of urls) URL.revokeObjectURL(u); urls = []; };
    addTool('galleryBtn', 'gallery', 'Gallery', () => panel.open());
    g.bus.on('album:view', onView);
  },
  update(dt) { if (started()) tick(dt); },
};
