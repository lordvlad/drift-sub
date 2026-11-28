import * as THREE from 'three';
import { makeCreatureMaterial } from '../materials.js';
import { alarm, swim } from '../fauna.js';
import { bandY, registerSpecies } from '../species.js';
import { registerSheets } from '../bestiary-data.js';
import { PELAGIC_SHEETS } from '../data/pelagic-sheets.js';
import * as M from '../models/pelagic.js';

/**
 * Open-ocean animals (barracuda's places) and cave / arch / wreck / reef-labyrinth animals (manta's places).
 * One fauna group (fauna.addGroup) that owns instanced schools (tuna, mahi-mahi, great barracuda, scalloped hammerhead, pennant coralfish)
 * and single animals (sailfish, green moray with its den rock, goliath grouper, hawksbill turtle, octopus).
 * Spawning is weighted by field.biomeAt and the active submarine (profile); landmark features attract some species.
 * All meshes are allocated once; animals are recycled when far away, so memory is bounded.
 */

const R = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const TAU = Math.PI * 2;

// ───────────────────────────── species ─────────────────────────────
// hab: 'open' (barracuda's places) | 'cave' (manta's places). aff: biome weights the species is drawn to (rock = field.rockAt).
// near: landmark feature types it is drawn to (spawns around them with probability nearChance). act: activity by time of day.
// second: a second slot of the species that only runs for the submarine whose places they are (profile multiplier >= 1.5).
export const PELAGIC = [
  { id: 'yellowfin', name: 'Yellowfin tuna', hab: 'open', cls: 'school', min: 6, max: 55, value: 26, weight: 3, len: [1.0, 1.7], count: [10, 34], second: true,
    aff: { open: 1, deep: 0.35 }, thresh: 0.5, near: ['dropoff', 'seamount'], nearChance: 0.3,
    mode: 'cruise', cruise: [3.2, 4.6], burst: 11, acc: 5, shy: 0.8, depth: [8, 36], shape: [0.5, 0.38, 1.9], r0: 2, rk: 1.15, rmax: 14,
    mat: { amp: 0.1, freq: 10, wave: 6 }, act: { night: 0.5, dawn: 1.3, morning: 1.2, day: 1.1, evening: 1.3 } },
  { id: 'mahi', name: 'Mahi-mahi', hab: 'open', cls: 'school', min: 2, max: 24, value: 22, weight: 2.5, len: [0.8, 1.3], count: [3, 10], second: true,
    aff: { open: 1 }, thresh: 0.6, near: ['seamount'], nearChance: 0.15,
    mode: 'cruise', cruise: [2.2, 3.2], burst: 9, acc: 5, shy: 0.7, depth: [3.5, 12], shape: [0.8, 0.5, 1.2], r0: 1.4, rk: 1.3, rmax: 7,
    mat: { amp: 0.11, freq: 9, wave: 6 }, act: { night: 0.3, dawn: 1.3, morning: 1.5, day: 1.5, evening: 1.1 } },
  { id: 'gbarracuda', name: 'Great barracuda', hab: 'open', cls: 'school', min: 3, max: 36, value: 34, weight: 2.5, len: [1.0, 1.7], count: [3, 14], second: true,
    aff: { open: 0.85, reef: 0.55, bigreef: 0.9, wreck: 1, cave: 0.3 }, thresh: 0.45, near: ['wreck', 'bigreef', 'seamount'], nearChance: 0.3,
    mode: 'hover', cruise: [0.2, 0.5], burst: 8.5, acc: 7, shy: 0.55, depth: [4, 16], shape: [0.55, 0.4, 1.5], r0: 2, rk: 1.2, rmax: 8,
    mat: { amp: 0.09, freq: 6, wave: 6 }, act: { night: 0.8, dawn: 1.3, morning: 1.1, day: 1, evening: 1.3 } },
  { id: 'sailfish', name: 'Sailfish', hab: 'open', cls: 'sailfish', min: 3, max: 40, value: 140, rare: true, weight: 1, len: [2.2, 3.1],
    aff: { open: 1, deep: 0.3 }, thresh: 0.55, mat: { amp: 0.07, freq: 5, wave: 5 }, act: { night: 0.3, dawn: 1.7, morning: 1.3, day: 1, evening: 1.6 } },
  { id: 'hammerhead', name: 'Scalloped hammerhead', hab: 'open', cls: 'school', min: 10, max: 58, value: 95, rare: true, weight: 0.8, len: [2.2, 3.6], count: [6, 22],
    aff: { open: 0.8, deep: 0.7 }, thresh: 0.5, near: ['seamount', 'dropoff'], nearChance: 0.5,
    mode: 'cruise', cruise: [1.5, 2.4], burst: 6.5, acc: 2.5, shy: 1.35, depth: [14, 44], shape: [1.0, 0.45, 1.3], r0: 5, rk: 2.4, rmax: 15,
    mat: { amp: 0.09, freq: 4, wave: 5 }, act: { night: 0.8, dawn: 2.2, morning: 0.8, day: 0.45, evening: 2.4 } },
  { id: 'moray', name: 'Green moray', hab: 'cave', cls: 'moray', bottom: true, min: 4, max: 45, value: 48, weight: 2, len: [1.4, 2.1], second: true,
    aff: { cave: 1, wreck: 1, bigreef: 0.9, reef: 0.55, rock: 0.5 }, thresh: 0.3,
    mat: { amp: 0.012, freq: 4.5, wave: 9 }, act: { night: 1.8, dawn: 1.3, morning: 0.8, day: 0.7, evening: 1.5 } },
  { id: 'goliath', name: 'Goliath grouper', hab: 'cave', cls: 'goliath', min: 8, max: 55, value: 115, rare: true, weight: 1, len: [1.7, 2.6],
    aff: { wreck: 1.3, cave: 1, bigreef: 0.8, reef: 0.35, rock: 0.4 }, thresh: 0.3, near: ['wreck', 'cave', 'arch', 'bigreef', 'garden'], nearChance: 0.7,
    mat: { amp: 0.05, freq: 3, wave: 4 }, act: { night: 0.7, dawn: 1.3, morning: 1.1, day: 1, evening: 1.2 } },
  { id: 'hawksbill', name: 'Hawksbill turtle', hab: 'cave', cls: 'hawksbill', min: 3, max: 35, value: 95, rare: true, weight: 1, len: [0.85, 1.25],
    aff: { reef: 0.8, bigreef: 1, wreck: 0.5, cave: 0.5, rock: 0.25, open: 0.08 }, thresh: 0.3, near: ['bigreef', 'arch'], nearChance: 0.3,
    mat: { mode: 'flap', amp: 0.15, freq: 3, wave: 2 }, act: { night: 0.5, dawn: 1.2, morning: 1.4, day: 1.3, evening: 1 } },
  { id: 'octopus', name: 'Common octopus', hab: 'cave', cls: 'octopus', bottom: true, min: 3, max: 50, value: 70, weight: 1.3, len: [0.8, 1.3], second: true,
    aff: { reef: 0.5, rock: 0.7, cave: 1, wreck: 0.8, bigreef: 0.6 }, thresh: 0.3,
    mat: { amp: 0.035, freq: 2, wave: 6 }, act: { night: 1.6, dawn: 1.4, morning: 0.8, day: 0.7, evening: 1.4 } },
  { id: 'bannerfish', name: 'Pennant coralfish', hab: 'cave', cls: 'school', min: 3, max: 40, value: 14, weight: 2, len: [0.2, 0.28], count: [6, 22], second: true,
    aff: { reef: 0.8, bigreef: 1, wreck: 0.6, cave: 0.9, rock: 0.3 }, thresh: 0.3, near: ['cave', 'arch', 'garden', 'bigreef', 'wreck'], nearChance: 0.5,
    mode: 'mill', cruise: [0.3, 0.7], burst: 3, acc: 4, shy: 0.8, depth: [1.2, 4], shape: [1, 0.7, 1], r0: 1.2, rk: 1.1, rmax: 5,
    mat: { amp: 0.06, freq: 9, wave: 7 }, act: { night: 0.3, dawn: 0.9, morning: 1.3, day: 1.4, evening: 0.9 } },
];
// the vertex colours are authored for the model preview; the sea is darker, so each species gets a small brightness gain
const GAIN = { yellowfin: 1.2, mahi: 1.3, gbarracuda: 1.35, hammerhead: 1.2, bannerfish: 1.1, sailfish: 1.2, moray: 1.3, goliath: 1.4, hawksbill: 1.2 };
registerSpecies(PELAGIC);
registerSheets(PELAGIC_SHEETS);

// spawn-rate multiplier by active submarine: the barracuda's places are open water, the manta's are caves / wrecks / reef mazes
const PROF = { open: { barracuda: 2.3, lemon: 1, manta: 0.5, squid: 0.7 }, cave: { manta: 2.3, lemon: 1, barracuda: 0.5, squid: 0.7 } };

// ───────────────────────────── spawn sites ─────────────────────────────
const _b = {};
function biomeOf(f, x, z) {
  if (f.biomeAt) return f.biomeAt(x, z, _b);
  const reef = f.reefAt(x, z), rock = f.rockAt(x, z);   // before the terrain knows biomes
  _b.reef = reef; _b.bigreef = 0; _b.open = Math.max(0, 1 - reef - rock * 0.5); _b.deep = 0; _b.cave = rock * 0.3; _b.wreck = 0; _b.vent = 0; _b.magma = 0; _b.trench = 0;
  return _b;
}
function affinity(sp, f, x, z) {
  const b = biomeOf(f, x, z); let s = 0;
  for (const k in sp.aff) s = Math.max(s, (k === 'rock' ? f.rockAt(x, z) : b[k] || 0) * sp.aff[k]);
  return s;
}
/** A place for a new animal 92-150 m from the sub (never in plain sight): near a matching landmark, else the best biome match on a ring ahead. */
function findSpot(f, sub, sp, minD = 92, maxD = 150) {
  const sx = sub.pos.x, sz = sub.pos.z;
  if (sp.near && f.featuresNear && Math.random() < sp.nearChance) {
    const c = f.featuresNear(sx, sz, 175).filter((ft) => sp.near.includes(ft.type) && Math.hypot(ft.x - sx, ft.z - sz) > minD && Math.hypot(ft.x - sx, ft.z - sz) < 190);
    if (c.length) {
      const ft = c[Math.floor(Math.random() * c.length)], a = R(0, TAU), d = Math.sqrt(Math.random()) * Math.min(ft.r * 0.6, 30);
      const x = ft.x + Math.cos(a) * d, z = ft.z + Math.sin(a) * d, g = f.heightAt(x, z);
      if (-g >= sp.min + 1.5 && !(sp.bottom && -g > sp.max)) return { x, z, g, feature: ft };
    }
  }
  const head = Math.atan2(sub.fwd.x, sub.fwd.z);
  let best = null;
  for (let i = 0; i < 9; i++) {
    const a = head + R(-2.4, 2.4), d = R(minD, maxD), x = sx + Math.sin(a) * d, z = sz + Math.cos(a) * d, g = f.heightAt(x, z);
    if (-g < sp.min + 1.5 || (sp.bottom && -g > sp.max)) continue;
    const s = affinity(sp, f, x, z) * R(0.75, 1);
    if (!best || s > best.s) best = { x, z, g, s };
  }
  return best && best.s >= sp.thresh ? best : null;
}
const BAND = (sp, y, g, m) => bandY(sp, y, g, m);

// ───────────────────────────── instanced schools ─────────────────────────────
class School {
  constructor(scene, sp, geo, slot) {
    this.sp = sp; this.slot = slot; this.cap = sp.count[1];
    this.mat = makeCreatureMaterial(sp.mat);
    this.mesh = new THREE.InstancedMesh(geo, this.mat, this.cap); this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(this.mesh);
    const n = this.cap;
    this.P = new Float32Array(n * 3); this.V = new Float32Array(n * 3); this.D = new Float32Array(n * 3); this.O = new Float32Array(n * 3);
    this.W = new Float32Array(n); this.PH = new Float32Array(n); this.SZ = new Float32Array(n); this.FL = new Float32Array(n);
    this.c = new THREE.Vector3(); this.vc = new THREE.Vector3(); this.home = new THREE.Vector3();
    this.active = false; this.timer = R(1, 12); this.n = 0; this.t = 0; this.yaw = 0; this.fear = 0; this.fs = 0; this.seedP = [0, 0, 0, 0];
  }
  spawn(spot, sub, ctx) {
    const sp = this.sp, n = this.n = Math.floor(R(sp.count[0], sp.count[1] + 1));
    this.size = R(sp.len[0], sp.len[1]);
    this.radius = clamp(sp.r0 + Math.cbrt(n) * sp.rk * (0.6 + this.size * 0.4), sp.r0, sp.rmax);
    this.cruise = R(sp.cruise[0], sp.cruise[1]); this.v = undefined; this.fear = 0; this.fs = 0;
    this.t = Math.random() * 100; this.seedP = [R(0, 6), R(0, 6), R(0, 6), R(0, 6)];
    this.depth = R(sp.depth[0], sp.depth[1]);
    this.home.set(spot.x, 0, spot.z);
    this.c.set(spot.x, this.wantY(spot.g, 0), spot.z); this.vc.set(0, 0, 0);
    this.yaw = Math.atan2(sub.pos.x - spot.x + R(-40, 40), sub.pos.z - spot.z + R(-40, 40));
    const col = this.mesh.instanceColor, c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const j = i * 3; let x, y, z; do { x = R(-1, 1); y = R(-1, 1); z = R(-1, 1); } while (x * x + y * y + z * z > 1);
      this.O[j] = x; this.O[j + 1] = y; this.O[j + 2] = z; this.W[i] = R(0.3, 0.9) * (Math.random() < 0.5 ? -1 : 1); this.PH[i] = R(0, TAU);
      this.SZ[i] = this.size * R(0.88, 1.12);
      c.setScalar(R(0.9, 1.12) * (GAIN[sp.id] ?? 1)); col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    const ca = Math.cos(this.yaw), sa = Math.sin(this.yaw), [sx, sy, sz] = sp.shape, top = -Math.max(2, sp.min), bot = -sp.max, clr = this.size * 0.3 + 0.4;
    for (let i = 0; i < n; i++) {   // members start inside the school's blob, inside the depth band and above the seabed
      const j = i * 3, ox = this.O[j] * sx * this.radius, oy = this.O[j + 1] * sy * this.radius, oz = this.O[j + 2] * sz * this.radius;
      const px = this.c.x + ox * ca + oz * sa, pz = this.c.z - ox * sa + oz * ca;
      this.P[j] = px; this.P[j + 2] = pz; this.P[j + 1] = Math.max(clamp(this.c.y + oy, bot, top), ctx.field.heightAt(px, pz) + clr);
      this.V[j] = 0; this.V[j + 1] = 0; this.V[j + 2] = 0; this.D[j] = sa; this.D[j + 1] = 0; this.D[j + 2] = ca; this.FL[i] = -1e9;
    }
    this.mesh.count = n; this.active = true;
  }
  /** preferred centre height: a depth below the surface (open water) or an altitude above the seabed (reef schools), never inside the seabed */
  wantY(g, t) {
    const sp = this.sp, clr = this.size * 0.5 + 2.5;
    const y = sp.mode === 'mill' ? g + this.depth + Math.sin(t * 0.09 + this.seedP[2]) * 0.7 : -(this.depth + Math.sin(t * 0.05 + this.seedP[2]) * 3);
    return BAND(sp, Math.max(y, g + clr), g, clr);
  }
  update(dt, frame, sub, ctx) {
    const sp = this.sp, field = ctx.field, th = ctx.threats; this.t += dt; const t = this.t, S = this.seedP;
    // fear: threats (sub, sharks, ...) scaled by shyness; the school's own size widens the reach
    let fx = 0, fz = 0, f = 0;
    for (const k of th) {
      const dx = this.c.x - k.x, dy = this.c.y - k.y, dz = this.c.z - k.z, d = Math.hypot(dx, dy, dz), reach = k.r * sp.shy + this.radius * 0.7;
      if (d < reach) { const q = 1 - d / reach; if (q > f) f = q; fx += (dx / (d + 0.1)) * q; fz += (dz / (d + 0.1)) * q; }
    }
    this.fs += (f - this.fs) * (1 - Math.exp(-dt * (f > this.fs ? 4 : 0.6)));
    this.fear = this.fs;
    const spd = swim(this, dt, this.cruise, sp.burst, sp.acc);
    const away = Math.atan2(fx, fz);
    // --- centre motion ---
    if (sp.mode === 'mill') {
      const tx = this.home.x + Math.sin(t * 0.06 + S[0]) * 6 + fx * 7 * this.fs, tz = this.home.z + Math.cos(t * 0.05 + S[1]) * 6 + fz * 7 * this.fs;
      const gT = field.heightAt(tx, tz), ty = this.wantY(gT, t), k = 1 - Math.exp(-dt * 0.6);
      this.vc.set((tx - this.c.x) * 0.5, (ty - this.c.y) * 0.5, (tz - this.c.z) * 0.5);
      this.c.x += (tx - this.c.x) * k * (1 + this.fs * 3); this.c.y += (ty - this.c.y) * k; this.c.z += (tz - this.c.z) * k * (1 + this.fs * 3);
      this.yaw = Math.atan2(this.vc.x, this.vc.z) || this.yaw;
    } else {
      let yr = (sp.mode === 'hover' ? 0.05 : 0.13) * Math.sin(t * 0.13 + S[0]) + 0.08 * Math.sin(t * 0.31 + S[1]);
      if (this.fs > 0.05) yr += clamp(angDiff(this.yaw, away), -1, 1) * 1.6 * this.fs;
      const ax = Math.sin(this.yaw), az = Math.cos(this.yaw);
      const gA = Math.max(field.heightAt(this.c.x + ax * 12, this.c.z + az * 12), field.heightAt(this.c.x + ax * 26, this.c.z + az * 26));
      if (gA + this.size * 0.5 + 3 > this.c.y) {   // terrain rising into the school's path: veer toward the lower side
        const gl = field.heightAt(this.c.x + Math.sin(this.yaw + 0.7) * 25, this.c.z + Math.cos(this.yaw + 0.7) * 25), gr = field.heightAt(this.c.x + Math.sin(this.yaw - 0.7) * 25, this.c.z + Math.cos(this.yaw - 0.7) * 25);
        yr += (gl < gr ? 1 : -1) * 0.5;
      }
      this.yaw += yr * dt;
      const wantY = this.wantY(gA, t);
      this.vc.x = Math.sin(this.yaw) * spd; this.vc.z = Math.cos(this.yaw) * spd;
      this.vc.y += ((wantY - this.c.y) * 0.4 - this.vc.y) * (1 - Math.exp(-dt * 1.5));
      this.c.addScaledVector(this.vc, dt);
    }
    // --- members ---
    const [sx, sy, sz] = sp.shape, R0 = this.radius * (1 + this.fs * 1.2), ca = Math.cos(this.yaw), sa = Math.sin(this.yaw);
    const mill = sp.mode === 'mill' ? t * 0.12 : 0, cm = Math.cos(mill), sm = Math.sin(mill);
    const maxSp = spd * 1.35 + 1.0 + (sp.mode === 'hover' ? 1.5 : 0), arr = this.mesh.instanceMatrix.array;
    const dartR = (1.2 + Math.pow(sub.speed, 1.3) * 1.4) * (0.7 + this.size * 0.3), dartK = 1.5 + sub.speed * 2.2;
    const kd = 1 - Math.exp(-dt * (3 + this.fs * 4)), kdir = 1 - Math.exp(-dt * 6), clr = this.size * 0.3 + 0.4;
    const top = -Math.max(2, sp.min), bot = -sp.max;
    for (let i = 0; i < this.n; i++) {
      const j = i * 3, a = t * this.W[i] + this.PH[i];
      let ox = (this.O[j] + 0.3 * Math.sin(a)) * sx, oy = (this.O[j + 1] + 0.25 * Math.sin(a * 1.3 + 1)) * sy, oz = (this.O[j + 2] + 0.3 * Math.cos(a * 0.9)) * sz;
      if (mill) { const rx = ox * cm - oz * sm, rz = ox * sm + oz * cm; ox = rx; oz = rz; }
      ox *= R0; oy *= R0; oz *= R0;
      const tx = this.c.x + ox * ca + oz * sa, tz = this.c.z - ox * sa + oz * ca, ty = this.c.y + oy;
      let vx = this.vc.x + (tx - this.P[j]) * 1.7, vy = this.vc.y + (ty - this.P[j + 1]) * 1.7, vz = this.vc.z + (tz - this.P[j + 2]) * 1.7;
      const qx = this.P[j] - sub.pos.x, qy = this.P[j + 1] - sub.pos.y, qz = this.P[j + 2] - sub.pos.z, q2 = qx * qx + qy * qy + qz * qz;
      let lim = maxSp;
      if (q2 < dartR * dartR) { const q = Math.sqrt(q2) || 0.01, push = (1 - q / dartR) * dartK; vx += (qx / q) * push; vy += (qy / q) * push * 0.6; vz += (qz / q) * push; lim += push; }
      const vm = Math.hypot(vx, vy, vz); if (vm > lim) { const s = lim / vm; vx *= s; vy *= s; vz *= s; }
      this.V[j] += (vx - this.V[j]) * kd; this.V[j + 1] += (vy - this.V[j + 1]) * kd; this.V[j + 2] += (vz - this.V[j + 2]) * kd;
      this.P[j] += this.V[j] * dt; this.P[j + 1] += this.V[j + 1] * dt; this.P[j + 2] += this.V[j + 2] * dt;
      const gh = field.heightAt(this.P[j], this.P[j + 2]);
      if ((i + frame) % 3 === 0) this.FL[i] = field.heightAt(this.P[j] + this.V[j] * 0.4, this.P[j + 2] + this.V[j + 2] * 0.4);   // look-ahead: a fast fish must not outrun the cached floor
      const fl = Math.max(gh, this.FL[i]) + clr;
      if (this.P[j + 1] > top) { this.P[j + 1] = top; if (this.V[j + 1] > 0) this.V[j + 1] = 0; }
      if (this.P[j + 1] < bot) { this.P[j + 1] = bot; if (this.V[j + 1] < 0) this.V[j + 1] = 0; }
      if (this.P[j + 1] < fl) { this.P[j + 1] = fl; if (this.V[j + 1] < 0) this.V[j + 1] = 0; }   // the seabed wins over the depth band
      const sm2 = Math.hypot(this.V[j], this.V[j + 1], this.V[j + 2]);
      if (sm2 > 0.15) {
        this.D[j] += (this.V[j] / sm2 - this.D[j]) * kdir; this.D[j + 1] += (this.V[j + 1] / sm2 - this.D[j + 1]) * kdir; this.D[j + 2] += (this.V[j + 2] / sm2 - this.D[j + 2]) * kdir;
      } else {   // hovering: face the school's heading with a little individual wander
        const hy = this.yaw + 0.3 * Math.sin(t * 0.4 * this.W[i] + this.PH[i]);
        this.D[j] += (Math.sin(hy) - this.D[j]) * kdir * 0.5; this.D[j + 1] += (0 - this.D[j + 1]) * kdir * 0.5; this.D[j + 2] += (Math.cos(hy) - this.D[j + 2]) * kdir * 0.5;
      }
      let dx = this.D[j], dy = this.D[j + 1], dz = this.D[j + 2]; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
      let rx = dz, rz = -dx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      const ux = dy * rz, uy = dz * rx - dx * rz, uz = -dy * rx, s = this.SZ[i], m = i * 16;
      arr[m] = rx * s; arr[m + 1] = 0; arr[m + 2] = rz * s; arr[m + 3] = 0;
      arr[m + 4] = ux * s; arr[m + 5] = uy * s; arr[m + 6] = uz * s; arr[m + 7] = 0;
      arr[m + 8] = dx * s; arr[m + 9] = dy * s; arr[m + 10] = dz * s; arr[m + 11] = 0;
      arr[m + 12] = this.P[j]; arr[m + 13] = this.P[j + 1]; arr[m + 14] = this.P[j + 2]; arr[m + 15] = 1;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mat.userData.u.uFreq.value = Math.min(sp.mode === 'hover' ? 9 : 15, sp.mat.freq * (0.55 + spd / Math.max(0.5, this.cruise) * 0.35) / (0.6 + this.size * 0.3));
    if (Math.hypot(this.c.x - sub.pos.x, this.c.z - sub.pos.z) > 195) this.despawn();
  }
  despawn() { this.active = false; this.mesh.count = 0; this.timer = R(25, 70); }
  threat(push) {
    const sp = this.sp; if (sp.id === 'hammerhead') push({ x: this.c.x, y: this.c.y, z: this.c.z, r: this.radius + 8 });
    else if (sp.id === 'gbarracuda') push({ x: this.c.x, y: this.c.y, z: this.c.z, r: this.radius + 5 });
  }
  sights(emit) {
    if (emit.occluded(this.c.x, this.c.y, this.c.z)) return;
    const big = this.sp.id === 'hammerhead';
    for (let i = 0; i < this.n; i++) emit(this.sp, big ? 'shark' : 'fish', 1.1 * this.SZ[i], this.P[i * 3], this.P[i * 3 + 1], this.P[i * 3 + 2], { checked: true, maxDist: big ? 160 : 120, minFrac: big ? 0.01 : 0.006 });
  }
}

// ───────────────────────────── single animals ─────────────────────────────
class Animal {
  constructor(scene, sp, geo, slot) {
    this.sp = sp; this.slot = slot; this.mat = makeCreatureMaterial(sp.mat); if (GAIN[sp.id]) this.mat.color.setScalar(GAIN[sp.id]);
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.rotation.order = 'YXZ'; scene.add(this.mesh);
    this.pos = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.roll = 0; this.yawRate = 0; this.fear = 0; this.fs = 0; this.len = 1; this.t = 0; this.active = false;
    this.timer = R(2, 14);
  }
  place() { this.mesh.position.copy(this.pos); this.mesh.rotation.set(-this.pitch, this.yaw, this.roll); }
  /** smoothed fear of the sub (0..1) from the point (x, y, z); returns the bearing pointing away from the sub */
  scare(sub, dt, sens, x = this.pos.x, y = this.pos.y, z = this.pos.z) {
    const f = alarm(sub, x, y, z, sens);
    this.fs += (f - this.fs) * (1 - Math.exp(-dt * (f > this.fs ? 3 : 0.4)));
    this.fear = this.fs;
    return Math.atan2(x - sub.pos.x, z - sub.pos.z);
  }
  /** highest seabed under the next few lookahead points */
  ahead(field, ax, az, dists) { let m = field.heightAt(this.pos.x, this.pos.z); for (const d of dists) m = Math.max(m, field.heightAt(this.pos.x + ax * d, this.pos.z + az * d)); return m; }
  ground(field, clear) { const g = field.heightAt(this.pos.x, this.pos.z) + clear; if (this.pos.y < g) this.pos.y = g; }
  despawn() { this.active = false; this.mesh.visible = false; this.timer = R(40, 110); this.v = undefined; this.fs = 0; this.fear = 0; }
  distTo(sub) { return Math.hypot(this.pos.x - sub.pos.x, this.pos.z - sub.pos.z); }
  /** sphere-chain body: [z, r] in units of body length. Pushes (pos) out and cancels the inward velocity; returns the impact speed. */
  hit(chain, speed, pos, vel, radius) {
    if (!this.active) return 0;
    const L = this.len, cp = Math.cos(this.pitch), fx = Math.sin(this.yaw) * cp, fy = Math.sin(this.pitch), fz = Math.cos(this.yaw) * cp;
    if (Math.abs(pos.x - this.pos.x) > L || Math.abs(pos.z - this.pos.z) > L || Math.abs(pos.y - this.pos.y) > L) return 0;
    let best = 0;
    for (const [z, r0] of chain) {
      const r = r0 * L + radius, sx = this.pos.x + fx * z * L, sy = this.pos.y + fy * z * L, sz = this.pos.z + fz * z * L;
      const ox = pos.x - sx, oy = pos.y - sy, oz = pos.z - sz, d2 = ox * ox + oy * oy + oz * oz;
      if (d2 >= r * r) continue;
      const d = Math.sqrt(d2) || 1e-4, nx = ox / d, ny = oy / d, nz = oz / d;
      pos.x = sx + nx * r; pos.y = sy + ny * r; pos.z = sz + nz * r;
      const vn = (vel.x - fx * speed) * nx + (vel.y - fy * speed) * ny + (vel.z - fz * speed) * nz;
      if (vn < 0) { vel.x -= nx * vn * 1.15; vel.y -= ny * vn * 1.15; vel.z -= nz * vn * 1.15; best = Math.max(best, -vn); }
    }
    return best;
  }
  sights(emit, kind = 'big', maxDist = 200, minFrac = 0.012) { emit(this.sp, kind, this.len * 1.12, this.pos.x, this.pos.y, this.pos.z, { maxDist, minFrac }); }
}

/** Sailfish: cruises slowly, then hunts a school at 10 m/s in bursts; tires and goes back to cruising. */
class Sailfish extends Animal {
  spawn(spot, sub, ctx) {
    const sp = this.sp; this.len = R(sp.len[0], sp.len[1]); this.mesh.scale.setScalar(this.len);
    this.cruise = R(1.5, 2.3); this.t = Math.random() * 50; this.hunt = 0; this.rest = R(8, 25); this.prey = null; this.v = undefined;
    this.depth = R(5, 20);
    this.pos.set(spot.x, BAND(sp, -this.depth, spot.g, 3), spot.z);
    this.yaw = Math.atan2(sub.pos.x - spot.x, sub.pos.z - spot.z) + R(-0.8, 0.8); this.pitch = 0; this.roll = 0; this.yawRate = 0;
    this.active = true; this.mesh.visible = true; this.place();
  }
  update(dt, sub, ctx) {
    this.t += dt; const t = this.t, field = ctx.field, sp = this.sp;
    const away = this.scare(sub, dt, 0.9);
    let want = this.yaw + 0.25 * Math.sin(t * 0.17) * 3 + 0.12 * Math.sin(t * 0.43 + 1) * 3, drive = this.fs, wantDepth = this.depth + 4 * Math.sin(t * 0.05);
    if (this.hunt > 0) {
      this.hunt -= dt; const p = this.prey;
      if (!p || !p.active || this.stam < 0.28) this.hunt = 0;
      else {
        const dx = p.c.x - this.pos.x, dz = p.c.z - this.pos.z; want = Math.atan2(dx, dz); wantDepth = -p.c.y; drive = Math.max(drive, 0.9);
        if (Math.hypot(dx, dz) < 4) this.hunt = Math.min(this.hunt, 0.8);   // the strike: through the school, then break off
      }
      if (this.hunt <= 0) { this.rest = R(30, 80); this.prey = null; }
    } else {
      this.rest -= dt;
      if (this.rest <= 0 && this.fs < 0.1) this.startHunt(ctx);
    }
    if (this.fs > 0.08) want = away;
    this.fear = Math.max(this.fs, drive);
    const spd = swim(this, dt, this.cruise, 10.5, 6);
    const tgt = clamp(angDiff(this.yaw, want), -1, 1) * (0.35 + this.fear * 1.1);
    this.yawRate += (tgt - this.yawRate) * (1 - Math.exp(-dt * (0.8 + this.fear * 2)));
    this.yaw += this.yawRate * dt;
    const ax = Math.sin(this.yaw), az = Math.cos(this.yaw), L = this.len;
    const gA = this.ahead(field, ax, az, [6, 14, 26, 40]);
    const wantY = BAND(sp, Math.max(-wantDepth, gA + 4), gA, 3);
    const dy = clamp((wantY - this.pos.y) * 0.25, -2, 3);
    this.pitch += (clamp(dy / Math.max(1, spd), -0.45, 0.6) - this.pitch) * (1 - Math.exp(-dt * 1.8));
    const cp = Math.cos(this.pitch);
    this.pos.x += ax * cp * spd * dt; this.pos.z += az * cp * spd * dt; this.pos.y += Math.sin(this.pitch) * spd * dt;
    this.pos.y = Math.min(this.pos.y, -Math.max(2, sp.min));
    this.ground(field, L * 0.1 + 0.8);
    this.roll += (-this.yawRate * 1.2 - this.roll) * (1 - Math.exp(-dt * 2));
    this.mat.userData.u.uFreq.value = Math.min(6.5, 2.2 + spd * 0.45);
    this.place();
    if (this.distTo(sub) > 200) this.despawn();
  }
  startHunt(ctx) {
    let best = null, bd = 120;
    const cands = [...this.group.schools.filter((s) => s.active && s.sp.id !== 'hammerhead' && s.sp.id !== 'gbarracuda'), ...(this.group.fauna ? this.group.fauna.swarms.filter((s) => s.active) : [])];
    for (const s of cands) { const d = Math.hypot(s.c.x - this.pos.x, s.c.z - this.pos.z); if (d < bd && d > 12) { bd = d; best = s; } }
    if (best) { this.prey = best; this.hunt = R(4, 8); } else this.rest = R(10, 25);
  }
  threat(push) { if (this.active) push({ x: this.pos.x, y: this.pos.y, z: this.pos.z, r: this.hunt > 0 ? 22 : 9 }); }
  collide(pos, vel, r) { return this.hit([[0.3, 0.04], [0.0, 0.05], [-0.3, 0.03]], this.v ?? this.cruise, pos, vel, r); }
}

/** Goliath grouper: hangs near a wreck / cave / reef, turns to face a slow sub, and retreats (with a short burst) from a fast one. */
class Grouper extends Animal {
  spawn(spot, sub, ctx) {
    const sp = this.sp, f = ctx.field; this.len = R(sp.len[0], sp.len[1]); this.mesh.scale.setScalar(this.len);
    this.t = Math.random() * 50; this.v = undefined;
    this.home = new THREE.Vector3(spot.x, 0, spot.z); this.alt = R(1.3, 3.2);
    let y = BAND(sp, spot.g + this.alt + this.len * 0.2, spot.g, this.len * 0.3);
    this.pos.set(spot.x, y, spot.z); this.yaw = R(0, TAU); this.pitch = 0; this.roll = 0; this.yawRate = 0; this.cruise = R(0.15, 0.35);
    this.active = true; this.mesh.visible = true; this.place();
  }
  update(dt, sub, ctx) {
    this.t += dt; const t = this.t, field = ctx.field, sp = this.sp, L = this.len;
    const away = this.scare(sub, dt, 0.8);
    const dxs = sub.pos.x - this.pos.x, dzs = sub.pos.z - this.pos.z, ds = Math.hypot(dxs, dzs);
    const dh = Math.hypot(this.home.x - this.pos.x, this.home.z - this.pos.z);
    let want = this.yaw + 0.5 * Math.sin(t * 0.21), rate = 0.25;
    if (this.fs > 0.3) { want = away; rate = 1; }
    else if (dh > 10) want = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z);
    else if (ds < 32 && ds > 4 && this.fs < 0.2) { want = Math.atan2(dxs, dzs); rate = 0.5; }   // curious: faces a calm sub
    const spd = this.fs > 0.1 || dh > 10 ? swim(this, dt, 0.5, 3.4, 2.5) : (swim(this, dt, 0.12 + 0.1 * Math.sin(t * 0.3), 0.5, 1), this.v);
    this.yawRate += (clamp(angDiff(this.yaw, want), -1, 1) * rate - this.yawRate) * (1 - Math.exp(-dt * 1.2));
    this.yaw += this.yawRate * dt;
    const ax = Math.sin(this.yaw), az = Math.cos(this.yaw);
    const gA = this.ahead(field, ax, az, [L * 0.6, L * 1.4, L * 2.5]);
    const wantY = BAND(sp, gA + this.alt + 0.3 * Math.sin(t * 0.2) + L * 0.2, gA, L * 0.3);
    this.pitch += (clamp((wantY - this.pos.y) * 0.15 / Math.max(0.4, spd), -0.4, 0.4) - this.pitch) * (1 - Math.exp(-dt * 1.5));
    const cp = Math.cos(this.pitch);
    this.pos.x += ax * cp * spd * dt; this.pos.z += az * cp * spd * dt; this.pos.y += Math.sin(this.pitch) * spd * dt + (wantY - this.pos.y) * 0.3 * dt;
    this.ground(field, L * 0.14 + 0.5);
    this.roll += (-this.yawRate * 0.8 - this.roll) * (1 - Math.exp(-dt * 2));
    this.mat.userData.u.uAmp.value = 0.03 + 0.03 * clamp(spd / 2, 0, 1); this.mat.userData.u.uFreq.value = 2 + spd * 1.2;
    this.place();
    if (this.distTo(sub) > 205) this.despawn();
  }
  threat(push) { if (this.active) push({ x: this.pos.x, y: this.pos.y, z: this.pos.z, r: 5 }); }
  collide(pos, vel, r) { return this.hit([[0.36, 0.12], [0.12, 0.15], [-0.12, 0.13], [-0.36, 0.06]], this.v ?? 0.2, pos, vel, r); }
}

/** Hawksbill: glides over reefs and ledges, now and then swimming up for a breath at the shallowest edge of its band. */
class Hawksbill extends Animal {
  spawn(spot, sub, ctx) {
    const sp = this.sp; this.len = R(sp.len[0], sp.len[1]); this.mesh.scale.setScalar(this.len);
    this.t = Math.random() * 50; this.v = undefined; this.cruise = R(0.65, 1.0); this.alt = R(2.5, 7); this.air = R(40, 100); this.breath = 0;
    this.pos.set(spot.x, BAND(sp, spot.g + this.alt, spot.g, this.len * 0.4), spot.z);
    this.yaw = Math.atan2(sub.pos.x - spot.x, sub.pos.z - spot.z) + R(-1.2, 1.2); this.pitch = 0; this.roll = 0; this.yawRate = 0;
    this.active = true; this.mesh.visible = true; this.place();
  }
  update(dt, sub, ctx) {
    this.t += dt; const t = this.t, field = ctx.field, sp = this.sp, L = this.len;
    const away = this.scare(sub, dt, 0.7);
    if (this.breath > 0) this.breath -= dt; else { this.air -= dt; if (this.air <= 0) { this.breath = R(14, 22); this.air = R(60, 130); } }
    const up = this.breath > 6;   // rising for the first part of a breath, hanging at the top, then drifting down again
    let want = this.yaw + (0.14 * Math.sin(t * 0.11) + 0.1 * Math.sin(t * 0.27 + 2)) * 3;
    if (this.fs > 0.08) want = away;
    const spd = swim(this, dt, this.cruise, 3.2, 2);
    this.yawRate += (clamp(angDiff(this.yaw, want), -1, 1) * (0.3 + this.fs) - this.yawRate) * (1 - Math.exp(-dt * 1.0));
    this.yaw += this.yawRate * dt;
    const ax = Math.sin(this.yaw), az = Math.cos(this.yaw);
    const gA = this.ahead(field, ax, az, [L, L * 2, L * 4, 12]);
    const cruiseY = Math.max(gA + this.alt + 1.5 * Math.sin(t * 0.07), gA + L * 0.5 + 1);
    const wantY = BAND(sp, this.breath > 0 && up ? -sp.min - 0.4 : cruiseY, gA, L * 0.4);
    this.pitch += (clamp((wantY - this.pos.y) * 0.22 / Math.max(0.5, spd), -0.5, 0.6) - this.pitch) * (1 - Math.exp(-dt * 1.4));
    const cp = Math.cos(this.pitch);
    this.pos.x += ax * cp * spd * dt; this.pos.z += az * cp * spd * dt; this.pos.y += Math.sin(this.pitch) * spd * dt;
    this.pos.y = Math.min(this.pos.y, -sp.min);
    this.ground(field, L * 0.25 + 0.5);
    this.roll += (-this.yawRate * 1.4 - this.roll) * (1 - Math.exp(-dt * 2));
    this.mat.userData.u.uFreq.value = clamp(1.8 + spd * 1.6, 1.8, 5.5); this.mat.userData.u.uAmp.value = 0.1 + 0.05 * clamp(spd, 0, 2);
    this.place();
    if (this.distTo(sub) > 200) this.despawn();
  }
  collide(pos, vel, r) { return this.hit([[0.06, 0.26], [0.4, 0.06]], this.v ?? this.cruise, pos, vel, r); }
}

/** A boulder with a hole and the green moray living in it: peeks out, retreats when startled, hunts along the seabed at night. */
const DEN_GEO = [];
class Moray extends Animal {
  constructor(scene, sp, geo, slot) {
    super(scene, sp, geo, slot);
    this.rockMat = makeCreatureMaterial({ amp: 0, freq: 0, wave: 1 });
    this.rock = new THREE.Mesh(DEN_GEO[0] ||= M.denRockGeometry({ seed: 3 }), this.rockMat); this.rock.frustumCulled = false; this.rock.visible = false; scene.add(this.rock);
    this.hole = new THREE.Vector3(); this.dir = new THREE.Vector3(); this.rockPos = new THREE.Vector3();
  }
  spawn(spot, sub, ctx) {
    const sp = this.sp, f = ctx.field; this.len = R(sp.len[0], sp.len[1]); this.mesh.scale.setScalar(this.len);
    const rs = this.rs = R(0.55, 0.8) * (this.len / 1.7);
    // the den opens toward the sub's side of the ledge; the rock sits on the lowest ground under it, with the hole kept above the ground at its mouth
    this.denYaw = Math.atan2(sub.pos.x - spot.x, sub.pos.z - spot.z) + R(-1.2, 1.2);
    const dx = Math.sin(this.denYaw), dz = Math.cos(this.denYaw), hx = spot.x + dx * 0.4 * rs, hz = spot.z + dz * 0.4 * rs;
    let gb = 1e9; for (const [ox, oz] of [[0, 0], [rs * 0.6, 0], [-rs * 0.6, 0], [0, rs * 0.6], [0, -rs * 0.6]]) gb = Math.min(gb, f.heightAt(spot.x + ox, spot.z + oz));
    const holeY = Math.max(gb + rs * 0.26, f.heightAt(hx, hz) + 0.25);
    this.rockPos.set(spot.x, holeY - rs * 0.04, spot.z);
    this.rock.position.copy(this.rockPos); this.rock.rotation.set(0, this.denYaw, 0); this.rock.scale.set(rs, rs, rs);
    this.rock.visible = true;
    this.dir.set(dx, 0, dz); this.hole.set(hx, holeY, hz);
    this.state = 'den'; this.p = 0; this.t = Math.random() * 50; this.v = undefined; this.cool = R(10, 40);
    this.yaw = this.denYaw; this.pitch = 0; this.roll = 0; this.yawRate = 0;
    this.active = true; this.mesh.visible = true; this.den();
  }
  /** pose in the den: nose protruding p body lengths past the pit bottom */
  denPose(p = 0.3) { const L = this.len, k = p * L - 0.4 * L; return [this.hole.x + this.dir.x * k, this.hole.y, this.hole.z + this.dir.z * k]; }
  den() {
    const c = this.denPose(this.p); this.pos.set(c[0], c[1], c[2]);
    this.yaw = this.denYaw + 0.07 * Math.sin(this.t * 0.45); this.pitch = 0;
  }
  head() { const L = this.len, cp = Math.cos(this.pitch); return [this.pos.x + Math.sin(this.yaw) * cp * 0.5 * L, this.pos.y, this.pos.z + Math.cos(this.yaw) * cp * 0.5 * L]; }
  update(dt, sub, ctx) {
    this.t += dt; const t = this.t, field = ctx.field, sp = this.sp, L = this.len, u = this.mat.userData.u;
    const [hx, hy, hz] = this.head();
    const away = this.scare(sub, dt, 0.75, hx, hy, hz);
    const night = ctx.phase === 'night', dusk = ctx.phase === 'dawn' || ctx.phase === 'evening';
    if (this.state === 'den') {
      const want = this.fs > 0.22 ? 0 : (night ? 0.4 : 0.27) + 0.06 * Math.sin(t * 0.5);
      this.p += clamp(want - this.p, -1.6 * dt, 0.22 * dt);
      this.cool -= dt;
      if (this.cool <= 0 && this.fs < 0.05 && this.p > 0.2) {
        this.cool = R(20, 60);
        if (Math.random() < (night ? 0.8 : dusk ? 0.35 : 0.05)) this.go(ctx);
      }
      this.den(); u.uAmp.value = 0.012 + 0.012 * Math.sin(t * 2.2);
    } else {
      // free swimming along the seabed: 'out' wanders to a waypoint, 'back' returns to the hole
      const gHere = field.heightAt(this.pos.x, this.pos.z);
      if (this.state === 'out' && (this.fs > 0.4 || -gHere > sp.max - 1 || -gHere < sp.min + 0.8)) this.state = 'back';   // startled, or the ground leaves its depth band
      let want;
      if (this.state === 'out') {
        this.leg -= dt; want = Math.atan2(this.wp.x - this.pos.x, this.wp.z - this.pos.z) + 0.5 * Math.sin(t * 1.3);
        if (this.leg <= 0) this.state = 'back'; else if (Math.hypot(this.wp.x - this.pos.x, this.wp.z - this.pos.z) < 2) this.wp = this.pickWp(field);
      } else if (this.state === 'enter') {   // slide the last stretch into the hole
        const k = 1 - Math.exp(-dt * 2.5), tk = this.denPose();
        this.pos.x += (tk[0] - this.pos.x) * k; this.pos.y += (tk[1] - this.pos.y) * k; this.pos.z += (tk[2] - this.pos.z) * k;
        this.yaw += angDiff(this.yaw, this.denYaw) * k; this.pitch *= 1 - k; this.v = 0.2;
        if (Math.hypot(tk[0] - this.pos.x, tk[2] - this.pos.z) < 0.04) { this.state = 'den'; this.p = 0.3; this.cool = R(20, 50); }
        u.uAmp.value = 0.05; this.place(); return;
      } else {
        const tx = this.hole.x + this.dir.x * (0.15 * L), tz = this.hole.z + this.dir.z * (0.15 * L), d = Math.hypot(tx - this.pos.x, tz - this.pos.z);
        want = Math.atan2(tx - this.pos.x, tz - this.pos.z);
        if (d < 2.2) want += angDiff(want, this.denYaw) * smooth(2.2, 0.6, d);
        if (d < 0.45 + 0.5 * L) this.state = 'enter';
      }
      const spd = this.state === 'back' && this.fs > 0.1 ? swim(this, dt, 0.7, 2.6, 3) : (swim(this, dt, 0.55, 1.2, 1.5));
      this.yawRate += (clamp(angDiff(this.yaw, want), -1, 1) * 1.6 - this.yawRate) * (1 - Math.exp(-dt * 2.5));
      this.yaw += this.yawRate * dt;
      this.pos.x += Math.sin(this.yaw) * spd * dt; this.pos.z += Math.cos(this.yaw) * spd * dt;
      const g = field.heightAt(this.pos.x, this.pos.z), ty = this.state === 'back' ? this.hole.y : g + 0.18 * L * 0.5 + 0.12;
      this.pos.y += (ty - this.pos.y) * Math.min(1, dt * 2); this.pos.y = Math.max(this.pos.y, g + L * 0.06 + 0.04);
      u.uAmp.value = 0.1 + 0.03 * spd; u.uFreq.value = 3.5 + spd * 2;
    }
    this.place();
    if (this.distTo(sub) > 200) this.despawn();
  }
  go(ctx) { this.state = 'out'; this.leg = R(10, 22); this.wp = this.pickWp(ctx.field); this.v = undefined; this.fs = 0; }
  /** a waypoint within the depth band, around the den */
  pickWp(field) {
    let x = this.hole.x, z = this.hole.z;
    for (let i = 0; i < 6; i++) { const a = R(0, TAU), d = R(6, 18), px = this.hole.x + Math.cos(a) * d, pz = this.hole.z + Math.sin(a) * d, g = -field.heightAt(px, pz); x = px; z = pz; if (g > this.sp.min + 1 && g < this.sp.max - 2) break; }
    return { x, z };
  }
  despawn() { super.despawn(); this.rock.visible = false; }
  sights(emit) {
    const vis = this.state === 'den' ? this.p : 1; if (vis < 0.08) return;
    const [x, y, z] = this.head(), seen = this.state === 'den' ? Math.min(1, 0.3 + this.p) : 1;
    emit(this.sp, 'big', this.len * seen * 1.1, x - Math.sin(this.yaw) * 0.12 * this.len, y, z - Math.cos(this.yaw) * 0.12 * this.len, { maxDist: 90, minFrac: 0.01 });
  }
  collide(pos, vel, r) {   // the den rock: a squashed sphere
    if (!this.active) return 0;
    const rs = this.rs, R2 = rs * 0.92 + r, ox = pos.x - this.rockPos.x, oy = (pos.y - this.rockPos.y) / 0.8, oz = pos.z - this.rockPos.z;
    if (Math.abs(ox) > R2 || Math.abs(oz) > R2) return 0;
    const d = Math.hypot(ox, oy, oz); if (d >= R2) return 0;
    const nx = ox / (d || 1e-4), ny = oy / (d || 1e-4), nz = oz / (d || 1e-4);
    pos.x = this.rockPos.x + nx * R2; pos.y = this.rockPos.y + ny * R2 * 0.8; pos.z = this.rockPos.z + nz * R2;
    const vn = vel.x * nx + vel.y * ny + vel.z * nz;
    if (vn < 0) { vel.x -= nx * vn * 1.15; vel.y -= ny * vn * 1.15; vel.z -= nz * vn * 1.15; return -vn; }
    return 0;
  }
}

/** Octopus: crawls from rock to rock, freezes when watched, flushes red, inks and jets away when a fast sub comes at it. */
class Octopus extends Animal {
  constructor(scene, sp, geo, slot) {
    super(scene, sp, geo, slot);
    this.ink = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: 0x2a2038, transparent: true, opacity: 0, depthWrite: false }));
    this.ink.frustumCulled = false; this.ink.visible = false; scene.add(this.ink); this.inkT = 9; this.tint = new THREE.Color(1, 1, 1);
  }
  spawn(spot, sub, ctx) {
    const sp = this.sp; this.len = R(sp.len[0], sp.len[1]); this.mesh.scale.setScalar(this.len);
    this.state = 'rest'; this.stateT = R(4, 14); this.t = Math.random() * 50; this.v = 0; this.wp = null; this.inkT = 9; this.ink.visible = false;
    this.pos.set(spot.x, spot.g + 0.01 * this.len, spot.z); this.yaw = R(0, TAU); this.pitch = 0; this.roll = 0; this.yawRate = 0;
    this.tint.setRGB(0.9, 0.88, 0.82); this.mat.color.copy(this.tint);
    this.active = true; this.mesh.visible = true; this.place();
  }
  update(dt, sub, ctx) {
    this.t += dt; const t = this.t, field = ctx.field, L = this.len, u = this.mat.userData.u;
    const away = this.scare(sub, dt, 0.8);
    this.stateT -= dt;
    let goal = [0.9, 0.88, 0.82];
    if (this.state === 'rest') {
      this.v += (0 - this.v) * (1 - Math.exp(-dt * 3));
      if (this.fs > 0.5) this.flee(away);
      else if (this.stateT <= 0 && this.fs < 0.25) {
        const a = R(0, TAU), d = R(1.5, 5), x = this.pos.x + Math.sin(a) * d, z = this.pos.z + Math.cos(a) * d, g = field.heightAt(x, z);
        if (-g >= this.sp.min) { this.wp = { x, z }; this.state = 'crawl'; this.stateT = 40; }
        else this.stateT = R(4, 10);
      }
      if (this.fs > 0.2) goal = [1.05, 0.85, 0.7];
    } else if (this.state === 'crawl') {
      const dx = this.wp.x - this.pos.x, dz = this.wp.z - this.pos.z, d = Math.hypot(dx, dz);
      this.yawRate += (clamp(angDiff(this.yaw, Math.atan2(dx, dz)), -1, 1) * 1.5 - this.yawRate) * (1 - Math.exp(-dt * 3));
      this.v += (0.2 - this.v) * (1 - Math.exp(-dt * 2));
      if (this.fs > 0.5) this.flee(away);
      else if (d < 0.2 || this.stateT <= 0) { this.state = 'rest'; this.stateT = R(8, 26); }
      goal = [1.0, 0.95, 0.85];
    } else {   // flee: a fast jet that decays, flushed red, then it freezes in camouflage
      this.v *= Math.exp(-dt * 0.9);
      this.yawRate += (clamp(angDiff(this.yaw, this.fleeYaw), -1, 1) * 2 - this.yawRate) * (1 - Math.exp(-dt * 4));
      if (this.stateT <= 0 || this.v < 0.3) { this.state = 'rest'; this.stateT = R(8, 16); this.v = 0; }
      goal = [1.35, 0.55, 0.45];
    }
    this.tint.r += (goal[0] - this.tint.r) * (1 - Math.exp(-dt * 3)); this.tint.g += (goal[1] - this.tint.g) * (1 - Math.exp(-dt * 3)); this.tint.b += (goal[2] - this.tint.b) * (1 - Math.exp(-dt * 3));
    this.mat.color.copy(this.tint);
    this.yaw += this.yawRate * dt;
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += Math.sin(this.yaw) * this.v * dt; this.pos.z += Math.cos(this.yaw) * this.v * dt;
    let g = field.heightAt(this.pos.x, this.pos.z);
    if (-g > this.sp.max || -g < this.sp.min) { this.pos.x = ox; this.pos.z = oz; g = field.heightAt(ox, oz); this.v = 0; if (this.state !== 'rest') { this.state = 'rest'; this.stateT = R(6, 14); } }   // the ground leaves its depth band: stop
    const lift = this.state === 'flee' ? (0.25 + 0.3 * smooth(0.5, 2.5, this.v)) * L : 0.012 * L;
    this.pos.y += (g + lift - this.pos.y) * Math.min(1, dt * (this.state === 'flee' ? 3 : 8));
    if (this.pos.y < g + 0.005 * L) this.pos.y = g + 0.005 * L;
    // lie on the slope
    const e = 0.5 * L, ax = Math.sin(this.yaw), az = Math.cos(this.yaw);
    const sf = field.heightAt(this.pos.x + ax * e, this.pos.z + az * e) - field.heightAt(this.pos.x - ax * e, this.pos.z - az * e), sr = field.heightAt(this.pos.x + az * e, this.pos.z - ax * e) - field.heightAt(this.pos.x - az * e, this.pos.z + ax * e);
    this.pitch += (clamp(Math.atan2(sf, 2 * e), -0.5, 0.5) - this.pitch) * Math.min(1, dt * 4); this.roll += (clamp(-Math.atan2(sr, 2 * e), -0.5, 0.5) - this.roll) * Math.min(1, dt * 4);
    u.uAmp.value = this.state === 'rest' ? 0.025 + 0.01 * Math.sin(t * 1.3) : 0.06; u.uFreq.value = this.state === 'flee' ? 6 : 2 + this.v * 3;
    this.place();
    if (this.inkT < 6) {
      this.inkT += dt; const k = this.inkT / 6;
      const e = 0.3 + 1.5 * Math.sqrt(k); this.ink.scale.set(e * 1.3, e * 0.8, e); this.ink.material.opacity = 0.5 * Math.pow(1 - k, 1.5) * smooth(0, 0.1, this.inkT);
      this.ink.position.y += dt * 0.12; if (this.inkT >= 6) this.ink.visible = false;
    }
    if (this.distTo(sub) > 200) this.despawn();
  }
  flee(away) {
    this.state = 'flee'; this.stateT = 3.2; this.v = 2.8; this.fleeYaw = away + R(-0.5, 0.5); this.yawRate = 0;
    this.ink.position.copy(this.pos); this.ink.position.y += 0.2 * this.len; this.ink.visible = true; this.inkT = 0;
  }
  despawn() { super.despawn(); this.ink.visible = false; this.inkT = 9; this.mat.color.setRGB(1, 1, 1); }
  sights(emit) { emit(this.sp, 'big', this.len * 0.9, this.pos.x, this.pos.y + 0.12 * this.len, this.pos.z, { maxDist: 32, minFrac: 0.012 }); }   // camouflaged: only seen close up
  collide(pos, vel, r) { return this.hit([[0, 0.09]], 0, pos, vel, r); }
}

// ───────────────────────────── the group ─────────────────────────────
const CLASSES = { sailfish: Sailfish, goliath: Grouper, hawksbill: Hawksbill, moray: Moray, octopus: Octopus };
const GEOS = { yellowfin: () => M.tunaGeometry(), mahi: () => M.mahiGeometry(), gbarracuda: () => M.barracudaGeometry(), hammerhead: () => M.hammerheadGeometry(), bannerfish: () => M.bannerfishGeometry(),
  sailfish: () => M.sailfishGeometry(), moray: () => M.morayGeometry(), goliath: () => M.grouperGeometry(), hawksbill: () => M.hawksbillGeometry(), octopus: () => M.octopusGeometry() };

class PelagicGroup {
  constructor() { this.id = 'pelagic'; this.slots = []; this.schools = []; this.singles = []; this.fauna = null; this.frame = 0; }
  init(game) {
    this.fauna = game.fauna; const scene = game.scene, geos = {};
    for (const sp of PELAGIC) {
      const geo = geos[sp.id] ||= GEOS[sp.id]();
      for (let slot = 0; slot < (sp.second ? 2 : 1); slot++) {
        const a = sp.cls === 'school' ? new School(scene, sp, geo, slot) : new CLASSES[sp.cls](scene, sp, geo, slot);
        a.group = this; this.slots.push(a); (sp.cls === 'school' ? this.schools : this.singles).push(a);
      }
    }
    this.geos = geos;
    game.fauna.addGroup(this);
  }
  /** spawn-rate multiplier for a slot: the sub's places, time of day, species weight; the second slot only runs for the matching submarine */
  rate(a, ctx) {
    const sp = a.sp, pm = PROF[sp.hab][ctx.profile] ?? 1;
    if (a.slot === 1 && pm < 1.5) return 0;
    return pm * (sp.act[ctx.phase] ?? 1) * (sp.weight / 2);
  }
  update(dt, sub, ctx) {
    this.frame++; dt = Math.min(dt, 0.1);
    for (const a of this.slots) {
      if (a.active) { a instanceof School ? a.update(dt, ctx.frame, sub, ctx) : a.update(dt, sub, ctx); continue; }
      a.timer -= dt * this.rate(a, ctx);
      if (a.timer > 0) continue;
      const spot = findSpot(ctx.field, sub, a.sp);
      if (spot) { a.spawn(spot, sub, ctx); if (a instanceof School) a.update(1e-4, ctx.frame, sub, ctx); } else a.timer = R(3, 9);   // (first update writes the instance matrices)
    }
  }
  threats(push) { for (const a of this.slots) if (a.active && a.threat) a.threat(push); }
  collide(pos, vel, radius) { let best = 0; for (const a of this.singles) if (a.active && a.collide) best = Math.max(best, a.collide(pos, vel, radius)); return best; }
  sightings(emit) { for (const a of this.slots) if (a.active) a.sights(emit); }
  hideAll() { for (const a of this.slots) if (a.active) a.despawn(); }
}

export const pelagic = new PelagicGroup();
export { findSpot };
export default { name: 'pelagic', init(game) { pelagic.init(game); game.pelagic = pelagic; } };
