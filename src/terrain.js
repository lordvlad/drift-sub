import * as THREE from 'three';
import { mulberry32, hash2 } from './noise.js';

export const CS = 64;           // chunk size (world units)
const RES = 40;                  // cells per side
const STEP = CS / RES;
const RADIUS = 2;                // chunks loaded around the sub (5x5)

const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _sc = new THREE.Vector3(), _n = new THREE.Vector3(), _yq = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

const CORAL_TINTS = [
  [0xff5d8f, 0xff9ab8], [0xff8a3d, 0xffc46b], [0xb06bff, 0xe0a8ff], [0xffd23f, 0xfff0a0],
  [0x2fd6c9, 0x9ff5ee], [0xe8403a, 0xff8f7a], [0xf2ecdf, 0xffffff], [0x5b7bff, 0xa7b8ff],
];
const WEED_TINTS = [0x3f8f3a, 0x6fae3c, 0x88a63a, 0x2f7d55, 0xa8803a, 0x8e3a4a, 0x6a4a9a];
const KELP_TINTS = [0x9a8a2a, 0x7c8f30, 0xb09030, 0x6e7a2a];

class Out {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.sway = []; }
  place(tpl, x, y, z, yaw, sx, sy, sz, nrm, tilt, tint, swayScale = 1, shade = 1) {
    _n.set(nrm[0], nrm[1], nrm[2]);
    _q.setFromUnitVectors(UP, _n.lerp(UP, 1 - tilt).normalize());
    _yq.setFromAxisAngle(UP, yaw);
    _q.multiply(_yq);
    _m.compose(_p.set(x, y, z), _q, _sc.set(sx, sy, sz));
    const e = _m.elements, N = tpl.count;
    const tr = tint ? tint.r : 1, tg = tint ? tint.g : 1, tb = tint ? tint.b : 1;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const px = tpl.pos[i3], py = tpl.pos[i3 + 1], pz = tpl.pos[i3 + 2];
      this.pos.push(e[0] * px + e[4] * py + e[8] * pz + e[12], e[1] * px + e[5] * py + e[9] * pz + e[13], e[2] * px + e[6] * py + e[10] * pz + e[14]);
      const nx = tpl.nor[i3], ny = tpl.nor[i3 + 1], nz = tpl.nor[i3 + 2];
      let ax = e[0] * nx + e[4] * ny + e[8] * nz, ay = e[1] * nx + e[5] * ny + e[9] * nz, az = e[2] * nx + e[6] * ny + e[10] * nz;
      const l = Math.hypot(ax, ay, az) || 1;
      this.nor.push(ax / l, ay / l, az / l);
      this.col.push(tpl.col[i3] * tr * shade, tpl.col[i3 + 1] * tg * shade, tpl.col[i3 + 2] * tb * shade);
      this.sway.push(tpl.sway[i] * swayScale * sy);
    }
  }
}

const tintCache = new Map();
const tint = (hex, j = 0) => { // jittered Color; reuse not possible because jitter is random
  return new THREE.Color(hex).multiplyScalar(1 + j);
};

function buildDecor(cx, cz, field, T, seed) {
  const rng = mulberry32(hash2(cx, cz, seed));
  const out = new Out(), colliders = [], corals = [], weeds = [];
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
    if (rng() > 0.03 + rm * 0.45) continue;
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
    const reef = field.reefAt(px, pz);
    if (reef < 0.2 || rng() > reef + 0.1) continue;
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
      corals.push(x, y + s * 0.5, z);
      if (ki === 1 || (ki === 2 && s > 1.4)) colliders.push(x, y + s * (ki === 1 ? 0.2 : 0.7), z, s * (ki === 1 ? 0.9 : 1.2), 0.6);
    }
  }

  // --- seaweed patches ---
  for (let k = 0; k < 5; k++) {
    const px = x0 + rng() * CS, pz = z0 + rng() * CS;
    const weed = field.weedAt(px, pz);
    if (weed < 0.2 || rng() > weed + 0.1) continue;
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
      weeds.push(x, y, z, (kind === 'kelp' ? 10 : kind === 'tall' ? 4 : 2) * s);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(out.sway, 1));
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 6; // sway + patch spill
  return { geometry: g, colliders, corals: new Float32Array(corals), weeds: new Float32Array(weeds) };
}

const SAND = new THREE.Color(0xe3cf9a), DEEP = new THREE.Color(0x6b7378), ROCK = new THREE.Color(0x7d7872), REEFSAND = new THREE.Color(0xcdc196);
const _c = new THREE.Color();

function buildTerrain(cx, cz, field, indexAttr) {
  const x0 = cx * CS, z0 = cz * CS, W = RES + 3;
  const H = new Float32Array(W * W);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) H[j * W + i] = field.heightAt(x0 + (i - 1) * STEP, z0 + (j - 1) * STEP);
  const V = (RES + 1) * (RES + 1);
  const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), col = new Float32Array(V * 3);
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
    const vn = (field.noise(x * 0.35, z * 0.35) * 0.5 + field.noise(x * 1.3, z * 1.3) * 0.5) * 0.07;
    col[v * 3] = _c.r * (1 + vn); col[v * 3 + 1] = _c.g * (1 + vn); col[v * 3 + 2] = _c.b * (1 + vn);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
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

/** Streams a (2R+1)^2 window of chunks. Chunks are pure functions of (seed, cx, cz); evicted ones are simply dropped. */
export class Terrain {
  constructor(scene, field, templates, seed, terrainMat, decorMat) {
    this.scene = scene; this.field = field; this.T = templates; this.seed = seed;
    this.terrainMat = terrainMat; this.decorMat = decorMat;
    this.chunks = new Map(); this.index = makeIndex(); this.cx = 1e9; this.cz = 1e9;
  }
  key(cx, cz) { return cx * 100003 + cz; }
  _build(cx, cz) {
    const tg = buildTerrain(cx, cz, this.field, this.index);
    const tm = new THREE.Mesh(tg, this.terrainMat); this.scene.add(tm);
    const d = buildDecor(cx, cz, this.field, this.T, this.seed);
    const dm = new THREE.Mesh(d.geometry, this.decorMat); this.scene.add(dm);
    this.chunks.set(this.key(cx, cz), { cx, cz, tm, dm, colliders: d.colliders, corals: d.corals, weeds: d.weeds });
  }
  _drop(ch) {
    this.scene.remove(ch.tm); this.scene.remove(ch.dm);
    ch.tm.geometry.dispose(); ch.dm.geometry.dispose();
    this.chunks.delete(this.key(ch.cx, ch.cz));
  }
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
