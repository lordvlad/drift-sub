import * as THREE from 'three';
import { shared } from './materials.js';

/**
 * Stateless GPU particle plumes: smoke from black smokers, ash, sparks and bubble streams of volcanoes and lava rifts,
 * heat shimmer. Every particle's position is a pure function of (uTime, per-particle seed), so a chunk's emitters are
 * just one static Points geometry (no CPU updates).
 * Emitter record (stride 6): x, y, z, kind, size, strength.
 */
export const PLUME = { BLACK: 0, WHITE: 1, SPARK: 2, ASH: 3, BUBBLE: 4, SHIMMER: 5 };
const COUNT = [48, 30, 14, 20, 16, 7];
export const PLUME_STRIDE = 6;

const VERT = /* glsl */`
attribute vec4 aP;   // kind, size, phase, rate
attribute vec3 aR;   // random -1..1
uniform float uTime, uScale;
varying vec4 vCol; varying float vKind; varying float vRnd;
#include <fog_pars_vertex>
void main(){
  float kind = aP.x, sz = aP.y, rate = aP.w;
  vec3 p = position; vec3 col = vec3(1.0); float a = 0.0, wsz = 0.3, life = 10.0, add = 0.0;
  float age;
  float t = uTime;
  if (kind < 0.5) {            // black smoke
    life = 13.0; age = fract(aP.z + t * rate / life);
    float H = 12.0 + 15.0 * sz;
    p.y += pow(age, 0.8) * H * (0.8 + 0.2 * aR.y);
    p.xz += vec2(0.6, 0.35) * age * age * (6.0 + 5.0 * sz) + aR.xz * (0.25 + age * (1.4 + 1.6 * sz))
         + 0.9 * age * vec2(sin(t * 0.4 + aR.y * 6.28 + age * 5.0), cos(t * 0.33 + aR.x * 6.28 + age * 4.0));
    wsz = (0.9 + age * 3.8) * (0.55 + sz * 0.7);
    a = smoothstep(0.0, 0.05, age) * pow(1.0 - age, 1.1) * 0.8;
    col = mix(vec3(0.03, 0.028, 0.034), vec3(0.2, 0.21, 0.24), age);
  } else if (kind < 1.5) {     // white / grey diffuse smoke
    life = 11.0; age = fract(aP.z + t * rate / life);
    float H = 7.0 + 8.0 * sz;
    p.y += pow(age, 0.75) * H;
    p.xz += vec2(0.5, 0.3) * age * age * 5.0 + aR.xz * (0.2 + age * (1.0 + 1.2 * sz)) + 0.6 * age * vec2(sin(t * 0.35 + aR.y * 6.28), cos(t * 0.3 + aR.x * 6.28));
    wsz = (0.7 + age * 2.8) * (0.55 + sz * 0.7);
    a = smoothstep(0.0, 0.08, age) * pow(1.0 - age, 1.3) * 0.5;
    col = mix(vec3(0.86, 0.84, 0.76), vec3(0.45, 0.52, 0.56), age);
  } else if (kind < 2.5) {     // sparks / glowing embers
    life = 3.2; age = fract(aP.z + t * rate / life);
    p.y += age * (5.0 + 9.0 * sz) - 3.0 * age * age;
    p.xz += aR.xz * age * 3.4 * sz + vec2(0.5, 0.3) * age * age * 3.0;
    wsz = 0.1 * (0.6 + sz * 0.5);
    a = smoothstep(0.0, 0.05, age) * (1.0 - age) * (0.65 + 0.35 * sin(t * 11.0 + aR.x * 40.0));
    col = vec3(1.0, 0.38 + 0.4 * (1.0 - age), 0.08); add = 1.0;
  } else if (kind < 3.5) {     // ash: slow, wide, grey
    life = 17.0; age = fract(aP.z + t * rate / life);
    float H = 16.0 + 14.0 * sz;
    p.y += pow(age, 0.85) * H;
    p.xz += vec2(0.7, 0.4) * age * age * 12.0 + aR.xz * (1.0 + age * 5.0) + 1.5 * age * vec2(sin(t * 0.2 + aR.y * 6.28), cos(t * 0.25 + aR.x * 6.28));
    wsz = (1.2 + age * 4.0) * (0.6 + sz * 0.4);
    a = smoothstep(0.0, 0.1, age) * pow(1.0 - age, 1.5) * 0.22;
    col = mix(vec3(0.18, 0.16, 0.16), vec3(0.34, 0.36, 0.4), age);
  } else if (kind < 4.5) {     // bubble stream
    life = 7.0; age = fract(aP.z + t * rate / life);
    p.y += age * (14.0 + 6.0 * sz);
    p.xz += aR.xz * 0.25 + vec2(sin(t * 1.7 + aR.y * 20.0), cos(t * 1.5 + aR.x * 20.0)) * 0.3 * (0.3 + age);
    wsz = 0.05 + 0.07 * abs(aR.y);
    a = smoothstep(0.0, 0.04, age) * (1.0 - smoothstep(0.8, 1.0, age)) * 0.85;
    col = vec3(0.8, 0.95, 1.0);
  } else {                     // heat shimmer: faint warm veil
    life = 4.0; age = fract(aP.z + t * rate / life);
    p.y += age * 5.0 * (0.6 + sz * 0.4);
    p.xz += aR.xz * (0.4 + age * 1.2) + vec2(sin(t * 2.3 + aR.y * 30.0), cos(t * 2.1 + aR.x * 30.0)) * 0.25;
    wsz = 1.6 + age * 2.4;
    a = smoothstep(0.0, 0.2, age) * (1.0 - age) * 0.035;
    col = vec3(0.9, 0.7, 0.5); add = 1.0;
  }
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(wsz * uScale / max(-mvPosition.z, 0.1), 1.0, 240.0) * (a > 0.0005 ? 1.0 : 0.0);
  vCol = vec4(col, a); vKind = kind + add * 0.25; vRnd = aR.z;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
varying vec4 vCol; varying float vKind; varying float vRnd;
#include <fog_pars_fragment>
void main(){
  vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float add = step(0.2, fract(vKind)) ; float kind = floor(vKind + 0.01);
  float shape;
  if (kind > 3.5 && kind < 4.5) {          // bubble ring + highlight
    float ring = smoothstep(0.5, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r));
    float hl = (1.0 - smoothstep(0.0, 0.3, length(c - vec2(-0.17, -0.17)))) * 0.9;
    shape = ring * 0.6 + 0.08 + hl;
  } else if (kind > 1.5 && kind < 2.5) {   // ember: hot core
    shape = 1.0 - smoothstep(0.0, 1.0, r); shape *= shape;
  } else {                                 // soft puff with a little ragged edge
    shape = 1.0 - smoothstep(0.05, 1.0, r); shape *= shape;
  }
  float a = vCol.a * shape;
  gl_FragColor = vec4(vCol.rgb, 1.0);
  #include <fog_fragment>
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a * (1.0 - add));
}`;

const uScale = { value: 800 };
let material = null;
export function plumeMaterial() {
  if (material) return material;
  material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: shared.uTime, uScale }]),
    vertexShader: VERT, fragmentShader: FRAG, fog: true, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  material.uniforms.uTime = shared.uTime; material.uniforms.uScale = uScale;   // merge() clones: re-share the live objects
  return material;
}
/** point size needs the pixel height of the current target; set right before each plume mesh draws */
function beforeRender(renderer, scene, camera) {
  const rt = renderer.getRenderTarget();
  uScale.value = (rt ? rt.height : renderer.domElement.height) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}

/** Static Points mesh for a chunk's emitters (Float32Array / number[] of stride PLUME_STRIDE), or null if empty. */
export function buildPlumes(em, rng) {
  let n = 0;
  for (let i = 0; i < em.length; i += PLUME_STRIDE) n += Math.max(2, Math.round(COUNT[em[i + 3]] * em[i + 5]));
  if (!n) return null;
  const pos = new Float32Array(n * 3), aP = new Float32Array(n * 4), aR = new Float32Array(n * 3);
  let k = 0;
  for (let i = 0; i < em.length; i += PLUME_STRIDE) {
    const kind = em[i + 3], m = Math.max(2, Math.round(COUNT[kind] * em[i + 5]));
    for (let j = 0; j < m; j++, k++) {
      pos[k * 3] = em[i]; pos[k * 3 + 1] = em[i + 1]; pos[k * 3 + 2] = em[i + 2];
      aP[k * 4] = kind; aP[k * 4 + 1] = em[i + 4]; aP[k * 4 + 2] = (j + rng() * 0.8) / m; aP[k * 4 + 3] = 0.85 + rng() * 0.3;
      aR[k * 3] = rng() * 2 - 1; aR[k * 3 + 1] = rng() * 2 - 1; aR[k * 3 + 2] = rng() * 2 - 1;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aP', new THREE.BufferAttribute(aP, 4));
  g.setAttribute('aR', new THREE.BufferAttribute(aR, 3));
  g.computeBoundingSphere();
  g.boundingSphere.radius += 46;
  const m = new THREE.Points(g, plumeMaterial());
  m.onBeforeRender = beforeRender; m.renderOrder = 3;
  return m;
}
