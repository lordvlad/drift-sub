/**
 * Chunk decor for the rare rock formations (places defined in biomes-rock.js): sea-stack forests, blue holes,
 * natural bridges, basalt column fields, mushroom rocks and terraced rock pools. Same contract as landmarks.js:
 * every function is a pure function of (feature, chunk); the chunk owns what falls inside its square.
 */
import * as THREE from 'three';
import { mulberry32, hash2, createNoise } from './noise.js';
import { rockFormationTemplates, buildBridge, STACK_H, STACK_R, stackRadius, MUSH, mushRadius } from './models/landmarks-rock.js';

const nz = createNoise(5813);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const R = (rng, a, b) => a + rng() * (b - a);
const pickFrom = (rng, a) => a[Math.floor(rng() * a.length)];
const inChunk = (c, x, z) => x >= c.x0 && x < c.x0 + c.CS && z >= c.z0 && z < c.z0 + c.CS;
const UPN = [0, 1, 0];
const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _E = new THREE.Euler(), _Q = new THREE.Quaternion(), _S = new THREE.Vector3(1, 1, 1), _V = new THREE.Vector3();

let RTc = null;
const RT = () => RTc || (RTc = rockFormationTemplates(913));

/** one slice of start-up work per call (templates, then the bridge builder once): returns true while more steps remain */
export function warmRock(step) {
  if (step === 0) RT();
  else if (step === 1) buildBridge(1, { span: 14, height: 9.5, pier: 4.5, wz: 4.2 });
  return step < 1;
}

function coralColor(c, rng) { const tp = pickFrom(rng, c.CORAL_TINTS); return c.tint(rng() < 0.75 ? tp[0] : tp[1], (rng() - 0.5) * 0.2); }

/** a coral head / sea fan / pebbles at (x, z), owned by the caller's chunk test */
function growth(c, L, rng, x, z, s = 1) {
  const y = c.ground(x, z), r = rng();
  if (r < 0.4) c.out.place(pickFrom(rng, L.gorgonians), x, y - 0.1, z, rng() * 6.283, s, s, s, c.nrm, 0.1, coralColor(c, rng), 1);
  else if (r < 0.75) { c.out.place(pickFrom(rng, c.T.coral[rng() < 0.5 ? 0 : 5].list), x, y - 0.1, z, rng() * 6.283, s, s, s, UPN, 0, coralColor(c, rng)); c.corals.push(x, y + s * 0.5, z); }
  else c.out.place(pickFrom(rng, c.T.pebbles), x, y - 0.1, z, rng() * 6.283, s, s * 0.8, s, c.nrm, 0.5, c.tint(0x7a766e, 0));
}

// ------------------------------------------------------------------------------------------------------------ sea stacks
function stacks(f, c, rng, L) {
  const T = RT(), { out, colliders } = c;
  for (let i = 0; i < f.sp.length; i += 6) {
    const x = f.sp[i], z = f.sp[i + 1], h0 = f.sp[i + 2], rad = f.sp[i + 3], vk = f.sp[i + 4], yaw = f.sp[i + 5];
    if (!inChunk(c, x, z)) continue;
    const y = c.ground(x, z), h = Math.min(h0, -4.5 - y);
    if (h < 5) continue;
    const sy = h / STACK_H, sx = rad / STACK_R, shade = 0.9 + 0.2 * nz(x * 0.2, z * 0.2);
    out.place(T.stacks[vk], x, y, z, yaw, sx, sy, sx, UPN, 0, null, 1, shade);
    const nS = Math.max(4, Math.ceil(h / (rad * 1.0)));
    for (let k = 0; k < nS; k++) {
      const t = 0.03 + (0.97 * k) / (nS - 1), yy = y + sy * (-1 + t * (STACK_H + 1));
      colliders.push(x, yy, z, Math.max(0.9, STACK_R * stackRadius(t) * sx * 0.88), 1);
    }
    if (rng() < 0.6) { const a = rng() * 6.283, d = rad * R(rng, 1.4, 2.2), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (inChunk(c, px, pz)) growth(c, L, rng, px, pz, R(rng, 0.7, 1.3)); }
  }
}

// ------------------------------------------------------------------------------------------------------------ blue hole
function bluehole(f, c, rng, L) {
  const { out, colliders } = c;
  for (let i = 0; i < 34; i++) {
    const x = c.x0 + rng() * c.CS, z = c.z0 + rng() * c.CS, dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz), u = d / f.r;
    if (u < 0.7 || u > 1.6) continue;
    const r = rng();
    if (u > 0.92 && r < 0.55) growth(c, L, rng, x, z, R(rng, 0.8, 1.5));                       // life on the rim and the lip
    else {
      const y = c.ground(x, z), s = R(rng, 0.7, 2.2), rt = c.tint(0x777066, (rng() - 0.5) * 0.3);
      out.place(pickFrom(rng, c.T.rocks), x, y - s * 0.2, z, rng() * 6.283, s, s * R(rng, 0.8, 1.2), s, c.nrm, 0.4, rt);
      if (s > 1.3) colliders.push(x, y + s * 0.2, z, s * 0.85, 1);
    }
  }
}

// ------------------------------------------------------------------------------------------------------------ natural bridge
const asmCache = new Map();
function assembly(f) {
  let a = asmCache.get(f.id);
  if (a) return a;
  a = buildBridge(f.odd, { span: f.span, height: f.height, pier: f.pier, wz: f.wz });
  if (asmCache.size >= 4) asmCache.delete(asmCache.keys().next().value);
  asmCache.set(f.id, a);
  return a;
}
function bridge(f, c, rng, L) {
  const asm = assembly(f), { out, colliders } = c;
  _E.set(0, f.yaw, 0); const M = _M.compose(_P.set(f.x, f.y0, f.z), _Q.setFromEuler(_E), _S).clone();
  for (const pc of asm.pieces) {
    _V.set(pc.cx, pc.cy, pc.cz).applyMatrix4(M);
    if (!inChunk(c, _V.x, _V.z)) continue;
    out.placeM(pc.tpl, M, null);
    for (const k of pc.colliders) { _V.set(k[0], k[1], k[2]).applyMatrix4(M); colliders.push(_V.x, _V.y, _V.z, k[3], k[4] ?? 1); }
  }
  for (let i = 0; i < 10; i++) {        // coral and fans clinging to the feet of the piers
    _V.set(R(rng, -asm.A * 0.85, asm.A * 0.85), 0, (rng() < 0.5 ? -1 : 1) * (asm.wz + R(rng, 1, 3))).applyMatrix4(M);
    if (inChunk(c, _V.x, _V.z)) growth(c, L, rng, _V.x, _V.z, R(rng, 0.7, 1.4));
  }
  for (let i = 0; i < 14; i++) {         // rubble and weed around the feet
    const a = rng() * 6.283, d = asm.A * Math.sqrt(rng()) * 1.05, x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
    if (!inChunk(c, x, z)) continue;
    const y = c.ground(x, z), s = R(rng, 0.5, 1.4);
    out.place(pickFrom(rng, c.T.rocks), x, y - s * 0.2, z, rng() * 6.283, s, s, s, c.nrm, 0.3, c.tint(0x777066, (rng() - 0.5) * 0.3));
    if (s > 1.2) colliders.push(x, y + s * 0.2, z, s * 0.85, 1);
  }
}

// ------------------------------------------------------------------------------------------------------------ basalt columns
const RHO = 1.7;
function basalt(f, c, rng, L) {
  const T = RT(), { out, colliders } = c, ca = Math.cos(f.ang), sa = Math.sin(f.ang), gc = Math.cos(f.o), gs = Math.sin(f.o);
  const pitch = Math.sqrt(3) * RHO, nR = Math.ceil((f.r * 1.2) / (RHO * 1.5)) + 1;
  for (let ri = -nR; ri <= nR; ri++) {
    for (let qi = -nR - 2; qi <= nR + 2; qi++) {
      const lx = pitch * (qi + ri / 2), lz = 1.5 * RHO * ri, x = f.x + lx * ca + lz * sa, z = f.z - lx * sa + lz * ca;
      if (!inChunk(c, x, z)) continue;
      const rc = mulberry32(hash2(qi + 400, ri + 400, f.id)), d = Math.hypot(lx, lz) / f.r;
      if (d > 1.1 + 0.12 * nz(lx * 0.1, lz * 0.1)) continue;
      const u = (lx * gc + lz * gs) / f.r;
      let h = 0.5 + f.tall * sstep(-0.8, 0.8, u + 0.25 * nz(lx * 0.08, lz * 0.08));
      h = Math.round(h / 0.75) * 0.75 + (rc() - 0.5) * 0.4;
      h = 0.35 + (h - 0.35) * (1 - sstep(0.78, 1.1, d));
      if (rc() < 0.06) h *= 0.45;
      if (h < 0.3) continue;
      const gy = c.ground(x, z), top = f.y0 + h, base = Math.min(f.y0 - 2.5, gy - 0.6);
      if (top < gy + 0.1) continue;
      out.place(T.columns[Math.floor(rc() * 4)], x, base, z, f.ang + (rc() - 0.5) * 0.12, RHO * (0.94 + rc() * 0.08), top - base, RHO * (0.94 + rc() * 0.08), UPN, 0, null, 1, 0.9 + rc() * 0.22);
      colliders.push(x, top - RHO * 0.9, z, RHO * 1.0, 1);
      for (let yy = top - RHO * 0.9 - RHO * 1.5; yy > Math.max(base, gy) + RHO * 0.3; yy -= RHO * 1.5) colliders.push(x, yy, z, RHO * 1.0, 1);
    }
  }
  for (let i = 0; i < 6; i++) {          // a few anemone-like tufts of weed and pebbles between the columns' feet
    const a = rng() * 6.283, d = f.r * R(rng, 1.12, 1.45), x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
    if (!inChunk(c, x, z)) continue;
    growth(c, L, rng, x, z, R(rng, 0.7, 1.2));
  }
}

// ------------------------------------------------------------------------------------------------------------ mushroom rocks
function mushroom(f, c, rng, L) {
  const T = RT(), { out, colliders } = c;
  for (let i = 0; i < f.sp.length; i += 6) {
    const x = f.sp[i], z = f.sp[i + 1], sc = f.sp[i + 2], vk = f.sp[i + 3], yaw = f.sp[i + 4];
    if (!inChunk(c, x, z)) continue;
    const y = c.ground(x, z), M = MUSH[vk], shade = 0.9 + 0.2 * nz(x * 0.2, z * 0.2);
    if (y + sc * (M.H - 0.7) > -4) continue;
    out.place(T.mushrooms[vk], x, y, z, yaw, sc, sc, sc, UPN, 0, null, 1, shade);
    for (const t of [0.1, 0.24, 0.38, 0.52]) colliders.push(x, y + sc * (-0.7 + t * (M.H + 0.7)), z, Math.max(0.8, mushRadius(vk, t) * sc * 0.92), 1);
    const capY = y + sc * (-0.7 + 0.83 * (M.H + 0.7)), cr = M.RC * sc;
    colliders.push(x, capY, z, cr * 0.5, 1);
    for (let k = 0; k < 6; k++) { const a = yaw + (k * Math.PI) / 3; colliders.push(x + Math.cos(a) * cr * 0.62, capY - 0.1 * sc, z + Math.sin(a) * cr * 0.62, cr * 0.36, 1); }
    if (rng() < 0.7) { const a = rng() * 6.283, d = M.RS * sc * R(rng, 2, 3.5), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (inChunk(c, px, pz)) growth(c, L, rng, px, pz, R(rng, 0.6, 1.2)); }
  }
}

// ------------------------------------------------------------------------------------------------------------ terraces
function terrace(f, c, rng, L) {
  const places = c.field.places, { out, colliders } = c;
  for (let i = 0; i < 220; i++) {
    const x = c.x0 + rng() * c.CS, z = c.z0 + rng() * c.CS;
    if (Math.hypot(x - f.x, z - f.z) >= f.R) continue;
    const q = places.rocks.terraceLocal(f, x, z);
    if (q.q > 1.0) continue;
    if (q.t > 0.8 && q.t < 0.99) {                                     // rimstone-like dams along the step edges
      if (rng() > 0.55) continue;
      const y = c.ground(x, z), s = R(rng, 1.0, 2.2);
      out.place(pickFrom(rng, c.T.rocks), x, y - s * 0.3, z, rng() * 6.283, s * 1.2, s * 0.75, s * 1.2, c.nrm, 0.3, c.tint(0xd8cfb4, (rng() - 0.5) * 0.25));
      colliders.push(x, y + s * 0.15, z, s * 0.95, 1);
    } else if (q.t < 0.6 && rng() < 0.05) growth(c, L, rng, x, z, R(rng, 0.7, 1.3));
  }
}

/** DECOR table entries for landmarks.js: (feature, chunk, rng) with the shared landmark templates passed in */
export function rockDecor(getLT) {
  const wrap = (fn) => (f, c, rng) => fn(f, c, rng, getLT());
  return { stacks: wrap(stacks), bluehole: wrap(bluehole), bridge: wrap(bridge), basalt: wrap(basalt), mushroom: wrap(mushroom), terrace: wrap(terrace) };
}
