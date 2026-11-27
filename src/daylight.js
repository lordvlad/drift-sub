import * as THREE from 'three';

export const TIMES = ['morning', 'day', 'evening', 'night'];
const HOUR = { morning: 7.5, day: 12, evening: 18.5, night: 23.5 };

// hour, shallow water, deep water, sun/moon, sun intensity, sky (hemi) colour, hemi intensity, shaft strength, shaft lean, surface tint
const K = [
  [0,    0x0a2a44, 0x010812, 0x7f9bff, 0.14, 0x4a6aa8, 0.38, 0,    -0.3, 0x2a4c80],
  [4.5,  0x0a2a44, 0x010812, 0x7f9bff, 0.14, 0x4a6aa8, 0.38, 0,    -0.3, 0x2a4c80],
  [5.5,  0x3a5f86, 0x07101f, 0xff9a6a, 0.5,  0x9a8fbf, 0.6,  0.4,  0.9,  0x8a86b0],
  [7.5,  0x3fb0b8, 0x06222e, 0xffd9a0, 1.1,  0xb8e6e0, 0.95, 0.3,  0.6,  0x70c8c0],
  [12,   0x1d9fc0, 0x041a2e, 0xfff4d8, 1.5,  0xa8ecff, 1.1,  0.22, 0.2,  0x59ccf2],
  [16.5, 0x2a9fb0, 0x05202c, 0xffe2b0, 1.3,  0xb0e4e0, 1.0,  0.26, -0.4, 0x60c0d0],
  [18.5, 0x4a6a9a, 0x0a0f24, 0xff7a3a, 0.8,  0xd09aa8, 0.7,  0.5,  -0.9, 0xe09a80],
  [20.5, 0x1c3a64, 0x030a18, 0x8a6aff, 0.25, 0x6a6aa8, 0.45, 0,    -0.6, 0x3a4a80],
  [21.5, 0x0a2a44, 0x010812, 0x7f9bff, 0.14, 0x4a6aa8, 0.38, 0,    -0.3, 0x2a4c80],
  [24,   0x0a2a44, 0x010812, 0x7f9bff, 0.14, 0x4a6aa8, 0.38, 0,    -0.3, 0x2a4c80],
];
const C = (h) => new THREE.Color(h);
const KF = K.map((k) => ({ h: k[0], shallow: C(k[1]), deep: C(k[2]), sun: C(k[3]), sunI: k[4], sky: C(k[5]), hemiI: k[6], shaft: k[7], lean: k[8], surf: C(k[9]) }));

function sample(h, out) {
  let i = 0; while (i < KF.length - 2 && h >= KF[i + 1].h) i++;
  const a = KF[i], b = KF[i + 1], t = THREE.MathUtils.smoothstep((h - a.h) / (b.h - a.h), 0, 1);
  for (const c of ['shallow', 'deep', 'sun', 'sky', 'surf']) out[c].copy(a[c]).lerp(b[c], t);
  for (const n of ['sunI', 'hemiI', 'shaft', 'lean']) out[n] = a[n] + (b[n] - a[n]) * t;
  return out;
}
const blank = () => ({ shallow: new THREE.Color(), deep: new THREE.Color(), sun: new THREE.Color(), sky: new THREE.Color(), surf: new THREE.Color(), sunI: 0, hemiI: 0, shaft: 0, lean: 0 });

export function phaseName(h) { return h < 5 || h >= 21 ? 'night' : h < 7 ? 'dawn' : h < 10.5 ? 'morning' : h < 16.5 ? 'day' : 'evening'; }

/** Time of day from the user's clock (or manual override). Parameters ease so switching never pops. */
export class Daylight {
  constructor(onChange) { this.mode = 'auto'; this.onChange = onChange; this.cur = sample(12, blank()); this.tgt = blank(); this.snap = true; }
  get hour() { if (this.mode !== 'auto') return HOUR[this.mode]; const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; }
  get phase() { return phaseName(this.hour); }
  cycle() { const all = ['auto', ...TIMES]; this.mode = all[(all.indexOf(this.mode) + 1) % all.length]; this.onChange(); }
  setMode(m) { this.mode = m; this.onChange(); }
  /** 0 (bright day) .. 1 (night) */
  get darkness() { return THREE.MathUtils.clamp(1 - this.cur.sunI / 1.2, 0, 1); }
  update(dt) {
    sample(this.hour, this.tgt);
    const k = this.snap ? 1 : 1 - Math.exp(-dt * 0.7); this.snap = false;
    const c = this.cur, t = this.tgt;
    for (const n of ['shallow', 'deep', 'sun', 'sky', 'surf']) c[n].lerp(t[n], k);
    for (const n of ['sunI', 'hemiI', 'lean']) c[n] += (t[n] - c[n]) * k;
    c.shaft += (t.shaft - c.shaft) * (k === 1 ? 1 : 1 - Math.exp(-dt * 2.5)); if (t.shaft === 0 && c.shaft < 0.004) c.shaft = 0;
  }
}
