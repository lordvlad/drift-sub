import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, createNoise } from './noise.js';

/** Accumulates non-indexed triangles: position, normal, color, sway amplitude. */
export class Builder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.sway = []; }
  get count() { return this.pos.length / 3; }
  vert(x, y, z, nx, ny, nz, r, g, b, s) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.col.push(r, g, b); this.sway.push(s);
  }
  /** bake a three geometry. colorFn(x,y,z,c) mutates c. swayFn(x,y,z)->amp */
  add(geo, m, colorFn, swayFn) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, e = m.elements;
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      let ax = e[0] * nx + e[4] * ny + e[8] * nz, ay = e[1] * nx + e[5] * ny + e[9] * nz, az = e[2] * nx + e[6] * ny + e[10] * nz;
      const l = Math.hypot(ax, ay, az) || 1;
      c.setRGB(1, 1, 1);
      if (colorFn) colorFn(wx, wy, wz, c);
      this.vert(wx, wy, wz, ax / l, ay / l, az / l, c.r, c.g, c.b, swayFn ? swayFn(wx, wy, wz) : 0);
    }
    g.dispose(); if (g !== geo) geo.dispose();
  }
  finish() {
    return {
      pos: new Float32Array(this.pos), nor: new Float32Array(this.nor),
      col: new Float32Array(this.col), sway: new Float32Array(this.sway), count: this.count,
    };
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const lum = (c, v, tint = 1) => c.setRGB(v * tint, v * tint, v * tint);

function tube(b, a, z, r0, r1, sides, colorFn, swayFn, open = false) {
  const dir = _v.copy(z).sub(a); const len = dir.length();
  const geo = new THREE.CylinderGeometry(r1, r0, len, sides, 1, open);
  _q.setFromUnitVectors(_up, dir.normalize());
  _m.compose(_s.copy(a).add(z).multiplyScalar(0.5).clone(), _q, new THREE.Vector3(1, 1, 1));
  b.add(geo, _m, colorFn, swayFn);
}

function rockTemplate(rng, noise, detail) {
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv'); geo = mergeVertices(geo, 1e-4);
  const p = geo.attributes.position;
  const ox = rng() * 50, sy = 0.55 + rng() * 0.3, sz = 0.8 + rng() * 0.4;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
    const d = 1 + 0.26 * noise(x * 1.6 + ox, y * 1.6 + z * 1.3) + 0.09 * noise(x * 4.1 + z * 2 + ox, y * 4.1 - z);
    p.setXYZ(i, x * d, Math.max(y * d * sy, -0.45), z * d * sz);
  }
  geo.computeVertexNormals();
  const b = new Builder();
  b.add(geo, new THREE.Matrix4(), (x, y, z, c) => { const v = 0.38 + 0.22 * (y + 0.5) + noise(x * 3, z * 3) * 0.08; c.setRGB(v * 1.02, v * 0.97, v * 0.9); });
  return b.finish();
}

function branching(rng) {
  const b = new Builder();
  const cf = (x, y) => (c) => {};
  const grow = (base, dir, len, r, depth) => {
    const end = base.clone().addScaledVector(dir, len);
    tube(b, base, end, r, r * 0.55, 4, (x, y, z, c) => lum(c, 0.62 + Math.min(0.5, y * 0.18)), (x, y) => 0.02 * y * y, depth === 0);
    if (depth > 0) {
      const n = 2;
      for (let k = 0; k < n; k++) {
        const nd = dir.clone().add(new THREE.Vector3(rng() - 0.5, rng() * 0.3 + 0.2, rng() - 0.5).multiplyScalar(1.5)).normalize();
        grow(end, nd, len * (0.62 + rng() * 0.15), r * 0.7, depth - 1);
      }
    }
  };
  const trunks = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < trunks; i++) {
    const d = new THREE.Vector3((rng() - 0.5) * 0.7, 1, (rng() - 0.5) * 0.7).normalize();
    grow(new THREE.Vector3((rng() - 0.5) * 0.2, -0.1, (rng() - 0.5) * 0.2), d, 0.55 + rng() * 0.2, 0.09, 3);
  }
  return b.finish();
}

function dome(rng, noise) {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.attributes.position; const ox = rng() * 90;
  const ridges = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
    const rd = 1 - Math.abs(noise(x * 5 + ox, y * 5 + z * 4));
    ridges[i] = rd;
    const d = 1 + 0.07 * rd;
    p.setXYZ(i, x * d, Math.max(y * d * 0.62, -0.15), z * d);
  }
  geo.computeVertexNormals();
  const b = new Builder(); let idx = 0;
  b.add(geo, new THREE.Matrix4(), (x, y, z, c) => { const rd = 1 - Math.abs(noise(x * 5 + ox, (y / 0.62) * 5 + z * 4)); lum(c, 0.62 + rd * 0.45); });
  return b.finish();
}

function table(rng, noise) {
  const b = new Builder();
  tube(b, new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0, 0.75, 0), 0.28, 0.2, 7, (x, y, z, c) => lum(c, 0.6));
  const geo = new THREE.CylinderGeometry(1.5, 1.2, 0.1, 14, 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i); const r = Math.hypot(x, z);
    if (r > 0.6) { const a = Math.atan2(z, x); p.setY(i, p.getY(i) + Math.sin(a * 6 + rng() * 0.0) * 0.07 * (r / 1.5) + noise(x * 2, z * 2) * 0.05); }
  }
  geo.computeVertexNormals();
  _m.makeTranslation(0, 0.8, 0);
  b.add(geo, _m, (x, y, z, c) => lum(c, y > 0.8 ? 0.8 + 0.3 * Math.hypot(x, z) / 1.5 : 0.55));
  return b.finish();
}

function tubes(rng) {
  const b = new Builder(); const n = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const a = rng() * 6.28, d = rng() * 0.4, h = 0.6 + rng() * 1.0, r = 0.13 + rng() * 0.12;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const geo = new THREE.CylinderGeometry(r * 1.1, r, h, 8, 1, true);
    _m.makeTranslation(x, h / 2 - 0.1, z);
    b.add(geo, _m, (X, Y, Z, c) => lum(c, 0.6 + Math.min(0.5, Y * 0.35)), () => 0);
  }
  return b.finish();
}

function fan(rng, noise) {
  const geo = new THREE.PlaneGeometry(2.2, 2, 10, 9);
  const p = geo.attributes.position; const ox = rng() * 40;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = (p.getY(i) + 1);
    const w = 0.22 + (y / 2) * 0.95;
    p.setXYZ(i, x * w, y, noise(x * 2 + ox, y * 2) * 0.12 + Math.sin(x * 3) * 0.08);
  }
  geo.computeVertexNormals();
  const b = new Builder();
  b.add(geo, new THREE.Matrix4(), (x, y, z, c) => { const l = 0.65 + 0.5 * Math.min(1, y / 2) + 0.2 * Math.sin(x * 9 + y * 4); lum(c, l); }, (x, y) => 0.12 * (y / 2) * (y / 2));
  return b.finish();
}

function anemone(rng) {
  const b = new Builder(); const n = 12 + Math.floor(rng() * 6);
  for (let i = 0; i < n; i++) {
    const a = rng() * 6.28, d = 0.05 + rng() * 0.35, len = 0.55 + rng() * 0.35;
    const out = 0.15 + rng() * 0.45;
    const base = new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d);
    const tip = new THREE.Vector3(Math.cos(a) * (d + out), len, Math.sin(a) * (d + out));
    tube(b, base, tip, 0.05, 0.012, 3, (x, y, z, c) => lum(c, 0.6 + 0.6 * (y / len)), (x, y) => 0.26 * (y / 0.9) * (y / 0.9), true);
  }
  const geo = new THREE.CylinderGeometry(0.5, 0.42, 0.28, 10);
  _m.makeTranslation(0, 0.06, 0);
  b.add(geo, _m, (x, y, z, c) => lum(c, 0.5));
  return b.finish();
}

function ribbon(b, rng, x, z, h, w, lean, segs, wavy) {
  const ang = rng() * 6.28, cw = Math.cos(ang), sw = Math.sin(ang);
  const la = rng() * 6.28, lx = Math.cos(la) * lean, lz = Math.sin(la) * lean;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const cx = x + lx * t * t * h + Math.sin(t * 5 + ang) * wavy * h;
    const cz = z + lz * t * t * h;
    const ww = w * (1 - t * t * 0.85) * (wavy > 0 ? 0.8 + 0.4 * Math.sin(t * 14 + ang) : 1);
    pts.push([cx, t * h * (1 - 0.1 * t), cz, ww, t]);
  }
  for (let i = 0; i < segs; i++) {
    const a = pts[i], d = pts[i + 1];
    const tx = d[0] - a[0], ty = d[1] - a[1], tz = d[2] - a[2];
    const tl = Math.hypot(tx, ty, tz);
    // normal = cross(widthAxis(cw,0,sw), tangent)
    let nx = 0 * tz - sw * ty, ny = sw * tx - cw * tz, nz = cw * ty - 0 * tx;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const v = (p, side) => {
      const l = 0.5 + 0.65 * p[4];
      b.vert(p[0] + cw * p[3] * side, p[1], p[2] + sw * p[3] * side, nx, ny, nz, l, l, l, 0.0 + (wavy > 0 ? 0.9 : 0.35) * p[4] * p[4] * h * 0.18);
    };
    v(a, -1); v(a, 1); v(d, 1);
    v(a, -1); v(d, 1); v(d, -1);
  }
}

function tuft(rng, blades, hmin, hmax, wmin, wmax, spread, wavy) {
  const b = new Builder();
  for (let i = 0; i < blades; i++) {
    const a = rng() * 6.28, d = rng() * spread;
    ribbon(b, rng, Math.cos(a) * d, Math.sin(a) * d, hmin + rng() * (hmax - hmin), wmin + rng() * (wmax - wmin), 0.2 + rng() * 0.5, wavy > 0 ? 6 : 4, wavy);
  }
  return b.finish();
}

/** Built once per session; all colors are luminance only, tinted per instance. */
export function buildTemplates(seed = 4242) {
  const rng = mulberry32(seed), noise = createNoise(seed + 5);
  const T = { rocks: [], pebbles: [], coral: [], grass: [], tall: [], kelp: [] };
  for (let i = 0; i < 5; i++) T.rocks.push(rockTemplate(rng, noise, 2));
  for (let i = 0; i < 3; i++) T.pebbles.push(rockTemplate(rng, noise, 1));
  const kinds = [branching, dome, table, tubes, fan, anemone];
  // coral[kind] = variants; names for tint choice
  T.coral = [
    { kind: 'branch', list: [0, 1, 2, 3].map(() => branching(rng)) },
    { kind: 'dome', list: [0, 1, 2].map(() => dome(rng, noise)) },
    { kind: 'table', list: [0, 1, 2].map(() => table(rng, noise)) },
    { kind: 'tubes', list: [0, 1, 2].map(() => tubes(rng)) },
    { kind: 'fan', list: [0, 1, 2].map(() => fan(rng, noise)) },
    { kind: 'anemone', list: [0, 1, 2].map(() => anemone(rng)) },
  ];
  for (let i = 0; i < 6; i++) T.grass.push(tuft(rng, 7, 0.9, 2.0, 0.06, 0.1, 0.4, 0));
  for (let i = 0; i < 4; i++) T.tall.push(tuft(rng, 5, 2.4, 4.2, 0.1, 0.16, 0.35, 0));
  for (let i = 0; i < 3; i++) T.kelp.push(tuft(rng, 3, 6, 10, 0.2, 0.32, 0.3, 0.02));
  return T;
}
