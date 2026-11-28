/**
 * Equipment feature: the effects of the shop items that are not plain stat changes (fleet.js owns the catalogue and prices).
 *   quiet propeller  -> stealth.noise / game.noiseFactor / sub.noise / audio.noise (fauna.alarm() shrinks every notice radius)
 *   red-light filter -> lamp mode 'red' (main.js cycles it): red beam, and white lamps startle shy animals at night (stealth.lamp)
 *   hydrophone       -> listen toggle + compass arc of large animals (equipment-hud.js)
 *   sonar ping       -> button with a 12 s cooldown, expanding ring and a round radar for ~6 s (equipment-hud.js)
 *   wide-angle lens  -> 0.6x zoom step (fleet.stats().zoomLevels; main.js steps through them)
 *   strobe light     -> viewfinder toggle; the shutter fires a flash (bus 'capture' from main.js), cooldown 2 s
 *   album expansion  -> setMaxShots(fleet.albumSlots())
 * Bus events: 'equipment' { kind: 'hydrophone'|'strobe'|'sonar', on? }.
 */
import { stealth, alarm } from '../fauna.js';
import { setMaxShots } from '../album.js';
import { addStyle, addTool, registerIcons } from '../ui.js';
import { ib } from '../icons.js';
import { HydrophoneHud, Sonar } from './equipment-hud.js';

const LAMP_BODY = 'M7 3h10l-2 6H9z M9 9v11a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V9 M12 13v2';
const BOLT = 'M13 2L4 14h7l-1 8 9-12h-7z';
const PHONES = 'M3 14v-2a9 9 0 0 1 18 0v2 M3 14h3v6H5a2 2 0 0 1-2-2z M21 14h-3v6h1a2 2 0 0 0 2-2z';
registerIcons({
  lampRed: LAMP_BODY + ' M3.5 4.5a5 5 0 0 0 0 5 M20.5 4.5a5 5 0 0 1 0 5',
  strobe: BOLT, strobeOff: BOLT + ' M3 3l18 18',
  hydro: PHONES, hydroOff: PHONES + ' M3 3l18 18',
  sonar: 'M12 11.5a.5.5 0 1 0 .01 0 M8.8 8.8a4.5 4.5 0 0 0 0 6.4 M15.2 8.8a4.5 4.5 0 0 1 0 6.4 M5.7 5.7a9 9 0 0 0 0 12.6 M18.3 5.7a9 9 0 0 1 0 12.6',
});

const STROBE_COOLDOWN = 2;
const $ = (id) => document.getElementById(id);

let G, hydro, sonar, st, strobeOn = false, strobeCool = 0, flashT = 0;
let hydroBtn, sonarBtn, strobeBtn, strobeAmb, strobePt, strobeFog = 0, fired = false;
const rigs = new WeakMap();

/** Make everything that depends on the owned items match the active sub (called on init and on every fleet change). */
function apply() {
  st = G.fleet.stats();
  stealth.noise = st.noise; G.noiseFactor = st.noise; G.sub.noise = st.noise; G.audio.noise = st.noise;
  setMaxShots(G.fleet.albumSlots());
  hydroBtn.hidden = !st.hydro; sonarBtn.hidden = !st.sonar; strobeBtn.hidden = !st.strobe;
  if (!st.hydro && hydro.on) hydro.set(false);
  if (!st.strobe) strobeOn = false;
  iconHydro(); iconStrobe();
}
const iconHydro = () => ib(hydroBtn, hydro.on ? 'hydro' : 'hydroOff', `Hydrophone: ${hydro.on ? 'listening' : 'off'} (H)`);
const iconStrobe = () => { ib(strobeBtn, strobeOn ? 'strobe' : 'strobeOff', `Strobe: ${strobeOn ? 'on' : 'off'} (R)`); strobeBtn.classList.toggle('cool', strobeOn && strobeCool > 0); };

function toggleHydro() {
  if (!st.hydro) return;
  hydro.set(!hydro.on); iconHydro(); G.say(`hydrophone ${hydro.on ? 'listening' : 'off'}`);
  G.bus.emit('equipment', { kind: 'hydrophone', on: hydro.on });
}
function toggleStrobe() {
  if (!st.strobe) return;
  strobeOn = !strobeOn; iconStrobe(); G.say(`strobe ${strobeOn ? 'on' : 'off'}`);
  if (strobeOn) warmStrobe();
  G.bus.emit('equipment', { kind: 'strobe', on: strobeOn });
}
function pingSonar() {
  if (!st.sonar) return;
  if (!sonar.ping()) { G.say('sonar is recharging'); return; }
  G.say('sonar ping'); sonarBtn.classList.add('cool');
  G.bus.emit('equipment', { kind: 'sonar', contacts: sonar.contacts });
}

// ---------- strobe ----------
const strobeLights = (on) => { if (on) { G.scene.add(strobeAmb); G.scene.add(strobePt); } else { G.scene.remove(strobeAmb); G.scene.remove(strobePt); } };
/** compile the shader variants with the extra lights once, when the strobe is armed, so the first flash does not hitch */
function warmStrobe() { strobeLights(true); try { G.renderer.compile(G.scene, G.camera); } catch { /* compile is only a warm-up */ } strobeLights(false); }
/** main.js emits 'capture' { phase: 'before', cam, flags } right before the snapshot render and { phase: 'after' } right after it */
function onCapture(e) {
  const fl = $('flash');
  if (e.phase === 'before') {
    if (!(strobeOn && st.strobe && strobeCool <= 0 && e.flags)) { fl.classList.remove('strobe'); return; }
    e.flags.strobe = true; fired = true; strobeCool = STROBE_COOLDOWN; iconStrobe();
    strobeAmb.intensity = 1.9; strobePt.intensity = 140; strobePt.position.copy(e.cam.position);
    strobeLights(true);
    strobeFog = G.scene.fog.density; G.scene.fog.density = strobeFog * 0.7;   // the flash cuts through the murk a little
    fl.classList.add('strobe'); clearTimeout(flashT); flashT = setTimeout(() => fl.classList.remove('strobe'), 1100);
    G.bus.emit('equipment', { kind: 'strobeFired' });
  } else if (e.phase === 'after' && fired) {
    fired = false; strobeLights(false); strobeAmb.intensity = 0; strobePt.intensity = 0; G.scene.fog.density = strobeFog;
  }
}

// ---------- red lamps ----------
/** The spot lights, beam cones and bulbs of a sub model, found once (setLamps() in subs.js rewrites their colours every frame). */
function rigOf(model) {
  let r = rigs.get(model.group);
  if (!r) {
    r = { spots: [], beams: new Set(), bulbs: new Set(), red: false };
    model.group.traverse((o) => {
      if (o.isSpotLight) r.spots.push(o);
      else if (o.isMesh && o.material && o.material.vertexColors && o.material.transparent && o.material.blending === G.THREE.AdditiveBlending) r.beams.add(o.material);
      else if (o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry' && o.geometry.parameters.radius === 0.07) r.bulbs.add(o.material);
    });
    rigs.set(model.group, r);
  }
  return r;
}
function tintLamps(red, level) {
  const r = rigOf(G.subModel);
  if (red) {
    for (const s of r.spots) s.color.setHex(0xff2a18);
    for (const m of r.beams) m.color.setRGB(0.14 * level, 0.016 * level, 0.01 * level);
    for (const m of r.bulbs) m.color.setRGB(0.3 + 0.7 * level, 0.06 + 0.03 * level, 0.04);
    r.red = true;
  } else if (r.red) { for (const s of r.spots) s.color.setHex(0xdff6ff); r.red = false; }   // main's setLamps() restores bulbs / beams
}

function panelOpen() { return !!document.querySelector('#shop:not([hidden]), .fpanel:not([hidden]), #album:not([hidden]), #bestiary:not([hidden])') || !$('intro').classList.contains('gone'); }

export const equipment = {
  name: 'equipment',
  init(game) {
    G = game;
    addStyle(`
#hydroHud{position:fixed;left:50%;top:68px;transform:translateX(-50%);z-index:4;pointer-events:none;opacity:.9}
#hydroHud[hidden]{display:none}
#sonarView{position:fixed;left:50%;top:128px;transform:translateX(-50%);z-index:4;pointer-events:none;text-align:center;font-size:11px;letter-spacing:.04em;white-space:pre;text-shadow:0 1px 6px #000a;color:#dff6ff;transition:opacity .3s}
#sonarView[hidden]{display:none}#sonarView .cap{margin-top:4px;opacity:.85;line-height:1.4}
body.vf #hydroHud,body.vf #sonarView{display:none}
#tools button.cool,#vfBar button.cool{opacity:.4}
#flash.go.strobe{animation:strobeFlash 1s ease-out}
@keyframes strobeFlash{0%{opacity:1}35%{opacity:.7}100%{opacity:0}}`);
    hydro = new HydrophoneHud(game); sonar = new Sonar(game);
    hydroBtn = addTool('hydroBtn', 'hydroOff', 'Hydrophone (H)', toggleHydro);
    sonarBtn = addTool('sonarBtn', 'sonar', 'Sonar ping (O)', pingSonar);
    strobeBtn = document.createElement('button'); strobeBtn.id = 'vfStrobe'; ib(strobeBtn, 'strobeOff', 'Strobe: off (R)');
    strobeBtn.addEventListener('click', (e) => { toggleStrobe(); e.currentTarget.blur(); });
    $('vfBar').insertBefore(strobeBtn, $('shutter'));
    strobeAmb = new game.THREE.AmbientLight(0xe8f6ff, 0); strobePt = new game.THREE.PointLight(0xffffff, 0, 90, 1.4);
    addEventListener('keydown', (e) => {
      if (e.repeat || panelOpen()) return;
      if (e.code === 'KeyH') toggleHydro(); else if (e.code === 'KeyO') pingSonar(); else if (e.code === 'KeyR' && game.viewfinder) toggleStrobe();
    });
    game.bus.on('capture', onCapture);
    game.fleet.onChange(apply);
    apply();
    game.equipment = { hydro, sonar, get strobeOn() { return strobeOn; }, get strobeCool() { return strobeCool; }, stealth, alarm };   // debug / test hooks
  },
  update(dt, game) {
    const mode = game.lampMode, level = game.lampLevel, red = mode === 'red' && st.redLight;
    stealth.lamp = red ? 0 : level * game.daylight.darkness;   // only white light at night startles
    tintLamps(red, level);
    if (strobeCool > 0) { strobeCool = Math.max(0, strobeCool - dt); if (strobeCool === 0) iconStrobe(); }
    sonar.update(dt); hydro.update(dt);
    sonarBtn.classList.toggle('cool', !sonar.ready);
  },
};
