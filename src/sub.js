import * as THREE from 'three';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function createSubModel() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffcc1a, roughness: 0.38, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0xe0a000, roughness: 0.5, metalness: 0.2 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd8432a, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fe3ff, roughness: 0.05, metalness: 0.3, emissive: 0x2a7fa8, emissiveIntensity: 0.55 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x6f7a85, roughness: 0.4, metalness: 0.6 });

  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), yellow);
  hull.scale.set(0.55, 0.5, 1.25); g.add(hull);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 40), red);
  stripe.scale.set(0.54, 0.49, 1); stripe.position.z = -0.3;
  g.add(stripe);
  // conning tower
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.42, 14), yellow);
  tower.position.set(0, 0.55, -0.05); g.add(tower);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
  cap.position.set(0, 0.76, -0.05); g.add(cap);
  const peri = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6), steel);
  peri.position.set(0, 1.0, -0.05); g.add(peri);
  const periHead = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.16), steel);
  periHead.position.set(0, 1.2, 0.02); g.add(periHead);
  // viewport + portholes
  const view = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12), glass);
  view.position.set(0, 0.1, 0.92); view.scale.set(1, 0.85, 0.8); g.add(view);
  for (const s of [-1, 1]) for (const z of [-0.35, 0.15]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 14), glass);
    p.rotation.z = Math.PI / 2; p.position.set(s * 0.53, 0.08, z); g.add(p);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.018, 6, 16), steel);
    rim.rotation.y = Math.PI / 2; rim.position.set(s * 0.545, 0.08, z); g.add(rim);
  }
  // tail fins
  const finGeo = new THREE.BoxGeometry(0.9, 0.04, 0.38);
  const fh = new THREE.Mesh(finGeo, dark); fh.position.set(0, 0, -1.2); g.add(fh);
  const fv = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.8, 0.38), dark); fv.position.set(0, 0, -1.2); g.add(fv);
  // shroud + prop
  const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 8, 24), steel);
  shroud.position.z = -1.58; g.add(shroud);
  for (let i = 0; i < 4; i++) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.27, 4), steel);
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    st.position.set(Math.cos(a) * 0.135, Math.sin(a) * 0.135, -1.46);
    st.rotation.z = a - Math.PI / 2; st.rotation.x = Math.PI / 2 * 0; g.add(st);
  }
  const prop = new THREE.Group(); prop.position.z = -1.6; g.add(prop);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 10), steel);
  hub.rotation.x = -Math.PI / 2; hub.position.z = -0.06; prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.2, 0.012, 0.075);
  bladeGeo.translate(0.12, 0, 0);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc9d2da, roughness: 0.3, metalness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const holder = new THREE.Group(); holder.rotation.z = (i / 4) * Math.PI * 2;
    const b = new THREE.Mesh(bladeGeo, bladeMat); b.rotation.x = 0.55; holder.add(b); prop.add(holder);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.25, 20), new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  disc.position.z = -0.02; prop.add(disc);
  // headlights
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
  lamp.position.set(0, -0.18, 1.18); g.add(lamp);
  const spot = new THREE.SpotLight(0xdff6ff, 0, 70, 0.55, 0.7, 1.2);
  spot.position.set(0, -0.1, 1.1);
  const target = new THREE.Object3D(); target.position.set(0, -0.3, 8);
  g.add(spot); g.add(target); spot.target = target;
  g.rotation.order = 'YXZ';
  return { group: g, prop, disc, spot };
}

export class Sub {
  constructor(model) {
    this.model = model;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.yaw = 0; this.pitch = 0; this.roll = 0; this.yawRate = 0; this.pitchRate = 0;
    this.throttle = 0; this.omega = 0; this.speed = 0; this.vf = 0; this.propAngle = 0;
    this.t = 0; this.touchedGround = 0;
    this.propPos = new THREE.Vector3();
  }
  update(dt, input, terrain, field) {
    this.t += dt;
    const sp = this.vel.length();
    const eff = 0.45 + 0.55 * Math.min(1, sp / 4);
    // angular inertia: key torque + mouse impulses, exponential damping
    this.yawRate += (-input.turn * 2.4 * eff) * dt - input.takeLookX() * 0.0094 * input.sens;
    this.pitchRate += -input.takeLookY() * 0.0094 * input.sens;
    const damp = Math.exp(-dt * 2.6);
    this.yawRate = clamp(this.yawRate * damp, -1.5, 1.5);
    this.pitchRate = clamp(this.pitchRate * damp, -1.2, 1.2);
    this.yaw += this.yawRate * dt;
    this.pitch += this.pitchRate * dt;
    if (Math.abs(this.pitchRate) < 0.05) this.pitch -= this.pitch * 0.1 * dt;           // gentle self-righting
    if (this.pitch > 1.2) { this.pitch = 1.2; this.pitchRate = Math.min(0, this.pitchRate); }
    if (this.pitch < -1.2) { this.pitch = -1.2; this.pitchRate = Math.max(0, this.pitchRate); }

    // motor spool
    const target = input.thrust >= 0 ? input.thrust : input.thrust * 0.45;
    this.throttle += (target - this.throttle) * (1 - Math.exp(-dt * 1.5));

    const cp = Math.cos(this.pitch);
    this.fwd.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const f = this.fwd, v = this.vel;
    const vf = v.dot(f);
    const lx = v.x - f.x * vf, ly = v.y - f.y * vf, lz = v.z - f.z * vf;
    const lm = Math.hypot(lx, ly, lz);
    const thrust = this.throttle * 5.2 * (input.boost ? 1.6 : 1);
    const along = thrust - (0.32 * vf + 0.035 * vf * Math.abs(vf));
    const latK = 1.5 + 0.25 * lm;
    let ax = f.x * along - lx * latK, ay = f.y * along - ly * latK + input.rise * 2.4, az = f.z * along - lz * latK;
    ay -= v.y * 0.5 * (input.rise !== 0 ? 0 : 0.3);   // a touch of extra vertical damping when hovering

    // ground cushion + contact
    const gh = field.heightAt(this.pos.x, this.pos.z);
    const clear = this.pos.y - gh - 0.9;
    if (clear < 2.5) {
      const n = field.normalAt(this.pos.x, this.pos.z, [0, 0, 0]);
      const push = (2.5 - clear) * 2.2;
      ax += n[0] * push; ay += n[1] * push; az += n[2] * push;
    }
    v.x += ax * dt; v.y += ay * dt; v.z += az * dt;
    this.pos.addScaledVector(v, dt);

    // hard contact
    const gh2 = field.heightAt(this.pos.x, this.pos.z);
    if (this.pos.y < gh2 + 0.8) {
      const n = field.normalAt(this.pos.x, this.pos.z, [0, 0, 0]);
      this.pos.y = gh2 + 0.8;
      const vn = v.x * n[0] + v.y * n[1] + v.z * n[2];
      if (vn < 0) { v.x -= n[0] * vn * 1.1; v.y -= n[1] * vn * 1.1; v.z -= n[2] * vn * 1.1; this.touchedGround = Math.min(1, -vn / 3); }
    }
    terrain.collide(this.pos, v, 0.9);
    if (this.pos.y > -2.4) { v.y -= (this.pos.y + 2.4) * 3 * dt; if (this.pos.y > -1.6) { this.pos.y = -1.6; v.y = Math.min(0, v.y); } }

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
    this.propPos.set(0, 0, -1.78).applyMatrix4(m.matrixWorld);
  }
}
