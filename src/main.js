import * as THREE from 'three';
import { createField } from './world.js';
import { buildTemplates } from './templates.js';
import { Terrain, CS } from './terrain.js';
import { makeTerrainMaterial, makeDecorMaterial, shared } from './materials.js';
import { Sub, MAX_DEPTH } from './sub.js';
import { createSubModel } from './subs.js';
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
  $('vfHint').textContent = touch ? 'drag to aim' : 'mouse / A D to aim · Space or Enter to shoot · Esc to exit';
  $('introText').innerHTML = touch
    ? 'Left lever: thrust forward &amp; reverse.<br>Drag anywhere else to steer left, right, up, down.<br>▲ ▼ rise and dive. Nothing to find, nowhere to be.'
    : '<kbd>W</kbd> <kbd>S</kbd> thrust &nbsp; <kbd>A</kbd> <kbd>D</kbd> turn &nbsp; mouse to steer<br><kbd>Space</kbd> rise &nbsp; <kbd>C</kbd> dive &nbsp; <kbd>Shift</kbd> burst &nbsp; <kbd>F</kbd> lamps &nbsp; <kbd>P</kbd> camera<br>Click to capture the mouse. Esc releases it. Nothing to find, nowhere to be.';
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
const LAMP_MODES = ['auto', 'on', 'off']; let lampMode = 'auto', lampLevel = 0;
const lampLabel = () => { for (const id of ['lampBtn', 'vfLamp']) ib($(id), lampMode === 'on' ? 'lampOn' : lampMode === 'off' ? 'lampOff' : 'lamp', `Lamps: ${lampMode} (F)`); };
const cycleLamps = () => { lampMode = LAMP_MODES[(LAMP_MODES.indexOf(lampMode) + 1) % 3]; lampLabel(); say(`lamps ${lampMode}`); };
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
const bestiary = new Bestiary((n) => ib($('bookBtn'), 'book', `Bestiary (${n} pages)`));
$('bookBtn').addEventListener('click', (e) => { setViewfinder(false); bestiary.open(); e.currentTarget.blur(); });
const album = new AlbumUI(store, wallet, (n) => albumIcon(n), toast);
const albumIcon = (n) => { ib($('albumBtn'), 'album', `Album (${n})`); ib($('vfAlbum'), 'album', `Album (${n})`); };
albumIcon(0); store.list().then((l) => albumIcon(l.length));
ib($('vfExit'), 'close', 'Exit viewfinder (Esc)');
$('albumBtn').addEventListener('click', (e) => { album.open(); e.currentTarget.blur(); });

// viewfinder mode: aim the sub (turn only, no thrust), then press the shutter
const VF_FOV = 58;
let vf = false, vfBlend = 0, wantSnap = false, rt = null, snapBusy = false;
const vfEl = $('vf');
function setViewfinder(on) {
  if (on === vf || (on && (!started || album.isOpen))) return;
  vf = on; document.body.classList.toggle('vf', on); vfEl.hidden = !on;
  if (on) { if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); fsBanner.hidden = true; }
}
$('snapBtn').addEventListener('click', (e) => { setViewfinder(true); e.currentTarget.blur(); });
$('vfExit').addEventListener('click', () => setViewfinder(false));
$('vfAlbum').addEventListener('click', () => { setViewfinder(false); album.open(); });
$('vfLamp').addEventListener('click', (e) => { cycleLamps(); e.currentTarget.blur(); });
$('shutter').addEventListener('click', (e) => { wantSnap = true; e.currentTarget.blur(); });
addEventListener('keydown', (e) => {
  if (album.isOpen || bestiary.isOpen || e.repeat) return;
  if (e.code === 'KeyP') setViewfinder(!vf);
  else if (vf && e.code === 'Escape') setViewfinder(false);
  else if (vf && (e.code === 'Enter' || e.code === 'Space')) wantSnap = true;
});
// while framing a shot the sub may turn but never accelerates
const vfInput = {
  get thrust() { return 0; }, get turn() { return input.turn; }, rise: 0, boost: false,
  get sens() { return input.sens * 0.55; }, takeLookX: () => input.takeLookX(), takeLookY: () => input.takeLookY(),
};
const snapCam = new THREE.PerspectiveCamera(VF_FOV, 1, 0.1, 320), q180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const _eul = new THREE.Euler(0, 0, 0, 'YXZ'), _vq = new THREE.Quaternion(), _vp = new THREE.Vector3();
/** the sub's eye: front viewport, level horizon, looking where the nose points */
function vfPose(pos, quat) {
  pos.copy(sub.pos).addScaledVector(sub.fwd, 1.0); pos.y += 0.12;
  quat.setFromEuler(_eul.set(-sub.pitch, sub.yaw, 0)).multiply(q180);
}
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
  vfPose(snapCam.position, snapCam.quaternion); snapCam.updateMatrixWorld(true);
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
  const damage = sub.damage, score = scorePhoto({ camera: snapCam, fauna, terrain, field, shafts, daylight, depth: -sub.pos.y, damage });
  return { buf, w, h, meta, score, damage };
}
async function finishSnapshot({ buf, w, h, meta, score, damage }) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const img = new ImageData(new Uint8ClampedArray(w * h * 4), w, h), row = w * 4;
  for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * row, (h - y) * row), y * row); // GL rows are bottom-up
  const cx2 = cv.getContext('2d'); cx2.putImageData(img, 0, 0);
  drawCracks(cx2, w, h, damage);   // a damaged sub has a cracked lens
  const tw = 320, th = Math.round(320 * h / w), tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
  tc.getContext('2d').drawImage(cv, 0, 0, tw, th);
  const [full, thumb] = await Promise.all([blobOf(cv, 0.9), blobOf(tc, 0.8)]);
  // bestiary: crop each animal out of the (possibly cracked) snapshot
  const fresh = bestiary.record(score.spots.filter((p) => p.frac >= 0.03).map(   // must be recognisable: >= 3% of frame height
    (p) => ({ id: p.id, frac: p.frac, crop: () => {
    const ch = Math.min(h, Math.max(h * 0.3, p.frac * h * (p.school ? 3.2 : 1.7))), cw = Math.min(w, ch * 4 / 3);
    const sx = Math.min(w - cw, Math.max(0, (p.x + 1) / 2 * w - cw / 2)), sy = Math.min(h - ch, Math.max(0, (1 - p.y) / 2 * h - ch / 2));
    const c = document.createElement('canvas'); c.width = 320; c.height = 240; c.getContext('2d').drawImage(cv, sx, sy, cw, ch, 0, 0, 320, 240);
    return c.toDataURL('image/jpeg', 0.78);
  } })));
  try { await store.add({ t: Date.now(), full, thumb, meta, value: score.value, key: score.key, items: score.items, species: score.species }); const n = (await store.list()).length; albumIcon(n); toast(fresh.length ? `New bestiary page: ${fresh.join(', ')}` : `Snapshot saved${score.species.length ? ' · ' + score.species.slice(0, 3).join(', ') : ''} · ${n} / ${MAX_SHOTS}`); }
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
  shafts.mesh.visible = shafts.u.uInt.value > 0.003;
}

// ---------- depth gauge ----------
const gTicks = $('gTicks'), gMark = $('gMark'), gauge = $('gauge');
$('gMax').textContent = MAX_DEPTH + 'm';
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
  const em = Math.round(sub.maxDepth);
  $('gDanger').style.height = ((MAX_DEPTH - sub.maxDepth + 8) / MAX_DEPTH * 100) + '%';
  $('gMax').textContent = em + 'm' + (em < MAX_DEPTH - 1 ? ' (damaged)' : '') + (sub.limit > 0.95 ? ' — limit reached' : '');
}

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
  const fov = baseFov + (VF_FOV - baseFov) * vfBlend;
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  weather.update(dt);
  updateWater(camera.position.y, dt);
  surface.follow(camera.position);
  snow.u.uCam.value.copy(camera.position); shafts.u.uCam.value.copy(camera.position);
  audio.update(dt, sub, fauna.whaleLevel);
  if (wantSnap) {
    wantSnap = false;
    if (started && vf && vfBlend > 0.95 && !snapBusy && !album.isOpen) {
      snapBusy = true; const fl = $('flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
      const shot = captureSnapshot();
      snow.u.uCam.value.copy(camera.position); shafts.u.uCam.value.copy(camera.position); surface.follow(camera.position);
      finishSnapshot(shot).finally(() => { snapBusy = false; });
    }
  }

  updateGauge();
  // damage feedback: red glow growing from the screen edges (no health bar), thump + shake on impact
  if (sub.hitCount !== seenHits) { seenHits = sub.hitCount; audio.thud(sub.hitSev); }
  const glow = clamp(sub.damage * 1.6 + sub.hurtFlash * 0.55 + sub.scrape * 0.12, 0, 1);
  hurtEl.style.opacity = (glow * (sub.damage > 0.4 ? 0.9 + 0.1 * Math.sin(t * 2.4) : 1)).toFixed(3);
  if (sub.hurtFlash > 0.02) { const k = sub.hurtFlash * sub.hurtFlash * 0.12; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; }
  if (vf) { const q = Math.round(sub.damage * 100) + ':' + innerWidth + 'x' + innerHeight; if (q !== crackKey) { crackKey = q; const c = $('vfCracks'); c.width = innerWidth; c.height = innerHeight; drawCracks(c.getContext('2d'), c.width, c.height, sub.damage); } }
  if (vf) { $('vfDepth').textContent = `${(-sub.pos.y).toFixed(0)} m · ${daylight.phase}`; }
  $('speed').textContent = `speed ${(sub.speed * 1.94).toFixed(1)} kn`;
  renderer.render(scene, camera);
}
const idleInput = { thrust: 0, turn: 0, rise: 0, boost: false, sens: 0, takeLookX: () => 0, takeLookY: () => 0 };
resize(); addEventListener('resize', resize);
requestAnimationFrame((n) => { last = n; frame(n); });
window.__sim = { bestiary, drawCracks, setViewfinder, scorePhoto, album, wallet, store, weather, sub, fauna, terrain, field, camera, scene, input, renderer, seed };

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !params.has('nosw')) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
