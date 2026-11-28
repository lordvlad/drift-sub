import { Builder } from '../templates.js';
import { createNoise } from '../noise.js';

/** Builder that also carries a per-vertex glow (0..1) attribute. */
export class GBuilder extends Builder {
  constructor() { super(); this.glow = []; }
  vert(x, y, z, nx, ny, nz, r, g, b, s) { super.vert(x, y, z, nx, ny, nz, r, g, b, s); this.glow.push(0); }
  vertg(x, y, z, nx, ny, nz, r, g, b, s, gl) { super.vert(x, y, z, nx, ny, nz, r, g, b, s); this.glow.push(gl); }
  finish() { const o = super.finish(); o.glow = new Float32Array(this.glow); return o; }
}

// ---- small math / colour helpers --------------------------------------------------------------
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const fract = (x) => x - Math.floor(x);
export const spow = (x, e) => Math.sign(x) * Math.abs(x) ** e;
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const lum = (v) => [v, v, v];
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** deterministic 2D simplex + a pseudo-3D variant, both ~[-1,1] */
export function noiseKit(seed) {
  const f = createNoise(seed), g = createNoise(seed + 101);
  const n3 = (x, y, z) => clamp(0.72 * (f(x + 0.37 * z, y - 0.51 * z) + g(y * 1.13 + 0.21 * x + 5.7, z * 0.89 - 0.33 * x + 2.3)), -1, 1);
  const fbm3 = (x, y, z, oct = 3) => { let a = 1, s = 0, t = 0; for (let i = 0; i < oct; i++) { s += a * n3(x, y, z); t += a; x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; } return s / t; };
  return { n2: f, n3, fbm3 };
}

/** rotation (euler XYZ order applied as x, then y, then z) returning a point mapper */
export function rotFn(rx = 0, ry = 0, rz = 0, origin = [0, 0, 0], offset = [0, 0, 0]) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  return (p) => {
    let x = p[0] - origin[0], y = p[1] - origin[1], z = p[2] - origin[2];
    let t = y * cx - z * sx; z = y * sx + z * cx; y = t;
    t = x * cy + z * sy; z = -x * sy + z * cy; x = t;
    t = x * cz - y * sz; y = x * sz + y * cz; x = t;
    return [x + origin[0] + offset[0], y + origin[1] + offset[1], z + origin[2] + offset[2]];
  };
}

// ---- indexed mesh with auto-oriented triangles ----------------------------------------------
/**
 * Indexed triangle mesh. Every vertex may carry a reference point `ref` strictly inside the solid
 * (or, for inward-facing surfaces, in the open space); a triangle added with mode +1 is flipped at
 * bake time so that its normal points away from `ref`, with mode -1 so that it points toward it.
 * Normals are area-weighted smooth normals computed from the final winding.
 */
export class Mesh {
  constructor() { this.P = []; this.C = []; this.G = []; this.S = []; this.R = []; this.T = []; this._prep = null; }
  get nv() { return this.R.length; }
  v(x, y, z, a, ref = null) {
    this.P.push(x, y, z); this.C.push(a[0], a[1], a[2]); this.G.push(a[3] || 0); this.S.push(a[4] || 0); this.R.push(ref);
    return this.R.length - 1;
  }
  pt(i) { return [this.P[i * 3], this.P[i * 3 + 1], this.P[i * 3 + 2]]; }
  tri(a, b, c, mode = 1) { this.T.push(a, b, c, mode); }
  quad(a, b, c, d, mode = 1) { this.tri(a, b, c, mode); this.tri(a, c, d, mode); }

  /**
   * Grid surface. pos(i,j)->[x,y,z] (i: 0..nu, or 0..nu-1 when wrapU; j: 0..nv),
   * attr(x,y,z,i,j)->[r,g,b,glow?,sway?], ref(i,j)->point|null, skip(i,j)->bool drops a cell.
   * Returns idx(i,j).
   */
  surface(nu, nv, pos, attr, o = {}) {
    const { wrapU = false, mode = 1, ref = null, skip = null } = o;
    const cols = wrapU ? nu : nu + 1, base = this.nv;
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i < cols; i++) {
        const p = pos(i, j);
        this.v(p[0], p[1], p[2], attr ? attr(p[0], p[1], p[2], i, j) : [0.5, 0.5, 0.5], ref ? ref(i, j) : null);
      }
    }
    const idx = (i, j) => base + j * cols + (wrapU ? ((i % cols) + cols) % cols : i);
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        if (skip && skip(i, j)) continue;
        this.quad(idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1), mode);
      }
    }
    return idx;
  }

  /** fan cap over a ring of points with a centre; own vertices so the edge stays crisp */
  cap(ringPts, centre, attrAt, ref, mode = 1) {
    const ids = ringPts.map((p) => this.v(p[0], p[1], p[2], attrAt(p[0], p[1], p[2], false), ref));
    const c = this.v(centre[0], centre[1], centre[2], attrAt(centre[0], centre[1], centre[2], true), ref);
    for (let i = 0; i < ids.length; i++) this.tri(ids[i], ids[(i + 1) % ids.length], c, mode);
  }

  /** apply fn(point)->point to vertices (and their refs) added since `from` */
  map(from, fn) {
    for (let i = from; i < this.nv; i++) {
      const p = fn([this.P[i * 3], this.P[i * 3 + 1], this.P[i * 3 + 2]]);
      this.P[i * 3] = p[0]; this.P[i * 3 + 1] = p[1]; this.P[i * 3 + 2] = p[2];
      if (this.R[i]) this.R[i] = fn(this.R[i]);
    }
  }

  prepare() {
    if (this._prep) return this._prep;
    const P = this.P, T = this.T, R = this.R;
    const nrm = new Float64Array(this.nv * 3), tris = [];
    for (let k = 0; k < T.length; k += 4) {
      let a = T[k], b = T[k + 1], c = T[k + 2]; const mode = T[k + 3];
      const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
      const bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2];
      const cx = P[c * 3], cy = P[c * 3 + 1], cz = P[c * 3 + 2];
      let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const l = Math.hypot(nx, ny, nz);
      if (!(l > 1e-9)) continue;
      const ref = mode ? R[a] : null;
      if (ref) {
        const d = nx * ((ax + bx + cx) / 3 - ref[0]) + ny * ((ay + by + cy) / 3 - ref[1]) + nz * ((az + bz + cz) / 3 - ref[2]);
        if (mode * d < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
      }
      tris.push([a, b, c, nx / l, ny / l, nz / l]);
      for (const v of [a, b, c]) { nrm[v * 3] += nx; nrm[v * 3 + 1] += ny; nrm[v * 3 + 2] += nz; }
    }
    this._prep = { tris, nrm };
    return this._prep;
  }

  /**
   * Emit into a GBuilder. facet 0 = smooth shading, 1 = flat; filter(cx,cy,cz)->bool picks triangles.
   */
  emit(b, { facet = 0, filter = null } = {}) {
    const { tris, nrm } = this.prepare(), P = this.P, C = this.C;
    for (const t of tris) {
      if (filter) {
        const [a, bb, c] = t;
        const cx = (P[a * 3] + P[bb * 3] + P[c * 3]) / 3, cy = (P[a * 3 + 1] + P[bb * 3 + 1] + P[c * 3 + 1]) / 3, cz = (P[a * 3 + 2] + P[bb * 3 + 2] + P[c * 3 + 2]) / 3;
        if (!filter(cx, cy, cz)) continue;
      }
      for (let q = 0; q < 3; q++) {
        const v = t[q];
        let nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
        const l = Math.hypot(nx, ny, nz);
        if (l > 1e-12) { nx /= l; ny /= l; nz /= l; } else { nx = t[3]; ny = t[4]; nz = t[5]; }
        if (facet > 0) {
          nx = nx + (t[3] - nx) * facet; ny = ny + (t[4] - ny) * facet; nz = nz + (t[5] - nz) * facet;
          const m = Math.hypot(nx, ny, nz) || 1; nx /= m; ny /= m; nz /= m;
        }
        b.vertg(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], nx, ny, nz, C[v * 3], C[v * 3 + 1], C[v * 3 + 2], this.S[v], this.G[v]);
      }
    }
    return b;
  }
  template(o) { return this.emit(new GBuilder(), o).finish(); }
  /** split triangles into template pieces by key(cx,cy,cz) of their centroid; returns Map(key -> tpl) */
  bin(keyFn, o = {}) {
    const keys = new Set(); const { tris } = this.prepare(), P = this.P;
    const cent = (t) => [(P[t[0] * 3] + P[t[1] * 3] + P[t[2] * 3]) / 3, (P[t[0] * 3 + 1] + P[t[1] * 3 + 1] + P[t[2] * 3 + 1]) / 3, (P[t[0] * 3 + 2] + P[t[1] * 3 + 2] + P[t[2] * 3 + 2]) / 3];
    for (const t of tris) keys.add(keyFn(...cent(t)));
    const out = new Map();
    for (const k of keys) {
      const tpl = this.template({ ...o, filter: (x, y, z) => keyFn(x, y, z) === k });
      if (tpl.count) out.set(k, tpl);
    }
    return out;
  }
}

/** bounding sphere (bbox centre, max distance) of a template */
export function tplBounds(tpl) {
  const p = tpl.pos; let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (let i = 0; i < p.length; i += 3) {
    x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2; let r = 0;
  for (let i = 0; i < p.length; i += 3) r = Math.max(r, Math.hypot(p[i] - cx, p[i + 1] - cy, p[i + 2] - cz));
  return { cx, cy, cz, r, min: [x0, y0, z0], max: [x1, y1, z1] };
}

export function makePiece(tpl, colliders = []) {
  const b = tplBounds(tpl);
  return { cx: b.cx, cy: b.cy, cz: b.cz, r: b.r, tpl, colliders };
}

/** put each collider into the piece whose centre is nearest */
export function assignColliders(pieces, colliders) {
  for (const c of colliders) {
    let best = null, bd = 1e18;
    for (const p of pieces) { const d = Math.hypot(p.cx - c[0], p.cy - c[1], p.cz - c[2]); if (d < bd) { bd = d; best = p; } }
    if (best) best.colliders.push(c);
  }
}

// ---- sweep: swept tube along a curve with parallel-transport frames ------------------------------
/**
 * o: path(t)->[x,y,z], rings, sides, radius(t,a,cx,cy,cz)->r, attr(x,y,z,t,a)->colour,
 *    scale(t)->[su,sv] anisotropy, lift(t,a)->dy on the ring, u0 (initial frame vector),
 *    capEnd / capStart (bool), capH (dome height factor, default 0.4).
 * Returns { idx, pts, ringPts, tans, frames }.
 */
export function sweep(m, o) {
  const { path, rings = 8, sides = 8, radius, attr, scale = null, lift = null } = o;
  const pts = [], tans = [], frames = [];
  for (let k = 0; k <= rings; k++) pts.push(path(k / rings));
  for (let k = 0; k <= rings; k++) tans.push(norm3(sub3(pts[Math.min(k + 1, rings)], pts[Math.max(k - 1, 0)])));
  let u = o.u0 ? norm3(o.u0) : Math.abs(tans[0][1]) > 0.9 ? [1, 0, 0] : norm3(cross3([0, 1, 0], tans[0]));
  for (let k = 0; k <= rings; k++) {
    const t = tans[k];
    u = norm3(sub3(u, scale3(t, dot3(u, t))));
    frames.push([u, cross3(t, u)]);
  }
  const ringPts = [];
  const idx = m.surface(sides, rings, (i, j) => {
    const a = (i / sides) * TAU, t = j / rings, c = pts[j], [fu, fv] = frames[j];
    const r = radius(t, a, c[0], c[1], c[2]);
    const [su, sv] = scale ? scale(t) : [1, 1];
    const ca = Math.cos(a) * r * su, sa = Math.sin(a) * r * sv;
    const p = [c[0] + ca * fu[0] + sa * fv[0], c[1] + ca * fu[1] + sa * fv[1], c[2] + ca * fu[2] + sa * fv[2]];
    if (lift) p[1] += lift(t, a);
    (ringPts[j] = ringPts[j] || [])[i] = p;
    return p;
  }, attr ? (x, y, z, i, j) => attr(x, y, z, j / rings, (i / sides) * TAU) : null, { wrapU: true, ref: (i, j) => pts[j] });
  const capH = o.capH ?? 0.4;
  if (o.capEnd !== false) {
    const rp = ringPts[rings], c = pts[rings], t = tans[rings];
    const r0 = radius(1, 0, c[0], c[1], c[2]);
    const centre = add3(c, scale3(t, r0 * capH));
    const refp = sub3(c, scale3(t, Math.max(r0, 0.3)));
    m.cap(rp, centre, (x, y, z) => (attr ? attr(x, y, z, 1, 0) : [0.5, 0.5, 0.5]), refp);
  }
  if (o.capStart) {
    const rp = ringPts[0], c = pts[0], t = tans[0];
    const r0 = radius(0, 0, c[0], c[1], c[2]);
    const centre = sub3(c, scale3(t, r0 * capH));
    const refp = add3(c, scale3(t, Math.max(r0, 0.3)));
    m.cap(rp, centre, (x, y, z) => (attr ? attr(x, y, z, 0, 0) : [0.5, 0.5, 0.5]), refp);
  }
  return { idx, pts, ringPts, tans, frames };
}

/** straight tapered limb a->b; r0 at a, r1 at b (closed with a point/dome if r1 small) */
export function limb(m, a, b, r0, r1, sides, rings, attr, o = {}) {
  return sweep(m, {
    path: (t) => lerp3(a, b, t), rings, sides, radius: (t) => lerp(r0, r1, t), attr, capEnd: o.capEnd !== false, capStart: o.capStart, capH: o.capH, lift: o.lift, scale: o.scale, u0: o.u0,
  });
}

/**
 * Closed (super)ellipsoid blob. o: disp(dx,dy,dz)->scale, attr(x,y,z,dx,dy,dz)->colour, yMin, exp (squareness exponent),
 * mode (+1 default).
 */
export function ellipsoid(m, c, rad, nu, nv, o = {}) {
  const { disp = null, attr = null, yMin = null, exp = 1 } = o;
  const dirAt = (i, j) => {
    const th = (Math.PI * j) / nv, ph = (TAU * i) / nu;
    let dx = Math.sin(th) * Math.cos(ph), dy = Math.cos(th), dz = Math.sin(th) * Math.sin(ph);
    if (exp !== 1) { dx = spow(Math.sin(th), exp) * spow(Math.cos(ph), exp); dy = spow(Math.cos(th), exp); dz = spow(Math.sin(th), exp) * spow(Math.sin(ph), exp); }
    return [dx, dy, dz];
  };
  return m.surface(nu, nv, (i, j) => {
    const [dx, dy, dz] = dirAt(i, j);
    const d = disp ? disp(dx, dy, dz) : 1;
    let y = c[1] + rad[1] * dy * d;
    if (yMin !== null && y < yMin) y = yMin;
    return [c[0] + rad[0] * dx * d, y, c[2] + rad[2] * dz * d];
  }, attr ? (x, y, z, i, j) => { const [dx, dy, dz] = dirAt(i, j); return attr(x, y, z, dx, dy, dz); } : null, { wrapU: true, ref: () => c, mode: o.mode ?? 1 });
}

/** shift all geometry so its bounding box is centred on x=z=0 */
Mesh.prototype.centerXZ = function centerXZ() {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < this.nv; i++) { const x = this.P[i * 3], z = this.P[i * 3 + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  this.map(0, (p) => [p[0] - cx, p[1], p[2] - cz]);
  return this;
};
