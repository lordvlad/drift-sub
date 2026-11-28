import * as THREE from 'three';
import { mulberry32, hash2 } from './noise.js';
import { buildPlumes } from './plumes.js';
import { decorLandmarks } from './landmarks.js';
import { FLORA_SIZE, coralKind, weedKind } from './templates.js';

export const CS = 64;           // chunk size (world units)
const RES = 40;                  // cells per side
const STEP = CS / RES;
const RADIUS = 2;                // chunks loaded around the sub (5x5)

const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _sc = new THREE.Vector3(), _n = new THREE.Vector3(), _yq = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

export const CORAL_TINTS = [
  [0xff5d8f, 0xff9ab8], [0xff8a3d, 0xffc46b], [0xb06bff, 0xe0a8ff], [0xffd23f, 0xfff0a0],
  [0x2fd6c9, 0x9ff5ee], [0xe8403a, 0xff8f7a], [0xf2ecdf, 0xffffff], [0x5b7bff, 0xa7b8ff],
];
export const WEED_TINTS = [0x3f8f3a, 0x6fae3c, 0x88a63a, 0x2f7d55, 0xa8803a, 0x8e3a4a, 0x6a4a9a];
export const KELP_TINTS = [0x9a8a2a, 0x7c8f30, 0xb09030, 0x6e7a2a];

/** Growable triangle-soup accumulator for a chunk's decor: position, normal, colour, sway amplitude, glow. */
export class Out {
  constructor(cap = 1 << 13) { this.n = 0; this.cap = 0; this._alloc(cap); }
  _alloc(cap) {
    const keep = this.n, o = this;
    const f = (old, k) => { const a = new Float32Array(cap * k); if (old) a.set(old.subarray(0, keep * k)); return a; };
    this.pos = f(o.pos, 3); this.nor = f(o.nor, 3); this.col = f(o.col, 3); this.sway = f(o.sway, 1); this.glow = f(o.glow, 1); this.cap = cap;
  }
  reserve(extra) { if (this.n + extra > this.cap) this._alloc(Math.max(this.cap * 2, this.n + extra)); }
  /** one vertex (triangle soup: call three times per triangle) */
  v(x, y, z, nx, ny, nz, r, g, b, sw = 0, gl = 0) {
    this.reserve(1);
    const i = this.n++, i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.nor[i3] = nx; this.nor[i3 + 1] = ny; this.nor[i3 + 2] = nz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b; this.sway[i] = sw; this.glow[i] = gl;
  }
  _emit(tpl, e, tr, tg, tb, swayK) {
    const N = tpl.count; this.reserve(N);
    const gl = tpl.glow;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3, o = (this.n + i) * 3;
      const px = tpl.pos[i3], py = tpl.pos[i3 + 1], pz = tpl.pos[i3 + 2];
      this.pos[o] = e[0] * px + e[4] * py + e[8] * pz + e[12]; this.pos[o + 1] = e[1] * px + e[5] * py + e[9] * pz + e[13]; this.pos[o + 2] = e[2] * px + e[6] * py + e[10] * pz + e[14];
      const nx = tpl.nor[i3], ny = tpl.nor[i3 + 1], nz = tpl.nor[i3 + 2];
      const ax = e[0] * nx + e[4] * ny + e[8] * nz, ay = e[1] * nx + e[5] * ny + e[9] * nz, az = e[2] * nx + e[6] * ny + e[10] * nz;
      const l = Math.hypot(ax, ay, az) || 1;
      this.nor[o] = ax / l; this.nor[o + 1] = ay / l; this.nor[o + 2] = az / l;
      this.col[o] = tpl.col[i3] * tr; this.col[o + 1] = tpl.col[i3 + 1] * tg; this.col[o + 2] = tpl.col[i3 + 2] * tb;
      this.sway[this.n + i] = tpl.sway[i] * swayK; this.glow[this.n + i] = gl ? gl[i] : 0;
    }
    this.n += N;
  }
  place(tpl, x, y, z, yaw, sx, sy, sz, nrm, tilt, tint, swayScale = 1, shade = 1) {
    _n.set(nrm[0], nrm[1], nrm[2]);
    _q.setFromUnitVectors(UP, _n.lerp(UP, 1 - tilt).normalize());
    _yq.setFromAxisAngle(UP, yaw);
    _q.multiply(_yq);
    _m.compose(_p.set(x, y, z), _q, _sc.set(sx, sy, sz));
    this._emit(tpl, _m.elements, (tint ? tint.r : 1) * shade, (tint ? tint.g : 1) * shade, (tint ? tint.b : 1) * shade, swayScale * sy);
  }
  /** place with an arbitrary matrix (assemblies: wrecks, arches, caves) */
  placeM(tpl, m, tint, shade = 1, swayScale = 1) {
    this._emit(tpl, m.elements, (tint ? tint.r : 1) * shade, (tint ? tint.g : 1) * shade, (tint ? tint.b : 1) * shade, swayScale);
  }
  geometry() {
    const g = new THREE.BufferGeometry(), n = this.n;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.slice(0, n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.slice(0, n * 3), 3));
    g.setAttribute('aSway', new THREE.BufferAttribute(this.sway.slice(0, n), 1));
    g.setAttribute('aGlow', new THREE.BufferAttribute(this.glow.slice(0, n), 1));
    return g;
  }
}

const tint = (hex, j = 0) => new THREE.Color(hex).multiplyScalar(1 + j); // jittered Color; reuse not possible because jitter is random

function buildDecor(cx, cz, field, T, seed) {
  const rng = mulberry32(hash2(cx, cz, seed));
  const out = new Out(), colliders = [], corals = [], weeds = [], emitters = [], heat = [], flora = [];
  /** record a plant for the Encyclopedia: kind index (templates.js FLORA), position, instance scale */
  const addFlora = (k, x, y, z, s) => flora.push(x, y, z, FLORA_SIZE[k] * s, k);
  const x0 = cx * CS, z0 = cz * CS;
  const nrm = [0, 1, 0];
  const R = (a, b) => a + rng() * (b - a);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const ground = (x, z) => { field.normalAt(x, z, nrm); return field.heightAt(x, z); };

  // --- rocks ---
  const rockTint = new THREE.Color();
  for (let i = 0; i < 70; i++) {
    const x = x0 + rng() * CS, z = z0 + rng() * CS;
    const rm = field.rockAt(x, z);
    if (rng() > 0.03 + rm * 0.45 || field.clearAt(x, z)) continue;
    let s = 0.7 + rng() * rng() * 3.2 + (rng() < 0.05 + rm * 0.12 ? R(3, 9) : 0);
    const y = ground(x, z);
    const jit = R(-0.12, 0.12);
    rockTint.setRGB(1 + jit, 1 + jit * 0.6, 1 + jit * 0.2);
    out.place(pick(T.rocks), x, y - s * 0.22, z, rng() * 6.28, s, s * R(0.8, 1.2), s * R(0.8, 1.2), nrm, 0.3, rockTint);
    if (s >= 1.2) colliders.push(x, y + s * 0.2, z, s * 0.85, 1);
    const pn = s > 2 ? 2 + Math.floor(rng() * 4) : Math.floor(rng() * 3);
    for (let k = 0; k < pn; k++) {
      const a = rng() * 6.28, d = s * R(0.9, 1.8), ps = s * R(0.15, 0.4) + 0.2;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = ground(px, pz);
      out.place(pick(T.pebbles), px, py - ps * 0.2, pz, rng() * 6.28, ps, ps * 0.8, ps, nrm, 0.5, rockTint);
    }
  }

  // --- coral patches ---
  let coralCount = 0, weedCount = 0;
  for (let k = 0; k < 6; k++) {
    const px = x0 + rng() * CS, pz = z0 + rng() * CS;
    const reef = field.reefBase(px, pz);   // big reefs bring their own, denser coral (landmarks.js)
    if (reef < 0.2 || rng() > reef + 0.1 || field.clearAt(px, pz)) continue;
    const pr = R(3, 8), n = Math.min(Math.floor(R(8, 22) * pr / 6), Math.max(0, 70 - coralCount)); coralCount += n;
    const pal = [pick(CORAL_TINTS), pick(CORAL_TINTS)];
    const weights = [R(0, 3), R(0, 2), R(0, 1.2), R(0, 1.5), R(0, 2), R(0, 1.2)];
    const wsum = weights.reduce((a, b) => a + b, 0.0001);
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.28, d = pr * Math.sqrt(rng());
      const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
      let r = rng() * wsum, ki = 0; while (ki < 5 && r > weights[ki]) { r -= weights[ki]; ki++; }
      const fam = T.coral[ki];
      const tp = pick(pal);
      const col = tint(rng() < 0.75 ? tp[0] : tp[1], R(-0.1, 0.1));
      const y = ground(x, z);
      const s = R(0.7, 1.9) * (ki === 5 ? 0.8 : 1);
      out.place(pick(fam.list), x, y, z, rng() * 6.28, s, s * R(0.8, 1.3), s, nrm, 0.35, col);
      corals.push(x, y + s * 0.5, z); addFlora(coralKind(ki, CORAL_TINTS.indexOf(tp)), x, y, z, s);
      if (ki === 1 || (ki === 2 && s > 1.4)) colliders.push(x, y + s * (ki === 1 ? 0.2 : 0.7), z, s * (ki === 1 ? 0.9 : 1.2), 0.6);
    }
  }

  // --- seaweed patches ---
  for (let k = 0; k < 5; k++) {
    const px = x0 + rng() * CS, pz = z0 + rng() * CS;
    const weed = field.weedAt(px, pz);
    if (weed < 0.2 || rng() > weed + 0.1 || field.clearAt(px, pz)) continue;
    const gy = field.heightAt(px, pz);
    const kind = gy < -38 && rng() < 0.55 ? 'kelp' : (rng() < 0.65 ? 'grass' : 'tall');
    const pr = R(2.5, 5.5), n = Math.min(Math.floor(R(10, 30) * pr / 4), Math.max(0, 110 - weedCount)); weedCount += n;
    const baseTint = kind === 'kelp' ? pick(KELP_TINTS) : pick(WEED_TINTS);
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.28, d = pr * Math.sqrt(rng());
      const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
      const y = ground(x, z);
      const col = tint(baseTint, R(-0.15, 0.15));
      const tpl = pick(kind === 'kelp' ? T.kelp : kind === 'tall' ? T.tall : T.grass);
      const s = R(0.75, 1.3);
      out.place(tpl, x, y - 0.05, z, rng() * 6.28, s, s * R(0.8, 1.2), s, nrm, 0.1, col);
      weeds.push(x, y, z, (kind === 'kelp' ? 10 : kind === 'tall' ? 4 : 2) * s); addFlora(weedKind(kind, WEED_TINTS.indexOf(baseTint)), x, y, z, s);
    }
  }

  // --- landmarks: big reefs, vents, lava, volcanoes, caves, arches, wrecks, gardens ---
  decorLandmarks({ cx, cz, x0, z0, CS, field, T, seed, out, colliders, corals, weeds, flora, addFlora, emitters, heat, ground, nrm, tint, CORAL_TINTS, WEED_TINTS, KELP_TINTS });

  const g = out.geometry();
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 6; // sway + patch spill
  return { geometry: g, colliders, corals: new Float32Array(corals), weeds: new Float32Array(weeds), flora: new Float32Array(flora), emitters, heat: new Float32Array(heat), plumeRng: rng };
}

const SAND = new THREE.Color(0xe3cf9a), DEEP = new THREE.Color(0x6b7378), ROCK = new THREE.Color(0x7d7872), REEFSAND = new THREE.Color(0xcdc196);
const _c = new THREE.Color();
const _s = { k: 0, r: 0, g: 0, b: 0, glow: 0 };

function buildTerrain(cx, cz, field, indexAttr) {
  const x0 = cx * CS, z0 = cz * CS, W = RES + 3;
  const H = new Float32Array(W * W);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) H[j * W + i] = field.heightAt(x0 + (i - 1) * STEP, z0 + (j - 1) * STEP);
  const V = (RES + 1) * (RES + 1);
  const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), col = new Float32Array(V * 3), glow = new Float32Array(V);
  for (let j = 0; j <= RES; j++) for (let i = 0; i <= RES; i++) {
    const v = j * (RES + 1) + i, hi = (j + 1) * W + (i + 1);
    const x = x0 + i * STEP, z = z0 + j * STEP, h = H[hi];
    pos[v * 3] = x; pos[v * 3 + 1] = h; pos[v * 3 + 2] = z;
    const dx = H[hi + 1] - H[hi - 1], dz = H[hi + W] - H[hi - W];
    const l = Math.hypot(dx, 2 * STEP, dz);
    const nx = -dx / l, ny = 2 * STEP / l, nz = -dz / l;
    nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
    const rm = field.rockAt(x, z), reef = field.reefAt(x, z);
    const dep = Math.min(1, Math.max(0, (-h - 18) / 55));
    _c.copy(SAND).lerp(REEFSAND, reef * 0.6).lerp(DEEP, dep * 0.75);
    const steep = Math.min(1, Math.max(0, (0.93 - ny) / 0.12));
    const rock = Math.max(steep, rm * 0.55 * Math.min(1, Math.max(0, (0.985 - ny) / 0.05)));
    _c.lerp(ROCK, rock);
    field.surfaceAt(x, z, _s);
    if (_s.k > 0) { _c.r += (_s.r - _c.r) * _s.k; _c.g += (_s.g - _c.g) * _s.k; _c.b += (_s.b - _c.b) * _s.k; }
    glow[v] = _s.glow;
    const vn = (field.noise(x * 0.35, z * 0.35) * 0.5 + field.noise(x * 1.3, z * 1.3) * 0.5) * 0.07;
    col[v * 3] = _c.r * (1 + vn); col[v * 3 + 1] = _c.g * (1 + vn); col[v * 3 + 2] = _c.b * (1 + vn);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  g.setIndex(indexAttr);
  g.computeBoundingSphere();
  return g;
}

function makeIndex() {
  const idx = new Uint16Array(RES * RES * 6); let k = 0;
  for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
    const a = j * (RES + 1) + i, b = a + 1, c = a + RES + 1, d = c + 1;
    idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
  }
  return new THREE.BufferAttribute(idx, 1);
}

/** Streams a (2R+1)^2 window of chunks. Chunks are pure functions of (seed, profile, cx, cz); evicted ones are simply dropped. */
export class Terrain {
  constructor(scene, field, templates, seed, terrainMat, decorMat) {
    this.scene = scene; this.field = field; this.T = templates; this.seed = seed;
    this.terrainMat = terrainMat; this.decorMat = decorMat;
    this.chunks = new Map(); this.index = makeIndex(); this.cx = 1e9; this.cz = 1e9;
    this.buildMs = 0; this.worstMs = 0; this.builtCount = 0;   // stats of the last / slowest chunk build
  }
  key(cx, cz) { return cx * 100003 + cz; }
  _build(cx, cz) {
    const t0 = performance.now();
    const tg = buildTerrain(cx, cz, this.field, this.index);
    const tm = new THREE.Mesh(tg, this.terrainMat); this.scene.add(tm);
    const d = buildDecor(cx, cz, this.field, this.T, this.seed);
    const dm = new THREE.Mesh(d.geometry, this.decorMat); this.scene.add(dm);
    const pm = d.emitters.length ? buildPlumes(d.emitters, d.plumeRng) : null;
    if (pm) this.scene.add(pm);
    this.chunks.set(this.key(cx, cz), { cx, cz, tm, dm, pm, colliders: d.colliders, corals: d.corals, weeds: d.weeds, flora: d.flora, emitters: d.emitters, heat: d.heat });
    this.buildMs = performance.now() - t0; if (this.buildMs > this.worstMs) this.worstMs = this.buildMs; this.builtCount++;
  }
  _drop(ch) {
    this.scene.remove(ch.tm); this.scene.remove(ch.dm);
    ch.tm.geometry.dispose(); ch.dm.geometry.dispose();
    if (ch.pm) { this.scene.remove(ch.pm); ch.pm.geometry.dispose(); }
    this.chunks.delete(this.key(ch.cx, ch.cz));
  }
  /** drop every chunk (the world changed under us: new profile); the next update() rebuilds the window */
  reset() { for (const ch of [...this.chunks.values()]) this._drop(ch); this.cx = 1e9; this.cz = 1e9; }
  /** budget = max chunks built this call */
  update(px, pz, budget = 1) {
    const cx = Math.floor(px / CS), cz = Math.floor(pz / CS);
    this.cx = cx; this.cz = cz;
    for (const ch of [...this.chunks.values()]) if (Math.abs(ch.cx - cx) > RADIUS + 1 || Math.abs(ch.cz - cz) > RADIUS + 1) this._drop(ch);
    const need = [];
    for (let dz = -RADIUS; dz <= RADIUS; dz++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      if (!this.chunks.has(this.key(cx + dx, cz + dz))) need.push([cx + dx, cz + dz, dx * dx + dz * dz]);
    }
    need.sort((a, b) => a[2] - b[2]);
    for (let i = 0; i < Math.min(budget, need.length); i++) this._build(need[i][0], need[i][1]);
    return need.length - Math.min(budget, need.length);
  }
  /** Pushes the sphere out of rock/coral colliders. Returns the strongest impact speed (0 = none); this.impactK = its hardness (1 rock, 0.6 coral). */
  collide(pos, vel, radius) {
    const cx = Math.floor(pos.x / CS), cz = Math.floor(pos.z / CS);
    let best = 0; this.impactK = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const ch = this.chunks.get(this.key(cx + dx, cz + dz)); if (!ch) continue;
      const c = ch.colliders;
      for (let i = 0; i < c.length; i += 5) {
        const ox = pos.x - c[i], oy = pos.y - c[i + 1], oz = pos.z - c[i + 2];
        const minD = c[i + 3] + radius, d2 = ox * ox + oy * oy + oz * oz;
        if (d2 < minD * minD) {
          const d = Math.sqrt(d2) || 1e-4, nx = ox / d, ny = oy / d, nz = oz / d;
          pos.x = c[i] + nx * minD; pos.y = c[i + 1] + ny * minD; pos.z = c[i + 2] + nz * minD;
          const vn = vel.x * nx + vel.y * ny + vel.z * nz;
          if (vn < 0) {
            vel.x -= nx * vn * 1.15; vel.y -= ny * vn * 1.15; vel.z -= nz * vn * 1.15;
            if (-vn > best) { best = -vn; this.impactK = c[i + 4]; }
          }
        }
      }
    }
    return best;
  }
  /** 0..1 heat of live lava around `pos` (spheres [x, y, z, r] per chunk); 0 almost everywhere */
  heatAt(pos) {
    const cx = Math.floor(pos.x / CS), cz = Math.floor(pos.z / CS); let k = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const ch = this.chunks.get(this.key(cx + dx, cz + dz)); if (!ch || !ch.heat.length) continue;
      const h = ch.heat;
      for (let i = 0; i < h.length; i += 4) {
        const ox = pos.x - h[i], oy = pos.y - h[i + 1], oz = pos.z - h[i + 2], d2 = ox * ox + oy * oy + oz * oz, r = h[i + 3];
        if (d2 < r * r) k = Math.max(k, 1 - Math.sqrt(d2) / r);
      }
    }
    return k;
  }
  /** number of seaweed plants the sub's sphere is currently pushing through */
  weedContact(pos, radius) {
    const cx = Math.floor(pos.x / CS), cz = Math.floor(pos.z / CS); let n = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const ch = this.chunks.get(this.key(cx + dx, cz + dz)); if (!ch) continue;
      const w = ch.weeds, r = radius + 0.35;
      for (let i = 0; i < w.length; i += 4) {
        const ox = pos.x - w[i], oz = pos.z - w[i + 2];
        if (ox * ox + oz * oz < r * r && pos.y > w[i + 1] - 0.4 && pos.y < w[i + 1] + w[i + 3]) n++;
      }
    }
    return n;
  }
}
