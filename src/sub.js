import * as THREE from 'three';
import { bus } from './bus.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));


export class Sub {
  constructor(model) {
    this.model = model;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.yaw = 0; this.pitch = 0; this.roll = 0; this.yawRate = 0; this.pitchRate = 0;
    this.throttle = 0; this.omega = 0; this.speed = 0; this.vf = 0; this.propAngle = 0;
    this.t = 0; this.touchedGround = 0;
    this.propPos = new THREE.Vector3(); this.ceil = -2.4; this.limit = 0;
    this.damage = 0; this.depthCap = 60; this.maxDepth = 60; this.stats = { thrust: 1, turn: 1, fragility: 1, lateral: false };
    this.radius = model.radius ?? 0.9; this.latThrottle = 0; this.hurtFlash = 0; this.scrape = 0; this.hitCool = 0; this.hitCount = 0; this.hitSev = 0;
    /** small handling multipliers earned through the logbook (see features/logbook.js): turn, thrust, bump (hull damage taken), repair (self-repair rate). Each within ±15%. */
    this.tweaks = { turn: 1, thrust: 1, bump: 1, repair: 1 };
  }
  /** Swap in another submarine model (position, heading and velocity are kept). */
  setModel(model) { this.model = model; this.radius = model.radius ?? 0.9; }
  /** Apply the effective stats of the active sub (see fleet.js); the depth limit jumps to the new value, then eases with damage as usual. */
  setStats(st) {
    this.stats = st; this.depthCap = st.maxDepth;
    if (!st.lateral) this.latThrottle = 0;
    this.maxDepth = st.maxDepth * (1 - 0.6 * this.damage);
  }
  /** impact at speed `spd` against something of hardness k (rock 1 .. sand 0.15). Gentle touches are free. */
  hit(spd, k) {
    if (this.hitCool > 0 || spd < 0.6) return;
    this.hitCool = 0.35;
    this.damage = Math.min(1, this.damage + 0.03 * Math.pow(spd - 0.4, 1.3) * k * this.stats.fragility * this.tweaks.bump);
    this.hitSev = clamp(spd * k / 5, 0.1, 1); this.hurtFlash = Math.max(this.hurtFlash, 0.4 + this.hitSev * 0.6); this.hitCount++;
    bus.emit('hit', { speed: spd, k });
  }
  /** 0.15 (flat sand) .. 1 (rock): mirrors the seabed colouring, steep or rock-zone ground is hard */
  groundHardness(n, field) {
    const steep = clamp((0.93 - n[1]) / 0.12, 0, 1), rock = Math.max(steep, field.rockAt(this.pos.x, this.pos.z) * 0.55 * clamp((0.985 - n[1]) / 0.05, 0, 1));
    return 0.15 + 0.85 * rock;
  }
  update(dt, input, terrain, field, fauna) {
    this.t += dt;
    const sp = this.vel.length();
    const eff = 0.45 + 0.55 * Math.min(1, sp / 4);
    // angular inertia: key torque + mouse impulses, exponential damping
    const tk = this.stats.turn * this.tweaks.turn, mk = Math.sqrt(tk);   // agile subs: stronger torque and higher rate limits (mouse a little less so)
    this.yawRate += (-input.turn * 2.4 * eff * tk) * dt - input.takeLookX() * 0.0094 * input.sens * mk;
    this.pitchRate += -input.takeLookY() * 0.0094 * input.sens * mk;
    const damp = Math.exp(-dt * 2.6);
    this.yawRate = clamp(this.yawRate * damp, -1.5 * tk, 1.5 * tk);
    this.pitchRate = clamp(this.pitchRate * damp, -1.2 * mk, 1.2 * mk);
    this.yaw += this.yawRate * dt;
    this.pitch += this.pitchRate * dt;
    if (Math.abs(this.pitchRate) < 0.05) this.pitch -= this.pitch * 0.1 * dt;           // gentle self-righting
    if (this.pitch > 1.2) { this.pitch = 1.2; this.pitchRate = Math.min(0, this.pitchRate); }
    if (this.pitch < -1.2) { this.pitch = -1.2; this.pitchRate = Math.max(0, this.pitchRate); }

    // motor spool
    const target = input.thrust >= 0 ? input.thrust : input.thrust * 0.45;
    this.throttle += (target - this.throttle) * (1 - Math.exp(-dt * 1.5));
    // sideways thrusters (manoeuvring kit): same spool-up as the main motor, thrust along the right vector
    const latTarget = this.stats.lateral ? clamp(input.strafe || 0, -1, 1) : 0;
    this.latThrottle += (latTarget - this.latThrottle) * (1 - Math.exp(-dt * 1.5));

    const cp = Math.cos(this.pitch);
    this.fwd.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const f = this.fwd, v = this.vel;
    const vf = v.dot(f);
    const lx = v.x - f.x * vf, ly = v.y - f.y * vf, lz = v.z - f.z * vf;
    const lm = Math.hypot(lx, ly, lz);
    const thrust = this.throttle * 5.2 * this.stats.thrust * this.tweaks.thrust * (input.boost ? 1.6 : 1);
    const along = thrust - (0.32 * vf + 0.035 * vf * Math.abs(vf));
    const latK = 1.5 + 0.25 * lm;
    let ax = f.x * along - lx * latK, ay = f.y * along - ly * latK + input.rise * 2.4, az = f.z * along - lz * latK;
    const rx0 = -Math.cos(this.yaw), rz0 = Math.sin(this.yaw), lat = this.latThrottle * 4.2 * this.stats.thrust;
    ax += rx0 * lat; az += rz0 * lat;
    ay -= v.y * 0.5 * (input.rise !== 0 ? 0 : 0.3);   // a touch of extra vertical damping when hovering

    // ground cushion + contact
    const gh = field.heightAt(this.pos.x, this.pos.z);
    const R = this.radius, clear = this.pos.y - gh - R;
    if (clear < 2.5) {
      const n = field.normalAt(this.pos.x, this.pos.z, [0, 0, 0]);
      const push = (2.5 - clear) * 2.2;
      ax += n[0] * push; ay += n[1] * push; az += n[2] * push;
      // the cushion usually softens a landing, but ploughing into the seabed still thumps the hull
      const vin = v.x * n[0] + v.y * n[1] + v.z * n[2];
      if (clear < R && vin < -0.8) this.hit(-vin, this.groundHardness(n, field));
    }
    v.x += ax * dt; v.y += ay * dt; v.z += az * dt;
    this.pos.addScaledVector(v, dt);

    // hard contact
    const gh2 = field.heightAt(this.pos.x, this.pos.z);
    if (this.pos.y < gh2 + R - 0.1) {
      const n = field.normalAt(this.pos.x, this.pos.z, [0, 0, 0]);
      this.pos.y = gh2 + R - 0.1;
      const vn = v.x * n[0] + v.y * n[1] + v.z * n[2];
      if (vn < 0) {
        v.x -= n[0] * vn * 1.1; v.y -= n[1] * vn * 1.1; v.z -= n[2] * vn * 1.1; this.touchedGround = Math.min(1, -vn / 3);
        // how rocky is this patch? mirrors the seabed colouring: steep or rock-zone ground is hard, flat sand is soft
        this.hit(-vn, this.groundHardness(n, field));
      }
    }
    const bump = terrain.collide(this.pos, v, R);
    if (bump > 0) this.hit(bump, terrain.impactK);
    const whump = fauna ? fauna.collide(this.pos, v, R) : 0;   // whales are big and do not step aside
    if (whump > 0) this.hit(whump, 0.7);
    // seaweed scrapes the hull while ploughing through it
    const wc = this.speed > 0.3 ? terrain.weedContact(this.pos, R) : 0;
    this.scrape += ((wc ? 1 : 0) - this.scrape) * (1 - Math.exp(-dt * 4));
    if (wc) this.damage = Math.min(1, this.damage + dt * 0.0028 * (0.4 + this.speed) * Math.min(wc, 4) * this.stats.fragility);
    this.hitCool = Math.max(0, this.hitCool - dt); this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.6);
    this.damage = Math.max(0, this.damage - dt * this.tweaks.repair / 720);   // slow self-repair: a full wreck mends in about 12 minutes
    this.maxDepth += (this.depthCap * (1 - 0.6 * this.damage) - this.maxDepth) * (1 - Math.exp(-dt * 2));
    // depth limit: pressure wall. Soft push over the last 4 m, hard stop at the sub's depth cap.
    const deep = -this.pos.y - (this.maxDepth - 4);
    if (deep > 0) { v.y += deep * 2.2 * dt; if (v.y < 0) v.y *= Math.exp(-dt * deep * 0.8); }
    if (this.pos.y < -this.depthCap) { this.pos.y = -this.depthCap; v.y = Math.max(0, v.y); }
    this.limit = clamp((-this.pos.y - (this.maxDepth - 8)) / 8, 0, 1);
    if (this.pos.y > this.ceil) { v.y -= (this.pos.y - this.ceil) * 3 * dt; if (this.pos.y > this.ceil + 0.8) { this.pos.y = this.ceil + 0.8; v.y = Math.min(0, v.y); } }

    this.speed = v.length();
    this.vf = v.dot(f);

    // propeller follows actual speed (plus a little for spool-up)
    const wTarget = Math.sign(this.throttle || this.vf) * Math.min(34, Math.abs(this.throttle) * 4 + Math.abs(this.vf) * 3.1);
    this.omega += (wTarget - this.omega) * (1 - Math.exp(-dt * 3.5));
    this.propAngle += this.omega * dt;

    // visuals
    const rx = -Math.cos(this.yaw), rz = Math.sin(this.yaw);   // right vector
    const slip = v.x * rx + v.z * rz;
    const rollT = clamp(-this.yawRate * 0.5 - slip * 0.05, -0.5, 0.5);
    this.roll += (rollT - this.roll) * (1 - Math.exp(-dt * 3));
    const m = this.model.group;
    const bob = Math.sin(this.t * 0.8) * 0.04;
    m.position.copy(this.pos); m.position.y += bob;
    m.rotation.set(-this.pitch, this.yaw, this.roll + Math.sin(this.t * 0.6) * 0.012);
    this.model.prop.rotation.z = this.propAngle;
    this.model.disc.material.opacity = THREE.MathUtils.smoothstep(Math.abs(this.omega), 12, 32) * 0.28;
    m.updateMatrixWorld(true);
    this.propPos.set(0, 0, this.model.propZ ?? -1.78).applyMatrix4(m.matrixWorld);
  }
}
