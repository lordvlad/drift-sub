import { addStyle, registerIcons } from '../ui.js';
import { ib } from '../icons.js';

/** Title-screen extras: a heart button (PayPal donation, SDK loaded only on demand) and a link to the source repository. */
const REPO = 'https://github.com/lordvlad/drift-sub';
const PAYPAL_SDK = 'https://www.paypal.com/sdk/js?client-id=BAA3I7Ebq_jrRrnlIQTorf96Vylh95OQRNrqVHNIKrAZwR_W_TSGVwxmFpKQHdeP5y6_VcXKmOZ57oqBc8&components=hosted-buttons&disable-funding=venmo&currency=EUR';
const BTN_ID = '7TRVZVKH42ZM6';

registerIcons({
  heart: 'M12 20.5C5 15.5 3 12 3 8.6 3 6 5 4 7.5 4c1.8 0 3.4 1 4.5 2.6C13.1 5 14.7 4 16.5 4 19 4 21 6 21 8.6c0 3.4-2 6.9-9 11.9z',
  github: 'M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
});

export default {
  name: 'donate',
  init() {
    addStyle(`#introLinks{display:flex;gap:14px;align-items:center;justify-content:center;margin-top:6px}
#introLinks .ib{width:44px;height:44px;border-radius:50%;background:#ffffff18;border:1px solid #ffffff44;color:#ffd6e4;cursor:pointer;display:inline-grid;place-items:center;padding:0;text-decoration:none}
#introLinks .ib:hover{background:#ffffff2c}#introLinks #heartBtn{color:#ff7aa8}#introLinks a.ib{color:#dff6ff}
#donate{position:fixed;inset:0;z-index:40;background:#031420dd;backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px}
#donate[hidden]{display:none}
#donate .card{position:relative;width:min(420px,100%);max-height:100%;overflow:auto;touch-action:pan-y;background:#0b2f44;border:1px solid #9fe3ff44;border-radius:18px;padding:26px 22px 22px;text-align:center;line-height:1.55;font-size:14px;user-select:text;-webkit-user-select:text}
#donate h2{margin:6px 0 8px;font-weight:500;font-size:22px}#donate p{margin:6px 0;opacity:.85}
#donate .big{width:54px;height:54px;color:#ff7aa8;margin:0 auto}
#donate #donateX{position:absolute;top:10px;right:10px;width:40px;height:40px;border-radius:50%;background:#ffffff1a;border:1px solid #9fe3ff33;color:#dff6ff;cursor:pointer;display:grid;place-items:center;padding:0}
#donate #donateNote{font-weight:600}#donate a{color:#9fe3ff}#donatePay{margin-top:12px;min-height:50px}`);
    const intro = document.getElementById('intro'); if (!intro) return;
    const row = document.createElement('div'); row.id = 'introLinks';
    const heart = document.createElement('button'); heart.id = 'heartBtn'; ib(heart, 'heart', 'Support Drift with a donation');
    const gh = document.createElement('a'); gh.className = 'ib'; gh.href = REPO; gh.target = '_blank'; gh.rel = 'noopener'; ib(gh, 'github', 'Source code on GitHub');
    row.append(heart, gh); intro.appendChild(row);

    const box = document.createElement('div'); box.id = 'donate'; box.hidden = true;
    box.innerHTML = `<div class="card"><button id="donateX" aria-label="Close"></button>
      <svg class="big" viewBox="0 0 24 24" fill="#ff7aa8" stroke="#ff7aa8" stroke-width="1.6" stroke-linejoin="round"><path d="${'M12 20.5C5 15.5 3 12 3 8.6 3 6 5 4 7.5 4c1.8 0 3.4 1 4.5 2.6C13.1 5 14.7 4 16.5 4 19 4 21 6 21 8.6c0 3.4-2 6.9-9 11.9z'}"/></svg>
      <h2>Thank you for diving</h2>
      <p>Drift is free, has no ads and no tracking. If it made a quiet moment brighter, you can chip in a little for its upkeep. Nothing in the game depends on it.</p>
      <div id="donatePay"><div id="paypal-container-${BTN_ID}"></div></div><p id="donateNote" hidden></p>
      <p class="muted" style="font-size:12px">Payment is handled by PayPal in a separate window; the PayPal script only loads when you open this. Source code: <a href="${REPO}" target="_blank" rel="noopener">${REPO.replace('https://', '')}</a></p></div>`;
    document.body.appendChild(box);
    ib(box.querySelector('#donateX'), 'close', 'Close');
    const note = (t) => { const n = box.querySelector('#donateNote'); n.textContent = t; n.hidden = !t; };
    let state = 'idle';
    function load() {
      if (state !== 'idle') return;
      if (!navigator.onLine) return note('You are offline. Connect to the internet to donate.');
      state = 'loading'; note('Loading…');
      const fail = () => { state = 'idle'; note('PayPal could not be loaded. Please try again later, or use the link on the project page.'); };
      const s = document.createElement('script'); s.src = PAYPAL_SDK;
      s.onload = () => { window.paypal.HostedButtons({ hostedButtonId: BTN_ID }).render('#paypal-container-' + BTN_ID).then(() => { state = 'ready'; note(''); }).catch(fail); };
      s.onerror = () => { s.remove(); fail(); };
      document.head.append(s);
    }
    const close = () => { box.hidden = true; };
    heart.addEventListener('click', () => { box.hidden = false; load(); });
    box.querySelector('#donateX').addEventListener('click', close);
    box.addEventListener('pointerdown', (e) => { if (e.target === box) close(); });
    addEventListener('keydown', (e) => { if (e.code === 'Escape' && !box.hidden) { close(); e.stopPropagation(); } }, true);
  },
};
