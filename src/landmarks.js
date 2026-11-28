/**
 * Chunk decor for the landmark places (see biomes.js): big reefs, hydrothermal vents, magma rifts, volcanoes,
 * caves, arches, wrecks, rock gardens, canyons. Called from terrain.js while a chunk is built.
 *
 * Every function here is a pure function of (feature, chunk): the chunk owns whatever falls inside its square
 * (elements are assigned to the chunk that contains their centre), colliders / emitters / heat spheres are
 * pushed into the chunk's lists, and nothing is cached except the (bounded) assembly meshes of structures.
 */
import * as THREE from 'three';
import { mulberry32, hash2, createNoise } from './noise.js';
import { PLUME } from './plumes.js';
import { buildLandmarkTemplates, buildWreck, buildArch, buildCave } from './models/landmarks.js';
import { rareAssembly, rareExtras } from './landmarks-wrecks.js';
import { FK, coralKind, weedKind } from './templates.js';
import { rockDecor, warmRock } from './landmarks-rock.js';

let LTcache = null;
const LT = () => LTcache || (LTcache = buildLandmarkTemplates(777));
const nz = createNoise(4711);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _E = new THREE.Euler(), _Q = new THREE.Quaternion(), _S = new THREE.Vector3(1, 1, 1);
const _ri = {};

const inChunk = (c, x, z) => x >= c.x0 && x < c.x0 + c.CS && z >= c.z0 && z < c.z0 + c.CS;
const rectDist = (c, x, z) => Math.hypot(Math.max(c.x0 - x, 0, x - (c.x0 + c.CS)), Math.max(c.z0 - z, 0, z - (c.z0 + c.CS)));

/** one slice of start-up work per call (templates, then each assembly builder once to warm it up): avoids a hitch the first time a chunk needs them */
export function warmLandmarks(step) {
  if (step === 0) LT();
  else if (step === 1) buildCave(1, { length: 30, radius: 4 });
  else if (step === 2) buildWreck(2, { length: 32, beam: 9 });
  else if (step === 3) buildArch(3, { span: 18, height: 11, thick: 4 });
  else if (step === 4 || step === 5) warmRock(step - 4);
  return step < 5;
}

export function decorLandmarks(c) {
  const list = c.field.places.near(c.x0 + c.CS * 0.5, c.z0 + c.CS * 0.5);
  for (const f of list) {
    const fn = DECOR[f.type];
    if (!fn || rectDist(c, f.x, f.z) >= f.R) continue;
    fn(f, c, mulberry32(hash2(c.cx, c.cz, f.id)));
  }
}

let _ti = 0, _wi = 0;   // index of the last palette colour / weed tint picked (for flora ids)
/** tint a template instance with a coral palette colour */
function coralColor(c, rng, pal) { const tp = pal[Math.floor(rng() * pal.length)]; _ti = c.CORAL_TINTS.indexOf(tp); return c.tint(rng() < 0.75 ? tp[0] : tp[1], (rng() - 0.5) * 0.2); }
function weedTint(c, rng) { _wi = Math.floor(rng() * c.WEED_TINTS.length); return c.WEED_TINTS[_wi]; }
const pickFrom = (rng, a) => a[Math.floor(rng() * a.length)];
const R = (rng, a, b) => a + rng() * (b - a);

// ------------------------------------------------------------------------------------------------------------ big reef
function bigreef(f, c, rng) {
  const { field, T, out, colliders, corals, weeds } = c, L = LT(), places = field.places;
  const palette = c.CORAL_TINTS;   // every reef is colourful: each patch picks its own two hues
  const info = _ri; let stdN = 0, bigN = 0;
  const rel = (y) => clamp((y - f.plat) / f.amp, 0, 1.3);
  // dense coral patches (standard coral templates)
  for (let k = 0; k < 14 && stdN < 80; k++) {
    const px = c.x0 + rng() * c.CS, pz = c.z0 + rng() * c.CS;
    places.reefInfo(f, px, pz, info);
    if (info.w < 0.25) continue;
    const y0 = field.heightAt(px, pz), rl = rel(y0);
    if (info.lag > 0.5 || rng() > info.w * (0.3 + 0.7 * Math.min(1, rl * 1.2))) continue;
    const pr = R(rng, 3, 7), n = Math.min(Math.floor(R(rng, 10, 22) * pr / 5), 80 - stdN); stdN += n;
    const pal = [pickFrom(rng, palette), pickFrom(rng, palette)];
    const weights = [R(rng, 0, 3), R(rng, 0, 2), R(rng, 0, 1.4), R(rng, 0, 1.5), R(rng, 0, 2), R(rng, 0, 0.8)];
    const wsum = weights.reduce((a, b) => a + b, 0.0001);
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.283, d = pr * Math.sqrt(rng()), x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
      let r = rng() * wsum, ki = 0; while (ki < 5 && r > weights[ki]) { r -= weights[ki]; ki++; }
      const y = c.ground(x, z), s = R(rng, 0.8, 2.0) * (ki === 5 ? 0.8 : 1);
      out.place(pickFrom(rng, T.coral[ki].list), x, y, z, rng() * 6.283, s, s * R(rng, 0.8, 1.3), s, c.nrm, 0.35, coralColor(c, rng, pal));
      corals.push(x, y + s * 0.5, z);
      c.addFlora(coralKind(ki, _ti), x, y, z, s);
      if (ki === 1 || (ki === 2 && s > 1.4)) colliders.push(x, y + s * (ki === 1 ? 0.2 : 0.7), z, s * (ki === 1 ? 0.9 : 1.2), 0.6);
    }
  }
  // showpieces: bommies, towers, table plates, thickets, sea fans
  for (let k = 0; k < 44 && bigN < 16; k++) {
    const x = c.x0 + rng() * c.CS, z = c.z0 + rng() * c.CS;
    places.reefInfo(f, x, z, info);
    if (info.w < 0.3) continue;
    const y = c.ground(x, z), rl = rel(y), lag = info.lag, roll = rng();
    const yaw = rng() * 6.283, col = coralColor(c, rng, palette);
    if (lag > 0.5) {                          // lagoon: lone bommies and thickets on sand
      if (roll < 0.1) { const s = R(rng, 0.8, 1.5); out.place(pickFrom(rng, L.bommies), x, y - 0.2, z, yaw, s, s, s, c.nrm, 0.3, col); colliders.push(x, y + 1.2 * s, z, 2.6 * s, 0.6); corals.push(x, y + 1.5 * s, z); c.addFlora(FK.porites, x, y, z, s); bigN++; }
      else if (roll < 0.22) { const s = R(rng, 0.9, 1.4); out.place(pickFrom(rng, L.thickets), x, y, z, yaw, s, s, s, c.nrm, 0.3, col); corals.push(x, y + s, z); c.addFlora(FK.staghorn, x, y, z, s); bigN++; }
      continue;
    }
    if (rng() > info.w) continue;
    if (rl > 0.62 && roll < 0.36) {           // crest: coral towers
      const s = R(rng, 0.8, 1.5), tpl = pickFrom(rng, L.towers);
      out.place(tpl, x, y - 0.3, z, yaw, s, s * R(rng, 0.9, 1.3), s, c.nrm, 0.15, col);
      for (const [hy, hr] of [[1.4, 1.35], [3.5, 1.1], [5.5, 0.9]]) colliders.push(x, y + hy * s, z, hr * s, 0.6);
      corals.push(x, y + 3 * s, z); bigN++;
      c.addFlora(FK['pillar-coral'], x, y, z, s);
    } else if (rl > 0.2 && roll < 0.58) {     // slopes: table-coral plates
      const s = R(rng, 0.9, 1.5);
      out.place(pickFrom(rng, L.plates), x, y - 0.2, z, yaw, s, s, s, c.nrm, 0.2, col);
      colliders.push(x, y + 1.0 * s, z, 0.9 * s, 0.6); colliders.push(x, y + 2.35 * s, z, 2.2 * s, 0.6);
      corals.push(x, y + 2.4 * s, z); bigN++;
      c.addFlora(FK['table-coral'], x, y, z, s);
    } else if (roll < 0.76) {                 // bommies
      const s = R(rng, 0.8, 1.7);
      out.place(pickFrom(rng, L.bommies), x, y - 0.25, z, yaw, s, s, s, c.nrm, 0.25, col);
      colliders.push(x, y + 1.2 * s, z, 2.6 * s, 0.6); corals.push(x, y + 1.5 * s, z); bigN++;
      c.addFlora(FK.porites, x, y, z, s);
    } else if (roll < 0.9) {
      const s = R(rng, 0.9, 1.5); out.place(pickFrom(rng, L.thickets), x, y, z, yaw, s, s, s, c.nrm, 0.3, col); corals.push(x, y + s, z); bigN++;
      c.addFlora(FK.staghorn, x, y, z, s);
    } else {                                  // gorgonian fans
      const s = R(rng, 0.8, 1.5); out.place(pickFrom(rng, L.gorgonians), x, y - 0.1, z, yaw, s, s, s, c.nrm, 0.1, c.tint(pickFrom(rng, [0xd24c8c, 0xe08a3a, 0xb04ad0, 0xe0d040]), (rng() - 0.5) * 0.2), 1);
      corals.push(x, y + 1.4 * s, z); bigN++;
      c.addFlora(FK['sea-fan'], x, y, z, s);
    }
  }
  // soft corals and sea whips: cheap waving tufts in coral colours, clumped over the reef
  for (let k = 0; k < 9; k++) {
    const px = c.x0 + rng() * c.CS, pz = c.z0 + rng() * c.CS;
    places.reefInfo(f, px, pz, info);
    if (info.w < 0.3 || info.lag > 0.6 || rng() > info.w) continue;
    const pr = R(rng, 2.5, 5), n = Math.floor(R(rng, 10, 18)), pal = pickFrom(rng, palette), tall = rng() < 0.4;
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.283, d = pr * Math.sqrt(rng()), x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d, y = c.ground(x, z), s = R(rng, 0.7, 1.4);
      out.place(pickFrom(rng, tall ? T.tall : T.grass), x, y - 0.05, z, rng() * 6.283, s, s * R(rng, 0.8, 1.2), s, c.nrm, 0.1, c.tint(pal[rng() < 0.7 ? 0 : 1], (rng() - 0.5) * 0.25));
      c.addFlora(tall ? FK['sea-whip'] : FK['soft-coral'], x, y, z, s);
    }
  }
  // seagrass and weed in the sandy lagoon and between the ridges
  let weedN = 0;
  for (let k = 0; k < 10 && weedN < 120; k++) {
    const px = c.x0 + rng() * c.CS, pz = c.z0 + rng() * c.CS;
    places.reefInfo(f, px, pz, info);
    if (info.w < 0.3 || rng() > 0.35 + info.lag * 0.55) continue;
    const kind = rng() < 0.7 ? 'grass' : 'tall', pr = R(rng, 2.5, 5), n = Math.floor(R(rng, 10, 24) * pr / 4);
    const baseTint = pickFrom(rng, c.WEED_TINTS);
    for (let i = 0; i < n && weedN < 120; i++, weedN++) {
      const a = rng() * 6.283, d = pr * Math.sqrt(rng()), x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d, y = c.ground(x, z);
      const s = R(rng, 0.8, 1.4);
      out.place(pickFrom(rng, kind === 'grass' ? T.grass : T.tall), x, y - 0.05, z, rng() * 6.283, s, s * R(rng, 0.8, 1.2), s, c.nrm, 0.1, c.tint(baseTint, (rng() - 0.5) * 0.3));
      weeds.push(x, y, z, (kind === 'grass' ? 2 : 4) * s);
      c.addFlora(weedKind(kind, c.WEED_TINTS.indexOf(baseTint)), x, y, z, s);
    }
  }
}

// ------------------------------------------------------------------------------------------------------------ vents
const MINERAL = [0xffffff, 0xf0d8c0, 0xe8c8a0, 0xd8b090];
function vent(f, c, rng) {
  const { field, T, out, colliders, emitters } = c, L = LT();
  const tw = L.tubeworms, mats = L.mats;
  const wormTint = () => c.tint(0xffffff, (rng() - 0.5) * 0.2);
  const group = (x, z, s) => { // worms, mats and small diffusers around a chimney
    const nw = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < nw; i++) {
      const a = rng() * 6.283, d = s * R(rng, 1.4, 4.2), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = c.ground(px, pz), ws = R(rng, 0.7, 1.5);
      out.place(pickFrom(rng, tw), px, py - 0.05, pz, rng() * 6.283, ws, ws * R(rng, 0.8, 1.3), ws, c.nrm, 0.3, wormTint());
      c.addFlora(FK['tube-worm'], px, py, pz, ws);
    }
    const nm = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < nm; i++) {
      const a = rng() * 6.283, d = s * R(rng, 0.8, 5), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = c.ground(px, pz), ms = R(rng, 0.9, 2.2);
      out.place(pickFrom(rng, mats), px, py + 0.03, pz, rng() * 6.283, ms, 1, ms, c.nrm, 0.9, c.tint(pickFrom(rng, MINERAL), (rng() - 0.5) * 0.25));
      c.addFlora(FK['microbial-mat'], px, py, pz, ms);
    }
    if (rng() < 0.7) {
      const a = rng() * 6.283, d = s * R(rng, 2.2, 5), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = c.ground(px, pz), ss = R(rng, 0.7, 1.3), tpl = pickFrom(rng, L.chimneysSmall);
      out.place(tpl, px, py - 0.15, pz, rng() * 6.283, ss, ss, ss, c.nrm, 0.2, null);
      if (tpl.top) emitters.push(px, py - 0.15 + tpl.top[1] * ss, pz, PLUME.WHITE, 0.55 * ss, 0.8);
    }
  };
  for (let i = 0; i < f.ch.length; i += 5) {
    const x = f.ch[i], z = f.ch[i + 1], s = f.ch[i + 2];
    if (!inChunk(c, x, z)) continue;
    const tpl = L.chimneys[f.ch[i + 3] % L.chimneys.length], yaw = f.ch[i + 4] * 6.283, y = c.ground(x, z) - 0.3 * s;
    out.place(tpl, x, y, z, yaw, s, s, s, c.nrm, 0.15, null);
    const h = (tpl.h || 5) * s, r0 = (tpl.r || 1.3) * s;
    for (const t of [0.12, 0.42, 0.72]) colliders.push(x, y + t * h, z, r0 * (1 - t * 0.6) * 1.05, 1);
    const top = tpl.top || [0, tpl.h || 5, 0], cy = Math.cos(yaw), sy = Math.sin(yaw);
    const tx = x + (top[0] * cy + top[2] * sy) * s, tz = z + (-top[0] * sy + top[2] * cy) * s, ty = y + top[1] * s;
    emitters.push(tx, ty, tz, PLUME.BLACK, s, 1.0);
    if (s > 0.9) emitters.push(tx, ty, tz, PLUME.SHIMMER, s, 0.8);
    group(x, z, Math.max(1, s));
  }
  // loose worms / mats / rubble across the field
  const n = 10 + Math.floor(f.r * 0.12);
  for (let i = 0; i < n; i++) {
    const x = c.x0 + rng() * c.CS, z = c.z0 + rng() * c.CS, d = Math.hypot(x - f.x, z - f.z);
    if (d > f.r * 1.1 || rng() > 1 - sstep(f.r * 0.2, f.r * 1.15, d)) continue;
    const y = c.ground(x, z), r = rng();
    if (r < 0.4) { const ws = R(rng, 0.7, 1.4); out.place(pickFrom(rng, tw), x, y - 0.05, z, rng() * 6.283, ws, ws, ws, c.nrm, 0.3, wormTint()); c.addFlora(FK['tube-worm'], x, y, z, ws); }
    else if (r < 0.75) { const ms = R(rng, 1, 2.4); out.place(pickFrom(rng, mats), x, y + 0.03, z, rng() * 6.283, ms, 1, ms, c.nrm, 0.9, c.tint(pickFrom(rng, MINERAL), (rng() - 0.5) * 0.25)); c.addFlora(FK['microbial-mat'], x, y, z, ms); }
    else { const s = R(rng, 0.6, 2); const rt = c.tint(0x6b5a4c, (rng() - 0.5) * 0.3); out.place(pickFrom(rng, T.rocks), x, y - s * 0.2, z, rng() * 6.283, s, s, s, c.nrm, 0.3, rt); if (s > 1.3) colliders.push(x, y + s * 0.2, z, s * 0.85, 1); }
  }
}

// ------------------------------------------------------------------------------------------------------------ lava
/** a glowing lava ribbon following the ground along a polyline, owned segment by segment by the chunk containing its midpoint */
function lavaLine(c, rng, line, width, pinch = true, sparks = 1) {
  const { out, emitters, heat } = c, p = line.pts;
  let acc = 0;
  for (let s = 0; s + 1 < line.len.length + 1 && s * 2 + 3 < p.length; s++) {
    const ax = p[s * 2], az = p[s * 2 + 1], bx = p[s * 2 + 2], bz = p[s * 2 + 3], len = line.len[s];
    const n = Math.max(1, Math.ceil(len / 1.5)), dx = (bx - ax) / n, dz = (bz - az) / n, px = -dz, pz = dx, pl = Math.hypot(px, pz) || 1;
    const nxu = px / pl, nzu = pz / pl;
    for (let i = 0; i < n; i++) {
      const x0 = ax + dx * i, z0 = az + dz * i, x1 = x0 + dx, z1 = z0 + dz;
      const t0 = (acc + len * i / n) / line.total, t1 = (acc + len * (i + 1) / n) / line.total;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (!inChunk(c, mx, mz)) continue;
      const wf = (t) => width * (0.55 + 0.75 * Math.abs(nz(x0 * 0.13 + t * 7, z0 * 0.13))) * (pinch ? clamp(Math.min(t, 1 - t) * 9 + 0.15, 0, 1) : 1);
      const w0 = wf(t0), w1 = wf(t1);
      const v = (x, z, k, dy) => c.field.heightAt(x, z) + dy;
      const L0x = x0 - nxu * w0, L0z = z0 - nzu * w0, R0x = x0 + nxu * w0, R0z = z0 + nzu * w0;
      const L1x = x1 - nxu * w1, L1z = z1 - nzu * w1, R1x = x1 + nxu * w1, R1z = z1 + nzu * w1;
      const yl0 = v(L0x, L0z, 0, 0.14), ym0 = v(x0, z0, 0, 0.26), yr0 = v(R0x, R0z, 0, 0.14);
      const yl1 = v(L1x, L1z, 0, 0.14), ym1 = v(x1, z1, 0, 0.26), yr1 = v(R1x, R1z, 0, 0.14);
      const flick = 0.85 + 0.3 * nz(mx * 0.4, mz * 0.4);
      const E = [0.3 * flick, 0.06, 0.01], M = [0.55, 0.26 * flick, 0.07];
      const q = (X, Y, Z, edge) => out.v(X, Y, Z, 0, 1, 0, edge ? E[0] : M[0], edge ? E[1] : M[1], edge ? E[2] : M[2], 0, edge ? 0.55 : 1.0);
      q(L0x, yl0, L0z, 1); q(x0, ym0, z0, 0); q(x1, ym1, z1, 0);
      q(L0x, yl0, L0z, 1); q(x1, ym1, z1, 0); q(L1x, yl1, L1z, 1);
      q(x0, ym0, z0, 0); q(R0x, yr0, R0z, 1); q(R1x, yr1, R1z, 1);
      q(x0, ym0, z0, 0); q(R1x, yr1, R1z, 1); q(x1, ym1, z1, 0);
      if ((i + s * 3) % 2 === 0) heat.push(mx, ym0 + 0.4, mz, 3.2);
      if (sparks && (s * 7 + i) % 9 === 0) {
        emitters.push(mx, ym0 + 0.2, mz, PLUME.SPARK, 0.5 + rng() * 0.4, 0.5 * sparks);
        if (rng() < 0.5) emitters.push(mx, ym0, mz, PLUME.BUBBLE, 0.5, 0.7);
        if (rng() < 0.4) emitters.push(mx, ym0 + 0.3, mz, PLUME.SHIMMER, 0.6, 0.7);
      }
    }
    acc += len;
  }
}

/** dark basalt blocks, columns and pillows near lava lines */
function lavaBlocks(c, rng, line, density, reach) {
  const L = LT(), { out, colliders } = c;
  for (let s = 0; s + 1 < line.len.length + 1 && s * 2 + 3 < line.pts.length; s++) {
    const p = line.pts, len = line.len[s], n = Math.floor(len * density);
    const px = -(p[s * 2 + 3] - p[s * 2 + 1]) / len, pz = (p[s * 2 + 2] - p[s * 2]) / len;
    for (let i = 0; i < n; i++) {
      const t = rng(), side = rng() < 0.5 ? -1 : 1, off = side * R(rng, 1.6, reach) * (rng() < 0.7 ? 1 : 2.2);
      const x = p[s * 2] + (p[s * 2 + 2] - p[s * 2]) * t + px * off, z = p[s * 2 + 1] + (p[s * 2 + 3] - p[s * 2 + 1]) * t + pz * off;
      const r = rng(), yaw = rng() * 6.283, sc = R(rng, 0.8, 1.6);
      if (!inChunk(c, x, z)) continue;
      const y = c.ground(x, z);
      if (r < 0.45) { out.place(pickFrom(rng, L.lavaRocks), x, y - 0.1, z, yaw, sc, sc, sc, c.nrm, 0.3, null); if (sc > 1.1) colliders.push(x, y + 0.4 * sc, z, 0.8 * sc, 1); }
      else if (r < 0.7) { out.place(pickFrom(rng, L.pillows), x, y - 0.1, z, yaw, sc, sc, sc, c.nrm, 0.4, null); }
      else if (r < 0.85) { out.place(pickFrom(rng, L.basalt), x, y - 0.2, z, yaw, sc, sc, sc, c.nrm, 0.2, null); colliders.push(x, y + 0.9 * sc, z, 1.0 * sc, 1); }
      else { const rt = c.tint(0x5a5650, (rng() - 0.5) * 0.25), s2 = R(rng, 0.8, 2.6); out.place(pickFrom(rng, c.T.rocks), x, y - s2 * 0.2, z, yaw, s2, s2, s2, c.nrm, 0.3, rt); if (s2 > 1.2) colliders.push(x, y + s2 * 0.2, z, s2 * 0.85, 1); }
    }
  }
}

function magma(f, c, rng) {
  f.lines.forEach((ln, i) => { lavaLine(c, rng, ln, f.w * (i === 0 ? 1 : 0.7), true, i === 0 ? 1 : 0.7); lavaBlocks(c, rng, ln, i === 0 ? 0.35 : 0.22, 6); });
}

function volcano(f, c, rng) {
  const L = LT(), { out, colliders, emitters, heat } = c, field = c.field;
  const yR = -f.summit, yF = yR - 4.8, lakeY = yF + 0.5, lakeR = f.craterR * 0.82;
  const ca = Math.cos(f.ea), sa = Math.sin(f.ea);
  const lakePt = (th, k) => { const a = Math.cos(th) * k / f.ell, b = Math.sin(th) * k * f.ell; return [f.x + a * ca - b * sa, f.z + a * sa + b * ca]; };
  if (f.lake && inChunk(c, f.x, f.z)) {
    const N = 30;
    for (let i = 0; i < N; i++) {
      const t0 = i / N * 6.283, t1 = (i + 1) / N * 6.283;
      const r0 = lakeR * (0.9 + 0.1 * nz(Math.cos(t0) * 2 + f.o, Math.sin(t0) * 2)), r1 = lakeR * (0.9 + 0.1 * nz(Math.cos(t1) * 2 + f.o, Math.sin(t1) * 2));
      const A = lakePt(t0, r0), B = lakePt(t1, r1), Am = lakePt(t0, r0 * 0.5), Bm = lakePt(t1, r1 * 0.5);
      const fl = 0.85 + 0.3 * nz(i * 0.7 + f.o, 3.3);
      const q = (p, y, k) => out.v(p[0], y, p[1], 0, 1, 0, 0.35 + 0.25 * k, 0.07 + 0.2 * k * fl, 0.01 + 0.05 * k, 0, 0.7 + 0.3 * k * fl);
      const C = [f.x, f.z];
      q(Am, lakeY + 0.05, 0.6); q(Bm, lakeY + 0.05, 0.6); q(C, lakeY + 0.08, 1);
      q(A, lakeY, 0.2); q(B, lakeY, 0.2); q(Bm, lakeY + 0.05, 0.6);
      q(A, lakeY, 0.2); q(Bm, lakeY + 0.05, 0.6); q(Am, lakeY + 0.05, 0.6);
    }
    heat.push(f.x, lakeY + 1.2, f.z, lakeR + 5);
    heat.push(f.x + ca * lakeR * 0.5, lakeY + 0.8, f.z + sa * lakeR * 0.5, lakeR * 0.8 + 3);
  }
  if (f.lake) {  // crater plume: ash, embers, bubbles, hot smoke (owned by the chunk holding each emitter position)
    for (let i = 0; i < 9; i++) {
      const th = i / 9 * 6.283 + f.o, k = lakeR * (i % 3 === 0 ? 0.2 : 0.7), p = lakePt(th, k);
      if (!inChunk(c, p[0], p[1])) continue;
      emitters.push(p[0], lakeY + 0.3, p[1], PLUME.SPARK, 1.0 + (i % 2) * 0.4, 1.4);
      if (i % 3 === 0) emitters.push(p[0], lakeY + 0.5, p[1], PLUME.ASH, 1.0, 1.0);
      if (i % 3 === 1) emitters.push(p[0], lakeY + 0.2, p[1], PLUME.BUBBLE, 1.0, 1.3);
      if (i % 4 === 2) emitters.push(p[0], lakeY + 0.5, p[1], PLUME.BLACK, 0.7, 0.8);
      if (i % 3 === 2) emitters.push(p[0], lakeY + 0.5, p[1], PLUME.SHIMMER, 1.4, 1.0);
    }
  }
  // lava rivulets running down the flanks
  for (const rv of f.rivers) { lavaLine(c, rng, rv, 0.85, true, 0.5); lavaBlocks(c, rng, rv, 0.18, 5); }
  // boulders, basalt columns and pillows over the cone
  const n = 22;
  for (let i = 0; i < n; i++) {
    const x = c.x0 + rng() * c.CS, z = c.z0 + rng() * c.CS, d = field.places.volcanoD(f, x, z);
    if (d > f.r * 0.98 || d < f.craterR) continue;
    const y = c.ground(x, z), r = rng(), yaw = rng() * 6.283, sc = R(rng, 0.8, 1.8), up = 1 - d / f.r;
    if (r < 0.28 + up * 0.15) { out.place(pickFrom(rng, L.basalt), x, y - 0.25, z, yaw, sc, sc * R(rng, 0.8, 1.6), sc, c.nrm, 0.2, null); colliders.push(x, y + 0.9 * sc, z, 1.0 * sc, 1); }
    else if (r < 0.55) out.place(pickFrom(rng, L.pillows), x, y - 0.1, z, yaw, sc * 1.2, sc * 1.2, sc * 1.2, c.nrm, 0.4, null);
    else if (r < 0.7) { out.place(pickFrom(rng, L.lavaRocks), x, y - 0.1, z, yaw, sc, sc, sc, c.nrm, 0.3, null); if (sc > 1.1) colliders.push(x, y + 0.4 * sc, z, 0.8 * sc, 1); }
    else { const s = R(rng, 1.2, 4.5), rt = c.tint(0x55514d, (rng() - 0.5) * 0.25); out.place(pickFrom(rng, c.T.rocks), x, y - s * 0.22, z, yaw, s, s * R(rng, 0.8, 1.3), s, c.nrm, 0.3, rt); colliders.push(x, y + s * 0.2, z, s * 0.85, 1); }
  }
}

// ------------------------------------------------------------------------------------------------------------ structures
const asmCache = new Map();
function assembly(f) {
  const key = f.rare ? f.rare.id : f.id;
  let a = asmCache.get(key);
  if (a) return a;
  a = f.rare ? rareAssembly(f) : f.type === 'wreck' ? buildWreck(f.odd, { length: f.length, beam: f.beam })
    : f.type === 'arch' ? buildArch(f.odd, { span: f.span, height: f.height, thick: f.thick })
      : buildCave(f.odd, { length: f.length, radius: f.radius });
  if (asmCache.size >= 6) asmCache.delete(asmCache.keys().next().value);
  asmCache.set(key, a);
  return a;
}
function placement(f, M) {
  if (f.type === 'wreck') {
    _E.set(f.pitch, f.yaw, f.heel, 'YXZ');
    _Q.setFromEuler(_E);
    // heel about the keel line: rotate then drop so the low side is buried and the hull sits in the pad
    M.compose(_P.set(f.ox, f.y0 - 0.9 + (f.dy || 0), f.oz), _Q, _S);
  } else {
    _E.set(0, f.yaw, 0);
    M.compose(_P.set(f.ox, f.y0, f.oz), _Q.setFromEuler(_E), _S);
  }
  return M;
}
const TINT_NONE = null;
function structure(f, c, rng) {
  const asm = assembly(f), M = placement(f, _M.clone()), { out, colliders } = c, L = LT();
  const v = new THREE.Vector3();
  for (const pc of asm.pieces) {
    v.set(pc.cx, pc.cy, pc.cz).applyMatrix4(M);
    if (!inChunk(c, v.x, v.z)) continue;
    out.placeM(pc.tpl, M, TINT_NONE);
    for (const k of pc.colliders) { v.set(k[0], k[1], k[2]).applyMatrix4(M); colliders.push(v.x, v.y, v.z, k[3], k[4] ?? 1); }
  }
  // growth on the structure and debris around it, owned by the chunk that holds the spot
  const growth = f.rare ? 34 : f.type === 'wreck' ? 14 : f.type === 'arch' ? 8 : 6;
  for (let i = 0; i < growth; i++) {
    const pc = asm.pieces[Math.floor(rng() * asm.pieces.length)], k = pc.colliders[Math.floor(rng() * pc.colliders.length)];
    if (!k) continue;
    v.set(k[0], k[1] + k[3] * 0.8, k[2]).applyMatrix4(M);
    if (!inChunk(c, v.x, v.z)) continue;
    const s = R(rng, 0.5, 1.1), col = coralColor(c, rng, c.CORAL_TINTS);
    if (rng() < 0.5) { out.place(pickFrom(rng, L.gorgonians), v.x, v.y - 0.2, v.z, rng() * 6.283, s, s, s, [0, 1, 0], 0, col, 1); c.addFlora(FK['sea-fan'], v.x, v.y - 0.2, v.z, s); }
    else { const ki = rng() < 0.5 ? 0 : 5; out.place(pickFrom(rng, c.T.coral[ki].list), v.x, v.y - 0.1, v.z, rng() * 6.283, s, s, s, [0, 1, 0], 0, col); c.addFlora(coralKind(ki, _ti), v.x, v.y - 0.1, v.z, s); }
    c.corals.push(v.x, v.y + s * 0.5, v.z);
  }
  if (f.rare) rareExtras(f, c, asm, M);
  const reach = f.type === 'wreck' ? f.length * 0.5 + 8 : f.type === 'arch' ? f.span * 0.5 + 10 : f.length * 0.5 + 10;
  for (let i = 0; i < 16; i++) {
    const a = rng() * 6.283, d = reach * Math.sqrt(rng()) , x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
    if (!inChunk(c, x, z) || c.field.places.orientedW(f, x, z) < 0.3) continue;
    const y = c.ground(x, z), r = rng();
    if (r < 0.5) { const s = R(rng, 0.5, 1.6), rt = c.tint(0x777066, (rng() - 0.5) * 0.3); out.place(pickFrom(rng, c.T.rocks), x, y - s * 0.2, z, rng() * 6.283, s, s, s, c.nrm, 0.3, rt); if (s > 1.3) colliders.push(x, y + s * 0.2, z, s * 0.85, 1); }
    else { const s = R(rng, 0.8, 1.3); out.place(pickFrom(rng, c.T.grass), x, y - 0.05, z, rng() * 6.283, s, s, s, c.nrm, 0.1, c.tint(weedTint(c, rng), (rng() - 0.5) * 0.3)); c.weeds.push(x, y, z, 2 * s); c.addFlora(weedKind('grass', _wi), x, y, z, s); }
  }
}

// ------------------------------------------------------------------------------------------------------------ rock garden
function garden(f, c, rng) {
  const L = LT(), { out, colliders } = c;
  for (let i = 0; i < f.sp.length; i += 6) {
    const x = f.sp[i], z = f.sp[i + 1], s = f.sp[i + 2], kind = f.sp[i + 4], yaw = f.sp[i + 5];
    if (!inChunk(c, x, z)) continue;
    const y = c.ground(x, z), shade = 0.85 + 0.3 * nz(x * 0.2, z * 0.2);
    if (kind === 0) {
      const tpl = pickFrom(rng, L.spires), sh = s * 1.1;
      out.place(tpl, x, y - 0.5, z, yaw, sh, sh * R(rng, 0.9, 1.4), sh, c.nrm, 0.1, null, 1, shade);
      for (const [hy, hr] of [[1.3, 1.75], [3.6, 1.4], [5.9, 1.1], [7.8, 0.8]]) colliders.push(x, y + hy * sh, z, hr * sh, 1);
    } else {
      const tpl = pickFrom(rng, L.slabs);
      out.place(tpl, x, y - 0.4, z, yaw, s, s, s, c.nrm, 0.1, null, 1, shade);
      const ca = Math.cos(yaw), sa = Math.sin(yaw);
      for (const o of [-1.9, 0, 1.9]) colliders.push(x + ca * o * s, y + 1.8 * s, z - sa * o * s, 1.6 * s, 1);
    }
    if (rng() < 0.6) {          // gorgonian or pebbles at the foot
      const a = rng() * 6.283, d = R(rng, 1.5, 3) * s, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = c.ground(px, pz), g = R(rng, 0.7, 1.3);
      if (rng() < 0.5) { out.place(pickFrom(rng, L.gorgonians), px, py - 0.1, pz, rng() * 6.283, g, g, g, c.nrm, 0.1, c.tint(pickFrom(rng, [0xd24c8c, 0xe08a3a, 0xb04ad0, 0xe0d040]), (rng() - 0.5) * 0.2)); c.addFlora(FK['sea-fan'], px, py, pz, g); }
      else out.place(pickFrom(rng, c.T.pebbles), px, py - 0.1, pz, rng() * 6.283, g, g * 0.8, g, c.nrm, 0.5, c.tint(0x7a766e, 0));
    }
  }
}

// ------------------------------------------------------------------------------------------------------------ canyon walls
function canyon(f, c, rng) {
  const L = LT(), { out, colliders } = c, places = c.field.places;
  for (let i = 0; i < 26; i++) {
    const x = c.x0 + rng() * c.CS, z = c.z0 + rng() * c.CS;
    if (c.field.rockAt(x, z) < 0.6 || places.near(x, z).indexOf(f) < 0) continue;
    const y = c.ground(x, z), steep = 1 - c.nrm[1];
    if (steep < 0.18 && rng() < 0.7) continue;
    const s = R(rng, 1, 2), yaw = rng() * 6.283;
    if (rng() < 0.5) out.place(pickFrom(rng, L.slabs), x, y - 0.5, z, yaw, s, s, s, c.nrm, 0.5, null, 1, 0.9);
    else out.place(pickFrom(rng, L.spires), x, y - 0.5, z, yaw, s * 0.6, s * 0.6, s * 0.6, c.nrm, 0.5, null, 1, 0.9);
    colliders.push(x, y + 1.6 * s, z, 1.7 * s, 1);
  }
}

const DECOR = { bigreef, vent, magma, volcano, cave: structure, arch: structure, wreck: structure, garden, canyon, ...rockDecor(LT) };
