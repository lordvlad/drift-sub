import * as THREE from 'three';

/** Loft body from sections [z, halfWidth, top, bottom] (nose +z) with belly/back vertex colors. */
function loft(sections, back, belly, sides = 14, colorFn = null) {
  const pos = [], col = [], idx = [];
  const cb = new THREE.Color(back), cl = new THREE.Color(belly), c = new THREE.Color();
  for (const [z, w, t, b, yo = 0] of sections) {
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2, s = Math.sin(a), co = Math.cos(a);
      const y = s >= 0 ? s * t : s * b;
      pos.push(co * w, y + yo, z);
      const f = THREE.MathUtils.smoothstep(-s, 0.0, 0.55);
      c.copy(cb).lerp(cl, f);
      if (colorFn) colorFn(c, z, s, co);
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

const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const mirror = (pts) => pts.map(([x, y, z]) => [-x, y, z]);
/** fin pair: right side as given, left side mirrored (winding reversed so both face outward) */
function fins2(f, pts, color) { fin(f, pts, color); fin(f, mirror(pts).reverse(), color); }

/** Reef shark: pointed, slightly underslung snout, gill slits, eye, two dorsals, heterocercal tail. Nose +z, length 1. */
export function sharkGeometry() {
  const body = loft([
    [0.5, 0.003, 0.003, 0.003, -0.012], [0.485, 0.022, 0.018, 0.014, -0.01], [0.45, 0.042, 0.036, 0.03, -0.006],
    [0.39, 0.06, 0.055, 0.046, -0.002], [0.31, 0.075, 0.073, 0.061, 0], [0.19, 0.086, 0.089, 0.074, 0],
    [0.05, 0.085, 0.093, 0.077, 0], [-0.09, 0.076, 0.084, 0.068, 0], [-0.21, 0.059, 0.066, 0.052, 0.002],
    [-0.32, 0.04, 0.047, 0.035, 0.004], [-0.41, 0.024, 0.031, 0.021, 0.006], [-0.47, 0.014, 0.02, 0.013, 0.008],
    [-0.5, 0.01, 0.014, 0.009, 0.009],
  ], 0x5a6571, 0xeef1f3, 18, (c, z, s, co) => {
    if (z > 0.2 && z < 0.3 && Math.abs(s) < 0.42 && (z - 0.2) % 0.021 < 0.007) c.multiplyScalar(0.62);      // gill slits
    if (z > 0.375 && z < 0.405 && s > 0.12 && s < 0.42 && Math.abs(co) > 0.75) c.setRGB(0.05, 0.06, 0.07);  // eye
    if (s > 0.2) c.multiplyScalar(0.92 + 0.08 * hash(z * 40, co * 7));                                      // mottled back
  });
  const f = { pos: [], col: [] }, fc = 0x4c5661, fl = 0x66717d;
  fin(f, [[0, 0.088, 0.16], [0, 0.09, 0.0], [0, 0.245, -0.06], [0, 0.205, 0.05]], fc);                      // first dorsal
  fin(f, [[0, 0.05, -0.26], [0, 0.044, -0.33], [0, 0.092, -0.35]], fc);                                      // second dorsal
  fins2(f, [[0.07, -0.045, 0.25], [0.075, -0.055, 0.12], [0.31, -0.175, -0.01], [0.27, -0.145, 0.07]], fl); // pectorals
  fins2(f, [[0.04, -0.058, -0.13], [0.04, -0.054, -0.2], [0.11, -0.095, -0.22]], fl);                       // pelvics
  fin(f, [[0, -0.05, -0.29], [0, -0.044, -0.35], [0, -0.094, -0.36]], fc);                                   // anal
  fin(f, [[0, 0.012, -0.46], [0, 0.235, -0.67], [0, 0.18, -0.65], [0, 0.0, -0.53]], fc);                     // caudal upper
  fin(f, [[0, -0.004, -0.47], [0, -0.006, -0.52], [0, -0.1, -0.6], [0, -0.135, -0.6]], fc);                 // caudal lower
  return finish(body, f);
}

/** Baleen whale (humpback-like): broad flat head with tubercles, ventral pleats, long pectorals, notched flukes. */
export function whaleGeometry() {
  const body = loft([
    [0.5, 0.005, 0.004, 0.006, -0.02], [0.48, 0.05, 0.026, 0.052, -0.02], [0.43, 0.088, 0.05, 0.088, -0.014],
    [0.35, 0.122, 0.08, 0.122, -0.008], [0.24, 0.146, 0.11, 0.146, 0], [0.12, 0.152, 0.13, 0.15, 0],
    [-0.02, 0.142, 0.13, 0.135, 0], [-0.15, 0.112, 0.112, 0.1, 0.005], [-0.27, 0.076, 0.086, 0.064, 0.01],
    [-0.37, 0.046, 0.06, 0.04, 0.012], [-0.44, 0.028, 0.04, 0.026, 0.012], [-0.5, 0.02, 0.028, 0.02, 0.012],
  ], 0x2d3a49, 0xdfe5e9, 22, (c, z, s, co) => {
    if (s < -0.25 && z > -0.06 && z < 0.47) { if (((co * 11) % 1 + 1) % 1 < 0.35) c.multiplyScalar(0.72); } // throat pleats
    if (z > 0.28 && s > 0.45 && hash(z * 60, co * 13) > 0.72) c.multiplyScalar(0.6);                       // tubercles
    if (s < -0.2 && hash(z * 23, co * 5) > 0.93) c.multiplyScalar(0.8);                                       // belly scars
  });
  const f = { pos: [], col: [] }, fc = 0x26323f;
  fin(f, [[0, 0.118, -0.13], [0, 0.104, -0.23], [0, 0.165, -0.21], [0, 0.15, -0.16]], fc);                  // dorsal hump
  fins2(f, [[0.13, -0.09, 0.25], [0.135, -0.1, 0.16], [0.47, -0.29, -0.11], [0.52, -0.285, -0.07], [0.3, -0.18, 0.12]], 0xe6ebee); // long pectorals
  fins2(f, [[0, 0, -0.46], [0.06, 0, -0.49], [0.37, 0.005, -0.6], [0.32, 0.005, -0.65], [0.14, 0, -0.61], [0.025, 0, -0.575]], fc); // flukes
  return finish(body, f);
}

/** Orca: black with white eye patch, belly and flank sweep, grey saddle, tall dorsal, paddle pectorals. */
export function orcaGeometry() {
  const body = loft([
    [0.5, 0.004, 0.004, 0.004, -0.004], [0.48, 0.042, 0.036, 0.034, -0.004], [0.43, 0.078, 0.07, 0.066, -0.002],
    [0.35, 0.102, 0.1, 0.09, 0], [0.22, 0.117, 0.12, 0.106, 0], [0.06, 0.116, 0.125, 0.11, 0],
    [-0.1, 0.1, 0.11, 0.094, 0], [-0.24, 0.07, 0.08, 0.06, 0.002], [-0.36, 0.04, 0.05, 0.034, 0.004],
    [-0.45, 0.022, 0.03, 0.02, 0.004], [-0.5, 0.016, 0.022, 0.014, 0.004],
  ], 0x14171b, 0x14171b, 20, (c, z, s, co) => {
    const white = () => c.setRGB(0.93, 0.93, 0.9);
    if (s < -0.25 && z > 0.05) white();                                                   // chin + belly
    if (s < 0.05 && z > -0.34 && z < -0.08 && Math.abs(co) > 0.2) white();                // flank sweep
    if (z > 0.27 && z < 0.37 && s > 0.12 && s < 0.5 && Math.abs(co) > 0.35) white();     // eye patch
    if (z > -0.13 && z < 0.01 && s > 0.7) c.setRGB(0.46, 0.48, 0.5);                      // saddle
  });
  const f = { pos: [], col: [] }, k = 0x121417;
  fin(f, [[0, 0.118, 0.05], [0, 0.118, -0.1], [0, 0.37, -0.085], [0, 0.34, -0.03]], k);                     // dorsal
  fins2(f, [[0.1, -0.07, 0.28], [0.1, -0.082, 0.17], [0.27, -0.17, 0.16], [0.26, -0.158, 0.25]], k);       // paddles
  fins2(f, [[0, 0, -0.46], [0.05, 0, -0.49], [0.23, 0.004, -0.6], [0.17, 0.004, -0.635], [0.02, 0, -0.565]], k); // flukes
  return finish(body, f);
}

/** Bottlenose dolphin: beak, melon, falcate dorsal, countershaded grey. */
export function dolphinGeometry() {
  const body = loft([
    [0.5, 0.006, 0.006, 0.006, -0.012], [0.47, 0.016, 0.014, 0.016, -0.012], [0.42, 0.021, 0.02, 0.02, -0.01],
    [0.39, 0.036, 0.048, 0.03, -0.002], [0.34, 0.06, 0.072, 0.055, 0], [0.25, 0.079, 0.086, 0.075, 0],
    [0.1, 0.085, 0.09, 0.08, 0], [-0.06, 0.075, 0.08, 0.07, 0], [-0.2, 0.055, 0.06, 0.048, 0.002],
    [-0.32, 0.032, 0.04, 0.028, 0.004], [-0.42, 0.018, 0.025, 0.016, 0.004], [-0.5, 0.012, 0.018, 0.012, 0.004],
  ], 0x5f6d7b, 0xe9eef2, 18, (c, z, s, co) => {
    if (z > 0.355 && z < 0.375 && s > 0.02 && s < 0.3 && Math.abs(co) > 0.8) c.setRGB(0.06, 0.07, 0.08); // eye
    if (s > -0.05 && s < 0.3 && z < 0.3 && z > -0.25) c.lerp(new THREE.Color(0x8996a3), 0.35);             // soft cape band
  });
  const f = { pos: [], col: [] }, k = 0x55626f;
  fin(f, [[0, 0.086, 0.07], [0, 0.086, -0.07], [0, 0.205, -0.115], [0, 0.18, -0.05]], k);                   // dorsal
  fins2(f, [[0.07, -0.04, 0.25], [0.07, -0.05, 0.17], [0.21, -0.13, 0.09], [0.19, -0.105, 0.16]], k);       // pectorals
  fins2(f, [[0, 0, -0.46], [0.045, 0, -0.49], [0.19, 0.004, -0.59], [0.14, 0.004, -0.62], [0.02, 0, -0.56]], k); // flukes
  return finish(body, f);
}

/** Squid: mantle (+z) with rhombic fins, eyes, 8 arms and 2 long clubbed tentacles trailing to -z. Neutral colours, tinted per use. */
export function squidGeometry() {
  const body = loft([
    [0.5, 0.003, 0.003, 0.003], [0.46, 0.028, 0.028, 0.028], [0.36, 0.055, 0.055, 0.055], [0.2, 0.07, 0.07, 0.07],
    [0.03, 0.066, 0.066, 0.066], [-0.04, 0.046, 0.046, 0.046], [-0.075, 0.056, 0.056, 0.056], [-0.12, 0.04, 0.04, 0.04],
    [-0.14, 0.026, 0.026, 0.026],
  ], 0xd6cbc2, 0xffffff, 12, (c, z, s, co) => {
    if (z > -0.095 && z < -0.06 && Math.abs(co) > 0.8 && Math.abs(s) < 0.45) c.setRGB(0.05, 0.05, 0.08); // eyes
    else if (z > -0.04 && hash(z * 80, co * 9 + s * 5) > 0.8) c.multiplyScalar(0.7);                    // chromatophores
  });
  const f = { pos: [], col: [] }, arm = 0xe2d4ca;
  fins2(f, [[0.02, 0, 0.47], [0.02, 0, 0.26], [0.17, 0, 0.35]], 0xece3dc);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2, ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
    const b = [ca * 0.03, sa * 0.03, -0.13], t = [ca * 0.075, sa * 0.075, -0.4 - (i % 3) * 0.02];
    fin(f, [[b[0] - px * 0.014, b[1] - py * 0.014, b[2]], [b[0] + px * 0.014, b[1] + py * 0.014, b[2]], [t[0] + px * 0.003, t[1] + py * 0.003, t[2]], [t[0] - px * 0.003, t[1] - py * 0.003, t[2]]], arm);
  }
  for (const sd of [-1, 1]) { // feeding tentacles with clubs
    const x0 = sd * 0.02, x1 = sd * 0.035;
    fin(f, [[x0, -0.006, -0.13], [x0, 0.006, -0.13], [x1, 0.003, -0.56], [x1, -0.003, -0.56]], arm);
    fin(f, [[x1, -0.004, -0.56], [x1, 0.004, -0.56], [x1 + sd * 0.01, 0.014, -0.62], [x1, 0, -0.66], [x1 + sd * 0.01, -0.014, -0.62]], 0xd9c3b6);
  }
  return finish(body, f);
}

/** Manta ray: flat swept wings (span 1 along x, nose +z), dark back / white belly with spots, cephalic fins, whip tail. */
export function mantaGeometry() {
  const N = 16, M = 8, pos = [], col = [], top = new THREE.Color(0x26303b), bot = new THREE.Color(0xeef2f4), c = new THREE.Color();
  const front = (a) => 0.24 - 0.62 * a - 0.3 * a * a, back = (a) => -0.12 + 0.12 * a - 0.36 * a * a, th = (a, v) => 0.055 * Math.pow(Math.max(0, 1 - 2 * a), 1.2) * Math.sin(Math.PI * v);
  const P = (i, j, side) => { const x = -0.5 + i / N, a = Math.abs(x), v = j / M, z = back(a) + (front(a) - back(a)) * v; return [x, side > 0 ? th(a, v) : -0.6 * th(a, v), z]; };
  const push = (p, side) => {
    pos.push(...p);
    if (side > 0) { c.copy(top).multiplyScalar(0.9 + 0.2 * hash(p[0] * 9, p[2] * 9)); const a = Math.abs(p[0]); if (a > 0.08 && a < 0.3 && p[2] > front(a) - 0.09) c.lerp(bot, 0.55); } // pale shoulder patches
    else { c.copy(bot); if (Math.abs(p[0]) < 0.18 && p[2] < 0.1 && hash(p[0] * 31, p[2] * 29) > 0.8) c.setRGB(0.2, 0.24, 0.28); }
    col.push(c.r, c.g, c.b);
  };
  for (const side of [1, -1]) for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = P(i, j, side), b = P(i + 1, j, side), d = P(i, j + 1, side), e = P(i + 1, j + 1, side);
    const tri = side > 0 ? [a, d, b, b, d, e] : [a, b, d, b, e, d];
    for (const p of tri) push(p, side);
  }
  const f = { pos: [], col: [] };
  fins2(f, [[0.05, 0.0, 0.2], [0.09, 0.0, 0.2], [0.09, -0.03, 0.32], [0.06, -0.02, 0.31]], 0x2a333d);   // cephalic fins
  fin(f, [[-0.01, 0, -0.12], [0.01, 0, -0.12], [0, 0.002, -0.62]], 0x232b34);                            // tail
  fin(f, [[0, 0.04, -0.06], [0, 0.0, -0.13], [0, 0.07, -0.12]], 0x232b34);                               // small dorsal
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...pos, ...f.pos], 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute([...col, ...f.col], 3));
  g.computeVertexNormals();
  return g;
}
