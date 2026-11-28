import * as THREE from 'three';
import { registerSpecies } from '../species.js';
import { registerSheets } from '../bestiary-data.js';
import { swim, alarm } from '../fauna.js';
import { shared, lockPhase } from '../materials.js';
import { DEEP_SHEETS } from '../data/deep-sheets.js';
import * as M from '../models/deep.js';
import { registerModel } from '../models/registry.js';

/**
 * The dark sea (squid submarine places): deep-water animals, trench-edge dwellers and the fauna of hydrothermal vents.
 * One fauna group (fauna.addGroup) that owns single animals (instanced-free meshes), instanced schools / blooms / vent clusters
 * and a vent-site tracker. Spawning is weighted by field.biomeAt (through ctx.biome) and the active sub (profile), vent animals
 * cluster at field.featuresNear() vents. All memory is fixed at construction; world content only exists in a 5x5 chunk window.
 */

const R = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const DEF_BIOME = { reef: 0, open: 1, deep: 0, vent: 0, magma: 0, cave: 0, trench: 0 };

// ───────────────────────────── species tables ─────────────────────────────
// `shy` / speeds are metres per second; profile = spawn multiplier per submarine kind (squid sees the dark sea at full density).
const P_DEEP = (o) => ({ squid: 1, other: o });

export const DEEP = [
  { id: 'lantern', name: 'Lanternfish', min: 20, max: 110, value: 9, weight: 3, len: [0.16, 0.26], aff: { open: 0.5, deep: 1, trench: 0.8, vent: 0.15, cave: 0.2 }, profile: P_DEEP(0.45), act: { night: 1.6, dawn: 1.2, morning: 1, day: 0.9, evening: 1.3 } },
  { id: 'atolla', name: 'Crown jelly', min: 35, max: 120, value: 28, weight: 2, len: [0.7, 1.3], aff: { open: 0.3, deep: 1, trench: 1, vent: 0.2, cave: 0.2 }, profile: P_DEEP(0.4), act: {} },
  { id: 'angler', name: 'Humpback anglerfish', min: 45, max: 120, value: 60, weight: 2, len: [0.7, 1.15], aff: { open: 0.15, deep: 1, trench: 1.2, cave: 0.5, vent: 0.25, magma: 0.05 }, profile: P_DEEP(0.22), act: {} },
  { id: 'dumbo', name: 'Dumbo octopus', min: 40, max: 120, value: 75, weight: 2, len: [0.55, 0.95], aff: { deep: 1, trench: 0.8, open: 0.12, cave: 0.4, vent: 0.3 }, profile: P_DEEP(0.2), act: {} },
  { id: 'gulper', name: 'Gulper eel', min: 55, max: 120, value: 110, rare: true, weight: 1, len: [1.1, 1.7], aff: { deep: 1, trench: 1.3, open: 0.08 }, profile: P_DEEP(0.12), act: {} },
  { id: 'vampire', name: 'Vampire squid', min: 50, max: 120, value: 130, rare: true, weight: 1, len: [0.6, 0.95], aff: { deep: 1, trench: 1, open: 0.08, cave: 0.3 }, profile: P_DEEP(0.12), act: {} },
  { id: 'oarfish', name: 'Oarfish', min: 30, max: 110, value: 420, rare: true, weight: 0.6, len: [5, 8], aff: { deep: 0.9, open: 0.35, trench: 0.8 }, profile: P_DEEP(0.18), act: { night: 1.2, dawn: 1.6, morning: 1, day: 0.8, evening: 1.6 } },
  { id: 'spermwhale', name: 'Sperm whale', min: 30, max: 120, value: 650, rare: true, weight: 0.6, len: [11, 15], aff: { deep: 1, trench: 1.3, open: 0.3 }, profile: P_DEEP(0.2), act: { night: 1.3, dawn: 1, morning: 0.9, day: 0.9, evening: 1.1 } },
  { id: 'isopod', name: 'Giant isopod', min: 45, max: 120, value: 45, weight: 2, len: [0.4, 0.7], aff: { deep: 1, trench: 0.9, open: 0.2, cave: 0.5, vent: 0.3 }, profile: P_DEEP(0.3), act: {} },
  { id: 'yeti', name: 'Yeti crab', min: 25, max: 120, value: 55, weight: 1, len: [0.22, 0.34], aff: {}, profile: { squid: 1, other: 0.7 }, act: {} },
  { id: 'shrimp', name: 'Vent shrimp', min: 15, max: 120, value: 14, weight: 1, len: [0.13, 0.19], aff: {}, profile: { squid: 1, other: 0.8 }, act: {} },
  { id: 'ventoctopus', name: 'Vent octopus', min: 30, max: 120, value: 150, rare: true, weight: 1, len: [0.55, 0.85], aff: {}, profile: { squid: 1, other: 0.6 }, act: {} },
];
const BY_ID = Object.fromEntries(DEEP.map((s) => [s.id, s]));
registerSpecies(DEEP);
registerSheets(DEEP_SHEETS);

// ───────────────────────────── material: tail wave / fin flap / jelly pulse + bioluminescence ─────────────────────────────
const MODES = { wave: 'DEEP_WAVE', flap: 'DEEP_FLAP', pulse: 'DEEP_PULSE' };
const GEO = {};
const geo = (id) => (GEO[id] ||= M.MODELS[id]());

/**
 * Lambert material with vertex colours plus: aGlow (emissive, shows with the lamps off) and aMove (animation weight).
 * wave:  displace along `axis` by sin(t*freq + phase - z*wave) * amp * aMove      (body / tail / leg waves)
 * flap:  same, but travelling outward with |x|                                     (ear fins)
 * pulse: aMove >= 0 contracts the bell (xz), aMove < 0 sways trailing tentacles    (jellyfish)
 */
function makeDeepMaterial({ mode = 'wave', freq = 2, amp = 0.1, wave = 4, axis = [1, 0, 0], pulse = 0.25 }) {
  const u = lockPhase({ uFreq: { value: freq }, uAmp: { value: amp }, uWave: { value: wave }, uAxis: { value: new THREE.Vector3(...axis) }, uGlowPulse: { value: pulse } });
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.userData.u = u; mat.userData.axis = axis;
  mat.defines = { [MODES[mode]]: '' };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, { uTime: shared.uTime });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 aGlow; attribute float aMove; varying vec3 vGlow;
uniform float uTime, uFreq, uOff, uAmp, uWave, uGlowPulse; uniform vec3 uAxis;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
  float ph = float(gl_InstanceID) * 1.7;
  #else
  float ph = 0.0;
  #endif
  #if defined(DEEP_PULSE)
  float ps = sin(uTime * uFreq + uOff + ph);
  if (aMove >= 0.0) { transformed.xz *= 1.0 + uAmp * aMove * ps; transformed.y *= 1.0 - uAmp * 0.45 * aMove * ps; }
  else {
    float sw = -aMove, a = (uTime * uFreq + uOff) * 0.55 + ph * 1.3 + position.y * uWave;
    transformed.x += sin(a) * uAmp * 0.35 * sw; transformed.z += cos(a * 0.8 + 1.0) * uAmp * 0.35 * sw;
    transformed.xz *= 1.0 + uAmp * (0.6 + 0.4 * ps) * sw * 0.35;
  }
  #elif defined(DEEP_FLAP)
  transformed += uAxis * sin(uTime * uFreq + uOff + ph - abs(position.x) * uWave) * uAmp * aMove;
  #else
  transformed += uAxis * sin(uTime * uFreq + uOff + ph - position.z * uWave) * uAmp * aMove;
  #endif
  vGlow = aGlow * (1.0 + uGlowPulse * sin(uTime * 2.1 + ph * 2.3));
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow;');
  };
  mat.customProgramCacheKey = () => 'deep-' + mode;
  return mat;
}

// ───────────────────────────── glow halos (sprites) ─────────────────────────────
let haloTex = null;
function haloTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  haloTex = new THREE.CanvasTexture(c); haloTex.colorSpace = THREE.SRGBColorSpace;
  return haloTex;
}

/** Soft additive glow sprites at the lights listed in geometry.userData.lights (angler lure, eel tail light, arm tips). Not fogged, fade with distance. */
class Halos {
  constructor(mesh, lights, mat) {
    this.mesh = mesh; this.mat = mat; this.items = [];
    for (const l of lights || []) {
      const m = new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color(l.c[0], l.c[1], l.c[2]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.7 });
      const s = new THREE.Sprite(m); s.scale.setScalar(l.size); s.position.set(...l.p); s.renderOrder = 5;
      mesh.add(s); this.items.push({ s, l, ph: R(0, 6.28) });
    }
  }
  update(t, camDist) {
    if (!this.items.length) return;
    const u = this.mat.userData.u, ax = this.mat.userData.axis, fade = clamp(1.25 - camDist / 80, 0.18, 1);
    for (const it of this.items) {
      const { s, l } = it;
      if (l.follow) { const d = Math.sin(shared.uTime.value * u.uFreq.value + u.uOff.value - l.p[2] * u.uWave.value) * u.uAmp.value * l.follow; s.position.set(l.p[0] + ax[0] * d, l.p[1] + ax[1] * d, l.p[2] + ax[2] * d); }
      s.material.opacity = fade * (0.55 + 0.3 * Math.sin(t * 2.3 + it.ph) + 0.15 * Math.sin(t * 5.7 + it.ph * 2));
    }
  }
}

// ───────────────────────────── helpers ─────────────────────────────
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function setInst(mesh, i, x, y, z, yaw, pitch, roll, s) {
  _q.setFromEuler(_e.set(-pitch, yaw, roll)); _m.compose(_v.set(x, y, z), _q, _s.setScalar(s)); _m.toArray(mesh.instanceMatrix.array, i * 16);
}
const mkInstanced = (scene, g, mat, cap) => {
  const mesh = new THREE.InstancedMesh(g, mat, cap); mesh.frustumCulled = false; mesh.count = 0; mesh.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(mesh); return mesh;
};
/** deterministic slow ocean current (m/s) for drifting animals */
const current = (x, z, t, out) => { out.x = 0.16 * Math.sin(t * 0.011 + z * 0.004) + 0.07 * Math.sin(t * 0.027 + x * 0.003); out.z = 0.14 * Math.cos(t * 0.013 + x * 0.004) + 0.06 * Math.sin(t * 0.023 + z * 0.003 + 1); return out; };
const _cur = { x: 0, z: 0 };

const profMul = (def, ctx) => def.profile[ctx.profile] ?? def.profile.other;
/** a spawn attempt succeeds with probability ~ (biome affinity)^3: dense in its own biome, a faint tail elsewhere */
const accept = (sp) => !!sp && Math.random() < Math.pow(Math.min(1, sp.w * 1.1), 3);
/** Highest seabed under a body of length L centred at (x, z) heading (ax, az) */
function floorUnder(field, x, z, ax, az, L, pitch = 0) {
  const k = L * 0.25;
  let h = field.heightAt(x, z);
  for (const m of [-2, -1, 1, 2]) h = Math.max(h, field.heightAt(x + ax * k * m, z + az * k * m));
  return h + L * 0.5 * Math.abs(Math.sin(pitch));   // a pitched body hangs lower at one end
}

/** Spawn weight of a species at a map point: biome affinity x submarine multiplier, 0 if the sea there cannot hold the species */
function spawnWeight(def, ctx, x, z, g, benthic) {
  const depth = -g;
  if (benthic ? depth < def.min || depth > def.max + 2 : depth < def.min + 6 + def.len[1] * 0.5) return 0;
  const b = ctx.biome(x, z) || DEF_BIOME;
  let w = 0; for (const k in def.aff) w += (b[k] || 0) * def.aff[k];
  return Math.min(1.6, w) * (def.act[ctx.phase] ?? 1);
}
/** Best of a few random points on a ring around the sub, biased ahead */
function findSpot(def, field, sub, ctx, benthic, tries = 7) {
  const dir = Math.atan2(sub.fwd.x, sub.fwd.z); let best = null;
  for (let i = 0; i < tries; i++) {
    const a = dir + R(-1.6, 1.6), d = R(95, 140), x = sub.pos.x + Math.sin(a) * d, z = sub.pos.z + Math.cos(a) * d, g = field.heightAt(x, z);
    const w = spawnWeight(def, ctx, x, z, g, benthic);
    if (!best || w > best.w) best = { x, z, g, w, a };
  }
  return best;
}

// ───────────────────────────── vent sites ─────────────────────────────
/** Vents / magma / volcanoes near the sub (field.featuresNear), with a biome-grid fallback while the terrain has no landmark list. */
class Sites {
  constructor() { this.list = []; this.t = 0; this.claims = new Map(); }
  refresh(dt, field, sub, ctx) {
    this.t -= dt; if (this.t > 0) return; this.t = 1.2;
    const out = [], px = sub.pos.x, pz = sub.pos.z;
    if (field.featuresNear) {
      const near = (x, z) => Math.hypot(x - px, z - pz) < 200;
      const add = (key, type, x, z, r) => { const g = field.heightAt(x, z); out.push({ key, type, x, z, y: g, g, r }); };
      for (const f of field.featuresNear(px, pz, 200) || []) {
        if (f.type !== 'vent' && f.type !== 'magma' && f.type !== 'volcano') continue;
        const raw = f.f;   // internal landmark data: chimneys (x, z, scale, template, yaw) of a vent field, polylines of a magma rift
        if (f.type === 'vent' && raw && raw.ch && raw.ch.length) {
          for (let i = 0; i < raw.ch.length && out.length < 40; i += 5) if (near(raw.ch[i], raw.ch[i + 1])) add(`vent:${f.id}:${i}`, 'vent', raw.ch[i], raw.ch[i + 1], Math.max(1.2, raw.ch[i + 2] * 1.1));
        } else if (f.type === 'magma' && raw && raw.lines && raw.lines[0] && raw.lines[0].pts) {
          const p = raw.lines[0].pts, n = p.length / 2, step = Math.max(1, Math.floor(n / 4));
          for (let i = 0; i < n && out.length < 40; i += step) if (near(p[i * 2], p[i * 2 + 1])) add(`magma:${f.id}:${i}`, 'magma', p[i * 2], p[i * 2 + 1], 3);
        } else if (near(f.x, f.z)) add(`${f.type}:${Math.round(f.x)},${Math.round(f.z)}`, f.type, f.x, f.z, Math.min(f.r || 4, 6));
      }
    } else {
      for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
        const x = (Math.round(px / 45) + i) * 45, z = (Math.round(pz / 45) + j) * 45, b = ctx.biome(x, z) || DEF_BIOME, v = (b.vent || 0) + (b.magma || 0) * 0.7;
        if (v < 0.35) continue;
        const g = field.heightAt(x, z); out.push({ key: `grid:${x},${z}`, type: 'vent', x, z, y: g, g, r: 4 });
      }
    }
    this.list = out;
    for (const [k, c] of this.claims) if (!out.some((s) => k.endsWith('|' + s.key)) || !c.active) this.claims.delete(k);
  }
  /** an unclaimed site 85..180 m from the sub inside the depth band, of an allowed type */
  pick(sub, def, types, prefer) {
    const c = [];
    for (const s of this.list) {
      if (this.claims.has(def.id + '|' + s.key) || !types.includes(s.type)) continue;
      const d = Math.hypot(s.x - sub.pos.x, s.z - sub.pos.z), depth = -s.g;
      if (d < 85 || d > 180 || depth < def.min || depth > def.max + 2) continue;
      c.push(s);
    }
    if (!c.length) return null;
    return prefer ? c.sort((a, b) => Math.hypot(a.x - prefer.x, a.z - prefer.z) - Math.hypot(b.x - prefer.x, b.z - prefer.z))[0] : c[(Math.random() * c.length) | 0];
  }
}

// ───────────────────────────── single animals ─────────────────────────────
/** Per-species behaviour. mode: 'swim' (pelagic / hovering) or 'crawl' (follows the seabed). */
const BEH = {
  angler:      { mode: 'swim', mat: { mode: 'wave', freq: 2.2, amp: 0.1, wave: 7, axis: [1, 0, 0], pulse: 0.3 }, cruise: [0.15, 0.32], burst: 2.2, acc: 1.4, shy: 0.75, turn: 0.5, alt: [3, 14], yAmp: 4, clear: 0.3, bank: 0.5, margin: 3, first: [20, 60], next: [40, 100], kind: 'fish', fr: 0.9, maxDist: 90, freqK: 1.2 },
  gulper:      { mode: 'swim', mat: { mode: 'wave', freq: 2.4, amp: 0.2, wave: 9, axis: [1, 0, 0], pulse: 0.35 }, cruise: [0.25, 0.5], burst: 2.8, acc: 1.5, shy: 0.85, turn: 0.7, alt: [4, 18], yAmp: 5, clear: 0.2, bank: 0.3, margin: 3, first: [40, 120], next: [80, 200], kind: 'fish', fr: 0.7, maxDist: 100, freqK: 1.0 },
  vampire:     { mode: 'swim', mat: { mode: 'flap', freq: 2.6, amp: 0.1, wave: 6, axis: [0, 1, 0], pulse: 0.3 }, cruise: [0.2, 0.42], burst: 3.4, acc: 3, shy: 0.85, turn: 0.6, alt: [3, 14], yAmp: 5, clear: 0.3, bank: 0.3, margin: 3, first: [40, 120], next: [80, 200], kind: 'fish', fr: 0.9, maxDist: 80, freqK: 1.5, pulse: true },
  dumbo:       { mode: 'swim', mat: { mode: 'flap', freq: 3.2, amp: 0.1, wave: 5, axis: [0, 1, 0], pulse: 0 }, cruise: [0.25, 0.5], burst: 2.4, acc: 2, shy: 0.7, turn: 0.7, alt: [0.8, 4], yAmp: 0.8, clear: 0.2, bank: 0.2, margin: 1.4, first: [25, 80], next: [50, 130], kind: 'fish', fr: 1.0, maxDist: 80, freqK: 2.2, hover: true },
  oarfish:     { mode: 'swim', mat: { mode: 'wave', freq: 2.0, amp: 0.05, wave: 12, axis: [1, 0, 0], pulse: 0 }, cruise: [0.5, 0.9], burst: 2.6, acc: 0.9, shy: 1.2, turn: 0.4, alt: [6, 26], yAmp: 8, clear: 0.15, bank: 0.35, margin: 4, first: [80, 200], next: [200, 420], kind: 'big', fr: 0.8, maxDist: 150, freqK: 1.4 },
  spermwhale:  { mode: 'swim', mat: { mode: 'wave', freq: 1.0, amp: 0.05, wave: 3, axis: [0, 1, 0], pulse: 0 }, cruise: [1.6, 2.4], burst: 3.4, acc: 0.4, jerk: 0.2, maxTurn: 0.2, maxPitch: 0.08, shy: 0.8, turn: 0.3, alt: [10, 40], yAmp: 14, clear: 0.12, bank: 0.2, margin: 6, first: [90, 220], next: [260, 520], kind: 'big', fr: 1.0, maxDist: 220, freqK: 0.2 },
  isopod:      { mode: 'crawl', mat: { mode: 'wave', freq: 7, amp: 0.045, wave: 30, axis: [0, 1, 0], pulse: 0 }, cruise: [0.12, 0.28], burst: 1.1, acc: 2, shy: 0.8, turn: 0.4, lift: 0.07, first: [20, 60], next: [30, 80], kind: 'fish', fr: 0.9, maxDist: 70, freqK: 6 },
  ventoctopus: { mode: 'crawl', mat: { mode: 'wave', freq: 3.2, amp: 0.06, wave: 12, axis: [0, 1, 0], pulse: 0 }, cruise: [0.12, 0.3], burst: 2.4, acc: 3, shy: 0.9, turn: 0.5, lift: 0.1, leash: 14, jet: true, first: [20, 70], next: [60, 140], kind: 'fish', fr: 1.0, maxDist: 70, freqK: 3 },
};
const SLOTS = { angler: 2, gulper: 1, vampire: 1, dumbo: 2, oarfish: 1, spermwhale: 1, isopod: 3, ventoctopus: 1 };
const TINT = { angler: [0.9, 1.15], gulper: [0.85, 1.2], vampire: [0.85, 1.2], dumbo: [0.9, 1.1], oarfish: [0.9, 1.1], spermwhale: [0.85, 1.12], isopod: [0.85, 1.12], ventoctopus: [0.9, 1.08] };
// sperm whale body as spheres along the spine: [z, radius] in units of body length (nose = +0.5)
const WHALE_SPINE = [0.34, 0.13, 0.2, 0.14, 0.04, 0.12, -0.12, 0.09, -0.3, 0.05];

class Critter {
  constructor(scene, def) {
    this.def = def; this.o = BEH[def.id]; this.id = def.id;
    this.mat = makeDeepMaterial(this.o.mat);
    this.mesh = new THREE.Mesh(geo(def.id), this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);
    this.halos = new Halos(this.mesh, this.mesh.geometry.userData.lights, this.mat);
    this.pos = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.roll = 0; this.yawRate = 0;
    this.active = false; this.frozen = false; this.timer = R(this.o.first[0], this.o.first[1]); this.t = R(0, 50); this.fear = 0; this.v = undefined;
    this.len = 1; this.speed = 0.3; this.y0 = -60; this.home = null; this.lift = 0; this.pause = 0;
  }
  place() { this.mesh.position.copy(this.pos); this.mesh.rotation.set(-this.pitch, this.yaw, this.roll); }
  deactivate(retry) { this.active = false; this.mesh.visible = false; this.timer = retry ?? R(this.o.next[0], this.o.next[1]); this.fear = 0; this.v = undefined; this.frozen = false; this.home = null; }
  /** smoothed fear of the sub; returns the bearing pointing away from it */
  scare(sub, dt) {
    const f = alarm(sub, this.pos.x, this.pos.y, this.pos.z, this.o.shy * (this.o.mode === 'swim' ? Math.max(0.6, this.len * 0.12) ** 0.5 : 1));
    this.fear += (f - this.fear) * (1 - Math.exp(-dt * (f > this.fear ? 3 : 0.4)));
    return Math.atan2(this.pos.x - sub.pos.x, this.pos.z - sub.pos.z);
  }
  tryNext(dt, field, sub, ctx) {
    this.timer -= dt * (this.def.act[ctx.phase] ?? 1) * profMul(this.def, ctx);
    if (this.timer <= 0) this.spawn(field, sub, ctx);
  }
  spawn(field, sub, ctx, site, at) {
    const o = this.o, def = this.def, benthic = o.mode === 'crawl' || o.hover;
    let x, z, g;
    if (at) { x = at.x; z = at.z; g = field.heightAt(x, z); }
    else if (site) { const sr = Math.min(site.r, 6); x = site.x + R(-1, 1) * sr; z = site.z + R(-1, 1) * sr; g = field.heightAt(x, z); }
    else {
      const sp = findSpot(def, field, sub, ctx, benthic);
      if (!accept(sp)) { this.timer = R(2.5, 6); return false; }
      ({ x, z, g } = sp);
    }
    this.len = R(def.len[0], def.len[1]); this.mesh.scale.setScalar(this.len);
    this.mat.color.setScalar(R(...TINT[def.id]));
    this.speed = R(o.cruise[0], o.cruise[1]); this.t = R(0, 50); this.fear = 0; this.v = undefined; this.yawRate = 0; this.pitch = 0; this.roll = 0; this.lift = 0; this.pause = 0;
    let y;
    if (at) y = at.y;
    else if (o.mode === 'crawl') y = g + this.len * o.lift;
    else if (o.hover) y = g + R(o.alt[0], o.alt[1]);
    else y = clamp(sub.pos.y + R(-14, 14), -def.max, -def.min);
    this.y0 = y;
    this.pos.set(x, Math.max(y, g + (o.mode === 'crawl' ? this.len * o.lift : o.margin)), z);
    this.yaw = at && at.yaw !== undefined ? at.yaw : Math.atan2(sub.pos.x - x, sub.pos.z - z) + R(-0.9, 0.9);
    if (o.mode === 'crawl' && !at) { const k = this.len * 0.6; this.pos.y = Math.max(g, field.heightAt(x + k, z), field.heightAt(x - k, z), field.heightAt(x, z + k), field.heightAt(x, z - k)) + 0.2 + this.len * o.lift; }
    else if (o.mode === 'swim') this.pos.y = Math.max(this.pos.y, floorUnder(field, x, z, Math.sin(this.yaw), Math.cos(this.yaw), this.len) + this.len * o.clear + o.margin * 0.5);
    this.home = o.leash && site ? { x: site.x, z: site.z, r: o.leash } : null;
    this.active = true; this.mesh.visible = true; this.place(); this.halos.update(this.t, 0);
    return true;
  }
  update(dt, field, sub, ctx) {
    this.t += dt;
    if (this.o.mode === 'crawl') this.crawl(dt, field, sub); else this.swimStep(dt, field, sub);
    this.mat.userData.u.uFreq.value = this.o.mat.freq + (this.v ?? 0) * (this.o.freqK ?? 0);
    this.place();
    this.halos.update(this.t, Math.hypot(this.pos.x - sub.pos.x, this.pos.y - sub.pos.y, this.pos.z - sub.pos.z));
    if (!this.frozen && Math.hypot(this.pos.x - sub.pos.x, this.pos.z - sub.pos.z) > 200) this.deactivate();
  }
  swimStep(dt, field, sub) {
    const o = this.o, t = this.t, L = this.len, def = this.def;
    const away = this.scare(sub, dt);
    if (this.frozen) { this.v = 0.3; return; }
    let steer = 0;   // stay over water that can hold the species: turn toward the side with suitable seabed depth
    {
      const dist = L + 14, ah = Math.sin(this.yaw), bh = Math.cos(this.yaw), need = o.hover ? def.min : def.min + o.margin + L * (o.clear + 0.5) + 2;
      const dA = -field.heightAt(this.pos.x + ah * dist, this.pos.z + bh * dist);
      if (dA < need || (o.hover && dA > def.max + 2)) {
        const dl = -field.heightAt(this.pos.x + Math.sin(this.yaw + 0.9) * dist, this.pos.z + Math.cos(this.yaw + 0.9) * dist), dr = -field.heightAt(this.pos.x + Math.sin(this.yaw - 0.9) * dist, this.pos.z + Math.cos(this.yaw - 0.9) * dist);
        steer = (o.hover ? Math.abs(dl - (def.min + def.max) / 2) < Math.abs(dr - (def.min + def.max) / 2) : dl > dr) ? 0.7 : -0.7;
      }
    }
    let target = o.turn * (0.13 * Math.sin(t * 0.09 + this.y0) + 0.08 * Math.sin(t * 0.23 + 2)) + steer + clamp(angDiff(this.yaw, away), -1, 1) * this.fear * 0.9;
    if (o.maxTurn) target = clamp(target, -o.maxTurn, o.maxTurn);   // big animals: capped turn rate (o.maxTurn rad/s), eased in
    const dr = (target - this.yawRate) * (1 - Math.exp(-dt * (0.6 + this.fear * 2)));
    this.yawRate += o.maxTurn ? clamp(dr, -o.maxTurn * 0.4 * dt, o.maxTurn * 0.4 * dt) : dr;
    this.yaw += this.yawRate * dt;
    const ax = Math.sin(this.yaw), az = Math.cos(this.yaw);
    let gA = floorUnder(field, this.pos.x, this.pos.z, ax, az, L, this.pitch);
    for (const k of [0.5, 1, 2, 3]) gA = Math.max(gA, field.heightAt(this.pos.x + ax * L * k + ax * 4, this.pos.z + az * L * k + az * 4));
    let wantY;
    if (o.hover) wantY = gA + o.alt[0] + (o.alt[1] - o.alt[0]) * (0.5 + 0.5 * Math.sin(t * 0.06 + this.y0));
    else wantY = Math.max(clamp(this.y0 + o.yAmp * Math.sin(t * 0.04 + this.y0 * 0.3), -def.max, -def.min), gA + o.margin + L * o.clear);
    wantY = Math.min(-2, Math.max(wantY, gA + o.margin * 0.5 + L * o.clear));
    const v = swim(this, dt, this.speed, o.burst, o.acc, o.jerk);
    const sp = o.pulse ? v * (0.5 + 1.0 * Math.pow(Math.max(0, Math.sin(t * (1.1 + this.fear * 2.2))), 2)) : v;
    const dy = clamp((wantY - this.pos.y) * 0.25, -0.8, 1.4);
    const dp = (clamp(dy / Math.max(0.4, sp), -0.4, 0.55) - this.pitch) * (1 - Math.exp(-dt * 1.2));
    this.pitch += o.maxPitch ? clamp(dp, -o.maxPitch * dt, o.maxPitch * dt) : dp;
    const cp = Math.cos(this.pitch);
    this.pos.x += ax * cp * sp * dt; this.pos.z += az * cp * sp * dt; this.pos.y += Math.sin(this.pitch) * sp * dt;
    const g = floorUnder(field, this.pos.x, this.pos.z, ax, az, L, this.pitch) + L * o.clear + o.margin * 0.5;
    if (this.pos.y < g) this.pos.y = g;
    if (this.pos.y > -2) this.pos.y = -2;
    this.roll += (-this.yawRate * o.bank - this.roll) * (1 - Math.exp(-dt * 1.5));
  }
  /** seabed crawler: follows the ground, pitch / roll from the slope, wanders and pauses; scuttles (or jets, for the octopus) when scared */
  crawl(dt, field, sub) {
    const o = this.o, L = this.len, t = this.t;
    const away = this.scare(sub, dt);
    const ax = Math.sin(this.yaw), az = Math.cos(this.yaw);
    if (!this.frozen) {
      if (this.pause > 0) this.pause -= dt; else if (Math.random() < dt * 0.05) this.pause = R(3, 12);
      let want = this.yaw + 0.5 * Math.sin(t * 0.15 + this.y0) + 0.3 * Math.sin(t * 0.37);
      if (this.home) { const hd = Math.hypot(this.home.x - this.pos.x, this.home.z - this.pos.z); if (hd > this.home.r) want = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z); }
      const gAhead = field.heightAt(this.pos.x + ax * 3, this.pos.z + az * 3), gHere = field.heightAt(this.pos.x, this.pos.z);
      const d1 = -gAhead, slope = (gAhead - gHere) / 3;
      if (Math.abs(slope) > 0.6 || d1 < this.def.min || d1 > this.def.max + 2) want = this.yaw + Math.PI * 0.6;   // too steep or out of its depth band: turn
      if (this.fear > 0.08) want = away;
      this.yawRate += (clamp(angDiff(this.yaw, want), -1, 1) * (0.5 + this.fear * 2) - this.yawRate) * (1 - Math.exp(-dt * 1.5));
      this.yaw += this.yawRate * dt;
      let spd = this.pause > 0 && this.fear < 0.08 ? 0 : swim(this, dt, this.speed, o.burst, o.acc);
      if (this.pause > 0 && this.fear < 0.08) this.v = 0;
      if (o.jet && this.fear > 0.35) this.lift = Math.min(this.lift + dt * 1.2, L * 1.6); else this.lift = Math.max(0, this.lift - dt * 0.4);
      const sx = Math.sin(this.yaw), sz = Math.cos(this.yaw);
      this.pos.x += sx * spd * dt; this.pos.z += sz * spd * dt;
    }
    const sx = Math.sin(this.yaw), sz = Math.cos(this.yaw), rx = sz, rz = -sx, k = L * 0.5;
    const hf = field.heightAt(this.pos.x + sx * k, this.pos.z + sz * k), hb = field.heightAt(this.pos.x - sx * k, this.pos.z - sz * k);
    const hl = field.heightAt(this.pos.x - rx * k, this.pos.z - rz * k), hr = field.heightAt(this.pos.x + rx * k, this.pos.z + rz * k);
    const q = L * 0.25, hq1 = field.heightAt(this.pos.x + sx * q, this.pos.z + sz * q), hq2 = field.heightAt(this.pos.x - sx * q, this.pos.z - sz * q), dd = hf - hb;
    const clr = 0.14 + L * o.lift * 0.5, top = Math.max(field.heightAt(this.pos.x, this.pos.z), (hf + hb) * 0.5, (hl + hr) * 0.5, hq1 - dd * 0.25, hq2 + dd * 0.25);   // the tilted body lies on the slope; clear of the (coarser) terrain mesh
    const want = top + clr + this.lift;
    if (!this.frozen) this.pos.y += (want - this.pos.y) * (1 - Math.exp(-dt * (this.lift > 0.05 ? 3 : 8)));
    if (!this.frozen && this.pos.y < top + clr * 0.8) this.pos.y = top + clr * 0.8;   // never below the surface
    this.pitch = Math.atan2(hf - hb, 2 * k);   // body lies on the slope
    this.roll = Math.atan2(hr - hl, 2 * k);
    if (!this.frozen) {   // support check on the tilted body itself: lift until no part of it is inside the seabed
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch), cr = Math.cos(this.roll), sr = Math.sin(this.roll);
      let lift = 0;
      for (const m of [-0.5, -0.25, 0.25, 0.5]) lift = Math.max(lift, field.heightAt(this.pos.x + sx * cp * L * m, this.pos.z + sz * cp * L * m) + clr * 0.8 - (this.pos.y + sp * L * m));
      for (const m of [-0.3, 0.3]) lift = Math.max(lift, field.heightAt(this.pos.x + rx * cr * L * m, this.pos.z + rz * cr * L * m) + clr * 0.8 - (this.pos.y + sr * L * m));
      if (lift > 0) this.pos.y += lift;
    }
    if (this.v === undefined) this.v = 0;
  }
  /** body chain collision (sperm whale) */
  hit(pos, vel, radius) {
    const c = this.pos, len = this.len, speed = this.v ?? this.speed;
    if (Math.abs(pos.x - c.x) > len || Math.abs(pos.z - c.z) > len || Math.abs(pos.y - c.y) > len) return 0;
    const cp = Math.cos(this.pitch), fx = Math.sin(this.yaw) * cp, fy = Math.sin(this.pitch), fz = Math.cos(this.yaw) * cp;
    let best = 0;
    for (let i = 0; i < WHALE_SPINE.length; i += 2) {
      const z = WHALE_SPINE[i] * len, r = WHALE_SPINE[i + 1] * len + radius;
      const sx = c.x + fx * z, sy = c.y + fy * z, sz = c.z + fz * z, ox = pos.x - sx, oy = pos.y - sy, oz = pos.z - sz, d2 = ox * ox + oy * oy + oz * oz;
      if (d2 >= r * r) continue;
      const d = Math.sqrt(d2) || 1e-4, nx = ox / d, ny = oy / d, nz = oz / d;
      pos.x = sx + nx * r; pos.y = sy + ny * r; pos.z = sz + nz * r;
      const vn = (vel.x - fx * speed) * nx + (vel.y - fy * speed) * ny + (vel.z - fz * speed) * nz;
      if (vn < 0) { vel.x -= nx * vn * 1.15; vel.y -= ny * vn * 1.15; vel.z -= nz * vn * 1.15; best = Math.max(best, -vn); }
    }
    return best;
  }
}

// ───────────────────────────── instanced groups ─────────────────────────────
/** Common state of an instanced cluster: per-member arrays and the fear of nearby threats. */
class Cluster {
  constructor(scene, def, geometry, cap, matOpts) {
    this.def = def; this.cap = cap; this.mat = makeDeepMaterial(matOpts); this.mesh = mkInstanced(scene, geometry, this.mat, cap);
    this.P = new Float32Array(cap * 3); this.V = new Float32Array(cap * 3); this.O = new Float32Array(cap * 3);
    this.PH = new Float32Array(cap); this.SZ = new Float32Array(cap); this.YAW = new Float32Array(cap); this.PIT = new Float32Array(cap); this.FL = new Float32Array(cap);
    this.active = false; this.n = 0; this.t = 0; this.fear = 0; this.timer = R(10, 40); this.c = new THREE.Vector3(); this.radius = 3; this.site = null; this.frozen = false;
  }
  fearOf(dt, threats, radiusBase) {
    let f = 0;
    for (const th of threats) { const d = Math.hypot(this.c.x - th.x, this.c.y - th.y, this.c.z - th.z), reach = th.r + radiusBase; if (d < reach) f = Math.max(f, 1 - d / reach); }
    this.fear += (f - this.fear) * (1 - Math.exp(-dt * (f > this.fear ? 4 : 0.6)));
    return this.fear;
  }
  tint(i, c) { this.mesh.setColorAt(i, c); }
  hide() { this.active = false; this.mesh.count = 0; if (this.site) { this.site = null; } this.frozen = false; }
}

/** School of lanternfish: a loose ball of members following a wandering centre; rises toward the surface at night. */
class School extends Cluster {
  constructor(scene, def) { super(scene, def, geo('lantern'), 80, { mode: 'wave', freq: 9, amp: 0.1, wave: 6, axis: [1, 0, 0], pulse: 0.5 }); this.D = new Float32Array(80 * 3); this.W = new Float32Array(80); this.vc = new THREE.Vector3(); this.yaw = 0; this.speed = 1; this.spread = 1; }
  spawn(field, sub, ctx, at) {
    const def = this.def, sp = at ? { x: at.x, z: at.z, g: field.heightAt(at.x, at.z), w: 1 } : findSpot(def, field, sub, ctx, false);
    if (!accept(sp)) { this.timer = R(3, 8); return false; }
    this.n = at && at.n ? Math.min(this.cap, at.n) : Math.floor(R(22, 76)); this.size = R(def.len[0], def.len[1]); this.radius = clamp(1.5 + Math.cbrt(this.n) * R(0.9, 1.5), 2, 8);
    this.speed = R(0.9, 1.8); this.t = R(0, 100); this.seed = [R(0, 6), R(0, 6), R(0, 6)]; this.depthPref = Math.random();
    const top = ctx.phase === 'night' ? 8 : def.min;
    const y = at ? at.y : clamp(sub.pos.y + R(-10, 10), -def.max, -top);
    this.c.set(sp.x, Math.max(y, sp.g + 4), sp.z); this.yaw = at ? at.yaw ?? 0 : R(0, 6.28); this.fear = 0; this.spread = 1;
    const c1 = new THREE.Color(), c2 = new THREE.Color();
    c1.setHSL(R(0.58, 0.64), 0.35, 0.8); c2.setHSL(R(0.55, 0.62), 0.25, 0.65);
    const col = new THREE.Color();
    for (let i = 0; i < this.n; i++) {
      const j = i * 3; let x, y2, z; do { x = R(-1, 1); y2 = R(-1, 1); z = R(-1, 1); } while (x * x + y2 * y2 + z * z > 1);
      this.O[j] = x; this.O[j + 1] = y2; this.O[j + 2] = z; this.W[i] = R(0.25, 0.8) * (Math.random() < 0.5 ? -1 : 1); this.PH[i] = R(0, 6.28); this.SZ[i] = this.size * R(0.85, 1.15);
      this.P[j] = this.c.x + x * this.radius; this.P[j + 1] = this.c.y + y2 * this.radius * 0.5; this.P[j + 2] = this.c.z + z * this.radius; this.V[j] = this.V[j + 1] = this.V[j + 2] = 0;
      this.D[j] = Math.sin(this.yaw); this.D[j + 1] = 0; this.D[j + 2] = Math.cos(this.yaw); this.FL[i] = field.heightAt(this.P[j], this.P[j + 2]) + 0.9; if (this.P[j + 1] < this.FL[i]) this.P[j + 1] = this.FL[i];
      this.tint(i, col.copy(c1).lerp(c2, Math.random()).multiplyScalar(R(0.8, 1.05)));
    }
    this.mesh.instanceColor.needsUpdate = true; this.mesh.count = this.n; this.active = true; this.vc.set(0, 0, 0);
    return true;
  }
  update(dt, frame, field, sub, ctx) {
    this.t += dt; const t = this.t, s = this.seed, def = this.def;
    this.fearOf(dt, ctx.threats, this.radius);
    let fx = 0, fz = 0;
    for (const th of ctx.threats) { const dx = this.c.x - th.x, dz = this.c.z - th.z, d = Math.hypot(dx, dz) + 0.1; if (d < th.r + this.radius) { fx += dx / d; fz += dz / d; } }
    this.spread += ((1 + this.fear * 1.2) - this.spread) * (1 - Math.exp(-dt * 2));
    const boost = 1 + this.fear * 1.6;
    if (!this.frozen) {
      let yr = 0.12 * Math.sin(t * 0.13 + s[0]) + 0.08 * Math.sin(t * 0.31 + s[1]);
      if (this.fear > 0.05) yr += clamp(angDiff(this.yaw, Math.atan2(fx, fz)), -1, 1) * 1.4 * this.fear;
      this.yaw += yr * dt;
      const ax = Math.sin(this.yaw), az = Math.cos(this.yaw), v = this.speed * boost, gA = field.heightAt(this.c.x + ax * 12, this.c.z + az * 12);
      this.vc.x = ax * v; this.vc.z = az * v;
      const top = ctx.phase === 'night' ? 8 : def.min, wantY = clamp(-(top + (def.max - top) * 0.55 * this.depthPref + 4 * Math.sin(t * 0.07 + s[2])), -def.max, -top);
      const ty = Math.max(wantY, gA + 4);
      this.vc.y += (clamp((ty - this.c.y) * 0.2, -0.5, 0.5) - this.vc.y) * (1 - Math.exp(-dt * 1.5));
      this.c.addScaledVector(this.vc, dt);
    }
    const R0 = this.radius * this.spread, ca = Math.cos(this.yaw), sa = Math.sin(this.yaw), maxSp = this.speed * 1.5 * boost + 1.2;
    const arr = this.mesh.instanceMatrix.array, dartR = 1.2 + Math.pow(sub.speed, 1.3) * 1.4, dartK = 1.2 + sub.speed * 2;
    const kd = 1 - Math.exp(-dt * (3 + this.fear * 4)), kdir = 1 - Math.exp(-dt * 6);
    for (let i = 0; i < this.n; i++) {
      const j = i * 3, a = t * this.W[i] + this.PH[i];
      const ox = (this.O[j] + 0.3 * Math.sin(a)) * 0.75 * R0, oy = (this.O[j + 1] + 0.25 * Math.sin(a * 1.3 + 1)) * 0.45 * R0, oz = (this.O[j + 2] + 0.3 * Math.cos(a * 0.9)) * 1.5 * R0;
      const tx = this.c.x + ox * ca + oz * sa, tz = this.c.z - ox * sa + oz * ca, ty = this.c.y + oy;
      let vx = this.vc.x + (tx - this.P[j]) * 1.7, vy = this.vc.y + (ty - this.P[j + 1]) * 1.7, vz = this.vc.z + (tz - this.P[j + 2]) * 1.7;
      const qx = this.P[j] - sub.pos.x, qy = this.P[j + 1] - sub.pos.y, qz = this.P[j + 2] - sub.pos.z, q2 = qx * qx + qy * qy + qz * qz;
      let lim = maxSp;
      if (q2 < dartR * dartR) { const q = Math.sqrt(q2) || 0.01, push = (1 - q / dartR) * dartK; vx += qx / q * push; vy += qy / q * push * 0.6; vz += qz / q * push; lim += push; }
      const vm = Math.hypot(vx, vy, vz); if (vm > lim) { const k = lim / vm; vx *= k; vy *= k; vz *= k; }
      this.V[j] += (vx - this.V[j]) * kd; this.V[j + 1] += (vy - this.V[j + 1]) * kd; this.V[j + 2] += (vz - this.V[j + 2]) * kd;
      this.P[j] += this.V[j] * dt; this.P[j + 1] += this.V[j + 1] * dt; this.P[j + 2] += this.V[j + 2] * dt;
      if ((i + frame) % 3 === 0) this.FL[i] = Math.max(field.heightAt(this.P[j], this.P[j + 2]), field.heightAt(this.P[j] + this.V[j] * 0.5, this.P[j + 2] + this.V[j + 2] * 0.5)) + 0.9;
      if (this.P[j + 1] < -def.max) { this.P[j + 1] = -def.max; if (this.V[j + 1] < 0) this.V[j + 1] = 0; }
      if (this.P[j + 1] < this.FL[i]) { this.P[j + 1] = this.FL[i]; if (this.V[j + 1] < 0) this.V[j + 1] = 0; }
      if (this.P[j + 1] > -2) this.P[j + 1] = -2;
      const sm = Math.hypot(this.V[j], this.V[j + 1], this.V[j + 2]);
      if (sm > 0.08) { this.D[j] += (this.V[j] / sm - this.D[j]) * kdir; this.D[j + 1] += (this.V[j + 1] / sm - this.D[j + 1]) * kdir; this.D[j + 2] += (this.V[j + 2] / sm - this.D[j + 2]) * kdir; }
      const dx = this.D[j], dy = this.D[j + 1], dz = this.D[j + 2], h = Math.hypot(dx, dz) || 1e-4;
      setInst(this.mesh, i, this.P[j], this.P[j + 1], this.P[j + 2], Math.atan2(dx, dz), Math.atan2(dy, h), 0, this.SZ[i]);
    }
    this.mat.userData.u.uFreq.value = 7 + this.speed * boost * 4;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** A bloom of drifting crown jellies: carried by the current, pulsing, rising and sinking a little. */
class Bloom extends Cluster {
  constructor(scene, def) { super(scene, def, geo('atolla'), 10, { mode: 'pulse', freq: 1.5, amp: 0.2, wave: 4, axis: [0, 1, 0], pulse: 0.45 }); this.sink = new Float32Array(10); }
  spawn(field, sub, ctx, at) {
    const def = this.def, sp = at ? { x: at.x, z: at.z, g: field.heightAt(at.x, at.z), w: 1 } : findSpot(def, field, sub, ctx, false);
    if (!accept(sp)) { this.timer = R(3, 8); return false; }
    this.n = at && at.n ? Math.min(this.cap, at.n) : Math.floor(R(1, 7)); this.radius = this.n > 1 ? R(4, 9) : 1; this.t = R(0, 100); this.fear = 0;
    this.c.set(sp.x, Math.max(at ? at.y : clamp(sub.pos.y + R(-12, 12), -def.max, -def.min), sp.g + 5), sp.z); this.y0 = this.c.y;
    const col = new THREE.Color();
    for (let i = 0; i < this.n; i++) {
      const j = i * 3; this.O[j] = R(-1, 1); this.O[j + 1] = R(-0.6, 0.6); this.O[j + 2] = R(-1, 1); this.PH[i] = R(0, 6.28); this.SZ[i] = R(def.len[0], def.len[1]); this.YAW[i] = R(0, 6.28);
      this.P[j] = this.c.x + this.O[j] * this.radius; this.P[j + 2] = this.c.z + this.O[j + 2] * this.radius; this.sink[i] = R(-0.05, 0.05);
      this.P[j + 1] = Math.max(this.c.y + this.O[j + 1] * this.radius, field.heightAt(this.P[j], this.P[j + 2]) + 0.9 * this.SZ[i] + 1.5);
      this.tint(i, col.setHSL(R(0.96, 1.02) % 1, R(0.7, 0.95), R(0.4, 0.55)).multiplyScalar(R(0.9, 1.1)));
    }
    this.mesh.instanceColor.needsUpdate = true; this.mesh.count = this.n; this.active = true;
    return true;
  }
  update(dt, frame, field, sub, ctx) {
    this.t += dt; const t = this.t, def = this.def;
    const f = this.fearOf(dt, ctx.threats, this.radius + 2);
    if (!this.frozen) {
      current(this.c.x, this.c.z, t, _cur);
      this.c.x += _cur.x * dt; this.c.z += _cur.z * dt;
      if (f > 0.02) { const dx = this.c.x - sub.pos.x, dz = this.c.z - sub.pos.z, d = Math.hypot(dx, dz) + 0.1; this.c.x += dx / d * f * 1.2 * dt; this.c.z += dz / d * f * 1.2 * dt; }
      const gC = field.heightAt(this.c.x, this.c.z), wantY = Math.max(clamp(this.y0 + 5 * Math.sin(t * 0.03), -def.max, -def.min), gC + 5);
      this.c.y += (wantY - this.c.y) * (1 - Math.exp(-dt * 0.4));
    }
    this.mat.userData.u.uFreq.value = 1.4 + f * 2.6;
    const kf = 1 - Math.exp(-dt * 0.5);
    for (let i = 0; i < this.n; i++) {
      const j = i * 3, a = t * 0.05 + this.PH[i];
      const tx = this.c.x + this.O[j] * this.radius + Math.sin(a) * 1.2, tz = this.c.z + this.O[j + 2] * this.radius + Math.cos(a * 0.8) * 1.2;
      const ty = this.c.y + this.O[j + 1] * this.radius + Math.sin(t * 0.21 + this.PH[i]) * 0.8 + this.sink[i] * Math.sin(t * 0.07) * 20;
      this.P[j] += (tx - this.P[j]) * kf; this.P[j + 1] += (ty - this.P[j + 1]) * kf; this.P[j + 2] += (tz - this.P[j + 2]) * kf;
      const floor = field.heightAt(this.P[j], this.P[j + 2]) + 0.9 * this.SZ[i] + 1.5;     // tentacles hang below the bell
      if (this.P[j + 1] < floor) this.P[j + 1] = floor;
      if (this.P[j + 1] < -def.max) this.P[j + 1] = -def.max;
      this.YAW[i] += dt * 0.08 * Math.sin(this.PH[i]);
      setInst(this.mesh, i, this.P[j], this.P[j + 1], this.P[j + 2], this.YAW[i], 0.05 * Math.sin(t * 0.3 + this.PH[i]), 0.05 * Math.cos(t * 0.27 + this.PH[i]), this.SZ[i]);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Swarm of vent shrimp pinned to a chimney: members hold a home inside the warm plume, jitter, and scatter from a fast sub. */
class ShrimpCloud extends Cluster {
  constructor(scene, def) { super(scene, def, geo('shrimp'), 90, { mode: 'wave', freq: 16, amp: 0.2, wave: 8, axis: [0, 1, 0], pulse: 0 }); this.D = new Float32Array(90 * 3); }
  spawn(field, sub, ctx, site, count) {
    const def = this.def; this.site = site; this.n = Math.min(this.cap, count); this.t = R(0, 50); this.fear = 0;
    this.radius = clamp(site.r * 0.7 + 1.2, 2, 5);
    this.c.set(site.x, site.y + 1.5, site.z);
    const col = new THREE.Color();
    for (let i = 0; i < this.n; i++) {
      const j = i * 3, a = R(0, 6.283), r = this.radius * Math.sqrt(Math.random()), h = R(0.2, 3.2) * (1 - 0.5 * r / this.radius);
      const hx = site.x + Math.cos(a) * r, hz = site.z + Math.sin(a) * r, g = field.heightAt(hx, hz);
      this.O[j] = hx; this.O[j + 1] = Math.max(g + 0.25 + h * 0.6, Math.min(site.y + h, g + 4)); this.O[j + 2] = hz;
      this.P[j] = hx; this.P[j + 1] = this.O[j + 1]; this.P[j + 2] = hz; this.V[j] = this.V[j + 1] = this.V[j + 2] = 0;
      this.PH[i] = R(0, 6.28); this.SZ[i] = R(def.len[0], def.len[1]) * R(0.85, 1.15); this.D[j] = R(-1, 1); this.D[j + 1] = 0; this.D[j + 2] = R(-1, 1); this.FL[i] = g + 0.3;
      this.tint(i, col.setHSL(R(0.04, 0.09), R(0.25, 0.5), R(0.78, 0.92)));
    }
    this.mesh.instanceColor.needsUpdate = true; this.mesh.count = this.n; this.active = true;
  }
  update(dt, frame, field, sub, ctx) {
    this.t += dt; const t = this.t;
    const dartR = 2.2 + Math.pow(sub.speed, 1.3) * 2.2, dartK = 1.5 + sub.speed * 2.5, kd = 1 - Math.exp(-dt * 4), kdir = 1 - Math.exp(-dt * 6), kh = 1 - Math.exp(-dt * 0.9);
    let f = 0;
    for (let i = 0; i < this.n; i++) {
      const j = i * 3, a = t * (0.7 + 0.5 * Math.sin(this.PH[i] * 3)) + this.PH[i];
      const hx = this.O[j] + Math.sin(a) * 0.45, hy = this.O[j + 1] + Math.sin(a * 1.3 + 1) * 0.3 + 0.3 * Math.sin(t * 0.4 + this.PH[i]), hz = this.O[j + 2] + Math.cos(a * 0.9) * 0.45;
      let vx = (hx - this.P[j]) * 1.6, vy = (hy - this.P[j + 1]) * 1.6, vz = (hz - this.P[j + 2]) * 1.6;
      const qx = this.P[j] - sub.pos.x, qy = this.P[j + 1] - sub.pos.y, qz = this.P[j + 2] - sub.pos.z, q2 = qx * qx + qy * qy + qz * qz;
      if (q2 < dartR * dartR) { const q = Math.sqrt(q2) || 0.01, push = (1 - q / dartR) * dartK; vx += qx / q * push; vy += qy / q * push * 0.5; vz += qz / q * push; f = Math.max(f, 1 - q / dartR); }
      this.V[j] += (vx - this.V[j]) * kd; this.V[j + 1] += (vy - this.V[j + 1]) * kd; this.V[j + 2] += (vz - this.V[j + 2]) * kd;
      this.P[j] += this.V[j] * dt; this.P[j + 1] += this.V[j + 1] * dt; this.P[j + 2] += this.V[j + 2] * dt;
      if ((i + frame) % 3 === 0) this.FL[i] = Math.max(field.heightAt(this.P[j], this.P[j + 2]), field.heightAt(this.P[j] + this.V[j] * 0.4, this.P[j + 2] + this.V[j + 2] * 0.4)) + 0.3;
      if (this.P[j + 1] < this.FL[i]) { this.P[j + 1] = this.FL[i]; if (this.V[j + 1] < 0) this.V[j + 1] = 0; }
      const sm = Math.hypot(this.V[j], this.V[j + 1], this.V[j + 2]);
      if (sm > 0.05) { this.D[j] += (this.V[j] / sm - this.D[j]) * kdir; this.D[j + 1] += (this.V[j + 1] / sm - this.D[j + 1]) * kdir; this.D[j + 2] += (this.V[j + 2] / sm - this.D[j + 2]) * kdir; }
      const dx = this.D[j], dy = this.D[j + 1], dz = this.D[j + 2], h = Math.hypot(dx, dz) || 1e-4;
      setInst(this.mesh, i, this.P[j], this.P[j + 1], this.P[j + 2], Math.atan2(dx, dz), Math.atan2(dy, h) * 0.6, 0, this.SZ[i]);
    }
    this.fear = f; this.mat.userData.u.uFreq.value = 12 + f * 12;
    this.mesh.instanceMatrix.needsUpdate = true;
    void ctx;
  }
}

/** Clump of yeti crabs on the warm rock around a vent: slow shufflers with waving claws; they scuttle off from a fast sub. */
class CrabClump extends Cluster {
  constructor(scene, def) { super(scene, def, geo('yeti'), 16, { mode: 'wave', freq: 2.4, amp: 0.16, wave: 6, axis: [0, 1, 0], pulse: 0 }); this.T = new Float32Array(16 * 2); this.PAUSE = new Float32Array(16); }
  spawn(field, sub, ctx, site, count) {
    this.site = site; this.n = Math.min(this.cap, count); this.t = R(0, 50); this.fear = 0; this.radius = clamp(site.r * 0.9 + 1.5, 2.5, 6);
    this.c.set(site.x, site.y, site.z);
    const col = new THREE.Color();
    for (let i = 0; i < this.n; i++) {
      const j = i * 3, a = R(0, 6.283), r = this.radius * Math.sqrt(Math.random()), x = site.x + Math.cos(a) * r, z = site.z + Math.sin(a) * r;
      this.P[j] = x; this.P[j + 2] = z; this.P[j + 1] = field.heightAt(x, z) + 0.1; this.T[i * 2] = x; this.T[i * 2 + 1] = z;
      this.PH[i] = R(0, 6.28); this.SZ[i] = R(this.def.len[0], this.def.len[1]); this.YAW[i] = R(0, 6.28); this.PIT[i] = 0; this.PAUSE[i] = R(0, 6); this.V[j] = 0;
      this.tint(i, col.setHSL(R(0.06, 0.11), R(0.08, 0.3), R(0.82, 0.96)));
    }
    this.mesh.instanceColor.needsUpdate = true; this.mesh.count = this.n; this.active = true;
  }
  update(dt, frame, field, sub, ctx) {
    this.t += dt; const t = this.t, site = this.site;
    const fearR = 3 + Math.pow(sub.speed, 1.4) * 2.5;
    let f = 0;
    for (let i = 0; i < this.n; i++) {
      const j = i * 3, x = this.P[j], z = this.P[j + 2], dxs = x - sub.pos.x, dzs = z - sub.pos.z, ds = Math.hypot(dxs, dzs, this.P[j + 1] - sub.pos.y);
      const scared = ds < fearR ? 1 - ds / fearR : 0; f = Math.max(f, scared);
      let spd = 0;
      if (scared > 0.05) {
        const away = Math.atan2(dxs, dzs); this.YAW[i] += angDiff(this.YAW[i], away) * Math.min(1, dt * 5); spd = 0.35 + scared * 1.6;
      } else {
        this.PAUSE[i] -= dt;
        if (this.PAUSE[i] < 0) { this.PAUSE[i] = R(2, 9); const a = R(0, 6.283), r = this.radius * Math.sqrt(Math.random()); this.T[i * 2] = site.x + Math.cos(a) * r; this.T[i * 2 + 1] = site.z + Math.sin(a) * r; }
        const tx = this.T[i * 2] - x, tz = this.T[i * 2 + 1] - z, td = Math.hypot(tx, tz);
        if (td > 0.3) { this.YAW[i] += angDiff(this.YAW[i], Math.atan2(tx, tz)) * Math.min(1, dt * 2); spd = Math.min(0.14, td * 0.3); }
      }
      const sx = Math.sin(this.YAW[i]), sz = Math.cos(this.YAW[i]);
      this.P[j] += sx * spd * dt; this.P[j + 2] += sz * spd * dt;
      const s = this.SZ[i], k = s * 0.35;
      const hf = field.heightAt(this.P[j] + sx * k, this.P[j + 2] + sz * k), hb = field.heightAt(this.P[j] - sx * k, this.P[j + 2] - sz * k);
      const hl = field.heightAt(this.P[j] - sz * k, this.P[j + 2] + sx * k), hr = field.heightAt(this.P[j] + sz * k, this.P[j + 2] - sx * k);
      this.P[j + 1] = this.frozen && this.holdY !== undefined ? this.holdY : Math.max(hf, hb, hl, hr) + s * 0.04 + 0.07;
      this.PIT[i] += (Math.atan2(hf - hb, 2 * k) - this.PIT[i]) * Math.min(1, dt * 4);
      setInst(this.mesh, i, this.P[j], this.P[j + 1], this.P[j + 2], this.YAW[i], this.PIT[i], Math.atan2(hr - hl, 2 * k), s);
    }
    this.fear = f; this.mat.userData.u.uFreq.value = 2.4 + f * 5;
    this.mesh.instanceMatrix.needsUpdate = true;
    void ctx; void frame; void field;
  }
}

// ───────────────────────────── the group ─────────────────────────────
class DeepGroup {
  constructor(game) {
    this.id = 'deep'; this.game = game; const scene = game.scene;
    this.critters = []; this.sites = new Sites();
    for (const [id, n] of Object.entries(SLOTS)) for (let i = 0; i < n; i++) this.critters.push(new Critter(scene, BY_ID[id]));
    this.schools = [new School(scene, BY_ID.lantern), new School(scene, BY_ID.lantern)];
    this.blooms = [new Bloom(scene, BY_ID.atolla)];
    this.shrimp = [new ShrimpCloud(scene, BY_ID.shrimp), new ShrimpCloud(scene, BY_ID.shrimp)];
    this.crabs = [new CrabClump(scene, BY_ID.yeti), new CrabClump(scene, BY_ID.yeti)];
    this.frame = 0;
    this.drifters = [...this.schools, ...this.blooms]; this.vents = [this.shrimp, this.crabs]; this.clusters = [...this.drifters, ...this.shrimp, ...this.crabs];
  }
  *all() { yield* this.critters; yield* this.schools; yield* this.blooms; yield* this.shrimp; yield* this.crabs; }
  update(dt, sub, ctx) {
    this.frame++; const { field } = ctx; this.ctx = ctx;
    this.sites.refresh(dt, field, sub, ctx);
    for (const c of this.critters) {
      if (c.active) { c.update(dt, field, sub, ctx); continue; }
      if (c.o.mode === 'crawl' && c.o.leash) { this.ventOctopus(c, dt, field, sub, ctx); continue; }
      c.tryNext(dt, field, sub, ctx);
    }
    for (const g of this.drifters) {
      if (g.active) {
        const d = Math.hypot(g.c.x - sub.pos.x, g.c.z - sub.pos.z);
        if (d > 175 && !g.frozen) { g.hide(); g.timer = R(20, 60); continue; }
        g.update(dt, this.frame, field, sub, ctx);
      } else { g.timer -= dt * (g.def.act[ctx.phase] ?? 1) * profMul(g.def, ctx); if (g.timer <= 0) { if (!g.spawn(field, sub, ctx)) continue; g.timer = R(30, 80); } }
    }
    for (const pool of this.vents) for (const g of pool) {
      if (g.active) {
        const d = Math.hypot(g.site.x - sub.pos.x, g.site.z - sub.pos.z);
        if (d > 200 && !g.frozen) { this.sites.claims.delete(g.def.id + '|' + g.site.key); g.hide(); g.timer = R(10, 30); continue; }
        g.update(dt, this.frame, field, sub, ctx);
      } else {
        g.timer -= dt; if (g.timer > 0) continue;
        const crab = pool === this.crabs, def = g.def, prof = def.profile[ctx.profile] ?? def.profile.other;
        const site = this.sites.pick(sub, def, crab ? ['vent'] : ['vent', 'magma']);
        if (!site || Math.random() > prof) { g.timer = R(4, 10); continue; }
        this.sites.claims.set(def.id + '|' + site.key, g);
        g.spawn(field, sub, ctx, site, crab ? Math.floor(R(5, 15)) : Math.floor(R(45, 91)));
      }
    }
  }
  /** the vent octopus lives at a vent: it appears near an unclaimed site and keeps close to it */
  ventOctopus(c, dt, field, sub, ctx) {
    c.timer -= dt; if (c.timer > 0) return;
    const prof = c.def.profile[ctx.profile] ?? c.def.profile.other, site = this.sites.pick(sub, c.def, ['vent', 'magma']);
    if (!site || Math.random() > prof) { c.timer = R(4, 10); return; }
    this.sites.claims.set(c.def.id + '|' + site.key, c); c.site = site;
    c.spawn(field, sub, ctx, site);
  }
  threats(push) { for (const c of this.critters) if (c.active && c.id === 'spermwhale') push({ x: c.pos.x, y: c.pos.y, z: c.pos.z, r: 18 }); }
  collide(pos, vel, radius) { let best = 0; for (const c of this.critters) if (c.active && c.id === 'spermwhale') best = Math.max(best, c.hit(pos, vel, radius)); return best; }
  hideAll() { for (const g of this.all()) { if (g.deactivate) g.deactivate(R(10, 40)); else g.hide(); } this.sites.claims.clear(); }
  sightings(emit) {
    for (const c of this.critters) {
      if (!c.active) continue;
      emit(c.def, c.o.kind, c.len * c.o.fr, c.pos.x, c.pos.y, c.pos.z, { maxDist: c.o.maxDist, minFrac: 0.008 });
    }
    for (const g of this.clusters) {
      if (!g.active || g.mesh.count === 0) continue;
      const cx = g.c.x, cy = g.c.y, cz = g.c.z;
      if (emit.occluded(cx, cy, cz)) continue;
      const big = g.def.id === 'atolla' || g.def.id === 'yeti';
      for (let i = 0; i < g.n; i++) {
        const j = i * 3, len = g.def.id === 'lantern' || g.def.id === 'atolla' ? g.SZ[i] : g.SZ[i] * 1.0;
        emit(g.def, 'fish', len, g.P[j], g.P[j + 1], g.P[j + 2], { maxDist: big ? 70 : 55, minFrac: g.def.id === 'shrimp' ? 0.0035 : 0.005, checked: true });
      }
    }
  }

  // ---- test / debug API (window.__game.deep) ----
  /** place a species in front of the sub, side-on, frozen in place (screenshots). Returns the animal / cluster. */
  pose(id, { dist = 6, dy = 0, yawOff = Math.PI / 2, count } = {}) {
    const sub = this.game.sub, field = this.game.field, def = BY_ID[id], ctx = this.ctx;
    const x = sub.pos.x + Math.sin(sub.yaw) * dist, z = sub.pos.z + Math.cos(sub.yaw) * dist, y = sub.pos.y + dy;
    for (const x of this.all()) if (x.frozen) { if (x.deactivate) x.deactivate(1e9); else x.hide(); }
    const list = [...this.all()].filter((g) => g.def === def);
    for (const g of list) { if (g.deactivate) g.deactivate(1e9); else g.hide(); }
    const g = list[0], at = { x, y, z, yaw: sub.yaw + yawOff, n: count };
    if (g instanceof Critter) g.spawn(field, sub, ctx, null, at);
    else if (g instanceof School || g instanceof Bloom) g.spawn(field, sub, ctx, at);
    else { const h = field.heightAt(x, z), site = { key: 'pose', type: 'vent', x, z, y: h, g: h, r: 3 }; g.spawn(field, sub, ctx, site, count || (g instanceof CrabClump ? 8 : 60)); }
    g.frozen = true; if (g instanceof Bloom) g.radius = g.n > 1 ? 2.2 : 0.5; if (g instanceof CrabClump) g.holdY = y;
    return g;
  }
}

// Encyclopedia 3D view: fresh geometry per open; tints follow the in-sea instance colours (clusters) or body tint (singles)
const VIEW_TINT = { lantern: [0.6, 0.3, 0.72], atolla: [0.99, 0.8, 0.48], shrimp: [0.07, 0.4, 0.86], yeti: [0.08, 0.2, 0.88] };
const VIEW_SCHOOL = new Set(['lantern', 'atolla', 'shrimp', 'yeti']);
for (const def of DEEP) {
  const t = VIEW_TINT[def.id], tint = t ? new THREE.Color().setHSL(t[0], t[1], t[2]) : new THREE.Color().setScalar(TINT[def.id] ? (TINT[def.id][0] + TINT[def.id][1]) / 2 : 1);
  registerModel(def.id, { geometry: M.MODELS[def.id], tint, kind: VIEW_SCHOOL.has(def.id) ? 'school-member' : 'single' });
}

// ───────────────────────────── feature ─────────────────────────────
const feature = {
  name: 'deep',
  init(game) { game.deep = game.fauna.addGroup(new DeepGroup(game)); },
};
export default feature;
export { DeepGroup, Critter, School, Bloom, ShrimpCloud, CrabClump, makeDeepMaterial };
