import * as THREE from 'three';

export const shared = { uTime: { value: 0 }, uSwayK: { value: 1 } };

const CAUSTIC = /* glsl */`
float causticPat(vec2 uv, float t){
  vec2 p = mod(uv*6.28318, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}`;

function patch(mat, { sway, caustics, glow }) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime; shader.uniforms.uSwayK = shared.uSwayK;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime, uSwayK;\nvarying vec3 vWPos;\n${sway ? 'attribute float aSway;' : ''}${glow ? '\nattribute float aGlow;\nvarying float vGlow;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>${glow ? '\nvGlow = aGlow;' : ''}
${sway ? `{
  vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  float ph = wp.x * 0.21 + wp.z * 0.13;
  transformed.x += aSway * uSwayK * (sin(uTime * 0.9 + ph) * 0.8 + sin(uTime * 1.9 + wp.z * 0.4) * 0.25);
  transformed.z += aSway * uSwayK * (cos(uTime * 0.7 + wp.z * 0.19 + wp.x * 0.11) * 0.7);
}` : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nvarying vec3 vWPos;\n${glow ? 'varying float vGlow;\n' : ''}${CAUSTIC}`)
      .replace('#include <opaque_fragment>', `
${caustics ? `{
  float cp = causticPat(vWPos.xz * 0.045, uTime * 0.5 + 23.0);
  float fade = exp(vWPos.y * 0.045);
  outgoingLight += outgoingLight * cp * 2.2 * fade + vec3(0.5,0.8,1.0) * cp * 0.25 * fade;
}` : ''}
${glow ? `if (vGlow > 0.003) {
  // lava / hot rock: warm emission that survives darkness, slowly pulsing
  float pulse = 0.84 + 0.16 * sin(uTime * 1.3 + vWPos.x * 0.35 + vWPos.z * 0.27) + 0.07 * sin(uTime * 3.1 + vWPos.z * 0.8 - vWPos.x * 0.5);
  float g = clamp(vGlow, 0.0, 1.4) * pulse;
  vec3 hot = mix(vec3(0.9, 0.16, 0.02), vec3(1.0, 0.56, 0.12), clamp(g * g, 0.0, 1.0));
  outgoingLight += hot * g * 1.25;
}` : ''}
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `m${sway ? 's' : ''}${caustics ? 'c' : ''}${glow ? 'g' : ''}`;
  return mat;
}

export const makeTerrainMaterial = () => patch(new THREE.MeshLambertMaterial({ vertexColors: true }), { caustics: true, glow: true });
export const makeDecorMaterial = () => patch(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { sway: true, caustics: true, glow: true });

/** Creature material: tail sway along z. axis (1,0,0) = side-to-side, (0,1,0) = up-down. */
/** mode 'tail' (default): travelling body wave toward the tail; 'flap': wings beat up/down, growing toward the tips (manta). */
export function makeCreatureMaterial({ amp, freq, axis = [1, 0, 0], wave = 4, mode = 'tail' }) {
  const u = { uFreq: { value: freq }, uAmp: { value: amp }, uAxis: { value: new THREE.Vector3(...axis) }, uWave: { value: wave } };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.userData.u = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, { uTime: shared.uTime });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uFreq, uAmp, uWave;\nuniform vec3 uAxis;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
  float ph = float(gl_InstanceID) * 1.7;
  #else
  float ph = 0.0;
  #endif
  #ifdef FLAP
  float ax = abs(position.x);
  transformed.y += sin(uTime * uFreq + ph - ax * uWave) * uAmp * ax * ax * 4.0;
  #else
  float w = clamp((0.25 - position.z) / 0.75, 0.0, 1.0); w *= w;
  transformed += uAxis * sin(uTime * uFreq + ph - position.z * uWave) * uAmp * w;
  #endif
}`);
  };
  if (mode === 'flap') mat.defines = { FLAP: '' };
  mat.customProgramCacheKey = () => 'creature-' + mode;
  return mat;
}
