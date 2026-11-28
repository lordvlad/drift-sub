import * as THREE from 'three';
import { createField } from './world.js';
import { buildTemplates } from './templates.js';
import { Terrain, CS } from './terrain.js';
import { makeTerrainMaterial, makeDecorMaterial, shared } from './materials.js';
import { Sub } from './sub.js';
import { createSubModel } from './subs.js';
import { Fleet, SUBS } from './fleet.js';
import { ShopUI } from './shop.js';
import { Bubbles, Snow, Shafts, Surface } from './effects.js';
import { Fauna } from './fauna.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Weather } from './weather.js';
import { Daylight } from './daylight.js';
import { Store, AlbumUI, Wallet, MAX_SHOTS } from './album.js';
import { scorePhoto } from './photo.js';
import { drawCracks } from './cracks.js';
import { ib, svg } from './icons.js';
import { Bestiary } from './bestiary.js';
import { Encyclopedia } from './encyclopedia.js';
import { bus } from './bus.js';
import { addStyle } from './ui.js';
import { FEATURES } from './features.js';
import './groups/deep.js';   // dark-sea species (registers bestiary pages at import time)
import './groups/pelagic.js';   // open-ocean and cave / wreck species (registers bestiary pages at import time)

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) | 0 : (Math.random() * 1e9) | 0;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ---------- renderer / scene ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(devicePixelRatio || 1, 2);
const scene = new THREE.Scene();
scene.background = new THREE.Color(); scene.fog = new THREE.FogExp2(0x1d9fc0, 0.013);
const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 320);
const hemi = new THREE.HemisphereLight(0xa8ecff, 0x6a6a58, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4d8, 1.5); sun.position.set(0.3, 1, 0.2); scene.add(sun);

function resize() {
  renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const s = (innerHeight * pixelRatio * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  bubbles.uScale.value = s; snow.u.uScale.value = s;
}

// ---------- world ----------
const field = createField(seed);
const templates = buildTemplates();
const terrain = new Terrain(scene, field, templates, seed, makeTerrainMaterial(), makeDecorMaterial());
const fleet = new Fleet();
field.setProfile(fleet.active);   // the world is shaped for the active submarine kind (see biomes.js; swaps handled in features/places.js)
const models = {};   // one 3D model per sub, built on first use; only the active one is in the scene
const modelOf = (id) => models[id] ||= createSubModel(id);
let subModel = modelOf(fleet.active); scene.add(subModel.group);
const sub = new Sub(subModel); fleet.bind(sub);
let fst = fleet.stats(); sub.setStats(fst);   // effective stats of the active sub (upgrades included)
const bubbles = new Bubbles(scene), snow = new Snow(scene), shafts = new Shafts(scene), surface = new Surface(scene);
const quality = matchMedia('(pointer: coarse)').matches ? 0.7 : 1;
const fauna = new Fauna(scene, field, quality);
const audio = new Audio();
const weather = new Weather(() => {
  const auto = weather.mode === 'auto', st = weather.status;
  ib($('waveBtn'), weather.state, auto ? `Waves: auto — ${weather.state}${st === 'locating' ? ' (locating…)' : st === 'unavailable' ? ' (drifting, no weather data)' : ` (${st})`}. Click to override` : `Waves: ${weather.state}. Click to change`);
});

const [sx, sz] = field.findStart();
sub.pos.set(sx, Math.min(-12, field.heightAt(sx, sz) + 9), sz);
sub.yaw = Math.random() * 6.28;
terrain.update(sx, sz, 99);
fauna.init(sub);

// ---------- UI / input ----------
const ui = {
  joy: $('joy'), knob: $('knob'), btnUp: $('btnUp'), btnDown: $('btnDown'),
  applyMode(mode, touch) {
    document.body.classList.toggle('touch', touch);
    ib($('modeBtn'), touch ? 'touch' : 'keys', 'Controls: ' + (mode === 'auto' ? `auto (${touch ? 'touch' : 'keyboard + mouse'})` : mode === 'touch' ? 'touch' : 'keyboard + mouse') + '. Click to switch');
    setIntroText(touch);
  },
};
const input = new Input(canvas, ui);
function setIntroText(touch) {
  $('vfHint').textContent = touch ? 'drag to aim' : 'mouse / A D to aim · Space or Enter to shoot · Esc to exit' + (fst.zoomLevels.length > 1 ? ' · wheel or + − to zoom' : '');
  $('introText').innerHTML = touch
    ? `Left ${fst.lateral ? 'joystick: thrust forward &amp; reverse, strafe sideways' : 'lever: thrust forward &amp; reverse'}.<br>Drag anywhere else to steer left, right, up, down.<br>▲ ▼ rise and dive. The cart button is the shop. Nothing to find, nowhere to be.`
    : `<kbd>W</kbd> <kbd>S</kbd> thrust &nbsp; <kbd>A</kbd> <kbd>D</kbd> turn &nbsp; mouse to steer<br><kbd>Space</kbd> rise &nbsp; <kbd>C</kbd> dive &nbsp; <kbd>Shift</kbd> burst &nbsp; ${fst.lateral ? '<kbd>Q</kbd> <kbd>E</kbd> strafe &nbsp; ' : ''}${fst.hasLamp ? '<kbd>F</kbd> lamps &nbsp; ' : ''}<kbd>P</kbd> camera<br>Click to capture the mouse. Esc releases it. The cart button is the shop. Nothing to find, nowhere to be.`;
}
$('modeBtn').addEventListener('click', (e) => { input.cycleMode(); say(`controls: ${modeLabel()}`); e.currentTarget.blur(); });
// toggle feedback goes to the same quiet line as the other calming notes
let sayT = 0;
function say(msg, ms = 2600) { const h = $('hint'); h.textContent = msg; h.classList.add('fast', 'show'); clearTimeout(sayT); sayT = setTimeout(() => { h.classList.remove('show'); setTimeout(() => h.classList.remove('fast'), 300); }, ms); }
const modeLabel = () => input.mode === 'auto' ? `auto (${input.touchUI ? 'touch' : 'keyboard + mouse'})` : input.mode === 'touch' ? 'touch' : 'keyboard + mouse';
const waveLabel = () => weather.mode === 'auto' ? `auto (${weather.state})` : weather.mode;
const timeLabel = () => daylight.mode === 'auto' ? `auto (${daylight.phase})` : daylight.mode;
const soundIcon = () => ib($('soundBtn'), audio.muted ? 'soundOff' : 'soundOn', 'Sound: ' + (audio.muted ? 'off' : 'on'));
soundIcon();
$('soundBtn').addEventListener('click', (e) => { audio.setMuted(!audio.muted); soundIcon(); say(`sound ${audio.muted ? 'off' : 'on'}`); e.currentTarget.blur(); });
$('waveBtn').addEventListener('click', (e) => { weather.cycle(); say(`waves ${waveLabel()}`); e.currentTarget.blur(); });
weather.onChange();
const daylight = new Daylight(() => { const ph = daylight.phase; ib($('timeBtn'), { night: 'moon', dawn: 'sunrise', morning: 'sunrise', day: 'sun', evening: 'sunset' }[ph], daylight.mode === 'auto' ? `Time: auto (${ph}, your clock). Click to override` : `Time: ${daylight.mode}. Click to change`); });
daylight.onChange();
let lampMode = 'auto', lampLevel = 0;
const lampModes = () => fst.redLight ? ['auto', 'on', 'red', 'off'] : ['auto', 'on', 'off'];   // red-light filter adds a mode (equipment feature)
const lampLabel = () => { for (const id of ['lampBtn', 'vfLamp']) ib($(id), lampMode === 'on' ? 'lampOn' : lampMode === 'red' ? 'lampRed' : lampMode === 'off' ? 'lampOff' : 'lamp', `Lamps: ${lampMode} (F)`); };
const cycleLamps = () => { if (!fst.hasLamp) return; const m = lampModes(); lampMode = m[(m.indexOf(lampMode) + 1) % m.length]; lampLabel(); say(`lamps ${lampMode}`); };
lampLabel();
$('timeBtn').addEventListener('click', (e) => { daylight.cycle(); say(`time ${timeLabel()}`); e.currentTarget.blur(); });
$('lampBtn').addEventListener('click', (e) => { cycleLamps(); e.currentTarget.blur(); });
addEventListener('keydown', (e) => { if (e.code === 'KeyF' && !e.repeat) cycleLamps(); });
$('tools').addEventListener('pointerdown', (e) => e.stopPropagation());

let started = false;
$('go').disabled = false; $('go').textContent = 'DIVE';
$('go').addEventListener('click', () => {
  started = true; $('intro').classList.add('gone'); audio.start(); weather.start(); maybeSuggestFs();
  setTimeout(() => { $('hint').textContent = input.touchUI ? 'steer gently — the sea is in no hurry' : 'steer gently — the sea is in no hurry'; $('hint').classList.add('show'); setTimeout(() => { if (!$('hint').classList.contains('fast')) $('hint').classList.remove('show'); }, 7000); }, 2500);
});
if (params.has('skip')) { started = true; $('intro').classList.add('gone'); }
if (params.has('waves')) weather.setMode(params.get('waves')); else if (params.has('skip')) weather.start();

// ---------- snapshots (sub's point of view) ----------
const store = new Store(), wallet = new Wallet();
const toastEl = $('toast'); let toastT = 0;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600); }
let encyclopedia;
const bestiary = new Bestiary(() => encyclopedia && encyclopedia.changed(), wallet);   // Fauna tab: stars, grants, page unlocks
encyclopedia = new Encyclopedia(bestiary, { toast, onCount: (n) => ib($('bookBtn'), 'book', `Encyclopedia (${n} pages)`) });
$('bookBtn').addEventListener('click', (e) => { setViewfinder(false); encyclopedia.open(); e.currentTarget.blur(); });
const album = new AlbumUI(store, wallet, (n) => albumIcon(n), toast);
const albumIcon = (n) => { ib($('albumBtn'), 'album', `Album (${n})`); ib($('vfAlbum'), 'album', `Album (${n})`); };
albumIcon(0); store.list().then((l) => albumIcon(l.length));
ib($('vfExit'), 'close', 'Exit viewfinder (Esc)');
$('albumBtn').addEventListener('click', (e) => { album.open(); e.currentTarget.blur(); });
const shop = new ShopUI(fleet, wallet, { toast, onSwitch: (id) => swapSub(id) });
ib($('shopBtn'), 'cart', 'Shop');
$('shopBtn').addEventListener('click', (e) => { setViewfinder(false); shop.open(); e.currentTarget.blur(); });

// viewfinder mode: aim the sub (turn only, no thrust), then press the shutter
const VF_FOV = 58;
// zoom objective: 2x / 4x narrow the viewfinder so that the subject appears 2x / 4x larger (tan(fov/2) / zoom)
let zoom = 1, vfFovNow = VF_FOV, lastShot = null;
const zoomFov = (z) => THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(VF_FOV) / 2) / z));
const zoomLabel = () => ib($('vfZoom'), 'zoom', `Zoom ${zoom}× (click, mouse wheel or + / − to change)`);
function setZoom(z) {
  if (!fst.zoomLevels.includes(z)) z = 1;
  if (z === zoom) return;
  zoom = z; zoomLabel(); say(`zoom ${z}×`);
}
/** dir +1 / -1 steps within the owned levels; 0 cycles (and wraps) */
function stepZoom(dir) {
  const lv = fst.zoomLevels, i = lv.indexOf(zoom);
  if (lv.length < 2) return;
  setZoom(dir === 0 ? lv[(i + 1) % lv.length] : lv[Math.min(lv.length - 1, Math.max(0, i + dir))]);
}
let vf = false, vfBlend = 0, wantSnap = false, rt = null, snapBusy = false;
const vfEl = $('vf');
const vfCross = $('vfCross');
// motion gauge: how blurred a shot taken right now would be (the shutter is never blocked)
const motionGauge = (() => {
  addStyle(`#vfMotion{position:absolute;right:calc(4.5% + 14px);top:50%;transform:translateY(-50%);width:10px;height:120px;border:1px solid #ffffffaa;border-radius:6px;background:#0b2f4455;overflow:hidden;display:flex;align-items:flex-end}
#vfMotion i{display:block;width:100%;height:0;border-radius:5px;transition:background .2s}
#vfMotion::before,#vfMotion::after{content:'';position:absolute;left:0;right:0;border-top:1px solid #ffffff55}#vfMotion::before{top:33%}#vfMotion::after{top:66%}
#vfMotionIc{position:absolute;right:calc(4.5% + 8px);top:calc(50% + 74px);font-size:11px;opacity:.7;letter-spacing:.06em}`);
  const box = document.createElement('div'); box.id = 'vfMotion'; box.title = 'Motion: a taller bar means a blurrier shot';
  const fill = document.createElement('i'); box.appendChild(fill);
  const lab = document.createElement('div'); lab.id = 'vfMotionIc'; lab.textContent = 'motion';
  $('vf').append(box, lab);
  let cur = 0;
  return { set(b) {
    cur += (b - cur) * 0.35;
    fill.style.height = Math.round(Math.min(1, cur) * 100) + '%';
    fill.style.background = cur < 0.12 ? '#6be3a2' : cur < 0.4 ? '#ffd21f' : '#ff5d4d';
  } };
})();
function setViewfinder(on) {
  if (on === vf || (on && (!started || album.isOpen || shop.isOpen))) return;
  vf = on; document.body.classList.toggle('vf', on); vfEl.hidden = !on;
  if (on) { if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); fsBanner.hidden = true; }
  else if (zoom !== 1) { zoom = 1; zoomLabel(); }   // back out of the viewfinder = back to 1x
}
$('snapBtn').addEventListener('click', (e) => { setViewfinder(true); e.currentTarget.blur(); });
$('vfExit').addEventListener('click', () => setViewfinder(false));
$('vfAlbum').addEventListener('click', () => { setViewfinder(false); album.open(); });
$('vfLamp').addEventListener('click', (e) => { cycleLamps(); e.currentTarget.blur(); });
$('vfZoom').addEventListener('click', (e) => { stepZoom(0); e.currentTarget.blur(); });
let wheelT = 0;
addEventListener('wheel', (e) => {
  if (!vf || album.isOpen || shop.isOpen) return;
  e.preventDefault(); const now = performance.now(); if (now - wheelT < 160) return;
  wheelT = now; stepZoom(e.deltaY < 0 ? 1 : -1);
}, { passive: false });
$('shutter').addEventListener('click', (e) => { wantSnap = true; e.currentTarget.blur(); });
addEventListener('keydown', (e) => {
  if (album.isOpen || encyclopedia.isOpen || shop.isOpen || e.repeat) return;
  if (e.code === 'KeyP') setViewfinder(!vf);
  else if (vf && e.code === 'Escape') setViewfinder(false);
  else if (vf && (e.code === 'Enter' || e.code === 'Space')) wantSnap = true;
  else if (vf && (e.code === 'Equal' || e.code === 'NumpadAdd' || e.key === '+')) stepZoom(1);
  else if (vf && (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === '-')) stepZoom(-1);
});
// while framing a shot the sub may turn but never accelerates
const vfInput = {
  get thrust() { return 0; }, get turn() { return input.turn / zoom; }, rise: 0, strafe: 0, boost: false,   // while framing a shot the sub never moves sideways either
  get sens() { return input.sens * 0.55 / zoom; }, takeLookX: () => input.takeLookX(), takeLookY: () => input.takeLookY(),
};
const snapCam = new THREE.PerspectiveCamera(VF_FOV, 1, 0.1, 320), q180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const _eul = new THREE.Euler(0, 0, 0, 'YXZ'), _vq = new THREE.Quaternion(), _vp = new THREE.Vector3();
/** the sub's eye: front viewport, level horizon, looking where the nose points */
function vfPose(pos, quat) {
  pos.copy(sub.pos).addScaledVector(sub.fwd, 1.0); pos.y += 0.12;
  quat.setFromEuler(_eul.set(-sub.pitch, sub.yaw, 0)).multiply(q180);
}
const blobOf = (cv, q) => new Promise((res) => cv.toBlob(res, 'image/jpeg', q));
/** Motion blur of a shot taken right now: amount 0..1 (prices the shot) plus the smear vector in frame heights (dx, dy) and radial scale. */
function motionBlur(fovDeg) {
  const fovR = THREE.MathUtils.degToRad(fovDeg), ex = 0.05 / fovR, v = sub.vel;   // ~1/20 s exposure; narrow lenses (zoom) magnify every shake
  const lat = v.x * -Math.cos(sub.yaw) + v.z * Math.sin(sub.yaw);
  let dx = (sub.yawRate - lat / 12) * ex, dy = (sub.pitchRate + v.y / 12) * ex;   // scene moves opposite to the sub; nearby subject ~12 m
  const sp = clamp((sub.speed - 0.5) / 6, 0, 1), len = Math.hypot(dx, dy);
  const raw = Math.hypot(len / 0.04, sp * 0.9), amount = clamp((raw - 0.08) / 0.92, 0, 1);
  const k = len > 1e-6 ? Math.min(0.08, len * 1.2 + sp * 0.02) / len : 0;
  return { amount, dx: dx * k, dy: dy * k, zoom: clamp(sub.vf * 0.012, -0.05, 0.06) * (amount > 0 ? 1 : 0) };
}
/** average N shifted / scaled copies of the image: a directional + radial smear on the 2D canvas */
function smearCanvas(cv, b) {
  const w = cv.width, h = cv.height, len = Math.hypot(b.dx * h, b.dy * h) + Math.abs(b.zoom) * w * 0.5;
  if (len < 2.5) return;                       // sub-pixel shifts only soften the picture: leave it sharp
  const src = document.createElement('canvas'); src.width = w; src.height = h;
  src.getContext('2d').drawImage(cv, 0, 0);
  const N = clamp(Math.ceil(len / 2.5), 4, 24), c = cv.getContext('2d'), tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
  const tc = tmp.getContext('2d', { willReadFrequently: true }), acc = new Float32Array(w * h * 4);
  // average in float: summing 8-bit alpha blends instead leaves rounding noise ("grain") in smooth gradients
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1) - 0.5, s = 1 + b.zoom * t;
    tc.save(); tc.clearRect(0, 0, w, h); tc.translate(w / 2 + b.dx * h * t, h / 2 + b.dy * h * t); tc.scale(s, s); tc.drawImage(src, -w / 2, -h / 2); tc.restore();
    const d = tc.getImageData(0, 0, w, h).data;
    for (let k = 0; k < d.length; k++) acc[k] += d[k];
  }
  const out = c.createImageData(w, h), o = out.data, inv = 1 / N;
  for (let k = 0; k < o.length; k++) o[k] = acc[k] * inv + 0.5;
  c.putImageData(out, 0, 0);
}
/** mean luma 0..1 around a point of the (bottom-up) GL pixel buffer, NDC coordinates */
function lumaSampler(buf, w, h) {
  return (nx, ny, rad = 0.02) => {
    let s = 0, n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const px = Math.round(clamp((nx + i * rad + 1) / 2, 0, 1) * (w - 1)), py = Math.round(clamp((ny + j * rad + 1) / 2, 0, 1) * (h - 1)), o = (py * w + px) * 4;
      s += 0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2]; n++;
    }
    return s / n / 255;
  };
}
function captureSnapshot() {
  const maxSide = input.coarse ? 1440 : 1920, asp = innerWidth / innerHeight;
  const w = asp >= 1 ? maxSide : Math.round(maxSide * asp), h = asp >= 1 ? Math.round(maxSide / asp) : maxSide;
  if (!rt || rt.width !== w || rt.height !== h) {
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(w, h, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  }
  // camera at the sub's viewport, looking where the sub points
  const g = subModel.group; g.updateMatrixWorld(true);
  snapCam.fov = zoomFov(zoom); snapCam.aspect = w / h; snapCam.updateProjectionMatrix(); lastShot = { fov: snapCam.fov, zoom };
  vfPose(snapCam.position, snapCam.quaternion); snapCam.updateMatrixWorld(true);
  // hide the sub's own meshes (lights stay on); point sizes/uniforms are re-aimed at the snapshot camera
  const hidden = []; g.traverse((o) => { if (o.isMesh && o.visible) { o.visible = false; hidden.push(o); } });
  const ps = (h * 0.5) / Math.tan(THREE.MathUtils.degToRad(snapCam.fov) / 2), oldB = bubbles.uScale.value, oldS = snow.u.uScale.value;
  bubbles.uScale.value = ps; snow.u.uScale.value = ps;
  snow.u.uCam.value.copy(snapCam.position); shafts.u.uCam.value.copy(snapCam.position); surface.follow(snapCam.position);
  const flags = { strobe: false }; bus.emit('capture', { phase: 'before', cam: snapCam, flags });
  renderer.setRenderTarget(rt); renderer.render(scene, snapCam); renderer.setRenderTarget(null);
  bus.emit('capture', { phase: 'after' });
  for (const o of hidden) o.visible = true;
  bubbles.uScale.value = oldB; snow.u.uScale.value = oldS;
  const buf = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
  const meta = `${(-sub.pos.y).toFixed(0)} m deep · ${daylight.phase} · ${weather.state} seas`;
  const blur = motionBlur(snapCam.fov), damage = sub.damage;
  const score = scorePhoto({ camera: snapCam, fauna, terrain, field, shafts, daylight, depth: -sub.pos.y, damage, zoom, blur: blur.amount, profile: fleet.active,
    lit: lampLevel > 0.3, lamp: { level: lampLevel, mode: lampMode }, strobe: flags.strobe, sampleLuma: lumaSampler(buf, w, h) });
  return { buf, w, h, meta, score, damage, blur };
}
async function finishSnapshot({ buf, w, h, meta, score, damage, blur }) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const img = new ImageData(new Uint8ClampedArray(w * h * 4), w, h), row = w * 4;
  for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * row, (h - y) * row), y * row); // GL rows are bottom-up
  const cx2 = cv.getContext('2d'); cx2.putImageData(img, 0, 0);
  if (blur && blur.amount > 0.05) smearCanvas(cv, blur);   // moving sub: smeared picture (priced via score.shot.blur)
  drawCracks(cx2, w, h, damage);   // a damaged sub has a cracked lens
  const tw = 320, th = Math.round(320 * h / w), tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
  tc.getContext('2d').drawImage(cv, 0, 0, tw, th);
  const [full, thumb] = await Promise.all([blobOf(cv, 0.9), blobOf(tc, 0.8)]);
  // Fauna pages: crop each animal out of the (possibly cracked) snapshot
  const fresh = bestiary.record(score.spots.filter((p) => p.frac >= 0.03).map(   // must be recognisable: >= 3% of frame height
    (p) => ({ id: p.id, frac: p.frac, crop: () => {
    const ch = Math.min(h, Math.max(h * 0.3, p.frac * h * (p.school ? 3.2 : 1.7))), cw = Math.min(w, ch * 4 / 3);
    const sx = Math.min(w - cw, Math.max(0, (p.x + 1) / 2 * w - cw / 2)), sy = Math.min(h - ch, Math.max(0, (1 - p.y) / 2 * h - ch / 2));
    const c = document.createElement('canvas'); c.width = 520; c.height = 390; const cc = c.getContext('2d'); cc.imageSmoothingQuality = 'high'; cc.drawImage(cv, sx, sy, cw, ch, 0, 0, 520, 390);
    return c.toDataURL('image/jpeg', 0.84);
  } })), score.shot);
  try { const rec = { t: Date.now(), full, thumb, meta, value: score.value, key: score.key, items: score.items, species: score.species, shot: score.shot };
    await store.add(rec); bus.emit('snapshot', { rec, shot: score.shot, score, zoom: lastShot ? lastShot.zoom : 1 }); const n = (await store.list()).length; albumIcon(n); toast((fresh.length ? fresh.join(' · ') : `Snapshot saved${score.species.length ? ' · ' + score.species.slice(0, 3).join(', ') : ''} · ${n} / ${MAX_SHOTS}`) + (rec.commission ? ' · fulfils a commission' : '')); }
  catch { toast('Could not save snapshot (storage full?)'); }
}

// ---------- fullscreen suggestion ----------
const fsEl = document.documentElement, fsOK = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
const inFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const fsBanner = $('fsBanner');
function maybeSuggestFs() {
  if (!fsOK || inFs() || localStorage.getItem('drift-fs-dismissed')) return;
  setTimeout(() => { if (!inFs()) fsBanner.hidden = false; }, 4000);
  setTimeout(() => { fsBanner.hidden = true; }, 24000);
}
$('fsGo').addEventListener('click', () => { (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl).catch(() => {}); fsBanner.hidden = true; });
$('fsX').addEventListener('click', () => { fsBanner.hidden = true; try { localStorage.setItem('drift-fs-dismissed', '1'); } catch {} });
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => { if (inFs()) fsBanner.hidden = true; });
fsBanner.addEventListener('pointerdown', (e) => e.stopPropagation());

// ---------- camera rig ----------
const cam = { yaw: sub.yaw, pitch: 0, pos: new THREE.Vector3(), look: new THREE.Vector3() };
const camDesired = new THREE.Vector3();
function angLerp(a, b, k) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; }
{
  const cp = Math.cos(0.1);
  cam.pos.set(sub.pos.x - Math.sin(sub.yaw) * 6, sub.pos.y + 1.6, sub.pos.z - Math.cos(sub.yaw) * 6);
}

const tmpC = new THREE.Color();
function updateWater(camY, dt) {
  const W = weather.cur, L = daylight.cur, d = clamp(-camY / 80, 0, 1), k = Math.pow(d, 0.7);
  daylight.update(dt);
  tmpC.copy(L.shallow).lerp(L.deep, k);
  scene.background.copy(tmpC); scene.fog.color.copy(tmpC);
  scene.fog.density = 0.0125 + 0.003 * k;
  hemi.intensity = L.hemiI * W.dim * (1 - 0.55 * k); hemi.color.copy(L.sky).lerp(tmpC, 0.2);
  sun.intensity = L.sunI * W.dim * (1 - 0.8 * k); sun.color.copy(L.sun);
  const lampTarget = !fst.hasLamp ? 0 : lampMode === 'on' || lampMode === 'red' ? 1 : lampMode === 'off' ? 0 : clamp(k * 1.5 - 0.1 + daylight.darkness * 1.3, 0, 1);
  lampLevel += (lampTarget - lampLevel) * (1 - Math.exp(-dt * 3)); subModel.setLamps(lampLevel);
  surface.u.uFog.value.copy(tmpC); surface.u.uDensity.value = scene.fog.density;
  shafts.u.uInt.value = L.shaft * (1 - 0.75 * k) * (W.dim < 0.7 ? 0.5 : 1) * (1 + W.gust * 0.3);
  const su = surface.u; su.uAmp.value = W.amp; su.uFreq.value = W.freq; su.uSpeed.value = W.speed; su.uGust.value = W.gust;
  shared.uSwayK.value = W.sway; su.uLight.value.copy(L.surf).multiplyScalar(W.dim);
  shafts.u.uSun.value.set(L.lean * 0.6, -1, 0.12).normalize(); shafts.u.uCol.value.copy(L.sun).lerp(new THREE.Color(0x8fe6ff), 0.45);
  snow.u.uBright.value = 1 - 0.6 * k;
  shafts.mesh.visible = shafts.u.uInt.value > 0.003;
}

// ---------- depth gauge ----------
const gTicks = $('gTicks'), gMark = $('gMark'), gauge = $('gauge');
let gShown = '', gaugeMax = 0;
/** the scale always spans 0 .. the active sub's maximum dive depth (rebuilt when the sub or its hull changes) */
function buildGauge(maxD) {
  gaugeMax = maxD; gShown = ''; gTicks.textContent = '';
  for (let m = 0; m <= maxD; m += 5) {
    const t = document.createElement('div'); t.style.top = (m / maxD * 100) + '%'; if (m % 10 === 0) { t.className = 'maj'; if (m) t.innerHTML = `<span>${m}m</span>`; }
    gTicks.appendChild(t);
  }
}
function updateGauge() {
  const d = clamp(-sub.pos.y, 0, gaugeMax);
  gMark.style.top = (d / gaugeMax * 100) + '%';
  const txt = d.toFixed(1), red = sub.limit > 0.01;
  if (txt !== gShown) { gShown = txt; $('gVal').textContent = '-' + txt + 'm'; $('gNow').textContent = Math.round(d) + 'm'; }
  gauge.classList.toggle('red', red);
  const em = Math.round(sub.maxDepth);
  $('gDanger').style.height = ((gaugeMax - sub.maxDepth + 8) / gaugeMax * 100) + '%';
  $('gMax').textContent = em + 'm' + (em < gaugeMax - 1 ? ' (damaged)' : '') + (sub.limit > 0.95 ? ' — limit reached' : '');
}

// ---------- fleet wiring: active stats, model swap, shop-driven controls ----------
function applyFleet() {
  fst = fleet.stats(); sub.setStats(fst);
  if (fst.maxDepth !== gaugeMax) buildGauge(fst.maxDepth);
  input.setLateral(fst.lateral);
  if (lampMode === 'red' && !fst.redLight) { lampMode = 'on'; lampLabel(); }
  for (const id of ['lampBtn', 'vfLamp']) $(id).hidden = !fst.hasLamp;   // no flashlight yet: no lamp buttons, F does nothing
  $('vfZoom').hidden = fst.zoomLevels.length < 2; if (!fst.zoomLevels.includes(zoom)) zoom = 1; zoomLabel();
  $('swapBtn').hidden = fleet.owned.length < 2;
  ib($('swapBtn'), 'swap', `Switch submarine (now ${fst.name})`);
  setIntroText(input.touchUI);
}
const note = (m) => shop.isOpen ? toast(m) : say(m);   // the quiet line sits under the shop overlay
/** Swap the active submarine: new model in place (position, heading and velocity kept), new stats, items and damage. */
function swapSub(id) {
  if (id === fleet.active || !fleet.owns(id)) return false;
  const to = SUBS[id], limit = fleet.stats(id).maxDepth * (1 - 0.6 * fleet.damageOf(id));
  if (-sub.pos.y > limit - 3) { note(`too deep for ${to.name} — rise first`); return false; }
  const old = subModel; old.setHidden(false); old.setLamps(0); scene.remove(old.group);
  subModel = modelOf(id); scene.add(subModel.group);
  subModel.group.position.copy(old.group.position); subModel.group.rotation.copy(old.group.rotation);
  sub.setModel(subModel);
  fleet.switchTo(id);   // moves hull damage to the new sub, then applyFleet() applies its stats
  lampLevel = 0;
  note(`sub: ${to.name}`);
  bus.emit('swap', { id });
  return true;
}
fleet.onChange(applyFleet);
$('swapBtn').addEventListener('click', (e) => { swapSub(fleet.next()); e.currentTarget.blur(); });
buildGauge(fst.maxDepth); applyFleet();

// ---------- loop ----------
const hurtEl = $('hurt'); let seenHits = 0, crackKey = '';
let last = performance.now(), fpsAcc = 0, fpsN = 0, lowTime = 0;
const _tmp = new THREE.Vector3(); let baseFov = 62;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.1) dt = 0.1;
  shared.uTime.value += dt;
  const t = shared.uTime.value;

  const inp = !started ? idleInput : vf ? vfInput : input;
  // dynamic resolution
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 2) {
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    if (fps < 40 && pixelRatio > 0.8) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); resize(); }
    else if (fps > 58 && pixelRatio < Math.min(devicePixelRatio || 1, 2) - 0.01) { lowTime += 1; if (lowTime > 3) { pixelRatio = Math.min(Math.min(devicePixelRatio || 1, 2), pixelRatio + 0.25); lowTime = 0; resize(); } }
  }

  sub.update(dt, inp, terrain, field, fauna);
  terrain.update(sub.pos.x, sub.pos.z, 1);
  fauna.profile = fleet.active;
  fauna.update(dt, sub, daylight.phase);
  bubbles.update(dt, t, sub.propPos, sub);

  // camera: lags the sub's heading, pulls back with speed
  cam.yaw = angLerp(cam.yaw, sub.yaw, 1 - Math.exp(-dt * 2.2));
  cam.pitch += (sub.pitch * 0.55 - cam.pitch) * (1 - Math.exp(-dt * 2));
  // portrait screens see far less sideways, so pull the camera back to keep the sub (and its surroundings) framed
  const portrait = camera.aspect < 1 ? Math.pow(1 / camera.aspect, 0.7) : 1;
  const dist = (5.6 + sub.speed * 0.22) * portrait, cp = Math.cos(cam.pitch);
  camDesired.set(sub.pos.x - Math.sin(cam.yaw) * cp * dist, sub.pos.y + Math.sin(cam.pitch) * dist + 1.5, sub.pos.z - Math.cos(cam.yaw) * cp * dist);
  cam.pos.lerp(camDesired, 1 - Math.exp(-dt * 5));
  const gh = field.heightAt(cam.pos.x, cam.pos.z) + 1.0;
  if (cam.pos.y < gh) cam.pos.y = gh;
  const crest = weather.cur.amp * (1 + weather.cur.gust);
  sub.ceil = -2.4 - crest;
  if (cam.pos.y > -1.2 - crest) cam.pos.y = -1.2 - crest;
  camera.position.copy(cam.pos);
  _tmp.copy(sub.pos).addScaledVector(sub.fwd, 3.2); _tmp.y += 0.2;
  cam.look.lerp(_tmp, 1 - Math.exp(-dt * 8));
  camera.lookAt(cam.look);
  baseFov += ((62 + Math.min(8, sub.speed * 0.8)) - baseFov) * 0.1;
  // viewfinder: glide from the chase camera into the sub's own eye
  vfBlend += ((vf ? 1 : 0) - vfBlend) * (1 - Math.exp(-dt * 7));
  if (vfBlend < 0.002) vfBlend = 0; else if (vfBlend > 0.998) vfBlend = 1;
  if (vfBlend > 0) {
    vfPose(_vp, _vq);
    camera.position.lerp(_vp, vfBlend); camera.quaternion.slerp(_vq, vfBlend);
  }
  subModel.setHidden(vfBlend > 0.75);
  vfFovNow += (zoomFov(zoom) - vfFovNow) * (1 - Math.exp(-dt * 10));
  const fov = baseFov + (vfFovNow - baseFov) * vfBlend;
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (vf) {   // blur-risk hint: the crosshair ring trembles and widens while the shot would come out smeared
    const b = motionBlur(camera.fov).amount, cross = vfCross;
    cross.style.transform = b > 0.08 ? `translate(${((Math.random() - 0.5) * b * 8).toFixed(1)}px, ${((Math.random() - 0.5) * b * 8).toFixed(1)}px) scale(${(1 + b * 0.7).toFixed(2)})` : '';
    cross.style.opacity = (1 - 0.5 * b).toFixed(2);
    motionGauge.set(b);
  }

  weather.update(dt);
  updateWater(camera.position.y, dt);
  surface.follow(camera.position);
  snow.u.uCam.value.copy(camera.position); shafts.u.uCam.value.copy(camera.position);
  audio.update(dt, sub, fauna.whaleLevel);
  if (wantSnap) {
    { wantSnap = false;
    if (started && vf && vfBlend > 0.95 && !snapBusy && !album.isOpen) {
      snapBusy = true; const fl = $('flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
      const shot = captureSnapshot();
      snow.u.uCam.value.copy(camera.position); shafts.u.uCam.value.copy(camera.position); surface.follow(camera.position);
      finishSnapshot(shot).finally(() => { snapBusy = false; });
    } }
  }

  updateGauge();
  // damage feedback: red glow growing from the screen edges (no health bar), thump + shake on impact
  if (sub.hitCount !== seenHits) { seenHits = sub.hitCount; audio.thud(sub.hitSev); }
  const glow = clamp(sub.damage * 1.6 + sub.hurtFlash * 0.55 + sub.scrape * 0.12, 0, 1);
  hurtEl.style.opacity = (glow * (sub.damage > 0.4 ? 0.9 + 0.1 * Math.sin(t * 2.4) : 1)).toFixed(3);
  if (sub.hurtFlash > 0.02) { const k = sub.hurtFlash * sub.hurtFlash * 0.12; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; }
  if (vf) { const q = Math.round(sub.damage * 100) + ':' + innerWidth + 'x' + innerHeight; if (q !== crackKey) { crackKey = q; const c = $('vfCracks'); c.width = innerWidth; c.height = innerHeight; drawCracks(c.getContext('2d'), c.width, c.height, sub.damage); } }
  if (vf) { $('vfDepth').textContent = `${(-sub.pos.y).toFixed(0)} m · ${daylight.phase}${zoom !== 1 ? ` · ${zoom}×` : ''}`; }
  $('speed').textContent = `speed ${(sub.speed * 1.94).toFixed(1)} kn`;
  bus.emit('frame', { dt, t });
  for (const f of FEATURES) if (f.update) f.update(dt, game);
  renderer.render(scene, camera);
}
const idleInput = { thrust: 0, turn: 0, rise: 0, boost: false, sens: 0, takeLookX: () => 0, takeLookY: () => 0 };
resize(); addEventListener('resize', resize);
// plug-in features (src/features.js) get the whole game state
const game = { THREE, scene, camera, renderer, canvas, field, terrain, fauna, sub, fleet, wallet, album, store, bestiary, encyclopedia, daylight, weather, audio, input,
  bubbles, snow, shafts, surface, say, toast, bus, params, get subModel() { return subModel; }, get viewfinder() { return vf; }, get zoom() { return zoom; },
  get lampLevel() { return lampLevel; }, get lampMode() { return lampMode; } };
window.__game = game;
for (const f of FEATURES) f.init(game);
requestAnimationFrame((n) => { last = n; frame(n); });
window.__sim = { smearCanvas,
  bestiary, encyclopedia, drawCracks, setViewfinder, scorePhoto, album, wallet, store, weather, sub, fauna, terrain, field, camera, scene, input, renderer, seed,
  fleet, shop, swapSub, setZoom, stepZoom, snapCam, captureSnapshot, finishSnapshot, motionBlur,
  get zoom() { return zoom; }, get lastShot() { return lastShot; }, get stats() { return fst; },
};

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !params.has('nosw')) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
