import { ib, registerIcons } from './icons.js';
export { registerIcons };

let styleEl;
/** Inject CSS from JS (features must not edit the big <style> in index.html). */
export function addStyle(css) {
  if (!styleEl) { styleEl = document.createElement('style'); styleEl.dataset.features = ''; document.head.appendChild(styleEl); }
  styleEl.textContent += '\n' + css;
}

/** Add a round icon button to the top bar (#tools). Returns the button. `iconName` must exist in icons.js (see registerIcons). */
export function addTool(id, iconName, title, onClick, { before = 'timeBtn' } = {}) {
  const tools = document.getElementById('tools');
  const b = document.createElement('button'); b.id = id; ib(b, iconName, title);
  b.addEventListener('click', (e) => { onClick(e); e.currentTarget.blur(); });
  const ref = before && document.getElementById(before);
  ref && ref.parentNode === tools ? tools.insertBefore(b, ref) : tools.appendChild(b);
  return b;
}

/**
 * Full-screen panel in the album/bestiary style (z-index 20, closes with Esc / its X).
 * Returns { root, bar, body, open(), close(), isOpen }. Put your DOM into `body` (scrolls vertically).
 */
export function addPanel(id, title) {
  addStyle(`.fpanel{position:fixed;inset:0;z-index:20;background:#031420f2;backdrop-filter:blur(8px);display:flex;flex-direction:column;touch-action:auto;user-select:text;-webkit-user-select:text}
.fpanel[hidden]{display:none}.fpanel .fbar{display:flex;align-items:center;gap:10px;padding:12px 16px;font-size:14px}.fpanel .fbar .sp{flex:1}
.fpanel .fbody{flex:1;overflow-y:auto;padding:4px 18px 40px;max-width:900px;width:100%;margin:0 auto;box-sizing:border-box;touch-action:pan-y;line-height:1.5;font-size:14px}
.fpanel button{font:inherit;color:#dff6ff;background:#ffffff1a;border:1px solid #9fe3ff33;cursor:pointer;border-radius:999px;padding:7px 14px}
.fpanel button.primary{background:#ffd21f;color:#06222f;border:0}.fpanel button:disabled{opacity:.45;cursor:default}
.fpanel h3{margin:18px 0 6px;font-weight:500;font-size:18px}.fpanel .muted{opacity:.65;font-size:12px}.fpanel .gold{color:#ffd21f}`);
  const root = document.createElement('div'); root.id = id; root.className = 'fpanel'; root.hidden = true;
  const bar = document.createElement('div'); bar.className = 'fbar';
  const h = document.createElement('b'); h.textContent = title; const sp = document.createElement('span'); sp.className = 'sp';
  const x = document.createElement('button'); x.id = id + 'Close'; ib(x, 'close', 'Close'); x.classList.add('ib');
  bar.append(h, sp, x);
  const body = document.createElement('div'); body.className = 'fbody';
  root.append(bar, body); document.body.appendChild(root);
  const api = { root, bar, body, titleEl: h, get isOpen() { return !root.hidden; },
    open() { if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); root.hidden = false; api.onOpen && api.onOpen(); },
    close() { root.hidden = true; api.onClose && api.onClose(); } };
  x.addEventListener('click', () => api.close());
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !root.hidden) { api.close(); e.stopPropagation(); } }, true);
  return api;
}
