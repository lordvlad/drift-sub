import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loft, fin, tube, blob, mirrorX, resample, hash, smooth } from './kit.js';

/**
 * Deep-sea creature models (squid submarine places: dark sea, trench edges, hydrothermal vents).
 * Same conventions as kit.js (nose +z, body length 1, y up) with two extra per-vertex attributes read by the deep
 * material (src/groups/deep.js):
 *   aGlow  (vec3)  bioluminescence: emissive colour added in the fragment shader, visible with the lamps off
 *   aMove  (float) animation weight; the shader's mode decides what it drives (tail wave, fin flap, jelly pulse)
 * geometry.userData.lights = [{ p: [x,y,z], size, c: [r,g,b], follow? }] lists point-like lures / organs that get a soft halo sprite.
 */

const K = (hex) => new THREE.Color(hex);
const pair = (g) => [g, mirrorX(g)];
const ZERO3 = [0, 0, 0];

/** Attach glow / move weights to a part. glow: [r,g,b] | ({x,y,z,r,g,b}) => [r,g,b] | 0; move: number | (x, y, z) => number */
function tag(g, glow = 0, move = 0) {
  const P = g.attributes.position, C = g.attributes.color, n = P.count, G = new Float32Array(n * 3), M = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const gv = typeof glow === 'function' ? glow({ x, y, z, r: C.getX(i), g: C.getY(i), b: C.getZ(i), i }) : glow;
    if (Array.isArray(gv)) { G[i * 3] = gv[0]; G[i * 3 + 1] = gv[1]; G[i * 3 + 2] = gv[2]; }
    M[i] = typeof move === 'function' ? move(x, y, z) : move;
  }
  g.setAttribute('aGlow', new THREE.BufferAttribute(G, 3));
  g.setAttribute('aMove', new THREE.BufferAttribute(M, 1));
  return g;
}
const tagAll = (list, glow, move) => list.map((g) => tag(g, glow, move));

/** Merge tagged parts (untagged ones get zero glow / move). */
function assemble(parts, userData = {}) {
  const clean = parts.map((g) => {
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'aGlow', 'aMove'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.aGlow) tag(g, 0, 0);
    return g;
  });
  const out = mergeGeometries(clean, false);
  out.computeBoundingSphere();
  out.userData = userData;
  return out;
}

const lerpC = (c, hex, t) => c.lerp(K(hex), t);
/** Round paddle fin (ear / flipper) rising from root [x, y] to tip [x, y] in the xy plane; prof = [[s (0 root..1 tip), zLeading, zTrailing, thickness]]. */
function paddle(root, tip, prof, opts) {
  const dx = tip[0] - root[0], dy = tip[1] - root[1], l = Math.hypot(dx, dy);
  const st = prof.map(([s, zl, zt, t]) => ({ le: [root[0] + dx * s, root[1] + dy * s, zl], te: [root[0] + dx * s, root[1] + dy * s, zt], t }));
  return fin(st, { side: [dy / l, -dx / l, 0], ...opts });
}
const GLOW_CYAN = [0.25, 0.95, 1.0], GLOW_BLUE = [0.2, 0.55, 1.0], GLOW_PINK = [1.0, 0.3, 0.55];
const scaleRGB = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// ───────────────────────────── humpback anglerfish ─────────────────────────────

/** Humpback anglerfish (Melanocetus johnsonii), ~1 unit long: globular dark body, huge oblique toothy mouth, glowing esca on a flexible rod. */
export function anglerGeometry() {
  const parts = [];
  const BACK = 0x3b2c30, BELLY = 0x5c4549;
  const body = loft([
    [0.46, 0.004, 0.01, 0.01, 0.03], [0.44, 0.07, 0.07, 0.04, 0.09], [0.38, 0.14, 0.15, 0.08, 0.1], [0.28, 0.2, 0.23, 0.15, 0.07],
    [0.12, 0.27, 0.3, 0.26, 0.02], [-0.05, 0.28, 0.31, 0.3, 0], [-0.2, 0.22, 0.26, 0.25, 0], [-0.32, 0.12, 0.14, 0.14, 0],
    [-0.4, 0.05, 0.06, 0.06, 0], [-0.46, 0.025, 0.03, 0.03, 0], [-0.5, 0.005, 0.01, 0.01, 0],
  ], {
    rings: 34, sides: 20, back: BACK, belly: BELLY,
    colorFn: (c, { z, s }) => { const h = hash(Math.round(z * 70), Math.round(s * 9)); if (h > 0.8) c.multiplyScalar(0.7); else if (h < 0.08) lerpC(c, 0x7a6064, 0.5); },
  });
  parts.push(tag(body, 0, (x, y, z) => smooth(-0.05, -0.5, z)));
  // the oblique lower jaw sticks out beyond the snout
  const jaw = loft([
    [0.52, 0.004, 0.01, 0.01, -0.09], [0.5, 0.05, 0.03, 0.035, -0.095], [0.42, 0.13, 0.05, 0.06, -0.1], [0.25, 0.2, 0.06, 0.09, -0.1],
    [0.08, 0.25, 0.1, 0.15, -0.09], [-0.05, 0.26, 0.12, 0.2, -0.07],
  ], { rings: 20, sides: 16, back: 0x2a1d21, belly: 0x4a3539 });
  parts.push(tag(jaw));
  parts.push(tag(blob([0, -0.02, 0.3], [0.15, 0.045, 0.2], 0x1b0709, { w: 10, h: 6 })));            // dark mouth cavity
  // fangs: long, glassy, slightly inward-curving
  for (const sd of [-1, 1]) for (let i = 0; i < 12; i++) {
    const z = 0.46 - i * 0.032, w = 0.04 + 0.2 * smooth(0.46, 0.1, z), k = 0.014 + 0.012 * hash(i, sd + 3);
    parts.push(tag(tube([[sd * w, -0.045, z, 0.006], [sd * w * 0.85, -0.045 + 0.1 + k, z + 0.012, 0.0015]], { segs: 2, sides: 3, color: 0xe9e2d2 })));
    if (i % 2 === 0) parts.push(tag(tube([[sd * (w * 0.9), 0.0, z - 0.01, 0.005], [sd * w * 0.8, -0.09 - k, z + 0.004, 0.0012]], { segs: 2, sides: 3, color: 0xe9e2d2 })));
  }
  // eyes
  for (const sd of [-1, 1]) parts.push(tag(blob([sd * 0.15, 0.19, 0.29], [0.028, 0.028, 0.028], 0x0a0a0c, { w: 8, h: 6 })));
  // illicium (fishing rod) and the glowing esca
  const rod = [[0, 0.27, 0.27, 0.014], [0, 0.42, 0.37, 0.01], [0, 0.55, 0.5, 0.008], [0, 0.6, 0.62, 0.007], [0, 0.55, 0.7, 0.006]];
  parts.push(tag(tube(rod, { segs: 12, sides: 5, color: 0x4a3a3e }), 0, 0));
  parts.push(tag(blob([0, 0.53, 0.705], [0.04, 0.045, 0.04], 0xcff9ff, { w: 10, h: 7 }), scaleRGB(GLOW_CYAN, 2.4), 0));
  for (let i = 0; i < 5; i++) {   // little filaments around the esca
    const a = (i / 5) * Math.PI * 2;
    parts.push(tag(tube([[0, 0.53, 0.705, 0.004], [Math.cos(a) * 0.05, 0.53 + Math.sin(a) * 0.05 - 0.02, 0.73, 0.001]], { segs: 2, sides: 3, color: 0xcff9ff }), scaleRGB(GLOW_CYAN, 1.2), 0));
  }
  // paired fins (translucent fans)
  {
    const st = [{ le: [0.26, -0.07, -0.02], te: [0.26, -0.07, -0.16], t: 0.008 }, { le: [0.34, -0.1, -0.03], te: [0.34, -0.1, -0.18], t: 0.006 }, { le: [0.42, -0.12, -0.06], te: [0.42, -0.12, -0.17], t: 0.003 }];
    parts.push(...tagAll(pair(fin(st, { side: [0, 1, 0], span: 5, chord: 4, color: 0x5a4448 })), 0, 0));
  }
  // caudal fin
  {
    const N = 9, st = [];
    for (let j = 0; j < N; j++) {
      const a = -1 + (2 * j) / (N - 1), y = a * 0.13, ch = 0.1 * (1 - 0.55 * a * a);
      st.push({ le: [0, y, -0.455], te: [0, y, -0.455 - ch], t: 0.006 });
    }
    parts.push(tag(fin(st, { side: [1, 0, 0], span: N, chord: 4, color: 0x2e2125, colorFn: (c, { u }) => lerpC(c, 0x4a3a3e, u * 0.4) }), 0, (x, y, z) => smooth(-0.05, -0.5, z)));
  }
  return assemble(parts, { lights: [{ p: [0, 0.53, 0.705], size: 0.35, c: GLOW_CYAN }] });
}

// ───────────────────────────── pelican / gulper eel ─────────────────────────────

/** Gulper eel (Eurypharynx pelecanoides): tiny skull, enormous hinged mouth pouch, whip tail ending in a glowing organ. */
export function gulperGeometry() {
  const parts = [];
  const body = loft([
    [0.5, 0.004, 0.004, 0.004, 0], [0.485, 0.02, 0.02, 0.02], [0.44, 0.04, 0.035, 0.03], [0.36, 0.045, 0.04, 0.035], [0.28, 0.035, 0.035, 0.03],
    [0.2, 0.026, 0.028, 0.026], [0.05, 0.022, 0.026, 0.022], [-0.2, 0.016, 0.02, 0.018], [-0.4, 0.009, 0.011, 0.01], [-0.5, 0.003, 0.004, 0.004],
  ], {
    rings: 70, sides: 8, back: 0x16121a, belly: 0x2a2230,
    colorFn: (c, { z, t }) => { if (z < -0.3) lerpC(c, 0x3a2230, smooth(-0.3, -0.5, z) * 0.6); },
  });
  parts.push(tag(body, ({ z }) => (z < -0.44 ? scaleRGB(GLOW_PINK, 1.5 * smooth(-0.44, -0.5, z)) : 0), (x, y, z) => smooth(0.4, -0.5, z)));
  // the pouch: a loose bag hung under the skull, pale and veined
  const pouch = loft([
    [0.5, 0.004, 0.004, 0.004, -0.02], [0.49, 0.03, 0.01, 0.03, -0.03], [0.44, 0.07, 0.015, 0.09, -0.06], [0.38, 0.09, 0.02, 0.12, -0.08],
    [0.32, 0.075, 0.02, 0.1, -0.07], [0.24, 0.04, 0.02, 0.05, -0.04],
  ], {
    rings: 16, sides: 14, back: 0x2a2230, belly: 0x5a4658,
    colorFn: (c, { z, co, s }) => { if (hash(Math.round(z * 50), Math.round(co * 6)) > 0.7) lerpC(c, 0x7a5a70, 0.5); },
  });
  parts.push(tag(pouch, 0, (x, y, z) => smooth(0.4, -0.5, z)));
  parts.push(tag(blob([0, -0.005, 0.49], [0.035, 0.025, 0.03], 0x050305, { w: 8, h: 5 })));       // black throat
  for (const sd of [-1, 1]) parts.push(tag(blob([sd * 0.036, 0.015, 0.39], [0.008, 0.008, 0.008], 0x08080a, { w: 6, h: 4 })));
  // small teeth rimming the upper jaw
  for (const sd of [-1, 1]) for (let i = 0; i < 7; i++) {
    const z = 0.485 - i * 0.012;
    parts.push(tag(tube([[sd * 0.02, -0.012, z, 0.002], [sd * 0.017, -0.026, z + 0.003, 0.0004]], { segs: 2, sides: 3, color: 0xcfc8d8 })));
  }
  // long low dorsal fin along the whole back
  {
    const st = [];
    for (let j = 0; j < 14; j++) {
      const z = 0.25 - (j / 13) * 0.7, y = 0.026 * (1 - (0.25 - z) * 0.9);
      st.push({ le: [0, Math.max(0.006, y), z], te: [0, Math.max(0.006, y) + 0.012 + 0.012 * Math.sin(j * 0.9), z - 0.003], t: 0.003 });
    }
    parts.push(tag(fin(st, { side: [1, 0, 0], span: 14, chord: 3, color: 0x1e1824 }), 0, (x, y, z) => smooth(0.4, -0.5, z)));
  }
  parts.push(tag(blob([0, 0, -0.508], [0.014, 0.014, 0.02], 0xffc0d4, { w: 8, h: 5 }), scaleRGB(GLOW_PINK, 2.4), 1));
  return assemble(parts, { lights: [{ p: [0, 0, -0.51], size: 0.28, c: GLOW_PINK, follow: 1 }] });
}

// ───────────────────────────── vampire squid ─────────────────────────────

/** Vampire squid (Vampyroteuthis infernalis): gelatinous burgundy body, big blue eyes, webbed cloak of arms, ear-like fins; glowing arm tips. */
export function vampireGeometry() {
  const parts = [], BACK = 0x4d0f1c, BELLY = 0x7a2334;
  const body = loft([
    [0.2, 0.004, 0.004, 0.004], [0.16, 0.07, 0.07, 0.06], [0.08, 0.14, 0.13, 0.12], [-0.04, 0.19, 0.17, 0.16], [-0.2, 0.2, 0.18, 0.17],
    [-0.35, 0.15, 0.14, 0.13], [-0.45, 0.07, 0.07, 0.06], [-0.5, 0.004, 0.004, 0.004],
  ], { rings: 26, sides: 18, back: BACK, belly: BELLY, colorFn: (c, { z, s }) => { if (hash(Math.round(z * 60), Math.round(s * 8)) > 0.86) lerpC(c, 0x1c0408, 0.5); } });
  parts.push(tag(body, ({ x, y, z }) => (Math.abs(x) < 0.06 && z < -0.4 ? scaleRGB(GLOW_BLUE, 0.6) : 0), 0));
  // webbed cloak: cone that opens forward, with 8 arms running along it
  const web = loft([
    [0.52, 0.004, 0.004, 0.004], [0.5, 0.2, 0.2, 0.2], [0.42, 0.26, 0.26, 0.26], [0.3, 0.2, 0.2, 0.2], [0.18, 0.12, 0.12, 0.11], [0.08, 0.1, 0.1, 0.09],
  ], { rings: 16, sides: 16, back: 0x3c0a16, belly: 0x641a2a, colorFn: (c, { z }) => lerpC(c, 0x8a3042, smooth(0.35, 0.5, z) * 0.6) });
  parts.push(tag(web, 0, 0));
  const tips = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2, ca = Math.cos(a), sa = Math.sin(a), r1 = 0.12, r2 = 0.27, wob = Math.sin(i * 2.1) * 0.015;
    const pts = [[ca * 0.1, sa * 0.1, 0.1, 0.02], [ca * r1, sa * r1, 0.2, 0.021], [ca * r2 + wob, sa * r2, 0.4, 0.017], [ca * (r2 + 0.03), sa * (r2 + 0.03) + wob, 0.54, 0.011], [ca * (r2 + 0.05), sa * (r2 + 0.04), 0.6, 0.0025]];
    parts.push(tag(tube(pts, { segs: 12, sides: 5, color: 0x5a1426, colorFn: (c, { v }) => lerpC(c, 0x9a3a4c, v * 0.5) }), ({ z }) => (z > 0.52 ? scaleRGB(GLOW_BLUE, 1.4 * smooth(0.52, 0.6, z)) : 0), 0));
    tips.push({ p: [ca * (r2 + 0.05), sa * (r2 + 0.04), 0.6], size: 0.07, c: GLOW_BLUE });
  }
  // eyes: large, blue (they glow faintly like the retinal reflector)
  for (const sd of [-1, 1]) {
    parts.push(tag(blob([sd * 0.17, 0.06, 0.04], [0.07, 0.075, 0.075], 0x2c5a98, { w: 12, h: 8 }), scaleRGB([0.08, 0.2, 0.4], 0.25)));
    parts.push(tag(blob([sd * 0.225, 0.06, 0.04], [0.025, 0.035, 0.035], 0x04080e, { w: 8, h: 5 })));
  }
  // ear fins: two round paddles up on the mantle sides, flapped like wings
  {
    const f = paddle([0.14, 0.1], [0.3, 0.27], [[0, -0.14, -0.26, 0.014], [0.22, -0.09, -0.3, 0.012], [0.5, -0.08, -0.31, 0.01], [0.75, -0.1, -0.28, 0.007], [0.92, -0.14, -0.24, 0.004], [1, -0.18, -0.21, 0.002]],
      { span: 8, chord: 6, color: 0x5a1426, colorFn: (c, { v }) => { lerpC(c, 0x8c2a3c, v * 0.5); } });
    parts.push(...tagAll(pair(f), 0, (x) => smooth(0.12, 0.34, Math.abs(x))));
    for (const sd of [-1, 1]) parts.push(tag(blob([sd * 0.17, 0.12, -0.17], [0.014, 0.014, 0.014], 0xbfe0ff, { w: 6, h: 4 }), scaleRGB(GLOW_BLUE, 2), 0));   // fin-base photophores
  }
  return assemble(parts, { lights: tips.filter((_, i) => i % 2 === 0) });
}

// ───────────────────────────── dumbo octopus ─────────────────────────────

/** Dumbo octopus (Grimpoteuthis): pale pink dome, big ear-like fins, umbrella web of short arms, small eyes. */
export function dumboGeometry() {
  const parts = [], BACK = 0xe0a8bc, BELLY = 0xf3d7de;
  const body = loft([
    [0.28, 0.004, 0.004, 0.004, 0.02], [0.25, 0.09, 0.09, 0.07, 0.04], [0.15, 0.17, 0.17, 0.12, 0.03], [0.0, 0.2, 0.22, 0.14, 0.04], [-0.15, 0.19, 0.21, 0.13, 0.03],
    [-0.3, 0.12, 0.14, 0.08, 0.02], [-0.38, 0.004, 0.004, 0.004, 0.02],
  ], { rings: 24, sides: 18, back: BACK, belly: BELLY, colorFn: (c, { z, s }) => { if (hash(Math.round(z * 40), Math.round(s * 7)) > 0.9) lerpC(c, 0xc07890, 0.4); } });
  parts.push(tag(body));
  // umbrella web + short arms
  const web = loft([
    [0.5, 0.004, 0.004, 0.004, -0.08], [0.47, 0.18, 0.02, 0.02, -0.09, 2.4], [0.4, 0.3, 0.045, 0.045, -0.08, 2.2], [0.3, 0.28, 0.07, 0.07, -0.06], [0.18, 0.2, 0.09, 0.08, -0.04], [0.08, 0.16, 0.1, 0.09, -0.02],
  ], { rings: 18, sides: 24, back: 0xd890a8, belly: 0xe8b8c8, colorFn: (c, { z, co, s }) => { const sc = Math.pow(Math.abs(Math.sin(Math.atan2(s, co) * 4)), 0.5); lerpC(c, 0xf0cdd8, smooth(0.35, 0.5, z) * (0.3 + 0.4 * sc)); } });
  parts.push(tag(web));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2, ca = Math.cos(a), sa = Math.sin(a);
    parts.push(tag(tube([[ca * 0.12, sa * 0.12 - 0.08, 0.2, 0.026], [ca * 0.25, sa * 0.2 - 0.1, 0.36, 0.021], [ca * 0.31 * 1.0, sa * 0.23 - 0.11, 0.47, 0.014], [ca * 0.31, sa * 0.2 - 0.1, 0.56, 0.0035]], { segs: 8, sides: 5, color: 0xdb9cb2, colorFn: (c, { v }) => lerpC(c, 0xf2d0da, v * 0.6) })));
  }
  for (const sd of [-1, 1]) {
    parts.push(tag(blob([sd * 0.16, 0.1, 0.2], [0.032, 0.036, 0.036], 0x14121a, { w: 8, h: 6 })));
    parts.push(tag(blob([sd * 0.168, 0.11, 0.21], [0.008, 0.01, 0.01], 0xffffff, { w: 4, h: 3 })));
  }
  // ear fins
  {
    const f = paddle([0.15, 0.13], [0.29, 0.36], [[0, 0.04, -0.12, 0.025], [0.2, 0.1, -0.18, 0.022], [0.45, 0.12, -0.22, 0.018], [0.7, 0.1, -0.22, 0.012], [0.9, 0.05, -0.17, 0.007], [1, -0.02, -0.1, 0.003]],
      { span: 9, chord: 7, color: 0xe6b8ca, colorFn: (c, { u, v }) => { lerpC(c, 0xf7e3ea, v * 0.6 + u * 0.15); } });
    parts.push(...tagAll(pair(f), 0, (x) => smooth(0.15, 0.34, Math.abs(x))));
  }
  return assemble(parts);
}

// ───────────────────────────── lanternfish ─────────────────────────────

/** Lanternfish (Myctophidae), schooling: <= 500 triangles. Slim, silver-blue, big eyes, rows of glowing photophores along the belly. */
export function lanternGeometry() {
  const parts = [];
  const body = loft([
    [0.5, 0.004, 0.004, 0.004], [0.46, 0.035, 0.04, 0.035], [0.38, 0.06, 0.075, 0.06], [0.2, 0.065, 0.09, 0.075], [0.0, 0.055, 0.08, 0.065], [-0.2, 0.035, 0.055, 0.045],
    [-0.35, 0.018, 0.03, 0.025], [-0.42, 0.012, 0.02, 0.018],
  ], { rings: 12, sides: 8, back: 0x1c2a44, belly: 0xc3d3e0, colorFn: (c, { s }) => { lerpC(c, 0x8aa0bc, smooth(0.3, -0.1, s) * 0.6); } });
  parts.push(tag(body, 0, (x, y, z) => smooth(0.1, -0.45, z)));
  for (const sd of [-1, 1]) parts.push(tag(blob([sd * 0.052, 0.022, 0.38], [0.026, 0.034, 0.034], 0x0a0f18, { w: 5, h: 3 })));
  // belly photophores: ventral rows + a luminous patch near the tail and a head lamp
  for (let i = 0; i < 5; i++) {
    const z = 0.32 - i * 0.1, y = -0.062 - 0.012 * Math.sin(i * 0.5);
    parts.push(tag(blob([0.038, y + 0.008, z], [0.011, 0.011, 0.011], 0xd8fbff, { w: 4, h: 3 }), scaleRGB(GLOW_CYAN, 2.2), 0));
    parts.push(tag(blob([-0.038, y + 0.008, z], [0.011, 0.011, 0.011], 0xd8fbff, { w: 4, h: 3 }), scaleRGB(GLOW_CYAN, 2.2), 0));
  }
  parts.push(tag(blob([0, 0.0, -0.4], [0.012, 0.012, 0.03], 0xfff0c8, { w: 4, h: 3 }), [1.6, 1.3, 0.5], 0.7));
  parts.push(tag(blob([0, 0.075, 0.44], [0.008, 0.008, 0.012], 0xd8fbff, { w: 4, h: 3 }), scaleRGB(GLOW_BLUE, 1.8), 0));
  // fins
  {
    const N = 5, st = [];
    for (let j = 0; j < N; j++) { const a = -1 + (2 * j) / (N - 1), y = a * 0.075, ch = 0.12 * (1 - 0.5 * a * a); st.push({ le: [0, y, -0.42], te: [0, y, -0.42 - ch], t: 0.005 }); }
    parts.push(tag(fin(st, { side: [1, 0, 0], span: N, chord: 3, color: 0x44587a }), 0, (x, y, z) => smooth(0.1, -0.45, z)));
  }
  parts.push(tag(fin([{ le: [0, 0.08, 0.05], te: [0, 0.08, -0.08], t: 0.004 }, { le: [0, 0.125, 0.0], te: [0, 0.115, -0.075], t: 0.003 }], { side: [1, 0, 0], span: 3, chord: 3, color: 0x34486a }), 0, (x, y, z) => smooth(0.1, -0.45, z)));
  parts.push(tag(fin([{ le: [0.04, -0.06, 0.2], te: [0.04, -0.06, 0.12], t: 0.004 }, { le: [0.085, -0.085, 0.17], te: [0.085, -0.085, 0.11], t: 0.002 }], { side: [0, 1, 0], span: 3, chord: 3, color: 0x6a7f9a }), 0, 0));
  parts.push(tag(mirrorX(fin([{ le: [0.04, -0.06, 0.2], te: [0.04, -0.06, 0.12], t: 0.004 }, { le: [0.085, -0.085, 0.17], te: [0.085, -0.085, 0.11], t: 0.002 }], { side: [0, 1, 0], span: 3, chord: 3, color: 0x6a7f9a })), 0, 0));
  return assemble(parts);
}

// ───────────────────────────── Atolla jellyfish ─────────────────────────────

/** Crown jelly (Atolla wyvillei), drifting bloom member: <= 600 triangles. Deep-red lens-shaped bell, glowing blue coronal ring, trailing tentacles. Bell diameter = 1 unit; y up. */
export function atollaGeometry() {
  const parts = [];
  const bell = loft([
    [0.5, 0.004, 0.004, 0.004], [0.47, 0.18, 0.18, 0.18], [0.4, 0.31, 0.31, 0.31], [0.3, 0.4, 0.4, 0.4], [0.2, 0.45, 0.45, 0.45], [0.12, 0.47, 0.47, 0.47], [0.09, 0.45, 0.45, 0.45],
    [0.05, 0.5, 0.5, 0.5], [0.0, 0.48, 0.48, 0.48], [-0.04, 0.42, 0.42, 0.42], [-0.07, 0.3, 0.3, 0.3], [-0.085, 0.004, 0.004, 0.004],
  ], { rings: 13, sides: 12, back: 0x9c1230, belly: 0xc23048, colorFn: (c, { z }) => { if (z < 0.1 && z > 0.0) lerpC(c, 0xe0485c, 0.4); else if (z < 0) lerpC(c, 0x7a0c24, 0.5); } });
  bell.rotateX(-Math.PI / 2);   // nose (+z) becomes the top (+y)
  parts.push(tag(bell, ({ x, y, z }) => { const ring = smooth(0.075, 0.0, Math.abs(y - 0.1)) * smooth(0.3, 0.45, Math.hypot(x, z)); return ring > 0 ? scaleRGB(GLOW_BLUE, 2.4 * ring) : 0; }, (x, y, z) => Math.min(1, Math.hypot(x, z) / 0.5) * 0.9));
  const T = 10;
  for (let i = 0; i < T; i++) {
    const a = (i / T) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), long = i === 3, L = long ? 1.4 : 0.42 + 0.12 * hash(i, 5), w = 0.12 + 0.1 * hash(i, 9);
    const pts = [[ca * 0.46, 0.0, sa * 0.46, 0.014], [ca * 0.5, -L * 0.3, sa * 0.5 + w * 0.2, 0.01], [ca * 0.46 + w * 0.3, -L * 0.65, sa * 0.46 - w * 0.2, 0.007], [ca * 0.44, -L, sa * 0.44 + w * 0.3, 0.002]];
    parts.push(tag(tube(pts, { segs: 4, sides: 3, color: 0xb02040, colorFn: (c, { v }) => lerpC(c, 0xff6a8a, v * 0.5) }), ({ y }) => (long ? scaleRGB(GLOW_PINK, 0.8 * smooth(-0.3, -1.3, y)) : 0), (x, y) => -Math.min(1, -y / 0.9)));
  }
  parts.push(tag(blob([0, -0.02, 0], [0.12, 0.05, 0.12], 0xe05060, { w: 6, h: 3 }), 0, 0.2));   // stomach under the bell
  return assemble(parts);
}

// ───────────────────────────── oarfish ─────────────────────────────

/** Oarfish (Regalecus glesne): silver ribbon body with dark blotches, crimson dorsal fin running the whole back with a head crest, long pelvic oars. */
export function oarfishGeometry() {
  const parts = [];
  const sections = [
    [0.5, 0.003, 0.008, 0.008], [0.48, 0.012, 0.026, 0.024], [0.44, 0.016, 0.04, 0.034], [0.38, 0.016, 0.046, 0.042], [0.2, 0.014, 0.04, 0.036], [0.0, 0.012, 0.034, 0.03],
    [-0.2, 0.01, 0.025, 0.022], [-0.4, 0.006, 0.014, 0.012], [-0.5, 0.003, 0.005, 0.005],
  ];
  const body = loft(sections, {
    rings: 64, sides: 10, back: 0xaeb9c2, belly: 0xe8edf0,
    colorFn: (c, { z, s }) => { const h = hash(Math.round(z * 38), Math.round(s * 3)); if (h > 0.84 && z < 0.34) lerpC(c, 0x33383f, 0.7); else if (h < 0.2) lerpC(c, 0xffffff, 0.3); },
  });
  parts.push(tag(body, 0, (x, y, z) => 0.25 + 0.75 * smooth(0.45, -0.5, z)));
  // eye + gill cover glint
  for (const sd of [-1, 1]) {
    parts.push(tag(blob([sd * 0.017, 0.012, 0.425], [0.006, 0.015, 0.015], 0x0a0c10, { w: 6, h: 5 })));
    parts.push(tag(blob([sd * 0.0195, 0.012, 0.425], [0.003, 0.02, 0.02], 0xd7dce0, { w: 6, h: 5 })));
  }
  // dorsal fin: tall crest over the head sweeping into a low ribbon along the back
  {
    const st = [], top = (z) => resample(sections.map((s) => [s[0], s[2]]), 40).reduce((b, r) => (Math.abs(r[0] - z) < Math.abs(b[0] - z) ? r : b))[1];
    for (let j = 0; j < 32; j++) {
      const z = 0.45 - (j / 31) * 0.94, h = 0.03 + 0.1 * Math.exp(-j * 0.35) + 0.012 * Math.sin(j * 1.4);
      st.push({ le: [0, top(z) * 0.9, z], te: [0, top(z) + h, z - 0.01], t: 0.004 });
    }
    parts.push(tag(fin(st, { side: [1, 0, 0], span: 32, chord: 4, color: 0xc8202c, colorFn: (c, { u, v }) => { lerpC(c, 0xff4a4a, u * 0.5); if (Math.floor(v * 90) % 2 === 0) c.multiplyScalar(0.88); } }), 0, (x, y, z) => 0.25 + 0.75 * smooth(0.45, -0.5, z)));
  }
  // pelvic oars: very long thin rays ending in a paddle
  for (const sd of [-1, 1]) {
    parts.push(tag(tube([[sd * 0.01, -0.03, 0.3, 0.004], [sd * 0.02, -0.2, 0.27, 0.003], [sd * 0.03, -0.38, 0.22, 0.003], [sd * 0.03, -0.46, 0.2, 0.004]], { segs: 8, sides: 3, color: 0xd02a32 })));
    parts.push(tag(blob([sd * 0.03, -0.47, 0.2], [0.006, 0.03, 0.02], 0xe03a3a, { w: 5, h: 4 })));
  }
  return assemble(parts);
}

// ───────────────────────────── sperm whale ─────────────────────────────

/** Sperm whale (Physeter macrocephalus), ~12 m: enormous blunt square head, narrow underslung jaw with teeth, wrinkled grey-brown skin, knuckle ridge, broad flukes. */
export function spermWhaleGeometry() {
  const parts = [], SK = 0x5d5c62, SK2 = 0x77747a;
  const body = loft([
    [0.5, 0.004, 0.004, 0.004, 0.03, 2.4], [0.495, 0.06, 0.09, 0.05, 0.04, 2.8], [0.48, 0.1, 0.15, 0.08, 0.04, 3.0], [0.44, 0.115, 0.19, 0.09, 0.035, 3.0], [0.36, 0.125, 0.2, 0.1, 0.03, 2.8],
    [0.25, 0.13, 0.2, 0.12, 0.02, 2.5], [0.1, 0.125, 0.18, 0.12, 0, 2.3], [-0.05, 0.11, 0.16, 0.11, 0, 2.2], [-0.2, 0.085, 0.12, 0.09, 0, 2.1], [-0.33, 0.055, 0.075, 0.06, 0.005, 2.0],
    [-0.42, 0.03, 0.045, 0.04, 0, 2], [-0.47, 0.018, 0.03, 0.03, 0, 2], [-0.505, 0.006, 0.012, 0.012, 0, 2],
  ], {
    rings: 50, sides: 36, back: SK, belly: 0x9c9aa0,
    colorFn: (c, { z, s, x, y }) => {
      const wr = Math.sin(z * 150 + Math.sin(s * 5 + z * 40) * 1.4);        // transverse wrinkles on the aft body
      c.multiplyScalar(1 - 0.12 * smooth(0.2, 0.9, wr) * smooth(0.18, -0.1, z) - 0.05 * smooth(0.55, 0.95, hash(Math.round(x * 90), Math.round(y * 90 + z * 40))));
      if (z > 0.2) lerpC(c, SK2, 0.3 * smooth(0.3, 0.5, z));
      if (s < -0.5) lerpC(c, 0xcfcfd2, 0.45 * smooth(-0.5, -0.9, s));
    },
  });
  parts.push(tag(body, 0, (x, y, z) => smooth(0.15, -0.5, z)));
  // lower jaw: thin, far back from the snout tip, with a row of peg teeth
  const jaw = loft([[0.42, 0.004, 0.01, 0.01, -0.095], [0.4, 0.03, 0.02, 0.025, -0.1], [0.3, 0.042, 0.025, 0.035, -0.105], [0.15, 0.05, 0.03, 0.04, -0.1], [0.02, 0.055, 0.04, 0.05, -0.08]],
    { rings: 14, sides: 12, back: 0xb8b4b6, belly: 0xe2dfe0 });
  parts.push(tag(jaw));
  for (const sd of [-1, 1]) for (let i = 0; i < 16; i++) {
    const z = 0.38 - i * 0.017;
    parts.push(tag(tube([[sd * 0.03, -0.073, z, 0.0045], [sd * 0.026, -0.052, z, 0.0012]], { segs: 2, sides: 3, color: 0xefe9d8 })));
  }
  // blowhole (offset to the left at the front of the head), eye, pale scar marks
  parts.push(tag(blob([0.045, 0.228, 0.42], [0.018, 0.004, 0.03], 0x1a1a1e, { w: 6, h: 3 })));
  for (const sd of [-1, 1]) parts.push(tag(blob([sd * 0.121, 0.015, 0.32], [0.006, 0.008, 0.008], 0x101012, { w: 5, h: 4 })));
  // dorsal hump / knuckles
  parts.push(tag(fin([{ le: [0, 0.158, -0.12], te: [0, 0.158, -0.2], t: 0.03 }, { le: [0, 0.2, -0.15], te: [0, 0.2, -0.205], t: 0.016 }, { le: [0, 0.22, -0.17], te: [0, 0.22, -0.2], t: 0.004 }], { side: [1, 0, 0], span: 5, chord: 5, color: SK }), 0, (x, y, z) => smooth(0.15, -0.5, z)));
  // flippers
  {
    const st = [{ le: [0.1, -0.1, 0.12], te: [0.1, -0.1, 0.0], t: 0.016 }, { le: [0.17, -0.16, 0.1], te: [0.17, -0.16, -0.02], t: 0.014 }, { le: [0.23, -0.21, 0.07], te: [0.23, -0.21, -0.03], t: 0.008 }, { le: [0.26, -0.235, 0.04], te: [0.26, -0.235, -0.02], t: 0.003 }];
    parts.push(...tagAll(pair(fin(st, { side: [0.65, 0.76, 0], span: 6, chord: 5, color: 0x66646a })), 0, 0));
  }
  // flukes
  {
    const X = 0.2, N = 21, st = [];
    for (let j = 0; j < N; j++) {
      const a = Math.abs(-1 + (2 * j) / (N - 1)), x = -X + (2 * X * j) / (N - 1);
      const zle = -0.47 - 0.07 * Math.pow(a, 1.6), chord = 0.1 * Math.pow(Math.max(0, 1 - Math.pow(a, 2.2)), 0.6) - 0.03 * Math.exp(-Math.pow(a / 0.1, 2)) + 0.004;
      st.push({ le: [x, 0.01, zle], te: [x, 0.01, zle - chord], t: 0.006 + 0.014 * (1 - a) });
    }
    parts.push(tag(fin(st, { side: [0, 1, 0], span: N, chord: 5, color: 0x56545a }), 0, (x, y, z) => smooth(0.15, -0.5, z)));
  }
  return assemble(parts);
}

// ───────────────────────────── giant isopod ─────────────────────────────

/** Giant isopod (Bathynomus giganteus): armoured segmented oval, two big compound eyes, 14 walking legs. Crawler: a leg wave runs along z. */
export function isopodGeometry() {
  const parts = [], SH = 0xcdb8a8, DK = 0x9a8274;
  const secs = [[0.5, 0.004, 0.004, 0.004, 0.02]];
  secs.push([0.48, 0.1, 0.05, 0.04, 0.04]);                     // cephalon
  const pinch = [0.34, 0.24, 0.14, 0.04, -0.06, -0.16, -0.26, -0.36];
  pinch.forEach((z, i) => { secs.push([z + 0.045, 0.2 - 0.005 * i, 0.09 - 0.004 * i, 0.04, 0.045 - 0.002 * i], [z - 0.005, 0.185 - 0.005 * i, 0.075 - 0.004 * i, 0.04, 0.04]); });
  secs.push([-0.43, 0.13, 0.07, 0.04, 0.03], [-0.47, 0.08, 0.05, 0.035, 0.025], [-0.5, 0.004, 0.01, 0.01, 0.02]);
  const body = loft(secs, {
    rings: 90, sides: 22, back: SH, belly: 0xe6d9cb,
    colorFn: (c, { z, s }) => { const ph = ((z + 0.5) % 0.1) / 0.1; c.multiplyScalar(0.84 + 0.2 * smooth(0, 0.35, ph) * smooth(1, 0.75, ph)); lerpC(c, DK, 0.18 * smooth(0.35, 0.95, s) * (0.5 + 0.5 * hash(Math.round(z * 30), 2))); },
  });
  parts.push(tag(body, 0, 0));
  for (const sd of [-1, 1]) {
    parts.push(tag(blob([sd * 0.075, 0.035, 0.43], [0.04, 0.03, 0.045], 0x1a1612, { w: 9, h: 6 })));
    parts.push(tag(blob([sd * 0.083, 0.052, 0.45], [0.012, 0.01, 0.014], 0x6a5a48, { w: 5, h: 4 })));
  }
  // antennae
  for (const sd of [-1, 1]) {
    parts.push(tag(tube([[sd * 0.03, 0.0, 0.5, 0.008], [sd * 0.08, 0.0, 0.62, 0.006], [sd * 0.14, -0.01, 0.74, 0.004], [sd * 0.2, -0.02, 0.8, 0.002]], { segs: 6, sides: 4, color: 0xb8a090 })));
    parts.push(tag(tube([[sd * 0.04, -0.02, 0.5, 0.005], [sd * 0.09, -0.03, 0.56, 0.004], [sd * 0.12, -0.04, 0.6, 0.002]], { segs: 3, sides: 3, color: 0xb8a090 })));
  }
  // 7 pairs of legs: knee up and out, foot down on the ground
  for (let i = 0; i < 7; i++) for (const sd of [-1, 1]) {
    const z = 0.38 - i * 0.1 - 0.02, w = 0.19 - i * 0.004, sw = (i % 2 ? 1 : -1) * 0.02;
    parts.push(tag(tube([[sd * w * 0.8, -0.03, z, 0.018], [sd * (w + 0.05), -0.02, z + sw, 0.015], [sd * (w + 0.09), -0.07, z + sw * 2, 0.011], [sd * (w + 0.1), -0.13, z + sw * 2.2, 0.004]], { segs: 5, sides: 4, color: 0xbba592, colorFn: (c, { v }) => lerpC(c, 0x8a7060, v * 0.5) }), 0, 0.6));
  }
  // tail fan (pleotelson + uropods)
  for (const sd of [-1, 1]) parts.push(tag(blob([sd * 0.09, 0.02, -0.52], [0.06, 0.012, 0.07], 0xc6b09e, { w: 8, h: 4 })));
  return assemble(parts);
}

// ───────────────────────────── yeti crab ─────────────────────────────

/** Yeti crab (Kiwa): pale, blind, with long hairy claws held forward; clustered at vents. <= 600 triangles. Claw tips wave (aMove). */
export function yetiGeometry() {
  const parts = [], SH = 0xece4d8, FUR = 0xf6f0e6;
  const shell = loft([[0.3, 0.004, 0.004, 0.004, 0.03], [0.28, 0.07, 0.04, 0.03, 0.04], [0.18, 0.15, 0.07, 0.05, 0.05], [0.0, 0.18, 0.08, 0.06, 0.05], [-0.18, 0.15, 0.07, 0.05, 0.04], [-0.3, 0.07, 0.04, 0.03, 0.03], [-0.34, 0.004, 0.01, 0.01, 0.03]],
    { rings: 10, sides: 8, back: SH, belly: 0xf6eee4, colorFn: (c, { z, s }) => { if (hash(Math.round(z * 20), Math.round(s * 4)) > 0.8) lerpC(c, 0xd8c8b4, 0.5); } });
  parts.push(tag(shell, 0, 0));
  for (const sd of [-1, 1]) {
    // hairy claw arms: long, bent forward, thick fur (colour stipple) and a pincer
    const arm = [[sd * 0.12, 0.05, 0.22, 0.05], [sd * 0.26, 0.1, 0.38, 0.04], [sd * 0.34, 0.12, 0.62, 0.036], [sd * 0.3, 0.1, 0.84, 0.03]];
    parts.push(tag(tube(arm, { segs: 6, sides: 5, color: FUR, colorFn: (c, { v }) => { c.multiplyScalar(0.88 + 0.16 * hash(Math.round(v * 33), 4)); if (hash(Math.round(v * 60), 9) > 0.7) lerpC(c, 0xcbb9a0, 0.5); } }), 0, (x, y, z) => smooth(0.35, 0.9, z) * 0.9));
    parts.push(tag(blob([sd * 0.3, 0.1, 0.92], [0.045, 0.045, 0.1], 0xf1e8dc, { w: 6, h: 4 }), 0, 1));
    parts.push(tag(blob([sd * 0.285, 0.12, 1.0], [0.018, 0.016, 0.05], 0xe0d4c0, { w: 5, h: 3 }), 0, 1));
    // walking legs 3 pairs
    for (let i = 0; i < 3; i++) {
      const z = 0.1 - i * 0.12;
      parts.push(tag(tube([[sd * 0.14, 0.03, z, 0.018], [sd * 0.3, 0.1, z - 0.02, 0.014], [sd * 0.4, -0.06, z - 0.05, 0.01], [sd * 0.44, -0.16, z - 0.06, 0.004]], { segs: 4, sides: 3, color: 0xe4dac8, colorFn: (c, { v }) => { c.multiplyScalar(0.9 + 0.14 * hash(Math.round(v * 20), i)); } }), 0, 0.4));
    }
  }
  parts.push(tag(blob([0, 0.05, 0.3], [0.03, 0.018, 0.02], 0xd4c4b0, { w: 6, h: 4 })));
  return assemble(parts);
}

// ───────────────────────────── vent shrimp ─────────────────────────────

/** Vent shrimp (Rimicaris exoculata), swarm member: <= 250 triangles. Pale, humped thorax with a dark back patch, no eyestalks, bristly legs. */
export function shrimpGeometry() {
  const parts = [];
  const body = loft([[0.5, 0.004, 0.004, 0.004, 0], [0.45, 0.03, 0.025, 0.025], [0.32, 0.06, 0.07, 0.05, 0.02], [0.1, 0.07, 0.09, 0.06, 0.03], [-0.1, 0.055, 0.06, 0.05, 0.02], [-0.3, 0.035, 0.035, 0.03, 0], [-0.42, 0.022, 0.022, 0.02], [-0.5, 0.004, 0.006, 0.006]],
    { rings: 10, sides: 7, back: 0xe8c8b4, belly: 0xf8ece0, colorFn: (c, { z, s }) => { if (s > 0.3 && z > -0.05 && z < 0.34) lerpC(c, 0x8a6454, 0.55); } });
  parts.push(tag(body, 0, (x, y, z) => smooth(0.1, -0.5, z)));
  parts.push(tag(fin([{ le: [0.05, 0, -0.4], te: [0.05, 0, -0.55], t: 0.006 }, { le: [0.09, 0, -0.46], te: [0.09, 0, -0.62], t: 0.004 }, { le: [0.07, 0, -0.5], te: [0.07, 0, -0.64], t: 0.003 }], { side: [0, 1, 0], span: 3, chord: 3, color: 0xe0cbb8 }), 0, (x, y, z) => smooth(0.1, -0.5, z)));
  parts.push(tag(mirrorX(fin([{ le: [0.05, 0, -0.4], te: [0.05, 0, -0.55], t: 0.006 }, { le: [0.09, 0, -0.46], te: [0.09, 0, -0.62], t: 0.004 }, { le: [0.07, 0, -0.5], te: [0.07, 0, -0.64], t: 0.003 }], { side: [0, 1, 0], span: 3, chord: 3, color: 0xe0cbb8 })), 0, (x, y, z) => smooth(0.1, -0.5, z)));
  for (const sd of [-1, 1]) {
    parts.push(tag(tube([[sd * 0.02, 0.0, 0.46, 0.006], [sd * 0.1, 0.02, 0.7, 0.004], [sd * 0.16, 0.03, 0.9, 0.002]], { segs: 3, sides: 3, color: 0xe8d6c4 })));
    for (let i = 0; i < 3; i++) parts.push(tag(tube([[sd * 0.05, -0.04, 0.22 - i * 0.12, 0.008], [sd * 0.13, -0.11, 0.2 - i * 0.12, 0.004]], { segs: 2, sides: 3, color: 0xe0cbb8 }), 0, 0.5));
  }
  return assemble(parts);
}

// ───────────────────────────── pale vent octopus ─────────────────────────────

/** Vent octopus (Vulcanoctopus hydrothermalis): pale ghost-pink, bulbous mantle trailing behind a domed head, big dark eyes, eight webbed arms that crawl. */
export function ventOctopusGeometry() {
  const parts = [], BACK = 0xe6c8c0, BELLY = 0xf6e6df;
  const body = loft([
    [0.3, 0.004, 0.004, 0.004, 0.0], [0.27, 0.07, 0.07, 0.05, 0.0], [0.18, 0.13, 0.14, 0.08, 0.0], [0.05, 0.16, 0.17, 0.1, 0.0], [-0.1, 0.175, 0.2, 0.11, 0.0], [-0.24, 0.16, 0.2, 0.1, 0.0],
    [-0.36, 0.115, 0.15, 0.08, 0.0], [-0.44, 0.05, 0.07, 0.05, 0], [-0.475, 0.004, 0.01, 0.01, 0],
  ], { rings: 24, sides: 18, back: BACK, belly: BELLY, colorFn: (c, { z, s }) => { if (hash(Math.round(z * 50), Math.round(s * 7)) > 0.86) lerpC(c, 0xc09088, 0.5); lerpC(c, 0xd8a8a4, 0.25 * smooth(-0.1, -0.4, z)); } });
  parts.push(tag(body, 0, 0));
  for (const sd of [-1, 1]) {
    parts.push(tag(blob([sd * 0.12, 0.1, 0.17], [0.034, 0.038, 0.038], 0x2a2024, { w: 10, h: 8 })));
    parts.push(tag(blob([sd * 0.141, 0.104, 0.18], [0.013, 0.022, 0.022], 0x050304, { w: 6, h: 5 })));
  }
  const web = loft([[0.46, 0.004, 0.004, 0.004, -0.06], [0.42, 0.12, 0.02, 0.02, -0.07], [0.32, 0.22, 0.04, 0.04, -0.065], [0.2, 0.18, 0.07, 0.07, -0.04], [0.1, 0.14, 0.09, 0.08, -0.02]],
    { rings: 12, sides: 20, back: 0xdcb4ae, belly: 0xefd2cc });
  parts.push(tag(web, 0, 0));
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), k = hash(i, 2);
    const pts = [[ca * 0.08, sa * 0.06 - 0.05, 0.2, 0.058], [ca * 0.2, sa * 0.1 - 0.09, 0.34 + 0.02 * k, 0.046], [ca * 0.3, -0.13, 0.46 + 0.03 * k, 0.034], [ca * 0.36 + 0.04 * Math.sin(i), -0.15, 0.57 + 0.04 * k, 0.019], [ca * 0.38 + 0.1 * Math.sin(i * 2), -0.15, 0.65 + 0.04 * k, 0.006]];
    parts.push(tag(tube(pts, { segs: 10, sides: 6, color: 0xdcb8b0, colorFn: (c, { v }) => lerpC(c, 0xf2dcd6, v * 0.5) }), 0, (x, y, z) => smooth(0.3, 0.7, z)));
  }
  return assemble(parts);
}

/** For tests: triangle counts of every deep model. */
export const MODELS = {
  angler: anglerGeometry, gulper: gulperGeometry, vampire: vampireGeometry, dumbo: dumboGeometry, lantern: lanternGeometry, atolla: atollaGeometry,
  oarfish: oarfishGeometry, spermwhale: spermWhaleGeometry, isopod: isopodGeometry, yeti: yetiGeometry, shrimp: shrimpGeometry, ventoctopus: ventOctopusGeometry,
};
