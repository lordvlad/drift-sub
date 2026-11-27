import * as THREE from 'three';

/**
 * Submarine models. Contract for every type: createSubModel(type) returns
 * { group, prop, disc, setLamps(level 0..1), setHidden(bool), propZ (local z of the propeller, for bubbles), radius (collision sphere, m) }.
 * Nose points +z; group.rotation.order = 'YXZ'.
 */
export const SUB_TYPES = ['lemon'];

export function createSubModel(type = 'lemon') {
  if (type === 'lemon') return lemonModel();
  throw new Error('unknown sub type ' + type);
}

function lemonModel() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffcc1a, roughness: 0.38, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0xe0a000, roughness: 0.5, metalness: 0.2 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd8432a, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fe3ff, roughness: 0.05, metalness: 0.3, emissive: 0x2a7fa8, emissiveIntensity: 0.55 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x6f7a85, roughness: 0.4, metalness: 0.6 });

  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), yellow);
  hull.scale.set(0.55, 0.5, 1.25); g.add(hull);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 40), red);
  stripe.scale.set(0.54, 0.49, 1); stripe.position.z = -0.3;
  g.add(stripe);
  // conning tower
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.42, 14), yellow);
  tower.position.set(0, 0.55, -0.05); g.add(tower);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
  cap.position.set(0, 0.76, -0.05); g.add(cap);
  const peri = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6), steel);
  peri.position.set(0, 1.0, -0.05); g.add(peri);
  const periHead = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.16), steel);
  periHead.position.set(0, 1.2, 0.02); g.add(periHead);
  // viewport + portholes
  const view = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12), glass);
  view.position.set(0, 0.1, 0.92); view.scale.set(1, 0.85, 0.8); g.add(view);
  for (const s of [-1, 1]) for (const z of [-0.35, 0.15]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 14), glass);
    p.rotation.z = Math.PI / 2; p.position.set(s * 0.53, 0.08, z); g.add(p);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.018, 6, 16), steel);
    rim.rotation.y = Math.PI / 2; rim.position.set(s * 0.545, 0.08, z); g.add(rim);
  }
  // tail fins
  const finGeo = new THREE.BoxGeometry(0.9, 0.04, 0.38);
  const fh = new THREE.Mesh(finGeo, dark); fh.position.set(0, 0, -1.2); g.add(fh);
  const fv = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.8, 0.38), dark); fv.position.set(0, 0, -1.2); g.add(fv);
  // shroud + prop
  const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 8, 24), steel);
  shroud.position.z = -1.58; g.add(shroud);
  for (let i = 0; i < 4; i++) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.27, 4), steel);
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    st.position.set(Math.cos(a) * 0.135, Math.sin(a) * 0.135, -1.46);
    st.rotation.z = a - Math.PI / 2; st.rotation.x = Math.PI / 2 * 0; g.add(st);
  }
  const prop = new THREE.Group(); prop.position.z = -1.6; g.add(prop);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 10), steel);
  hub.rotation.x = -Math.PI / 2; hub.position.z = -0.06; prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.2, 0.012, 0.075);
  bladeGeo.translate(0.12, 0, 0);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc9d2da, roughness: 0.3, metalness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const holder = new THREE.Group(); holder.rotation.z = (i / 4) * Math.PI * 2;
    const b = new THREE.Mesh(bladeGeo, bladeMat); b.rotation.x = 0.55; holder.add(b); prop.add(holder);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.25, 20), new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  disc.position.z = -0.02; prop.add(disc);
  // twin headlights: lamp, spot and soft beam on each side
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const beamGeo = new THREE.ConeGeometry(1.7, 14, 18, 1, true); beamGeo.rotateX(-Math.PI / 2); beamGeo.translate(0, 0, 7);
  { const p = beamGeo.attributes.position, c = new Float32Array(p.count * 3); // bright at the lamp, black (= invisible when additive) at the far rim
    for (let i = 0; i < p.count; i++) { const t = p.getZ(i) / 14, f = Math.min(1, t / 0.12) * Math.pow(1 - t, 2.5); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = f; }
    beamGeo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x000000, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const spots = [], beams = [];
  for (const s of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lampMat);
    lamp.position.set(s * 0.3, -0.14, 1.12); g.add(lamp);
    const spot = new THREE.SpotLight(0xdff6ff, 0, 60, 0.5, 0.7, 1.2);
    spot.position.copy(lamp.position);
    const target = new THREE.Object3D(); target.position.set(s * 0.9, -0.5, 9);
    g.add(spot); g.add(target); spot.target = target; spots.push(spot);
    const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.copy(lamp.position); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), target.position.clone().sub(lamp.position).normalize()); beam.visible = false; g.add(beam); beams.push(beam);
  }
  let hidden = false, lampLevel = 0;
  /** level 0..1 */
  const setLamps = (level) => {
    lampLevel = level;
    for (const sp of spots) sp.intensity = 38 * level;
    lampMat.color.setRGB(0.25 + 0.75 * level, 0.25 + 0.72 * level, 0.2 + 0.6 * level);
    beamMat.color.setRGB(0.07 * level, 0.1 * level, 0.12 * level); for (const b of beams) b.visible = !hidden && level > 0.02;
  };
  g.rotation.order = 'YXZ';
  const bodyMeshes = []; g.traverse((o) => { if (o.isMesh && !beams.includes(o)) bodyMeshes.push(o); });
  /** first-person (viewfinder): hide hull and beams, lights keep shining */
  const setHidden = (h) => { if (h === hidden) return; hidden = h; for (const m of bodyMeshes) m.visible = !h; for (const b of beams) b.visible = !h && lampLevel > 0.02; };
  return { group: g, prop, disc, setLamps, setHidden, propZ: -1.78, radius: 0.9 };
}
