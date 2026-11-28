/**
 * Places feature: keeps the world matched to the active submarine kind (profile), the quiet lava heat hazard,
 * and teleport helpers on window.__sim for testers (goto / gotoXZ).
 */
import { addStyle } from '../ui.js';
import { warmLandmarks } from '../landmarks.js';

const FADE_IN = 0.28, FADE_OUT = 1.1;
let veil, phase = 'idle', t = 0, pending = null, said = 0, hooked = false;

addStyle(`#placesVeil { position: fixed; inset: 0; z-index: 3; pointer-events: none; opacity: 0; background: #1d9fc0; }`);

function rebuild(game, kind) {
  const { field, terrain, sub } = game;
  if (!field.setProfile(kind)) return false;
  terrain.reset();
  terrain.update(sub.pos.x, sub.pos.z, 99);
  // keep the sub safe: never inside the new seabed, never above its ceiling
  const gh = field.heightAt(sub.pos.x, sub.pos.z) + sub.radius + 2.6;
  if (sub.pos.y < gh) { sub.pos.y = gh; sub.vel.y = Math.max(0, sub.vel.y); }
  if (sub.pos.y > sub.ceil - 0.5) sub.pos.y = sub.ceil - 0.5;
  return true;
}

const DEFAULT_VANTAGE = {
  bigreef: { dist: 0.55, up: 16 }, vent: { dist: 26, up: 7 }, magma: { dist: 18, up: 6 }, volcano: { dist: 0.7, up: 18 },
  cave: { dist: 22, up: 3 }, arch: { dist: 24, up: 4 }, wreck: { dist: 26, up: 7 }, canyon: { dist: 12, up: 12 },
  garden: { dist: 0.7, up: 8 }, trench: { dist: 0.5, up: 18 }, dropoff: { dist: 40, up: 16 }, seamount: { dist: 60, up: 16 },
  stacks: { dist: 1.0, up: 12 }, bluehole: { dist: 1.05, up: 20 }, bridge: { dist: 30, up: 5 }, basalt: { dist: 1.1, up: 9 }, mushroom: { dist: 1.2, up: 5 }, terrace: { dist: 0.9, up: 14 },
};

function install(game) {
  const { field, sub, terrain } = game, sim = window.__sim;
  if (!sim || sim.goto) return;
  /** jump to the nearest landmark of `type` (string or array) and face it; opts: { dist (m, or <=3 = fraction of the feature radius), up (m above the seabed), yaw (view angle around it), maxR } */
  sim.goto = (type, opts = {}) => {
    const f = field.findFeature(type, sub.pos.x, sub.pos.z, opts.maxR || 4000);
    if (!f) return null;
    const d0 = DEFAULT_VANTAGE[f.type] || { dist: 30, up: 8 }, dist = opts.dist ?? d0.dist, up = opts.up ?? d0.up;
    const D = dist <= 3 ? f.r * dist : dist, a = opts.yaw ?? 0.7;
    const x = f.x + Math.sin(a) * D, z = f.z + Math.cos(a) * D;
    sim.gotoXZ(x, z, null, up);
    sub.yaw = Math.atan2(f.x - x, f.z - z); sub.pitch = opts.pitch ?? -0.12;
    return f;
  };
  /** jump to (x, z); y = absolute (m, negative) or null for `up` metres above the seabed */
  sim.gotoXZ = (x, z, y = null, up = 8) => {
    sub.pos.set(x, y ?? Math.min(-4, field.heightAt(x, z) + up), z);
    sub.vel.set(0, 0, 0); sub.throttle = 0;
    terrain.update(x, z, 99);
    return sub.pos;
  };
}

export default {
  name: 'places',
  init(game) {
    let step = 0; const warm = () => { if (warmLandmarks(step++)) setTimeout(warm, 700); }; setTimeout(warm, 1500);
    veil = document.createElement('div'); veil.id = 'placesVeil'; document.body.appendChild(veil);
    game.bus.on('swap', ({ id }) => {
      if (id === game.field.profile) return;
      pending = id; phase = 'in'; t = 0;
      veil.style.background = '#' + game.scene.fog.color.getHexString();
    });
  },
  update(dt, game) {
    if (!hooked) { hooked = true; install(game); }
    if (phase === 'in') {
      t += dt; veil.style.opacity = String(Math.min(1, t / FADE_IN));
      if (t >= FADE_IN) { rebuild(game, pending); phase = 'out'; t = 0; }
    } else if (phase === 'out') {
      t += dt; veil.style.opacity = String(Math.max(0, 1 - t / FADE_OUT));
      if (t >= FADE_OUT) { phase = 'idle'; veil.style.opacity = '0'; }
    }
    // live lava: a gentle, forgiving heat tick, readable by the red glow
    const { sub, terrain } = game;
    const k = terrain.heatAt(sub.pos);
    if (k > 0) {
      sub.damage = Math.min(1, sub.damage + dt * 0.012 * k * sub.stats.fragility);
      sub.hurtFlash = Math.max(sub.hurtFlash, 0.3 + 0.3 * k);
      said -= dt;
      if (said <= 0) { game.say('the water is hot here — back off', 2600); said = 18; }
    } else if (said > 0) said = Math.max(0, said - dt);
  },
};
