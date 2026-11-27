import * as THREE from 'three';
import { fishGeometry, sharkGeometry, whaleGeometry } from './creatures.js';
import { makeCreatureMaterial } from './materials.js';
import { FISH, SHARKS, WHALES, pick, bandY, bodyTint } from './species.js';

const R = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

const pickCount = () => {
  const r = Math.random();
  if (r < 0.22) return Math.floor(R(6, 16));
  if (r < 0.58) return Math.floor(R(20, 48));
  if (r < 0.86) return Math.floor(R(55, 110));
  return Math.floor(R(120, 220));
};
const CAP = 220;
// whale body as spheres along the spine: [z, radius] in units of body length (nose = +0.5)
const SPINE = [0.36, 0.1, 0.22, 0.14, 0.05, 0.15, -0.12, 0.13, -0.27, 0.085, -0.38, 0.05];

class Swarm {
  constructor(scene, geo) {
    this.mat = makeCreatureMaterial({ amp: 0.14, freq: 14, wave: 5 });
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
    this.type = Math.random() < 0.5 ? 'reef' : 'open';
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
    const sp = this.sp = pick(FISH, -g - 1.5, (f) => f.habitat === this.type);
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
    this.mat.userData.u.uFreq.value = (6 + this.speed * 2.2) / (0.5 + this.size);
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
    const kd = 1 - Math.exp(-dt * 3), kdir = 1 - Math.exp(-dt * 6);
    const spr = open ? this.spread : this.spread;
    for (let i = 0; i < this.n; i++) {
      const j = i * 3, a = t * this.W[i] + this.PH[i];
      let ox = (this.O[j] + 0.3 * Math.sin(a)) * sx, oy = (this.O[j + 1] + 0.25 * Math.sin(a * 1.3 + 1)) * sy, oz = (this.O[j + 2] + 0.3 * Math.cos(a * 0.9)) * sz;
      if (!open) { const rx = ox * cm - oz * sm, rz = ox * sm + oz * cm; ox = rx; oz = rz; }
      ox *= R0; oy *= R0; oz *= R0;
      // heading frame: right = (ca,0,-sa), forward = (sa,0,ca)
      const tx = this.c.x + ox * ca + oz * sa, tz = this.c.z - ox * sa + oz * ca, ty = this.c.y + oy;
      let vx = this.vc.x + (tx - this.P[j]) * 1.7, vy = this.vc.y + (ty - this.P[j + 1]) * 1.7, vz = this.vc.z + (tz - this.P[j + 2]) * 1.7;
      const vm = Math.hypot(vx, vy, vz);
      if (vm > maxSp) { const s = maxSp / vm; vx *= s; vy *= s; vz *= s; }
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
  despawn() { this.active = false; this.mesh.visible = false; this.timer = this.opts.nextDelay(); }
  bandY(y, ground, margin) { return bandY(this.sp, y, ground, margin); }
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
  constructor(scene, geo) {
    super(scene, geo, { mat: { amp: 0.075, freq: 5, wave: 5 }, firstDelay: () => R(6, 50), nextDelay: () => R(20, 80) });
  }
  spawn(field, sub) {
    const a = Math.atan2(sub.fwd.x, sub.fwd.z) + R(-2.4, 2.4), d = R(100, 130);
    const px = sub.pos.x + Math.sin(a) * d, pz = sub.pos.z + Math.cos(a) * d, g = field.heightAt(px, pz);
    const sp = this.sp = pick(SHARKS, -g - 4);
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
    const target = clamp(angDiff(this.yaw, wantYaw), -1, 1) * 0.4;
    this.yawRate += (target - this.yawRate) * (1 - Math.exp(-dt * 0.8));
    this.yaw += this.yawRate * dt;
    const ax = Math.sin(this.yaw), az = Math.cos(this.yaw);
    const gA = this.aheadGround(field, ax, az, [6, 12, 22, 34]);
    const wantY = this.bandY(Math.max(gA + 8 + Math.sin(t * 0.05) * 6, gA + 4), gA, 4);
    const dy = clamp((wantY - this.pos.y) * 0.2, -1.2, 2.5);
    this.pitch += (clamp(dy / this.speed, -0.4, 0.7) - this.pitch) * (1 - Math.exp(-dt * 1.6));
    const cp = Math.cos(this.pitch);
    this.pos.x += ax * cp * this.speed * dt; this.pos.z += az * cp * this.speed * dt; this.pos.y += Math.sin(this.pitch) * this.speed * dt;
    this.groundGuard(field, this.len * 0.2 + 0.6);
    this.roll += (-this.yawRate * 1.3 - this.roll) * (1 - Math.exp(-dt * 2));
    this.mat.userData.u.uFreq.value = 3 + this.speed * 0.9;
    this.place();
    if (Math.hypot(this.pos.x - sub.pos.x, this.pos.z - sub.pos.z) > 190) this.despawn();
  }
}

class Whale extends Big {
  constructor(scene, geo) {
    super(scene, geo, { mat: { amp: 0.06, freq: 1.5, wave: 3, axis: [0, 1, 0] }, firstDelay: () => R(70, 140), nextDelay: () => R(200, 420) });
    this.calf = null;
    this.calfMesh = new THREE.Mesh(geo, makeCreatureMaterial({ amp: 0.08, freq: 2.2, wave: 3, axis: [0, 1, 0] }));
    this.calfMesh.frustumCulled = false; this.calfMesh.visible = false; this.calfMesh.rotation.order = 'YXZ';
    scene.add(this.calfMesh); this.calfPos = new THREE.Vector3(); this.hasCalf = false;
  }
  spawn(field, sub) {
    const a = Math.atan2(sub.fwd.x, sub.fwd.z) + R(-1.6, 1.6), d = 150;
    this.pos.set(sub.pos.x + Math.sin(a) * d, 0, sub.pos.z + Math.cos(a) * d);
    const g0 = field.heightAt(this.pos.x, this.pos.z);
    const sp = this.sp = pick(WHALES, -g0 - 12);
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
    const turn = 0.03 * Math.sin(t * 0.04) + 0.02 * Math.sin(t * 0.11);
    this.yaw += turn * dt;
    const ax = Math.sin(this.yaw), az = Math.cos(this.yaw);
    const gA = this.aheadGround(field, ax, az, [15, 30, 50, 80]);
    const wantY = this.bandY(Math.max(gA + 14, this.pos.y + Math.sin(t * 0.08) * 2), gA, 12);
    const dy = clamp((wantY - this.pos.y) * 0.12, -0.8, 1.4);
    this.pitch += (clamp(dy / this.speed, -0.2, 0.35) + Math.sin(t * 0.25) * 0.04 - this.pitch) * (1 - Math.exp(-dt * 0.9));
    const cp = Math.cos(this.pitch);
    this.pos.x += ax * cp * this.speed * dt; this.pos.z += az * cp * this.speed * dt; this.pos.y += Math.sin(this.pitch) * this.speed * dt;
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

export class Fauna {
  constructor(scene, field, quality = 1) {
    this.field = field; this.frame = 0;
    const fg = fishGeometry();
    this.swarms = [];
    const n = Math.round(14 * quality);
    for (let i = 0; i < n; i++) this.swarms.push(new Swarm(scene, fg));
    const sg = sharkGeometry();
    this.sharks = [0, 1, 2].map(() => new Shark(scene, sg));
    this.whale = new Whale(scene, whaleGeometry());
    this.threats = [{ x: 0, y: 0, z: 0, r: 8 }];
    this.whaleLevel = 0;
  }
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
  update(dt, sub) {
    this.frame++;
    const th = this.threats; th.length = 0;
    th.push({ x: sub.pos.x, y: sub.pos.y, z: sub.pos.z, r: 4 + sub.speed * 0.9 });
    for (const s of this.sharks) if (s.active) th.push({ x: s.pos.x, y: s.pos.y, z: s.pos.z, r: 16 });
    for (const sw of this.swarms) {
      if (!sw.active) { sw.spawn(this.field, sub); continue; }
      const d = Math.hypot(sw.c.x - sub.pos.x, sw.c.z - sub.pos.z);
      if (d > 165) { sw.spawn(this.field, sub); continue; }
      sw.update(dt, this.frame, this.field, sub, th);
    }
    for (const s of this.sharks) {
      if (s.active) s.update(dt, this.field, sub);
      else { s.timer -= dt; if (s.timer <= 0) s.spawn(this.field, sub); }
    }
    const w = this.whale;
    if (w.active) w.update(dt, this.field, sub);
    else { w.timer -= dt; if (w.timer <= 0) w.spawn(this.field, sub); }
    this.whaleLevel = w.active ? clamp(1 - w.pos.distanceTo(sub.pos) / 200, 0, 1) : 0;
  }
  /** Sphere-vs-whale (and calf) collision: body approximated by a chain of spheres along its axis. Returns the strongest impact speed (relative to the whale), 0 if none. */
  collide(pos, vel, radius) {
    const w = this.whale; if (!w.active) return 0;
    let best = this._bodyHit(w.pos, w.len, w.yaw, w.pitch, w.speed, pos, vel, radius);
    if (w.hasCalf && w.calfMesh.visible) best = Math.max(best, this._bodyHit(w.calfPos, w.len * 0.4, w.yaw, w.pitch, w.speed, pos, vel, radius));
    return best;
  }
  _bodyHit(c, len, yaw, pitch, speed, pos, vel, radius) {
    if (Math.abs(pos.x - c.x) > len || Math.abs(pos.z - c.z) > len || Math.abs(pos.y - c.y) > len) return 0;
    const cp = Math.cos(pitch), fx = Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = Math.cos(yaw) * cp;
    let best = 0;
    for (let i = 0; i < SPINE.length; i += 2) {
      const z = SPINE[i] * len, r = SPINE[i + 1] * len + radius;
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
