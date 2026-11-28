import { collectContacts, relBearing } from './equipment-contacts.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const dpr = () => Math.min(devicePixelRatio || 1, 2);
const KIND_COLOR = { whale: '#8fd8ff', pod: '#9dffd0', giantsquid: '#ff9fc4' };
const KIND_PITCH = { whale: 98, pod: 196, giantsquid: 73 };
const LANDMARK = { vent: 'hydrothermal vent', magma: 'magma rift', volcano: 'volcano', bigreef: 'big reef', wreck: 'wreck', arch: 'rock arch', cave: 'cave', trench: 'trench' };

function makeCanvas(id, w, h) {
  const cv = document.createElement('canvas'), k = dpr();
  cv.id = id; cv.width = Math.round(w * k); cv.height = Math.round(h * k); cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const cx = cv.getContext('2d'); cx.scale(k, k);
  return { cv, cx };
}

/**
 * Hydrophone listen mode: a shallow compass arc at the top edge. A pip per large animal within 250 m sits at its bearing
 * (centre = straight ahead, the ends = behind), bigger and brighter when closer, higher / lower when the animal is above / below.
 * The nearest one also pings softly, panned by bearing, faster the closer it is.
 */
export class HydrophoneHud {
  constructor(game) {
    this.game = game; this.on = false; this.contacts = []; this.acc = 1; this.pingT = 0.5; this.W = 300; this.H = 58;
    const { cv, cx } = makeCanvas('hydroHud', this.W, this.H); this.cv = cv; this.cx = cx; cv.hidden = true;
    document.body.appendChild(cv);
  }
  set(on) { this.on = on; this.cv.hidden = !on; if (!on) this.contacts = []; else this.acc = 1; }
  update(dt) {
    if (!this.on) return;
    const g = this.game;
    this.acc += dt;
    if (this.acc > 0.25) { this.acc = 0; this.contacts = collectContacts(g, { range: 250, bigOnly: true, max: 12 }); }
    // distances / bearings are re-derived every frame from the sub's current position, so the pips glide as it turns
    this.draw();
    const n = this.contacts[0];
    this.pingT -= dt;
    if (n && this.pingT <= 0) {
      const d = Math.hypot(n.x - g.sub.pos.x, n.y - g.sub.pos.y, n.z - g.sub.pos.z), near = clamp(1 - d / 250, 0, 1);
      this.pingT = 1.1 + (1 - near) * 2.6;
      if (g.audio.ping) g.audio.ping(Math.sin(relBearing(g.sub, n.x, n.z)), 0.03 + 0.07 * near, KIND_PITCH[n.kind] || 130, 0.5);
    }
  }
  draw() {
    const { cx: c, W, H, game: g } = this, sub = g.sub;
    c.clearRect(0, 0, W, H);
    const ax = (u) => W / 2 + u * (W / 2 - 14), ay = (u) => 18 + 13 * u * u;
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(159,227,255,.38)'; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i <= 48; i++) { const u = i / 24 - 1; i ? c.lineTo(ax(u), ay(u)) : c.moveTo(ax(u), ay(u)); }
    c.stroke();
    c.strokeStyle = 'rgba(223,246,255,.5)'; c.lineWidth = 1;
    for (const u of [-1, -0.5, 0, 0.5, 1]) { const x = ax(u), y = ay(u), l = u === 0 ? 7 : 4; c.beginPath(); c.moveTo(x, y - 2); c.lineTo(x, y - 2 - l); c.stroke(); }
    c.fillStyle = 'rgba(223,246,255,.55)'; c.font = '9px system-ui, sans-serif'; c.textAlign = 'center';
    c.fillText('ahead', W / 2, ay(0) - 12); c.fillText('behind', ax(-1) + 8, ay(-1) - 8); c.fillText('behind', ax(1) - 8, ay(1) - 8);
    let nearest = null, nd = 1e9;
    for (const n of this.contacts) {
      const dx = n.x - sub.pos.x, dy = n.y - sub.pos.y, dz = n.z - sub.pos.z, d = Math.hypot(dx, dy, dz);
      if (d > 260) continue;
      const u = relBearing(sub, n.x, n.z) / Math.PI, near = clamp(1 - d / 250, 0, 1), x = ax(u), y = ay(u) + 7 - clamp(dy / 40, -1, 1) * 5, r = 2.5 + 4.5 * near;
      const col = KIND_COLOR[n.kind] || '#ffe08a';
      c.globalAlpha = 0.35 + 0.65 * near; c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 8;
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      c.shadowBlur = 0; c.globalAlpha = 1;
      if (d < nd) { nd = d; nearest = n; }
    }
    c.textAlign = 'center'; c.font = '11px system-ui, sans-serif'; c.fillStyle = 'rgba(223,246,255,.85)';
    c.fillText(nearest ? `${nearest.name}${nearest.count > 1 ? ' ×' + nearest.count : ''} · ${Math.round(nd)} m` : 'listening…', W / 2, H - 6);
  }
}

/**
 * Sonar ping: a ring sweeps out through the water (3.2 s, 120 m); a small round radar (sub in the middle, heading up) lights each
 * animal / landmark as the ring passes it and fades them over ~6 s. Echoes keep their place in the world while the sub turns.
 */
export const SONAR = { range: 120, sweep: 3.2, show: 6.5, cooldown: 12 };
export class Sonar {
  constructor(game) {
    const { THREE, scene } = game;
    this.game = game; this.t = 99; this.cool = 0; this.contacts = []; this.S = 164;
    const flat = new THREE.RingGeometry(0.97, 1, 96, 1).rotateX(-Math.PI / 2);   // thin ring on the horizontal plane at the sub's depth
    const wall = new THREE.CylinderGeometry(1, 1, 0.16, 96, 2, true);          // soft translucent wall around the sub (fades to nothing at top and bottom)
    { const p = wall.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = Math.max(0, 1 - Math.abs(p.getY(i)) / 0.08); wall.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    const mk = (o) => new THREE.MeshBasicMaterial({ color: 0x8fe6ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false, ...o });
    this.mat = mk({}); this.matWall = mk({ vertexColors: true });
    this.ring = new THREE.Group(); this.ring.add(new THREE.Mesh(flat, this.mat), new THREE.Mesh(wall, this.matWall));
    for (const m of this.ring.children) { m.frustumCulled = false; m.renderOrder = 5; }
    this.ring.visible = false; scene.add(this.ring);
    const wrap = this.wrap = document.createElement('div'); wrap.id = 'sonarView'; wrap.hidden = true;
    const { cv, cx } = makeCanvas('sonarRadar', this.S, this.S); this.cx = cx; this.cap = document.createElement('div'); this.cap.className = 'cap';
    wrap.append(cv, this.cap); document.body.appendChild(wrap);
  }
  get ready() { return this.cool <= 0; }
  ping() {
    const g = this.game, s = g.sub;
    if (this.cool > 0) return false;
    this.cool = SONAR.cooldown; this.t = 0;
    this.contacts = collectContacts(g, { range: SONAR.range, landmarks: true, max: 40 });
    this.ring.position.set(s.pos.x, s.pos.y, s.pos.z); this.ring.rotation.y = Math.atan2(s.fwd.x, s.fwd.z); this.ring.scale.setScalar(1); this.ring.visible = true;
    const rank = (c) => (c.kind === 'landmark' || c.big ? 0 : c.kind === 'school' ? 2 : 1);   // landmarks and big animals first, fish schools last
    this.cap.textContent = this.contacts.length
      ? [...this.contacts].sort((a, b) => rank(a) - rank(b) || a.d - b.d).slice(0, 3).map((c) => `${c.kind === 'landmark' ? LANDMARK[c.name] || c.name : c.name}${c.count > 1 ? ' ×' + c.count : ''} · ${Math.round(c.d)} m`).join('\n')
      : 'quiet water';
    this.wrap.hidden = false; this.wrap.style.opacity = 1;
    if (g.audio.ping) g.audio.ping(0, 0.1, 620, 1.4);
    return true;
  }
  update(dt) {
    if (this.cool > 0) this.cool = Math.max(0, this.cool - dt);
    if (this.t > SONAR.show) { if (!this.wrap.hidden) { this.wrap.hidden = true; this.ring.visible = false; } return; }
    this.t += dt;
    const t = this.t, k = clamp(t / SONAR.sweep, 0, 1);
    this.ring.scale.setScalar(Math.max(1, k * SONAR.range * 1.04));
    this.mat.opacity = k < 1 ? 0.75 * Math.pow(1 - k, 1.3) : 0; this.matWall.opacity = this.mat.opacity * 0.55;
    this.ring.visible = k < 1;
    this.wrap.style.opacity = clamp((SONAR.show - t) / 1.2, 0, 1);
    this.draw(t);
  }
  draw(t) {
    const { cx: c, S, game: g } = this, sub = g.sub, R = S / 2 - 6, mid = S / 2;
    const fx = sub.fwd.x, fz = sub.fwd.z, fl = Math.hypot(fx, fz) || 1, hx = fx / fl, hz = fz / fl;   // heading; right = (-hz, hx)
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(3,24,36,.58)'; c.beginPath(); c.arc(mid, mid, R + 3, 0, 6.2832); c.fill();
    c.strokeStyle = 'rgba(159,227,255,.45)'; c.lineWidth = 1.5; c.beginPath(); c.arc(mid, mid, R + 3, 0, 6.2832); c.stroke();
    c.strokeStyle = 'rgba(159,227,255,.16)'; c.lineWidth = 1;
    for (const f of [1 / 3, 2 / 3]) { c.beginPath(); c.arc(mid, mid, R * f, 0, 6.2832); c.stroke(); }
    c.beginPath(); c.moveTo(mid, mid - R); c.lineTo(mid, mid + R); c.moveTo(mid - R, mid); c.lineTo(mid + R, mid); c.stroke();
    c.fillStyle = 'rgba(223,246,255,.8)'; c.beginPath(); c.moveTo(mid, mid - 3); c.lineTo(mid - 3.5, mid + 4); c.lineTo(mid + 3.5, mid + 4); c.closePath(); c.fill();   // the sub
    if (t < SONAR.sweep) { c.strokeStyle = 'rgba(159,227,255,.85)'; c.lineWidth = 2; c.beginPath(); c.arc(mid, mid, Math.max(1, t / SONAR.sweep * R), 0, 6.2832); c.stroke(); }
    for (const n of this.contacts) {
      const age = t - (n.d / SONAR.range) * SONAR.sweep; if (age < 0) continue;
      const dx = n.x - sub.pos.x, dz = n.z - sub.pos.z, fwd = dx * hx + dz * hz, right = dx * -hz + dz * hx;
      let px = right / SONAR.range * R, py = -fwd / SONAR.range * R; const m = Math.hypot(px, py); if (m > R) { px *= R / m; py *= R / m; }
      const a = Math.exp(-age * 0.42) * (0.55 + 0.45 * Math.cos(age * 5)), vert = Math.abs(n.y - sub.pos.y) > 40 ? 0.55 : 1, x = mid + px, y = mid + py;
      c.globalAlpha = clamp(a * vert, 0, 1);
      if (n.kind === 'landmark') { c.strokeStyle = '#ffcf6b'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x + 5, y); c.lineTo(x, y + 5); c.lineTo(x - 5, y); c.closePath(); c.stroke(); }
      else {
        const col = KIND_COLOR[n.kind] || (n.kind === 'school' ? '#b8f0ff' : '#ffe08a'), r = n.big ? 4.5 : n.kind === 'school' ? 3.2 : 3;
        c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 9 * (age < 0.6 ? 1.5 : 0.7);
        c.beginPath(); c.arc(x, y, r * (age < 0.5 ? 1.5 - age : 1), 0, 6.2832); c.fill(); c.shadowBlur = 0;
      }
      c.globalAlpha = 1;
    }
  }
}
