import * as THREE from 'three';

/** Loft body from sections [z, halfWidth, top, bottom] (nose +z) with belly/back vertex colors. */
function loft(sections, back, belly, sides = 14) {
  const pos = [], col = [], idx = [];
  const cb = new THREE.Color(back), cl = new THREE.Color(belly), c = new THREE.Color();
  for (const [z, w, t, b] of sections) {
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2, s = Math.sin(a), co = Math.cos(a);
      const y = s >= 0 ? s * t : s * b;
      pos.push(co * w, y + (t - b) * 0.0, z);
      const f = THREE.MathUtils.smoothstep(-s, 0.0, 0.55);
      c.copy(cb).lerp(cl, f);
      col.push(c.r, c.g, c.b);
    }
  }
  const S = sections.length;
  for (let i = 0; i < S - 1; i++) for (let k = 0; k < sides; k++) {
    const a = i * sides + k, b = i * sides + ((k + 1) % sides), d = (i + 1) * sides + k, e = (i + 1) * sides + ((k + 1) % sides);
    idx.push(a, b, d, b, e, d);
  }
  return { pos, col, idx };
}

function fin(out, pts, color) {
  // pts: array of [x,y,z]; triangles fan from pts[0]
  const c = new THREE.Color(color);
  for (let i = 1; i < pts.length - 1; i++) for (const p of [pts[0], pts[i], pts[i + 1]]) {
    out.pos.push(...p); out.col.push(c.r, c.g, c.b);
  }
}

function finish(body, fins) {
  const g = new THREE.BufferGeometry();
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(body.pos, 3));
  bg.setAttribute('color', new THREE.Float32BufferAttribute(body.col, 3));
  bg.setIndex(body.idx);
  const ng = bg.toNonIndexed();
  const P = [...ng.attributes.position.array, ...fins.pos];
  const C = [...ng.attributes.color.array, ...fins.col];
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  // smooth normals for the body part (indexed), flat for fins
  const bodyN = (() => { bg.computeVertexNormals(); return bg.toNonIndexed().attributes.normal.array; })();
  const N = [...bodyN];
  for (let i = 0; i < fins.pos.length; i += 9) {
    const a = new THREE.Vector3(...fins.pos.slice(i, i + 3)), b = new THREE.Vector3(...fins.pos.slice(i + 3, i + 6)), c = new THREE.Vector3(...fins.pos.slice(i + 6, i + 9));
    const n = b.sub(a).cross(c.sub(a)).normalize();
    for (let k = 0; k < 3; k++) N.push(n.x, n.y, n.z);
  }
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  return g;
}

/** Small reef/schooling fish, length ~1.1, nose +z */
export function fishGeometry() {
  const body = loft([
    [0.5, 0.004, 0.004, 0.004], [0.46, 0.03, 0.06, 0.055], [0.38, 0.06, 0.12, 0.11], [0.2, 0.075, 0.165, 0.15],
    [0.0, 0.07, 0.17, 0.14], [-0.2, 0.05, 0.12, 0.09], [-0.34, 0.028, 0.06, 0.05], [-0.4, 0.016, 0.035, 0.035],
  ], 0xc8c8c8, 0xffffff, 8);
  const f = { pos: [], col: [] };
  fin(f, [[0, 0.015, -0.4], [0, 0.17, -0.63], [0, 0, -0.53], [0, -0.17, -0.63], [0, -0.015, -0.4]], 0xcfcfcf);
  fin(f, [[0, 0.15, 0.18], [0, 0.16, -0.12], [0, 0.29, -0.2]], 0xbdbdbd);
  fin(f, [[0.06, -0.05, 0.2], [0.06, -0.05, 0.08], [0.17, -0.12, 0.0]], 0xdddddd);
  fin(f, [[-0.06, -0.05, 0.2], [-0.06, -0.05, 0.08], [-0.17, -0.12, 0.0]], 0xdddddd);
  fin(f, [[0, -0.13, 0.0], [0, -0.13, -0.15], [0, -0.22, -0.2]], 0xcfcfcf);
  return finish(body, f);
}

export function sharkGeometry() {
  const body = loft([
    [0.5, 0.002, 0.002, 0.002], [0.47, 0.03, 0.03, 0.022], [0.4, 0.055, 0.052, 0.04], [0.3, 0.075, 0.075, 0.06],
    [0.15, 0.085, 0.09, 0.075], [0.0, 0.082, 0.092, 0.08], [-0.15, 0.07, 0.078, 0.065], [-0.3, 0.05, 0.055, 0.042],
    [-0.4, 0.03, 0.035, 0.028], [-0.47, 0.018, 0.022, 0.018], [-0.5, 0.012, 0.016, 0.012],
  ], 0x56606c, 0xe8ecef, 16);
  const f = { pos: [], col: [] }; const fc = 0x4a535e;
  fin(f, [[0, 0.085, 0.14], [0, 0.085, -0.02], [0, 0.21, -0.07]], fc);                       // dorsal
  fin(f, [[0.06, -0.04, 0.24], [0.06, -0.05, 0.08], [0.27, -0.14, -0.03]], 0x6a7480);          // pectoral R
  fin(f, [[-0.06, -0.04, 0.24], [-0.06, -0.05, 0.08], [-0.27, -0.14, -0.03]], 0x6a7480);       // pectoral L
  fin(f, [[0, -0.07, -0.2], [0, -0.07, -0.27], [0, -0.12, -0.3]], fc);                          // anal
  fin(f, [[0, 0.015, -0.46], [0, 0.0, -0.5], [0, 0.22, -0.66], [0, 0.07, -0.47]], fc);          // caudal upper
  fin(f, [[0, -0.005, -0.5], [0, -0.01, -0.46], [0, -0.12, -0.6]], fc);                         // caudal lower
  return finish(body, f);
}

export function whaleGeometry() {
  const body = loft([
    [0.5, 0.004, 0.004, 0.004], [0.47, 0.06, 0.04, 0.06], [0.4, 0.105, 0.075, 0.1], [0.28, 0.14, 0.11, 0.14],
    [0.12, 0.15, 0.135, 0.15], [-0.05, 0.14, 0.13, 0.14], [-0.2, 0.1, 0.1, 0.1], [-0.34, 0.06, 0.065, 0.06],
    [-0.44, 0.035, 0.04, 0.035], [-0.5, 0.025, 0.028, 0.025],
  ], 0x2f3d4d, 0xd8dee3, 18);
  const f = { pos: [], col: [] }; const fc = 0x2b3846;
  fin(f, [[0, 0.125, -0.12], [0, 0.12, -0.2], [0, 0.185, -0.2]], fc);                               // dorsal nub
  fin(f, [[0.12, -0.1, 0.2], [0.12, -0.09, 0.08], [0.44, -0.2, -0.05], [0.3, -0.12, 0.2]], 0xe5eaee);  // flipper R
  fin(f, [[-0.12, -0.1, 0.2], [-0.12, -0.09, 0.08], [-0.44, -0.2, -0.05], [-0.3, -0.12, 0.2]], 0xe5eaee);
  // flukes (horizontal)
  fin(f, [[0, 0, -0.46], [0.07, 0, -0.5], [0.34, 0, -0.62], [0.12, 0, -0.66], [0, 0, -0.58]], fc);
  fin(f, [[0, 0, -0.46], [0, 0, -0.58], [-0.12, 0, -0.66], [-0.34, 0, -0.62], [-0.07, 0, -0.5]], fc);
  return finish(body, f);
}
