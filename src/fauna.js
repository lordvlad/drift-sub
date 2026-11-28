import * as THREE from 'three';
import { fishGeometry, mantaGeometry, orcaGeometry, dolphinGeometry } from './creatures.js';
import { sharkGeometry } from './models/shark.js';
import { humpbackGeometry, blueWhaleGeometry } from './models/whale.js';
import { squidGeometry, giantSquidGeometry } from './models/squid.js';
import { makeCreatureMaterial } from './materials.js';
import { FISH, SHARKS, WHALES, SQUID, GIANT_SQUID, MANTAS, ORCAS, DOLPHINS, pick, bandY, bodyTint } from './species.js';

const R = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
/**
 * Game-wide stealth state, driven by src/features/equipment.js: `noise` multiplies how far animals notice the sub (quiet propeller 0.8 / 0.6);
 * `lamp` (0..1) is the glare of white lamps in the dark (0 for red light, lamps off, or daylight).
 */
export const stealth = { noise: 1, lamp: 0 };
/** How alarming the sub is at a given distance: grows steeply with its speed, so a slow approach allows close-ups. 0..1 */
export function alarm(sub, x, y, z, sens = 1) {
  const dx = x - sub.pos.x, dy = y - sub.pos.y, dz = z - sub.pos.z, d = Math.hypot(dx, dy, dz);
  const r = (3 + Math.pow(sub.speed, 1.4) * 3.2) * sens * stealth.noise;
  let f = d < r ? 1 - d / r : 0;
  if (stealth.lamp > 0.01 && d < 15 && d > 0.01) {   // white headlights mildly startle shy animals caught in the beam (within 15 m, ahead of the sub)
    const ahead = clamp(((dx * sub.fwd.x + dy * sub.fwd.y + dz * sub.fwd.z) / d - 0.3) / 0.5, 0, 1);
    f = Math.max(f, 0.4 * stealth.lamp * ahead * (1 - d / 15) * clamp(sens, 0.5, 1.5));
  }
  return f;
}
/**
 * Flexible swim speed: cruise when calm, sprint toward `burst` when scared. Speed changes with finite acceleration
 * (fast up, gentle coast down) and sprinting drains stamina, so a chase ends with the animal tiring back to cruise.
 * Returns the current speed (m/s) and stores it in obj.v.
 */
export function swim(obj, dt, cruise, burst, acc) {
  if (obj.v === undefined) { obj.v = cruise; obj.stam = 1; }
  const want = cruise + (burst - cruise) * Math.pow(obj.fear || 0, 0.7) * (0.25 + 0.75 * obj.stam);
  const dv = want - obj.v;
  obj.v += dv > 0 ? Math.min(dv, acc * dt) : Math.max(dv, -acc * 0.35 * dt);
  const sprint = clamp((obj.v - cruise * 1.25) / Math.max(0.1, burst - cruise), 0, 1);
  obj.stam = clamp(obj.stam - sprint * 0.11 * dt + (sprint === 0 ? 0.06 * dt : 0), 0, 1);
  return obj.v;
}
/** Activity by time of day: >1 means seen more often. */
const ACTIVITY = {
  shark:      { night: 1.8, dawn: 1.6, morning: 1, day: 0.7, evening: 1.6 },
  whale:      { night: 0.8, dawn: 1, morning: 1.1, day: 1.1, evening: 1 },
  manta:      { night: 0.4, dawn: 0.8, morning: 1.3, day: 1.4, evening: 0.9 },
  giantsquid: { night: 2.5, dawn: 1.2, morning: 0.5, day: 0.4, evening: 1.3 },
  dolphin:    { night: 0.3, dawn: 0.9, morning: 1.5, day: 1.3, evening: 1 },
  orca:       { night: 0.8, dawn: 1.1, morning: 1, day: 1, evening: 1.2 },
};
// share of the fish-school pool that is out and about (reef fish hide in the coral at night); squid come up at night
const FISH_OUT = { night: 0.5, dawn: 0.8, morning: 1, day: 1, evening: 0.85 };
const SQUID_OUT = { night: 2, dawn: 2, morning: 1, day: 1, evening: 2 };
const SQUID_W = { night: 4, dawn: 2, morning: 0.6, day: 0.5, evening: 2 };   // firefly squid weight multiplier
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

const pickCount = () => {
  const r = Math.random();
  if (r < 0.22) return Math.floor(R(6, 16));
  if (r < 0.58) return Math.floor(R(20, 48));
  if (r < 0.86) return Math.floor(R(55, 110));
  return Math.floor(R(120, 220));
};
const CAP = 220;
const DEFAULT_BIOME = { reef: 0, open: 1, deep: 0, vent: 0, magma: 0, cave: 0, trench: 0 };
// whale body as spheres along the spine: [z, radius] in units of body length (nose = +0.5)
const SPINE = [0.36, 0.1, 0.22, 0.14, 0.05, 0.15, -0.12, 0.13, -0.27, 0.085, -0.38, 0.05];

class Swarm {
  constructor(scene, geo, pool = FISH) {
    this.pool = pool;
    this.mat = makeCreatureMaterial({ amp: pool === FISH ? 0.14 : 0.1, freq: 14, wave: 5 });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, CAP);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(this.mesh);
    this.P = new Float32Array(CAP * 3); this.V = new Float32Array(CAP * 3); this.D = new Float32Array(CAP * 3);
    this.O = new Float32Array(CAP * 3); this.W = new Float32Array(CAP); this.PH = new Float32Array(CAP); this.SZ = new Float32Array(CAP);
    this.FL = new Float32Array(CAP); // per-fish ground floor cache
    this.active = false; this.t = 0; this.n = 0;
    this.c = new THREE.Vector3(); this.vc = new THREE.Vector3();
    this.yaw = 0; this.speed = 1; this.spread = 1; this.fear = 0; this.seedP = [0, 0, 0, 0];
  }
  bandY(y, ground) { return bandY(this.sp, y, ground, 1.5); }
  spawn(field, sub) {
    this.n = pickCount();
    this.type = this.pool === FISH && Math.random() < 0.5 ? 'reef' : 'open';
    // position: ahead-biased ring just outside visibility
    const dir = Math.atan2(sub.fwd.x, sub.fwd.z) + R(-2.2, 2.2);
    let best = null;
    for (let tries = 0; tries < (this.type === 'reef' ? 14 : 1); tries++) {
      const d = R(95, 135), a = dir + R(-0.4, 0.4) * tries;
      const x = sub.pos.x + Math.sin(a) * d, z = sub.pos.z + Math.cos(a) * d;
      const score = this.type === 'reef' ? field.reefAt(x, z) + field.rockAt(x, z) * 0.5 : 0;
      if (!best || score > best.s) best = { x, z, s: score };
    }
    const g = field.heightAt(best.x, best.z);
    const sp = this.sp = pick(this.pool, -g - 1.5, (f) => f.habitat === this.type, (f) => (f.glow ? SQUID_W[this.phase] || 1 : 1));
    if (sp.count) this.n = Math.floor(R(sp.count[0], sp.count[1]));
    this.mat.emissive.set(sp.glow ? sp.colors[0] : 0x000000).multiplyScalar(sp.glow ? 0.45 : 0);
    this.size = (this.n > 100 ? 0.75 : 1) * R(sp.size[0], sp.size[1]);
    this.radius = clamp(1.5 + Math.cbrt(this.n) * R(0.9, 1.6) * (0.6 + this.size), 2, 13);
    this.speed = this.type === 'open' ? R(1.8, 4.2) * (0.7 + this.size) : R(0.3, 0.9);
    this.alt = this.type === 'open' ? R(4, 38) : R(1.5, 6);
    this.t = Math.random() * 100;
    this.seedP = [R(0, 6), R(0, 6), R(0, 6), R(0, 6)];
    const rainbow = !sp.colors;
    const c1 = new THREE.Color(rainbow ? '#fff' : sp.colors[0]), c2 = new THREE.Color(rainbow ? '#fff' : sp.colors[sp.colors.length - 1]), c = new THREE.Color();
    for (let i = 0; i < this.n; i++) {
      const j = i * 3;
      // uniform in unit ball
      let x, y, z; do { x = R(-1, 1); y = R(-1, 1); z = R(-1, 1); } while (x * x + y * y + z * z > 1);
      this.O[j] = x; this.O[j + 1] = y; this.O[j + 2] = z;
      this.W[i] = R(0.25, 0.8) * (Math.random() < 0.5 ? -1 : 1);
      this.PH[i] = R(0, 6.28); this.SZ[i] = this.size * R(0.8, 1.2);
      if (rainbow) c.setHSL(Math.random(), 0.8, 0.55); else c.copy(c1).lerp(c2, Math.random()).multiplyScalar(R(0.85, 1.1));
      this.mesh.instanceColor.setXYZ(i, c.r, c.g, c.b);
    }
    this.mesh.instanceColor.needsUpdate = true;
    this.mat.userData.u.uFreq.value = (6 + this.speed * 2.2) / (0.5 + this.size) * (this.pool === FISH ? 1 : 0.35);
    this.c.set(best.x, this.bandY(g + this.alt, g), best.z);
    this.home = this.c.clone();
    this.yaw = R(0, 6.28);
    for (let i = 0; i < this.n; i++) { // start inside the blob
      const j = i * 3;
      this.P[j] = this.c.x + this.O[j] * this.radius; this.P[j + 1] = this.c.y + this.O[j + 1] * this.radius * 0.5; this.P[j + 2] = this.c.z + this.O[j + 2] * this.radius;
      this.V[j] = 0; this.V[j + 1] = 0; this.V[j + 2] = 0;
      this.D[j] = Math.sin(this.yaw); this.D[j + 1] = 0; this.D[j + 2] = Math.cos(this.yaw);
      this.FL[i] = -1e9;
    }
    this.fear = 0; this.spread = 1;
    this.mesh.count = this.n; this.active = true;
  }
  update(dt, frame, field, sub, threats) {
    this.t += dt; const t = this.t, sp = this.seedP;
    // --- fear from threats ---
    let fx = 0, fz = 0, f = 0;
    for (const th of threats) {
      const dx = this.c.x - th.x, dy = this.c.y - th.y, dz = this.c.z - th.z, d = Math.hypot(dx, dy, dz);
      const reach = th.r + this.radius;
      if (d < reach) { const k = 1 - d / reach; if (k > f) f = k; fx += dx / (d + 0.1) * k; fz += dz / (d + 0.1) * k; }
    }
    this.fear += (f - this.fear) * (1 - Math.exp(-dt * (f > this.fear ? 4 : 0.6)));
    this.spread += ((1 + this.fear * 1.4) - this.spread) * (1 - Math.exp(-dt * 2));
    const boost = 1 + this.fear * 1.8;

    // --- center motion ---
    if (this.type === 'open') {
      let yawRate = 0.14 * Math.sin(t * 0.13 + sp[0]) + 0.09 * Math.sin(t * 0.31 + sp[1]);
      if (this.fear > 0.05) yawRate += clamp(angDiff(this.yaw, Math.atan2(fx, fz)), -1, 1) * 1.6 * this.fear;
      this.yaw += yawRate * dt;
      const s = this.speed * boost;
      const ax = Math.sin(this.yaw), az = Math.cos(this.yaw);
      this.vc.x = ax * s; this.vc.z = az * s;
      const gA = field.heightAt(this.c.x + ax * 14, this.c.z + az * 14);
      const wantY = this.bandY(Math.max(gA + this.alt + Math.sin(t * 0.07 + sp[2]) * 4, gA + 3), gA);
      this.vc.y += ((wantY - this.c.y) * 0.4 - this.vc.y) * (1 - Math.exp(-dt * 1.5));
      this.c.addScaledVector(this.vc, dt);
    } else {
      const tx = this.home.x + Math.sin(t * 0.06 + sp[0]) * 7 + fx * 8 * this.fear, tz = this.home.z + Math.cos(t * 0.05 + sp[1]) * 7 + fz * 8 * this.fear;
      const gT = field.heightAt(tx, tz), ty = this.bandY(gT + this.alt + Math.sin(t * 0.09 + sp[2]) * 1.5, gT);
      const k = 1 - Math.exp(-dt * 0.6);
      this.vc.set((tx - this.c.x) * 0.6, (ty - this.c.y) * 0.6, (tz - this.c.z) * 0.6);
      this.c.x += (tx - this.c.x) * k * (1 + this.fear * 3); this.c.y += (ty - this.c.y) * k; this.c.z += (tz - this.c.z) * k * (1 + this.fear * 3);
      this.yaw = Math.atan2(this.vc.x, this.vc.z) || this.yaw;
    }

    // --- fish ---
    const open = this.type === 'open';
    const R0 = this.radius * this.spread;
    const sx = open ? 0.75 : 1, sy = open ? 0.45 : 0.6, sz = open ? 1.6 : 1;
    const ca = Math.cos(this.yaw), sa = Math.sin(this.yaw);
    const mill = open ? 0 : t * 0.12;
    const cm = Math.cos(mill), sm = Math.sin(mill);
    const maxSp = (open ? this.speed * 1.5 + 1.5 : 1.8 + this.n * 0.004) * boost;
    const arr = this.mesh.instanceMatrix.array;
    const dartR = 1.2 + Math.pow(sub.speed, 1.3) * 1.4, dartK = 1.5 + sub.speed * 2.2;
    const kd = 1 - Math.exp(-dt * (3 + this.fear * 4)), kdir = 1 - Math.exp(-dt * 6);
    const spr = open ? this.spread : this.spread;
    for (let i = 0; i < this.n; i++) {
      const j = i * 3, a = t * this.W[i] + this.PH[i];
      let ox = (this.O[j] + 0.3 * Math.sin(a)) * sx, oy = (this.O[j + 1] + 0.25 * Math.sin(a * 1.3 + 1)) * sy, oz = (this.O[j + 2] + 0.3 * Math.cos(a * 0.9)) * sz;
      if (!open) { const rx = ox * cm - oz * sm, rz = ox * sm + oz * cm; ox = rx; oz = rz; }
      ox *= R0; oy *= R0; oz *= R0;
      // heading frame: right = (ca,0,-sa), forward = (sa,0,ca)
      const tx = this.c.x + ox * ca + oz * sa, tz = this.c.z - ox * sa + oz * ca, ty = this.c.y + oy;
      let vx = this.vc.x + (tx - this.P[j]) * 1.7, vy = this.vc.y + (ty - this.P[j + 1]) * 1.7, vz = this.vc.z + (tz - this.P[j + 2]) * 1.7;
      // individual fish dart away from a sub that comes at them quickly (scuttle); a slow sub can drift right up to them
      const qx = this.P[j] - sub.pos.x, qy = this.P[j + 1] - sub.pos.y, qz = this.P[j + 2] - sub.pos.z, q2 = qx * qx + qy * qy + qz * qz;
      let lim = maxSp;
      if (q2 < dartR * dartR) {
        const q = Math.sqrt(q2) || 0.01, push = (1 - q / dartR) * dartK;
        vx += qx / q * push; vy += qy / q * push * 0.6; vz += qz / q * push; lim += push;
      }
      const vm = Math.hypot(vx, vy, vz);
      if (vm > lim) { const s = lim / vm; vx *= s; vy *= s; vz *= s; }
      this.V[j] += (vx - this.V[j]) * kd; this.V[j + 1] += (vy - this.V[j + 1]) * kd; this.V[j + 2] += (vz - this.V[j + 2]) * kd;
      this.P[j] += this.V[j] * dt; this.P[j + 1] += this.V[j + 1] * dt; this.P[j + 2] += this.V[j + 2] * dt;
      if ((i + frame) % 8 === 0) this.FL[i] = field.heightAt(this.P[j], this.P[j + 2]) + 0.5;
      const dmax = -this.sp.max; if (this.P[j + 1] < dmax) { this.P[j + 1] = dmax; if (this.V[j + 1] < 0) this.V[j + 1] = 0; }
      if (this.P[j + 1] < this.FL[i]) { this.P[j + 1] = this.FL[i]; if (this.V[j + 1] < 0) this.V[j + 1] = 0; }
      const top = -Math.max(2, this.sp.min); if (this.P[j + 1] > top) this.P[j + 1] = top;
      // direction
      const sm2 = Math.hypot(this.V[j], this.V[j + 1], this.V[j + 2]);
      if (sm2 > 0.08) {
        this.D[j] += (this.V[j] / sm2 - this.D[j]) * kdir; this.D[j + 1] += (this.V[j + 1] / sm2 - this.D[j + 1]) * kdir; this.D[j + 2] += (this.V[j + 2] / sm2 - this.D[j + 2]) * kdir;
      }
      let dx = this.D[j], dy = this.D[j + 1], dz = this.D[j + 2];
      const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
      // right = up x forward
      let rx = dz, rz = -dx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      const ux = dy * rz, uy = dz * rx - dx * rz, uz = -dy * rx; // forward x right
      const s = this.SZ[i], m = i * 16;
      arr[m] = rx * s; arr[m + 1] = 0; arr[m + 2] = rz * s; arr[m + 3] = 0;
      arr[m + 4] = ux * s; arr[m + 5] = uy * s; arr[m + 6] = uz * s; arr[m + 7] = 0;
      arr[m + 8] = dx * s; arr[m + 9] = dy * s; arr[m + 10] = dz * s; arr[m + 11] = 0;
      arr[m + 12] = this.P[j]; arr[m + 13] = this.P[j + 1]; arr[m + 14] = this.P[j + 2]; arr[m + 15] = 1;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  hide() { this.active = false; this.mesh.count = 0; }
}

class Big {
  constructor(scene, geo, opts) {
    this.opts = opts;
    this.mat = makeCreatureMaterial(opts.mat);
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false;
    this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.roll = 0; this.yawRate = 0; this.speed = 0; this.active = false;
    this.timer = opts.firstDelay(); this.t = 0;
  }
  place() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(-this.pitch, this.yaw, this.roll);
  }
  despawn() { this.active = false; this.mesh.visible = false; this.timer = this.opts.nextDelay(); this.fear = 0; this.v = undefined; }
  bandY(y, ground, margin) { return bandY(this.sp, y, ground, margin); }
  /** smoothed fear of the sub; returns the bearing pointing away from it */
  scare(sub, dt, sens) {
    const f = alarm(sub, this.pos.x, this.pos.y, this.pos.z, sens);
    this.fear = (this.fear || 0) + (f - (this.fear || 0)) * (1 - Math.exp(-dt * (f > (this.fear || 0) ? 3 : 0.4)));
    return Math.atan2(this.pos.x - sub.pos.x, this.pos.z - sub.pos.z);
  }
  /** highest seabed under the next few lookahead points (hills ahead must be cleared early) */
  aheadGround(field, ax, az, dists) {
    let m = field.heightAt(this.pos.x, this.pos.z);
    for (const d of dists) m = Math.max(m, field.heightAt(this.pos.x + ax * d, this.pos.z + az * d));
    return m;
  }
  /** hard floor: never let the body intersect the seabed, whatever the steering does */
  groundGuard(field, clear) {
    const g = field.heightAt(this.pos.x, this.pos.z) + clear;
    if (this.pos.y < g) this.pos.y = g;
  }
}

class Shark extends Big {
  /** geos: { [species id]: geometry } — each species has its own markings */
  constructor(scene, geos) {
    super(scene, Object.values(geos)[0], { mat: { amp: 0.075, freq: 5, wave: 5 }, firstDelay: () => R(6, 50), nextDelay: () => R(20, 80) });
    this.geos = geos;
  }
  spawn(field, sub) {
    const a = Math.atan2(sub.fwd.x, sub.fwd.z) + R(-2.4, 2.4), d = R(100, 130);
    const px = sub.pos.x + Math.sin(a) * d, pz = sub.pos.z + Math.cos(a) * d, g = field.heightAt(px, pz);
    const sp = this.sp = pick(SHARKS, -g - 4);
    this.mesh.geometry = this.geos[sp.id] || this.mesh.geometry;
    this.len = R(sp.len[0], sp.len[1]); this.mesh.scale.setScalar(this.len);
    bodyTint(sp, this.mat.color, 0.15);
    this.speed = R(2.6, 4); this.curious = Math.random() < 0.5; this.cur = this.curious ? R(25, 50) : 0; this.t = Math.random() * 50;
    this.pos.set(px, this.bandY(g + R(5, 22), g, 4), pz);
    this.yaw = a + Math.PI + R(-0.8, 0.8); this.yawRate = 0; this.pitch = 0;
    this.active = true; this.mesh.visible = true; this.place();
  }
  update(dt, field, sub) {
    this.t += dt; const t = this.t;
    let wantYaw = this.yaw + (0.2 * Math.sin(t * 0.11) + 0.12 * Math.sin(t * 0.29 + 1)) * 4;
    const dx = sub.pos.x - this.pos.x, dz = sub.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    if (this.cur > 0) {
      this.cur -= dt;
      const bearing = Math.atan2(dx, dz), off = THREE.MathUtils.lerp(0.05, 1.45, clamp(1 - (dist - 9) / 16, 0, 1));
      wantYaw = bearing + (this.side ??= Math.random() < 0.5 ? 1 : -1) * off;
    } else if (dist < 70 && Math.random() < dt * 0.01) this.cur = R(25, 50);
    const away = this.scare(sub, dt, 1.1);
    if (this.fear > 0.05) { this.cur = 0; wantYaw = away; }
    const target = clamp(angDiff(this.yaw, wantYaw), -1, 1) * (0.4 + this.fear * 0.6);
    this.yawRate += (target - this.yawRate) * (1 - Math.exp(-dt * 0.8));
    this.yaw += this.yawRate * dt;
    const ax = Math.sin(this.yaw), az = Math.cos(this.yaw);
    const gA = this.aheadGround(field, ax, az, [6, 12, 22, 34]);
    const wantY = this.bandY(Math.max(gA + 8 + Math.sin(t * 0.05) * 6, gA + 4), gA, 4);
    const dy = clamp((wantY - this.pos.y) * 0.2, -1.2, 2.5);
    const spd = swim(this, dt, this.speed, 10, 4.5);   // reef sharks sprint to ~10 m/s in about 2 s
    this.pitch += (clamp(dy / Math.max(1, spd), -0.4, 0.7) - this.pitch) * (1 - Math.exp(-dt * 1.6));
    const cp = Math.cos(this.pitch);
    this.pos.x += ax * cp * spd * dt; this.pos.z += az * cp * spd * dt; this.pos.y += Math.sin(this.pitch) * spd * dt;
    this.groundGuard(field, this.len * 0.2 + 0.6);
    this.roll += (-this.yawRate * 1.3 - this.roll) * (1 - Math.exp(-dt * 2));
    this.mat.userData.u.uFreq.value = Math.min(6.5, 2.6 + spd * 0.4);   // tail beats faster when sprinting, but stays a plausible few Hz
    this.place();
    if (Math.hypot(this.pos.x - sub.pos.x, this.pos.z - sub.pos.z) > 190) this.despawn();
  }
}

class Whale extends Big {
  constructor(scene, geos) {
    const geo = Object.values(geos)[0];
    super(scene, geo, { mat: { amp: 0.06, freq: 1.5, wave: 3, axis: [0, 1, 0] }, firstDelay: () => R(70, 140), nextDelay: () => R(200, 420) });
    this.geos = geos;
    this.calfMesh = new THREE.Mesh(geo, makeCreatureMaterial({ amp: 0.08, freq: 2.2, wave: 3, axis: [0, 1, 0] }));
    this.calfMesh.frustumCulled = false; this.calfMesh.visible = false; this.calfMesh.rotation.order = 'YXZ';
    scene.add(this.calfMesh); this.calfPos = new THREE.Vector3(); this.hasCalf = false;
  }
  spawn(field, sub) {
    const a = Math.atan2(sub.fwd.x, sub.fwd.z) + R(-1.6, 1.6), d = 150;
    this.pos.set(sub.pos.x + Math.sin(a) * d, 0, sub.pos.z + Math.cos(a) * d);
    const g0 = field.heightAt(this.pos.x, this.pos.z);
    const sp = this.sp = pick(WHALES, -g0 - 12);
    this.mesh.geometry = this.calfMesh.geometry = this.geos[sp.id] || this.mesh.geometry;
    this.len = R(sp.len[0], sp.len[1]); this.mesh.scale.setScalar(this.len);
    bodyTint(sp, this.mat.color, 0.1); this.calfMesh.material.color.copy(this.mat.color).multiplyScalar(1.05);
    this.speed = R(2.4, 3.2); this.t = Math.random() * 50;
    // aim to pass 25-45 units from the sub
    const lat = R(25, 45) * (Math.random() < 0.5 ? 1 : -1);
    const tx = sub.pos.x + Math.cos(a) * lat, tz = sub.pos.z - Math.sin(a) * lat;
    this.yaw = Math.atan2(tx - this.pos.x, tz - this.pos.z); this.yawRate = 0;
    this.pos.y = this.bandY(sub.pos.y + R(-6, 10), g0, 12);
    this.pitch = 0; this.active = true; this.mesh.visible = true;
    this.hasCalf = Math.random() < 0.5;
    if (this.hasCalf) { this.calfMesh.scale.setScalar(this.len * 0.4); this.calfMesh.visible = true; this.calfPos.copy(this.pos); this.calfPos.x -= 8; }
    this.place();
  }
  update(dt, field, sub) {
    this.t += dt; const t = this.t;
    const away = this.scare(sub, dt, 1.4);
    const turn = 0.03 * Math.sin(t * 0.04) + 0.02 * Math.sin(t * 0.11) + clamp(angDiff(this.yaw, away), -1, 1) * 0.22 * this.fear;
    this.yaw += turn * dt;
    const ax = Math.sin(this.yaw), az = Math.cos(this.yaw);
    const gA = this.aheadGround(field, ax, az, [15, 30, 50, 80]);
    const wantY = this.bandY(Math.max(gA + 14, this.pos.y + Math.sin(t * 0.08) * 2), gA, 12);
    const dy = clamp((wantY - this.pos.y) * 0.12, -0.8, 1.4);
    const spd = swim(this, dt, this.speed, this.speed * 1.5, 0.35);   // whales cannot outrun the sub, they just lumber away
    this.pitch += (clamp(dy / Math.max(1, spd), -0.2, 0.35) + Math.sin(t * 0.25) * 0.04 - this.pitch) * (1 - Math.exp(-dt * 0.9));
    const cp = Math.cos(this.pitch);
    this.pos.x += ax * cp * spd * dt; this.pos.z += az * cp * spd * dt; this.pos.y += Math.sin(this.pitch) * spd * dt;
    this.groundGuard(field, this.len * 0.18 + 1);
    this.roll = Math.sin(t * 0.2) * 0.05;
    this.place();
    if (this.hasCalf) {
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      const tx = this.pos.x + rx * this.len * 0.28 - ax * this.len * 0.12, ty = this.pos.y - this.len * 0.22, tz = this.pos.z + rz * this.len * 0.28 - az * this.len * 0.12;
      const k = 1 - Math.exp(-dt * 0.9);
      this.calfPos.x += (tx - this.calfPos.x) * k; this.calfPos.y += (ty - this.calfPos.y) * k; this.calfPos.z += (tz - this.calfPos.z) * k;
      const cg = field.heightAt(this.calfPos.x, this.calfPos.z) + this.len * 0.4 * 0.2 + 0.8; if (this.calfPos.y < cg) this.calfPos.y = cg;
      this.calfMesh.position.copy(this.calfPos); this.calfMesh.rotation.set(-this.pitch, this.yaw, this.roll * 1.5);
    }
    const d = Math.hypot(this.pos.x - sub.pos.x, this.pos.z - sub.pos.z);
    if (d > 240 || (d > 170 && this.t > 30 && this.pos.distanceTo(sub.pos) > this.lastD && this.lastD)) this.despawn();
    this.lastD = this.pos.distanceTo(sub.pos);
  }
  despawn() { super.despawn(); this.calfMesh.visible = false; this.lastD = 0; }
}

/** Single large solitary swimmer (manta, giant squid): wanders inside its depth band, clears hills ahead, never enters the seabed. */
class Cruiser extends Big {
  constructor(scene, geo, list, o) {
    super(scene, geo, { mat: o.mat, firstDelay: o.first, nextDelay: o.next });
    this.list = list; this.o = o;
  }
  spawn(field, sub) {
    const o = this.o, a = Math.atan2(sub.fwd.x, sub.fwd.z) + R(-2, 2), d = R(100, 130);
    const px = sub.pos.x + Math.sin(a) * d, pz = sub.pos.z + Math.cos(a) * d, g = field.heightAt(px, pz);
    const sp = pick(this.list, -g - o.margin);
    if (-g < sp.min + o.margin) { this.timer = R(6, 14); return; } // too shallow here, try again later
    this.sp = sp; this.len = R(sp.len[0], sp.len[1]); this.mesh.scale.setScalar(this.len);
    bodyTint(sp, this.mat.color, o.exotic);
    this.speed = R(o.speed[0], o.speed[1]); this.t = Math.random() * 50;
    this.pos.set(px, this.bandY(g + R(o.alt[0], o.alt[1]), g, o.margin), pz);
    this.yaw = a + Math.PI + R(-0.7, 0.7); this.yawRate = 0; this.pitch = 0; this.roll = 0;
    this.active = true; this.mesh.visible = true; this.place();
  }
  update(dt, field, sub) {
    const o = this.o; this.t += dt; const t = this.t;
    const away = this.scare(sub, dt, o.shy);
    const target = (0.16 * Math.sin(t * 0.09) + 0.1 * Math.sin(t * 0.23 + 2)) * o.turn + clamp(angDiff(this.yaw, away), -1, 1) * this.fear * 0.9;
    this.yawRate += (target - this.yawRate) * (1 - Math.exp(-dt * (0.6 + this.fear * 2)));
    this.yaw += this.yawRate * dt;
    const ax = Math.sin(this.yaw), az = Math.cos(this.yaw), L = this.len;
    const gA = this.aheadGround(field, ax, az, [L * 0.5, L, L * 2, L * 3]);
    const wantY = this.bandY(Math.max(gA + o.alt[0] + (o.alt[1] - o.alt[0]) * (0.5 + 0.5 * Math.sin(t * 0.05)), gA + o.margin), gA, o.margin);
    const v = swim(this, dt, this.speed, o.burst, o.acc), sp = o.pulse ? v * (0.45 + 1.1 * Math.pow(Math.max(0, Math.sin(t * (1.3 + this.fear * 1.5))), 2)) : v;
    const dy = clamp((wantY - this.pos.y) * 0.2, -1, 2);
    this.pitch += (clamp(dy / Math.max(0.5, sp), -0.35, 0.6) - this.pitch) * (1 - Math.exp(-dt * 1.4));
    const cp = Math.cos(this.pitch);
    this.pos.x += ax * cp * sp * dt; this.pos.z += az * cp * sp * dt; this.pos.y += Math.sin(this.pitch) * sp * dt;
    this.groundGuard(field, L * o.clear + 0.6);
    this.roll += (-this.yawRate * o.bank - this.roll) * (1 - Math.exp(-dt * 1.5));
    this.place();
    if (Math.hypot(this.pos.x - sub.pos.x, this.pos.z - sub.pos.z) > 200) this.despawn();
  }
}

/** A pod of cetaceans (orcas, dolphins): a leader path plus members holding loose formation, porpoising gently. */
const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pe = new THREE.Euler(0, 0, 0, 'YXZ'), _pv = new THREE.Vector3(), _ps = new THREE.Vector3();
class Pod {
  constructor(scene, geo, list, max, o) {
    this.list = list; this.o = o; this.max = max;
    this.mat = makeCreatureMaterial({ amp: 0.06, freq: 3, wave: 3, axis: [0, 1, 0] });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max); this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(this.mesh);
    this.P = new Float32Array(max * 3); this.OFF = new Float32Array(max * 3); this.PH = new Float32Array(max); this.SC = new Float32Array(max);
    this.YAW = new Float32Array(max); this.PIT = new Float32Array(max);
    this.pos = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.yawRate = 0; this.t = 0; this.n = 0;
    this.active = false; this.timer = o.first(); this.fear = 0;
  }
  spawn(field, sub) {
    const o = this.o, a = Math.atan2(sub.fwd.x, sub.fwd.z) + R(-1.8, 1.8), d = R(110, 140);
    const px = sub.pos.x + Math.sin(a) * d, pz = sub.pos.z + Math.cos(a) * d, g = field.heightAt(px, pz);
    const sp = pick(this.list, -g - 3);
    if (-g < sp.min + 3) { this.timer = R(6, 14); return; }
    this.sp = sp; this.len = R(sp.len[0], sp.len[1]); this.n = Math.min(this.max, Math.floor(R(sp.pod[0], sp.pod[1] + 1)));
    this.speed = R(o.speed[0], o.speed[1]); this.t = Math.random() * 50;
    this.pos.set(px, this.bandY(g + R(o.alt[0], o.alt[1]), g), pz);
    // head across the sub's path, passing at 20-50 m
    const lat = R(20, 50) * (Math.random() < 0.5 ? 1 : -1);
    this.yaw = Math.atan2(sub.pos.x + Math.cos(a) * lat - px, sub.pos.z - Math.sin(a) * lat - pz); this.pitch = 0; this.yawRate = 0;
    const c = new THREE.Color();
    for (let i = 0; i < this.n; i++) {
      const row = Math.floor((i + 1) / 2), side = i === 0 ? 0 : i % 2 ? 1 : -1;
      this.OFF[i * 3] = side * row * this.len * R(0.8, 1.3); this.OFF[i * 3 + 1] = R(-0.6, 0.6) * this.len * 0.4; this.OFF[i * 3 + 2] = -row * this.len * R(0.6, 1.0);
      this.PH[i] = R(0, 6.28); this.SC[i] = this.len * (i > 0 && Math.random() < 0.2 ? R(0.5, 0.65) : R(0.88, 1.08)); // the odd calf
      this.P[i * 3] = this.pos.x; this.P[i * 3 + 1] = this.pos.y; this.P[i * 3 + 2] = this.pos.z;
      this.YAW[i] = this.yaw; this.PIT[i] = 0;
      c.setHSL(o.hue + R(-0.03, 0.03), o.sat, 0.5).lerp(new THREE.Color(1, 1, 1), 1 - o.sat).multiplyScalar(R(0.9, 1.06));
      this.mesh.setColorAt(i, c);
    }
    this.mesh.instanceColor.needsUpdate = true; this.mesh.count = this.n; this.active = true;
    this.mat.userData.u.uFreq.value = 1.5 + this.speed * 0.5;
  }
  bandY(y, ground) { return bandY(this.sp, y, ground, this.len * 0.5 + 1.5); }
  update(dt, field, sub) {
    const o = this.o; this.t += dt; const t = this.t;
    const f = alarm(sub, this.pos.x, this.pos.y, this.pos.z, o.shy);
    this.fear += (f - this.fear) * (1 - Math.exp(-dt * (f > this.fear ? 3 : 0.4)));
    const away = Math.atan2(this.pos.x - sub.pos.x, this.pos.z - sub.pos.z);
    const target = 0.12 * Math.sin(t * 0.08) + 0.08 * Math.sin(t * 0.21 + 1) + clamp(angDiff(this.yaw, away), -1, 1) * this.fear * 1.2;
    this.yawRate += (target - this.yawRate) * (1 - Math.exp(-dt * (0.6 + this.fear * 2))); this.yaw += this.yawRate * dt;
    const ax = Math.sin(this.yaw), az = Math.cos(this.yaw), L = this.len;
    let gA = field.heightAt(this.pos.x, this.pos.z);
    for (const k of [1, 2, 4, 6]) gA = Math.max(gA, field.heightAt(this.pos.x + ax * L * k, this.pos.z + az * L * k));
    const wantY = this.bandY(Math.max(gA + o.alt[0] + (o.alt[1] - o.alt[0]) * (0.5 + 0.5 * Math.sin(t * 0.06)), gA + L * 0.8), gA);
    const dy = clamp((wantY - this.pos.y) * 0.2, -1.2, 2.2);
    const spd = swim(this, dt, this.speed, o.burst, o.acc);
    this.mat.userData.u.uFreq.value = Math.min(4.5, 1.4 + spd * 0.3);
    this.pitch += (clamp(dy / Math.max(1, spd), -0.35, 0.55) - this.pitch) * (1 - Math.exp(-dt * 1.4));
    const cp = Math.cos(this.pitch);
    this.pos.x += ax * cp * spd * dt; this.pos.z += az * cp * spd * dt; this.pos.y += Math.sin(this.pitch) * spd * dt;
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw), k = 1 - Math.exp(-dt * (1.6 + spd * 0.35)), arr = this.mesh.instanceMatrix.array;
    for (let i = 0; i < this.n; i++) {
      const j = i * 3, ox = this.OFF[j], oy = this.OFF[j + 1], oz = this.OFF[j + 2];
      const bob = Math.sin(t * o.bob + this.PH[i]) * L * 0.22;
      const tx = this.pos.x + rx * ox + ax * oz, tz = this.pos.z + rz * ox + az * oz;
      let ty = this.pos.y + oy + bob;
      const px = this.P[j], py = this.P[j + 1], pz = this.P[j + 2];
      this.P[j] += (tx - px) * k; this.P[j + 2] += (tz - pz) * k; this.P[j + 1] += (ty - py) * k;
      const floor = field.heightAt(this.P[j], this.P[j + 2]) + this.SC[i] * 0.2 + 0.6;   // members never touch the seabed
      if (this.P[j + 1] < floor) this.P[j + 1] = floor;
      if (this.P[j + 1] > -1.5) this.P[j + 1] = -1.5;
      const vx = this.P[j] - px, vy = this.P[j + 1] - py, vz = this.P[j + 2] - pz, h = Math.hypot(vx, vz);
      if (h > 1e-4) { this.YAW[i] = this.yaw + clamp(Math.atan2(vx, vz) - this.yaw, -0.5, 0.5); this.PIT[i] += (clamp(Math.atan2(vy, h), -0.5, 0.5) - this.PIT[i]) * 0.2; }
      _pq.setFromEuler(_pe.set(-this.PIT[i], this.YAW[i], -this.yawRate * 0.8));
      _pm.compose(_pv.set(this.P[j], this.P[j + 1], this.P[j + 2]), _pq, _ps.setScalar(this.SC[i]));
      _pm.toArray(arr, i * 16);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (Math.hypot(this.pos.x - sub.pos.x, this.pos.z - sub.pos.z) > 220) this.despawn();
  }
  despawn() { this.active = false; this.mesh.count = 0; this.timer = this.o.next(); this.fear = 0; this.v = undefined; }
}

export class Fauna {
  constructor(scene, field, quality = 1) {
    this.field = field; this.frame = 0;
    const fg = fishGeometry();
    this.swarms = [];
    const n = Math.round(14 * quality);
    for (let i = 0; i < n; i++) this.swarms.push(new Swarm(scene, fg));
    this.nFish = n;
    const qg = squidGeometry();
    for (let i = 0; i < 2; i++) this.swarms.push(new Swarm(scene, qg, SQUID));
    this.cruisers = [
      new Cruiser(scene, mantaGeometry(), MANTAS, { kind: 'manta', shy: 1.2, burst: 6, acc: 2.5, mat: { amp: 0.11, freq: 1.4, wave: 2.5, mode: 'flap' }, first: () => R(30, 90), next: () => R(70, 160),
        speed: [1.6, 2.4], alt: [3, 14], margin: 2, clear: 0.12, turn: 1.2, bank: 1.6, exotic: 0.05 }),
      new Cruiser(scene, giantSquidGeometry(), GIANT_SQUID, { kind: 'giantsquid', shy: 1.5, burst: 8, acc: 5, mat: { amp: 0.05, freq: 1.2, wave: 4 }, first: () => R(60, 160), next: () => R(160, 360),
        speed: [1.2, 2], alt: [3, 12], margin: 3, clear: 0.1, turn: 0.8, bank: 0.5, exotic: 0.05, pulse: true }),
    ];
    this.pods = [
      new Pod(scene, dolphinGeometry(), DOLPHINS, 9, { kind: 'dolphin', shy: 0.8, burst: 11, acc: 6, first: () => R(20, 60), next: () => R(60, 150), speed: [3.4, 4.6], alt: [4, 16], bob: 1.1, hue: 0.58, sat: 0.12 }),
      new Pod(scene, orcaGeometry(), ORCAS, 6, { kind: 'orca', shy: 0.7, burst: 12, acc: 5, first: () => R(90, 200), next: () => R(200, 400), speed: [3, 4], alt: [5, 18], bob: 0.7, hue: 0.6, sat: 0.04 }),
    ];
    const sg = Object.fromEntries(SHARKS.map((s) => [s.id, sharkGeometry(s.id)]));
    this.sharks = [0, 1, 2].map(() => new Shark(scene, sg));
    this.whale = new Whale(scene, { humpback: humpbackGeometry(), blue: blueWhaleGeometry() });
    this.threats = [{ x: 0, y: 0, z: 0, r: 8 }];
    this.whaleLevel = 0;
    /**
     * Plug-in animal groups (see src/groups/*.js). A group is:
     *   { id, update(dt, sub, ctx), threats?(push), collide?(pos, vel, radius) -> impact speed, sightings?(emit), hideAll?() }
     * ctx = { field, phase, profile ('lemon'|'manta'|'barracuda'|'squid'), biome(x, z) -> weights, threats, frame, sub }.
     * emit(species, kind, lengthMetres, x, y, z, { maxDist?, minFrac?, count? }) reports a visible individual to the photo scorer;
     * emit.occluded(x, y, z) tells whether the seabed blocks the line of sight (call once per school instead of per fish).
     */
    this.groups = []; this.profile = 'lemon';
  }
  addGroup(g) { this.groups.push(g); return g; }
  biome(x, z) { return this.field.biomeAt ? this.field.biomeAt(x, z) : DEFAULT_BIOME; }
  init(sub) {
    for (const s of this.swarms) { s.spawn(this.field, sub); // initial: closer so the first view is alive
      const a = Math.random() * 6.28, d = 25 + Math.random() * 85;
      const g = this.field.heightAt(sub.pos.x + Math.sin(a) * d, sub.pos.z + Math.cos(a) * d);
      const dx = sub.pos.x + Math.sin(a) * d - s.c.x, dz = sub.pos.z + Math.cos(a) * d - s.c.z;
      s.c.set(sub.pos.x + Math.sin(a) * d, Math.min(-4, g + s.alt), sub.pos.z + Math.cos(a) * d);
      s.home.copy(s.c);
      for (let i = 0; i < s.n; i++) { s.P[i * 3] += dx; s.P[i * 3 + 1] = s.c.y + s.O[i * 3 + 1]; s.P[i * 3 + 2] += dz; }
    }
    this.sharks.forEach((s, i) => { s.timer = i === 0 ? 4 : R(25, 90); });
  }
  update(dt, sub, phase = 'day') {
    this.frame++; this.phase = phase;
    const rate = (k) => ACTIVITY[k][phase] ?? 1;
    const th = this.threats; th.length = 0;
    th.push({ x: sub.pos.x, y: sub.pos.y, z: sub.pos.z, r: 2 + Math.pow(sub.speed, 1.5) * 2.2 });
    for (const s of this.sharks) if (s.active) th.push({ x: s.pos.x, y: s.pos.y, z: s.pos.z, r: 16 });
    for (const p of this.pods) if (p.active) th.push({ x: p.pos.x, y: p.pos.y, z: p.pos.z, r: p.sp.id === 'orca' ? 20 : 12 });
    for (const c of this.cruisers) if (c.active && c.sp.id === 'giantsquid') th.push({ x: c.pos.x, y: c.pos.y, z: c.pos.z, r: 12 });
    const fishOut = Math.round(this.nFish * (FISH_OUT[phase] ?? 1)), squidOut = SQUID_OUT[phase] ?? 1;
    for (let i = 0; i < this.swarms.length; i++) {
      const sw = this.swarms[i]; sw.phase = phase;
      const allowed = i < this.nFish ? i < fishOut : i - this.nFish < squidOut;
      const d = sw.active ? Math.hypot(sw.c.x - sub.pos.x, sw.c.z - sub.pos.z) : 1e9;
      if (!allowed) { if (sw.active && d > 110) sw.hide(); if (!sw.active) continue; }   // retire unseen, never pop out in view
      else if (!sw.active || d > 165) { sw.spawn(this.field, sub); continue; }
      sw.update(dt, this.frame, this.field, sub, th);
    }
    for (const s of this.sharks) {
      if (s.active) s.update(dt, this.field, sub);
      else { s.timer -= dt * rate('shark'); if (s.timer <= 0) s.spawn(this.field, sub); }
    }
    for (const c of [...this.cruisers, ...this.pods]) {
      if (c.active) c.update(dt, this.field, sub);
      else { c.timer -= dt * rate(c.o.kind); if (c.timer <= 0) c.spawn(this.field, sub); }
    }
    const ctx = { field: this.field, phase, profile: this.profile, biome: (x, z) => this.biome(x, z), threats: th, frame: this.frame, sub };
    for (const g of this.groups) { g.update(dt, sub, ctx); if (g.threats) g.threats((t) => th.push(t)); }
    const w = this.whale;
    if (w.active) w.update(dt, this.field, sub);
    else { w.timer -= dt * rate('whale'); if (w.timer <= 0) w.spawn(this.field, sub); }
    this.whaleLevel = w.active ? clamp(1 - w.pos.distanceTo(sub.pos) / 200, 0, 1) : 0;
  }
  /** Sphere-vs-whale (and calf) collision: body approximated by a chain of spheres along its axis. Returns the strongest impact speed (relative to the whale), 0 if none. */
  collide(pos, vel, radius) {
    let gbest = 0;
    for (const g of this.groups) if (g.collide) gbest = Math.max(gbest, g.collide(pos, vel, radius));
    const w = this.whale; if (!w.active) return gbest;
    const girth = w.sp && w.sp.id === 'blue' ? 0.62 : 1;   // blue whales are much slimmer than humpbacks
    let best = this._bodyHit(w.pos, w.len, w.yaw, w.pitch, w.v ?? w.speed, pos, vel, radius, girth);
    if (w.hasCalf && w.calfMesh.visible) best = Math.max(best, this._bodyHit(w.calfPos, w.len * 0.4, w.yaw, w.pitch, w.v ?? w.speed, pos, vel, radius, girth));
    return Math.max(best, gbest);
  }
  _bodyHit(c, len, yaw, pitch, speed, pos, vel, radius, girth = 1) {
    if (Math.abs(pos.x - c.x) > len || Math.abs(pos.z - c.z) > len || Math.abs(pos.y - c.y) > len) return 0;
    const cp = Math.cos(pitch), fx = Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = Math.cos(yaw) * cp;
    let best = 0;
    for (let i = 0; i < SPINE.length; i += 2) {
      const z = SPINE[i] * len, r = SPINE[i + 1] * len * girth + radius;
      const sx = c.x + fx * z, sy = c.y + fy * z, sz = c.z + fz * z;
      const ox = pos.x - sx, oy = pos.y - sy, oz = pos.z - sz, d2 = ox * ox + oy * oy + oz * oz;
      if (d2 >= r * r) continue;
      const d = Math.sqrt(d2) || 1e-4, nx = ox / d, ny = oy / d, nz = oz / d;
      pos.x = sx + nx * r; pos.y = sy + ny * r; pos.z = sz + nz * r;
      const vn = (vel.x - fx * speed) * nx + (vel.y - fy * speed) * ny + (vel.z - fz * speed) * nz;
      if (vn < 0) { vel.x -= nx * vn * 1.15; vel.y -= ny * vn * 1.15; vel.z -= nz * vn * 1.15; best = Math.max(best, -vn); }
    }
    return best;
  }
  forceWhale(sub) { this.whale.spawn(this.field, sub); }
}
