import * as THREE from 'three';
import { createField } from './world.js';
import { buildTemplates } from './templates.js';
import { Terrain, CS } from './terrain.js';
import { makeTerrainMaterial, makeDecorMaterial, shared } from './materials.js';
import { createSubModel, Sub, MAX_DEPTH } from './sub.js';
import { Bubbles, Snow, Shafts, Surface } from './effects.js';
import { Fauna } from './fauna.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Weather } from './weather.js';
import { Daylight } from './daylight.js';
import { Store, AlbumUI, MAX_SHOTS } from './album.js';

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
const subModel = createSubModel(); scene.add(subModel.group);
const sub = new Sub(subModel);
const bubbles = new Bubbles(scene), snow = new Snow(scene), shafts = new Shafts(scene), surface = new Surface(scene);
const quality = matchMedia('(pointer: coarse)').matches ? 0.7 : 1;
const fauna = new Fauna(scene, field, quality);
const audio = new Audio();
const weather = new Weather(() => {
  $('waveBtn').textContent = 'Waves: ' + (weather.mode === 'auto' ? `auto (${weather.state}${weather.status === 'locating' ? '…' : weather.status === 'unavailable' ? ', drifting' : ''})` : weather.mode);
  $('waveBtn').title = weather.mode === 'auto' ? 'Sea state from local wind: ' + weather.status : 'Manual sea state';
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
    $('modeBtn').textContent = 'Controls: ' + (mode === 'auto' ? `auto (${touch ? 'touch' : 'keys'})` : mode === 'touch' ? 'touch' : 'keys + mouse');
    setIntroText(touch);
  },
};
const input = new Input(canvas, ui);
function setIntroText(touch) {
  $('introText').innerHTML = touch
    ? 'Left stick: forward &amp; back.<br>Drag anywhere else to steer left, right, up, down.<br>▲ ▼ rise and dive. Nothing to find, nowhere to be.'
    : '<kbd>W</kbd> <kbd>S</kbd> thrust &nbsp; <kbd>A</kbd> <kbd>D</kbd> turn &nbsp; mouse to steer<br><kbd>Space</kbd> rise &nbsp; <kbd>C</kbd> dive &nbsp; <kbd>Shift</kbd> burst &nbsp; <kbd>F</kbd> lamps<br>Click to capture the mouse. Esc releases it. Nothing to find, nowhere to be.';
}
$('modeBtn').addEventListener('click', (e) => { input.cycleMode(); e.target.blur(); });
$('soundBtn').addEventListener('click', (e) => { audio.setMuted(!audio.muted); e.target.textContent = 'Sound: ' + (audio.muted ? 'off' : 'on'); e.target.blur(); });
$('waveBtn').addEventListener('click', (e) => { weather.cycle(); e.target.blur(); });
weather.onChange();
const daylight = new Daylight(() => { $('timeBtn').textContent = 'Time: ' + (daylight.mode === 'auto' ? `auto (${daylight.phase})` : daylight.mode); });
daylight.onChange();
const LAMP_MODES = ['auto', 'on', 'off']; let lampMode = 'auto', lampLevel = 0;
const lampLabel = () => { $('lampBtn').textContent = 'Lamps: ' + lampMode; };
const cycleLamps = () => { lampMode = LAMP_MODES[(LAMP_MODES.indexOf(lampMode) + 1) % 3]; lampLabel(); };
lampLabel();
$('timeBtn').addEventListener('click', (e) => { daylight.cycle(); e.target.blur(); });
$('lampBtn').addEventListener('click', (e) => { cycleLamps(); e.target.blur(); });
addEventListener('keydown', (e) => { if (e.code === 'KeyF' && !e.repeat) cycleLamps(); });
$('tools').addEventListener('pointerdown', (e) => e.stopPropagation());

let started = false;
$('go').disabled = false; $('go').textContent = 'DIVE';
$('go').addEventListener('click', () => {
  started = true; $('intro').classList.add('gone'); audio.start(); weather.start(); maybeSuggestFs();
  setTimeout(() => { $('hint').textContent = input.touchUI ? 'steer gently — the sea is in no hurry' : 'steer gently — the sea is in no hurry'; $('hint').classList.add('show'); setTimeout(() => $('hint').classList.remove('show'), 7000); }, 2500);
});
if (params.has('skip')) { started = true; $('intro').classList.add('gone'); }
if (params.has('waves')) weather.setMode(params.get('waves')); else if (params.has('skip')) weather.start();

// ---------- snapshots (sub's point of view) ----------
const store = new Store();
const album = new AlbumUI(store, (n) => { $('albumBtn').textContent = `Album (${n})`; });
store.list().then((l) => { $('albumBtn').textContent = `Album (${l.length})`; });
$('albumBtn').addEventListener('click', (e) => { album.open(); e.target.blur(); });
$('snapBtn').addEventListener('click', (e) => { wantSnap = true; e.target.blur(); });
$('snapBtn').addEventListener('pointerdown', (e) => e.stopPropagation());
addEventListener('keydown', (e) => { if (e.code === 'KeyP' && !e.repeat && !album.isOpen) wantSnap = true; });
let wantSnap = false, rt = null, snapBusy = false;
const snapCam = new THREE.PerspectiveCamera(72, 1, 0.1, 320), q180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const toastEl = $('toast'); let toastT = 0;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2200); }
const blobOf = (cv, q) => new Promise((res) => cv.toBlob(res, 'image/jpeg', q));
function captureSnapshot() {
  const maxSide = input.coarse ? 1440 : 1920, asp = innerWidth / innerHeight;
  const w = asp >= 1 ? maxSide : Math.round(maxSide * asp), h = asp >= 1 ? Math.round(maxSide / asp) : maxSide;
  if (!rt || rt.width !== w || rt.height !== h) {
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(w, h, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  }
  // camera at the sub's viewport, looking where the sub points
  const g = subModel.group; g.updateMatrixWorld(true);
  snapCam.aspect = w / h; snapCam.updateProjectionMatrix();
  g.localToWorld(snapCam.position.set(0, 0.15, 1.0));
  snapCam.quaternion.copy(g.quaternion).multiply(q180); snapCam.updateMatrixWorld(true);
  // hide the sub's own meshes (lights stay on); point sizes/uniforms are re-aimed at the snapshot camera
  const hidden = []; g.traverse((o) => { if (o.isMesh && o.visible) { o.visible = false; hidden.push(o); } });
  const ps = (h * 0.5) / Math.tan(THREE.MathUtils.degToRad(snapCam.fov) / 2), oldB = bubbles.uScale.value, oldS = snow.u.uScale.value;
  bubbles.uScale.value = ps; snow.u.uScale.value = ps;
  snow.u.uCam.value.copy(snapCam.position); shafts.u.uCam.value.copy(snapCam.position); surface.follow(snapCam.position);
  renderer.setRenderTarget(rt); renderer.render(scene, snapCam); renderer.setRenderTarget(null);
  for (const o of hidden) o.visible = true;
  bubbles.uScale.value = oldB; snow.u.uScale.value = oldS;
  const buf = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
  const meta = `${(-sub.pos.y).toFixed(0)} m deep · ${daylight.phase} · ${weather.state} seas`;
  return { buf, w, h, meta };
}
async function finishSnapshot({ buf, w, h, meta }) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const img = new ImageData(new Uint8ClampedArray(w * h * 4), w, h), row = w * 4;
  for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * row, (h - y) * row), y * row); // GL rows are bottom-up
  cv.getContext('2d').putImageData(img, 0, 0);
  const tw = 320, th = Math.round(320 * h / w), tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
  tc.getContext('2d').drawImage(cv, 0, 0, tw, th);
  const [full, thumb] = await Promise.all([blobOf(cv, 0.9), blobOf(tc, 0.8)]);
  try { await store.add({ t: Date.now(), full, thumb, meta }); const n = (await store.list()).length; $('albumBtn').textContent = `Album (${n})`; toast(`Snapshot saved · ${n} / ${MAX_SHOTS}`); }
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
  const lampTarget = lampMode === 'on' ? 1 : lampMode === 'off' ? 0 : clamp(k * 1.5 - 0.1 + daylight.darkness * 1.3, 0, 1);
  lampLevel += (lampTarget - lampLevel) * (1 - Math.exp(-dt * 3)); subModel.setLamps(lampLevel);
  surface.u.uFog.value.copy(tmpC); surface.u.uDensity.value = scene.fog.density;
  shafts.u.uInt.value = L.shaft * (1 - 0.75 * k) * (W.dim < 0.7 ? 0.5 : 1) * (1 + W.gust * 0.3);
  const su = surface.u; su.uAmp.value = W.amp; su.uFreq.value = W.freq; su.uSpeed.value = W.speed; su.uGust.value = W.gust;
  shared.uSwayK.value = W.sway; su.uLight.value.copy(L.surf).multiplyScalar(W.dim);
  shafts.u.uSun.value.set(L.lean * 0.6, -1, 0.12).normalize(); shafts.u.uCol.value.copy(L.sun).lerp(new THREE.Color(0x8fe6ff), 0.45);
  snow.u.uBright.value = 1 - 0.6 * k;
}

// ---------- depth gauge ----------
const gTicks = $('gTicks'), gMark = $('gMark'), gauge = $('gauge');
$('gMax').textContent = MAX_DEPTH + 'm'; $('gDanger').style.height = (8 / MAX_DEPTH * 100) + '%';
for (let m = 0; m <= MAX_DEPTH; m += 5) {
  const t = document.createElement('div'); t.style.top = (m / MAX_DEPTH * 100) + '%'; if (m % 10 === 0) { t.className = 'maj'; if (m) t.innerHTML = `<span>${m}m</span>`; }
  gTicks.appendChild(t);
}
let gShown = '';
function updateGauge() {
  const d = clamp(-sub.pos.y, 0, MAX_DEPTH);
  gMark.style.top = (d / MAX_DEPTH * 100) + '%';
  const txt = d.toFixed(1), red = sub.limit > 0.01;
  if (txt !== gShown) { gShown = txt; $('gVal').textContent = '-' + txt + 'm'; $('gNow').textContent = Math.round(d) + 'm'; }
  gauge.classList.toggle('red', red);
  $('gMax').textContent = MAX_DEPTH + 'm' + (sub.limit > 0.95 ? ' — limit reached' : '');
}

// ---------- loop ----------
let last = performance.now(), fpsAcc = 0, fpsN = 0, lowTime = 0;
const _tmp = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.1) dt = 0.1;
  shared.uTime.value += dt;
  const t = shared.uTime.value;

  const inp = started ? input : idleInput;
  // dynamic resolution
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 2) {
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    if (fps < 40 && pixelRatio > 0.8) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); resize(); }
    else if (fps > 58 && pixelRatio < Math.min(devicePixelRatio || 1, 2) - 0.01) { lowTime += 1; if (lowTime > 3) { pixelRatio = Math.min(Math.min(devicePixelRatio || 1, 2), pixelRatio + 0.25); lowTime = 0; resize(); } }
  }

  sub.update(dt, inp, terrain, field);
  terrain.update(sub.pos.x, sub.pos.z, 1);
  fauna.update(dt, sub);
  bubbles.update(dt, t, sub.propPos, sub);

  // camera: lags the sub's heading, pulls back with speed
  cam.yaw = angLerp(cam.yaw, sub.yaw, 1 - Math.exp(-dt * 2.2));
  cam.pitch += (sub.pitch * 0.55 - cam.pitch) * (1 - Math.exp(-dt * 2));
  const dist = 5.6 + sub.speed * 0.22, cp = Math.cos(cam.pitch);
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
  const fov = 62 + Math.min(8, sub.speed * 0.8);
  if (Math.abs(fov - camera.fov) > 0.05) { camera.fov += (fov - camera.fov) * 0.1; camera.updateProjectionMatrix(); }

  weather.update(dt);
  updateWater(camera.position.y, dt);
  surface.follow(camera.position);
  snow.u.uCam.value.copy(camera.position); shafts.u.uCam.value.copy(camera.position);
  audio.update(dt, sub, fauna.whaleLevel);
  if (wantSnap) {
    wantSnap = false;
    if (started && !snapBusy && !album.isOpen) {
      snapBusy = true; const fl = $('flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
      const shot = captureSnapshot();
      snow.u.uCam.value.copy(camera.position); shafts.u.uCam.value.copy(camera.position); surface.follow(camera.position);
      finishSnapshot(shot).finally(() => { snapBusy = false; });
    }
  }

  updateGauge();
  $('speed').textContent = `speed ${(sub.speed * 1.94).toFixed(1)} kn`;
  renderer.render(scene, camera);
}
const idleInput = { thrust: 0, turn: 0, rise: 0, boost: false, sens: 0, takeLookX: () => 0, takeLookY: () => 0 };
resize(); addEventListener('resize', resize);
requestAnimationFrame((n) => { last = n; frame(n); });
window.__sim = { album, store, weather, sub, fauna, terrain, field, camera, scene, input, renderer, seed };

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !params.has('nosw')) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
