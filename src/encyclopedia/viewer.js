import * as THREE from 'three';
import { getModel } from '../models/registry.js';
import { addStyle } from '../ui.js';
import { ib, registerIcons } from '../icons.js';

registerIcons({
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9',
  rotate: 'M20 12a8 8 0 1 1-2.6-5.9 M20 4v5h-5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v10H5z M12 15v2',
});

addStyle(`.b3d{position:relative;margin:4px 0 14px;border-radius:14px;overflow:hidden;aspect-ratio:16/10;max-height:62vh;width:100%;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;
background:radial-gradient(ellipse at 50% 18%,#3fa6c8 0%,#176a92 38%,#073a5a 70%,#03182a 100%);border:1px solid #9fe3ff33}
.b3d:active{cursor:grabbing}.b3d canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.b3d .b3bar{position:absolute;right:8px;top:8px;display:flex;gap:6px}.b3d .b3bar button{width:36px;height:36px;background:#03182acc;backdrop-filter:blur(4px)}
.b3d .b3hint{position:absolute;left:12px;bottom:8px;right:12px;font-size:11.5px;opacity:.75;text-shadow:0 1px 4px #000;pointer-events:none}
.b3d .b3name{position:absolute;left:12px;top:10px;font-size:12px;opacity:.85;text-shadow:0 1px 4px #000;pointer-events:none}
.b3btn{display:inline-flex;align-items:center;gap:8px;margin:0 0 14px;padding:4px 14px 4px 5px !important}.b3btn .ib{width:34px;height:34px;border:0;background:#ffffff1a}
.b3lock{margin:0 0 14px;font-size:13px;opacity:.5;display:flex;align-items:center;gap:8px}.b3lock svg{opacity:.7}`);

const FOV = 38, DEG = Math.PI / 180;

function makeMaterial(def, geometry) {
  const plain = def.material === 'plain', tint = new THREE.Color();
  const t = def.tint; if (Array.isArray(t)) tint.setRGB(t[0], t[1], t[2]); else if (typeof t === 'number' && t < 16) tint.setScalar(t); else if (t !== undefined && t !== null) tint.set(t);   // small numbers are brightness gains, bigger ones hex colours
  const mat = new THREE.MeshLambertMaterial({ vertexColors: !plain, side: THREE.DoubleSide, color: plain && t === undefined ? 0xcccccc : tint });
  if (geometry.getAttribute('aGlow')) {   // bioluminescence / lamps authored into the model (deep sea animals)
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aGlow; varying vec3 vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlow;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * 0.8;');
    };
    mat.customProgramCacheKey = () => 'enc-glow';
  }
  return mat;
}

/**
 * Open the 3D viewer for registered model `id` inside `host` (an element; the viewer fills it). Returns { close() }.
 * Renders only while open; close() (or the X button) disposes the renderer, geometry and materials and frees the WebGL context.
 */
export function openViewer(host, id, { name = '', onClose } = {}) {
  const def = getModel(id);
  if (!def) return null;
  const box = document.createElement('div'); box.className = 'b3d';
  const canvas = document.createElement('canvas'); box.appendChild(canvas);
  const nameEl = document.createElement('div'); nameEl.className = 'b3name'; nameEl.textContent = name;
  const bar = document.createElement('div'); bar.className = 'b3bar';
  const reset = document.createElement('button'), x = document.createElement('button');
  ib(reset, 'rotate', 'Reset view'); ib(x, 'close', 'Close 3D view'); bar.append(reset, x);
  const hint = document.createElement('div'); hint.className = 'b3hint'; hint.textContent = 'Drag to turn · pinch or scroll to zoom · double-tap to reset';
  box.append(nameEl, bar, hint); host.appendChild(box);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch { hint.textContent = '3D view is not available on this device'; renderer = null; }

  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(FOV, 1.6, 0.01, 100);
  scene.add(new THREE.HemisphereLight(0xcdf1ff, 0x0b3550, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(2, 4, 3); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x7fd0ff, 0.7); rim.position.set(-3, -1, -2); scene.add(rim);

  const geometry = def.geometry(), material = makeMaterial(def, geometry);
  geometry.computeBoundingSphere();
  const bs = geometry.boundingSphere, center = bs.center.clone(), k = (def.scale || 1) / (bs.radius || 1);
  const group = new THREE.Group(); scene.add(group);
  const mk = () => { const m = new THREE.Mesh(geometry, material); m.position.copy(center).multiplyScalar(-1); m.frustumCulled = false; const p = new THREE.Group(); p.add(m); p.scale.setScalar(k); return p; };
  const main = mk(); group.add(main);
  const followers = [];
  if (def.kind === 'school-member') {   // a few smaller companions drifting behind
    const offs = [[-0.75, -0.18, -0.9, 0.52], [0.8, 0.22, -1.15, 0.46], [-0.4, 0.45, -1.6, 0.4], [0.35, -0.42, -1.7, 0.44], [-1.1, 0.1, -2.0, 0.36], [1.15, -0.1, -2.1, 0.34]];
    for (const [ox, oy, oz, s] of offs) { const f = mk(); f.scale.multiplyScalar(s); f.userData = { ox, oy, oz, ph: ox * 3 + oz }; group.add(f); followers.push(f); }
    main.position.set(0.25, 0, 0.9); group.position.z = 0.1;
  }

  // view state (spherical around the origin); the framing distance fits the model's bounding sphere
  const reach = followers.length ? 1.9 : 1;
  const fit = reach / Math.sin(FOV * DEG / 2) * 0.9;
  const home = { yaw: 1.15, pitch: 0.16, zoom: 1 };
  const v = { ...home }, goal = { ...home };
  let userT = -1e9, disposed = false, raf = 0, W = 0, H = 0, last = performance.now();

  const size = () => {
    const w = box.clientWidth || 1, h = box.clientHeight || 1; if (w === W && h === H || !renderer) return;
    W = w; H = h; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null; ro && ro.observe(box);

  const frame = (now) => {
    if (disposed) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (now - userT > 2500) goal.yaw += dt * 0.28;                       // slow auto-rotate once the user lets go
    const e = 1 - Math.exp(-dt * 9);
    v.yaw += (goal.yaw - v.yaw) * e; v.pitch += (goal.pitch - v.pitch) * e; v.zoom += (goal.zoom - v.zoom) * e;
    const d = fit * v.zoom, cp = Math.cos(v.pitch);
    cam.position.set(Math.sin(v.yaw) * cp * d, Math.sin(v.pitch) * d, Math.cos(v.yaw) * cp * d); cam.lookAt(0, 0, 0);
    const t = now / 1000;
    for (const f of followers) { const u = f.userData; f.position.set(u.ox + Math.sin(t * 0.7 + u.ph) * 0.06, u.oy + Math.sin(t * 0.9 + u.ph * 1.7) * 0.05, u.oz); }
    if (followers.length) main.position.y = Math.sin(t * 0.8) * 0.03;
    if (renderer) { size(); renderer.render(scene, cam); }
  };

  // pointer: one finger / mouse orbits, two fingers pinch, wheel zooms, double-tap resets
  const ptrs = new Map(); let pinch = 0, lastTap = 0, tapX = 0, tapY = 0, moved = 0;
  const touch = () => { userT = performance.now(); };
  const resetView = () => { Object.assign(goal, home, { yaw: Math.round((v.yaw - home.yaw) / (Math.PI * 2)) * Math.PI * 2 + home.yaw }); touch(); };
  const down = (e) => { if (e.target.closest('.b3bar')) return; try { box.setPointerCapture(e.pointerId); } catch {} ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } touch(); };
  const move = (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY; touch(); moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0 && d > 0) goal.zoom = Math.min(2.2, Math.max(0.35, goal.zoom * pinch / d)); pinch = d;
    } else { goal.yaw -= dx * 0.009; goal.pitch = Math.min(1.35, Math.max(-1.2, goal.pitch + dy * 0.008)); }
  };
  const up = (e) => {
    if (!ptrs.delete(e.pointerId)) return; pinch = 0;
    if (moved < 8 && !ptrs.size) { const now = performance.now(); if (now - lastTap < 330 && Math.hypot(e.clientX - tapX, e.clientY - tapY) < 30) { resetView(); lastTap = 0; } else { lastTap = now; tapX = e.clientX; tapY = e.clientY; } }
  };
  const wheel = (e) => { e.preventDefault(); goal.zoom = Math.min(2.2, Math.max(0.35, goal.zoom * Math.exp(e.deltaY * 0.0012))); touch(); };
  const stop = (e) => e.stopPropagation();
  box.addEventListener('pointerdown', down); box.addEventListener('pointermove', move); box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  box.addEventListener('wheel', wheel, { passive: false }); box.addEventListener('dblclick', resetView);
  bar.addEventListener('pointerdown', stop);
  reset.addEventListener('click', resetView);

  const api = {
    get isOpen() { return !disposed; },
    close() {
      if (disposed) return; disposed = true; cancelAnimationFrame(raf); ro && ro.disconnect();
      box.removeEventListener('wheel', wheel);
      geometry.dispose(); material.dispose();
      if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
      box.remove(); onClose && onClose();
    },
  };
  x.addEventListener('click', () => api.close());
  size(); raf = requestAnimationFrame(frame);
  return api;
}
