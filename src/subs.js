import * as THREE from 'three';

/**
 * Submarine models. Contract for every type: createSubModel(type) returns
 * { group, prop, disc, setLamps(level 0..1), setHidden(bool), propZ (local z of the propeller, for bubbles), radius (collision sphere, m) }.
 * Nose points +z; group.rotation.order = 'YXZ'.
 */
export const SUB_TYPES = ['lemon', 'manta', 'barracuda', 'squid'];

export function createSubModel(type = 'lemon') {
  if (type === 'lemon') return lemonModel();
  if (type === 'manta') return mantaModel();
  if (type === 'barracuda') return barracudaModel();
  if (type === 'squid') return squidModel();
  throw new Error('unknown sub type ' + type);
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/** thin cylinder between two points */
function rod(mat, r, a, b, seg = 8) {
  const d = b.clone().sub(a), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

/**
 * Swept fin/wing: planform polygon of (span x, chord z) points for the +x side, extruded with a rounded edge and
 * laid flat in the XZ plane (centred in thickness). Mirror with scale.x = -1.
 */
function finGeometry(pts, thick = 0.05, bevel = 0.025) {
  const sh = new THREE.Shape();
  pts.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  geo.translate(0, 0, -thick / 2);
  geo.rotateX(Math.PI / 2); // shape y -> +z, thickness -> y
  return geo;
}

/** spinning propeller group (hub + blades + additive blur disc) at local z */
function makeProp(g, { z, hubR = 0.06, hubLen = 0.2, bladeLen = 0.2, bladeW = 0.075, blades = 4, discR = 0.25, steel, bladeMat }) {
  const prop = new THREE.Group(); prop.position.z = z; g.add(prop);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(hubR, hubLen, 10), steel);
  hub.rotation.x = -Math.PI / 2; hub.position.z = -hubLen * 0.3; prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(bladeLen, 0.012, bladeW);
  bladeGeo.translate(bladeLen / 2 + hubR * 0.4, 0, 0);
  for (let i = 0; i < blades; i++) {
    const holder = new THREE.Group(); holder.rotation.z = (i / blades) * Math.PI * 2;
    const b = new THREE.Mesh(bladeGeo, bladeMat); b.rotation.x = 0.55; holder.add(b); prop.add(holder);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(discR, 20), new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  disc.position.z = -0.02; prop.add(disc);
  return { prop, disc };
}

/**
 * Twin headlights: lamp bulb, spot light and soft additive beam per side.
 * defs: [{ pos: Vector3, target: Vector3 }] (group-local). Returns { setLamps, beams, getHidden hooks }.
 */
function makeLamps(g, defs) {
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const beamGeo = new THREE.ConeGeometry(1.7, 14, 18, 1, true); beamGeo.rotateX(-Math.PI / 2); beamGeo.translate(0, 0, 7);
  { const p = beamGeo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const t = p.getZ(i) / 14, f = Math.min(1, t / 0.12) * Math.pow(1 - t, 2.5); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = f; }
    beamGeo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x000000, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const spots = [], beams = [];
  for (const d of defs) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lampMat);
    lamp.position.copy(d.pos); g.add(lamp);
    const spot = new THREE.SpotLight(0xdff6ff, 0, 60, 0.5, 0.7, 1.2);
    spot.position.copy(d.pos);
    const target = new THREE.Object3D(); target.position.copy(d.target);
    g.add(spot); g.add(target); spot.target = target; spots.push(spot);
    const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.copy(d.pos);
    beam.quaternion.setFromUnitVectors(V(0, 0, 1), d.target.clone().sub(d.pos).normalize());
    beam.visible = false; g.add(beam); beams.push(beam);
  }
  return { spots, beams, lampMat, beamMat };
}

/**
 * common tail of every model: lamp control, first-person hiding, cosmetic paint and the contract object.
 * `paint` lists the materials each cosmetic slot recolours: { base, trim, accent, prop: [MeshStandardMaterial] }.
 * Contract addition: model.setPaint({ base, trim, accent, lamp, prop }) — each a colour (hex number / CSS string) or null/undefined
 * to restore that slot's built-in colour; lamp recolours the headlight bulbs, spot lights and beams. Purely cosmetic.
 */
const LAMP_DEFAULT = { spot: new THREE.Color(0xdff6ff), bulb: [1, 0.97, 0.8], beam: [0.07, 0.1, 0.12] };
function finishModel(g, { prop, disc }, rig, propZ, radius, paint = {}) {
  g.rotation.order = 'YXZ';
  let hidden = false, lampLevel = 0, tint = LAMP_DEFAULT;
  /** level 0..1 */
  const setLamps = (level) => {
    lampLevel = level;
    for (const sp of rig.spots) { sp.intensity = 38 * level; sp.color.copy(tint.spot); }
    const k = 0.25 + 0.75 * level;
    rig.lampMat.color.setRGB(tint.bulb[0] * k, tint.bulb[1] * k, tint.bulb[2] * k);
    rig.beamMat.color.setRGB(tint.beam[0] * level, tint.beam[1] * level, tint.beam[2] * level); for (const b of rig.beams) b.visible = !hidden && level > 0.02;
  };
  const bodyMeshes = []; g.traverse((o) => { if (o.isMesh && !rig.beams.includes(o)) bodyMeshes.push(o); });
  /** first-person (viewfinder): hide hull and beams, lights keep shining */
  const setHidden = (h) => { if (h === hidden) return; hidden = h; for (const m of bodyMeshes) m.visible = !h; for (const b of rig.beams) b.visible = !h && lampLevel > 0.02; };
  const orig = new Map(); for (const k of ['base', 'trim', 'accent', 'prop']) for (const m of paint[k] || []) orig.set(m, { c: m.color.clone(), metal: m.metalness });
  const setPaint = ({ base, trim, accent, lamp, prop: propC } = {}) => {
    for (const [k, c] of [['base', base], ['trim', trim], ['accent', accent], ['prop', propC]]) for (const m of paint[k] || []) {
      const o = orig.get(m);
      if (c == null) { m.color.copy(o.c); m.metalness = o.metal; } else { m.color.set(c); if (k !== 'prop') m.metalness = Math.min(o.metal, 0.2); }   // repainted metal reads as lacquer (no env map: pure metal looks black)
    }
    if (lamp == null) tint = LAMP_DEFAULT;
    else { const c = new THREE.Color(lamp), mx = Math.max(c.r, c.g, c.b, 1e-3); tint = { spot: c, bulb: [c.r / mx, c.g / mx, c.b / mx], beam: [c.r / mx * 0.11, c.g / mx * 0.11, c.b / mx * 0.11] }; }
    setLamps(lampLevel);
  };
  return { group: g, prop, disc, setLamps, setHidden, setPaint, propZ, radius };
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
  const rig = makeLamps(g, [-1, 1].map((s) => ({ pos: V(s * 0.3, -0.14, 1.12), target: V(s * 0.9, -0.5, 9) })));
  return finishModel(g, { prop, disc }, rig, -1.78, 0.9, { base: [yellow], trim: [dark], accent: [red], prop: [bladeMat] });
}

/** Manta: flat, wide, ray-like sub with swept wing hulls, teal with an orange accent. ~3 m long, ~3 m wide. */
function mantaModel() {
  const g = new THREE.Group();
  const teal = new THREE.MeshStandardMaterial({ color: 0x1b8ea0, roughness: 0.35, metalness: 0.2 });
  const deep = new THREE.MeshStandardMaterial({ color: 0x2678b5, roughness: 0.4, metalness: 0.25 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff8a3d, roughness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fe3ff, roughness: 0.05, metalness: 0.3, emissive: 0x2a7fa8, emissiveIntensity: 0.55 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x6f7a85, roughness: 0.4, metalness: 0.6 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), teal);
  body.scale.set(0.6, 0.26, 1.25); g.add(body);
  const spine = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), orange);
  spine.scale.set(0.07, 0.05, 1.0); spine.position.set(0, 0.245, -0.12); g.add(spine);
  // wings: wide swept pectoral planform, tips curl up slightly
  const wingGeo = finGeometry([[0.2, 1.0], [0.5, 0.97], [0.85, 0.8], [1.15, 0.5], [1.4, 0.1], [1.5, -0.2], [1.45, -0.5], [1.2, -0.5], [0.9, -0.45], [0.55, -0.7], [0.2, -0.9]], 0.07, 0.045);
  const tipGeo = new THREE.SphereGeometry(1, 12, 8);
  const lampDefs = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, deep);
    wing.scale.x = s; wing.rotation.z = s * 0.1; wing.position.y = -0.02; g.add(wing);
    const tip = new THREE.Mesh(tipGeo, orange);
    tip.scale.set(0.09, 0.05, 0.3); tip.position.set(s * 1.46, 0.15, -0.38); tip.rotation.z = s * 0.1; g.add(tip);
    // leading-edge accent strip
    const edge = rod(orange, 0.022, V(s * 0.5, 0.03, 0.99), V(s * 1.38, 0.16, 0.14), 6); g.add(edge);
    // lamp pod on the wing leading edge
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 12), steel);
    pod.rotation.x = Math.PI / 2; pod.position.set(s * 0.72, -0.02, 0.8); g.add(pod);
    lampDefs.push({ pos: V(s * 0.72, -0.02, 0.92), target: V(s * 1.1, -0.4, 9) });
    // porthole on the body flank
    const port = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12), glass);
    port.rotation.z = Math.PI / 2; port.position.set(s * 0.52, 0.06, 0.28); g.add(port);
  }
  // canopy dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glass);
  dome.scale.set(0.38, 0.27, 0.55); dome.position.set(0, 0.14, 0.55); g.add(dome);
  // tail: small swept fin + ducted prop
  const fin = new THREE.Mesh(finGeometry([[0.0, 0.2], [0.3, -0.12], [0.3, -0.26], [0.0, -0.26]], 0.035, 0.018), orange);
  fin.rotation.z = Math.PI / 2; fin.position.set(0, 0.2, -0.95); g.add(fin);
  const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 24), steel);
  shroud.position.z = -1.42; g.add(shroud);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(rod(steel, 0.014, V(Math.cos(a) * 0.04, Math.sin(a) * 0.04, -1.26), V(Math.cos(a) * 0.24, Math.sin(a) * 0.24, -1.42), 4));
  }
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc9d2da, roughness: 0.3, metalness: 0.6 });
  const { prop, disc } = makeProp(g, { z: -1.44, hubR: 0.05, bladeLen: 0.17, bladeW: 0.07, blades: 3, discR: 0.22, steel, bladeMat });
  const rig = makeLamps(g, lampDefs);
  return finishModel(g, { prop, disc }, rig, -1.6, 1.15, { base: [teal], trim: [deep], accent: [orange], prop: [bladeMat] });
}

/** Barracuda: long slim torpedo hull, silver/graphite with a red-orange stripe, swept fins, big ducted prop. ~4 m. */
function barracudaModel() {
  const g = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: 0xc4ccd4, roughness: 0.28, metalness: 0.65 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x30363d, roughness: 0.4, metalness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xff4a1a, roughness: 0.4, metalness: 0.15 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fe3ff, roughness: 0.05, metalness: 0.3, emissive: 0x2a7fa8, emissiveIntensity: 0.55 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x6f7a85, roughness: 0.4, metalness: 0.6 });

  // lathe hull: elliptical nose, long parallel body, tapering tail (axis = z)
  const R = 0.42, zNose = 2.0, zNoseStart = 1.1, zTail = -1.85, zTaper = -0.4;
  const radiusAt = (z) => {
    if (z >= zNoseStart) return R * Math.sqrt(Math.max(0, 1 - Math.pow((z - zNoseStart) / (zNose - zNoseStart), 2)));
    if (z >= zTaper) return R;
    const t = (zTaper - z) / (zTaper - zTail);
    return R - 0.22 * Math.pow(t, 1.3);
  };
  const prof = [V(0, 0, zTail)];
  for (let i = 0; i <= 44; i++) { const z = zTail + (zNose - zTail) * (i / 44); prof.push(V(Math.max(radiusAt(z), 0.0001), 0, z)); }
  const hullGeo = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p.x, p.z)), 28);
  hullGeo.rotateX(Math.PI / 2); // lathe axis y -> +z
  g.add(new THREE.Mesh(hullGeo, silver));
  // stripe bands + dark nose cap
  const band = (z, len, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 28, 1, true), red); m.material.side = THREE.DoubleSide; m.rotation.x = Math.PI / 2; m.position.z = z; g.add(m); };
  band(0.45, 0.32, R + 0.008); band(0.9, 0.08, R + 0.008); band(-0.12, 0.08, R + 0.008);
  const dorsalStripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 1.9), red);
  dorsalStripe.position.set(0, R - 0.005, -0.3); g.add(dorsalStripe);
  const noseCap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), graphite);
  noseCap.position.z = zNose - 0.06; g.add(noseCap);
  // canopy
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glass);
  canopy.scale.set(0.2, 0.15, 0.42); canopy.position.set(0, 0.36, 0.78); g.add(canopy);
  // swept fins: dorsal sail, aft hydroplanes, tail cross fins
  const sailGeo = finGeometry([[0.25, 0.3], [0.75, -0.2], [0.75, -0.38], [0.25, -0.35]], 0.04, 0.02);
  const sail = new THREE.Mesh(sailGeo, graphite); sail.rotation.z = Math.PI / 2; sail.position.set(0, 0.0, 0.05); g.add(sail);
  const planeGeo = finGeometry([[0.3, 0.45], [1.05, -0.35], [1.05, -0.6], [0.3, -0.4]], 0.04, 0.02);
  const tailGeo = finGeometry([[0.12, 0.35], [0.7, -0.15], [0.7, -0.33], [0.12, -0.3]], 0.035, 0.018);
  for (const s of [-1, 1]) {
    const pl = new THREE.Mesh(planeGeo, graphite); pl.scale.x = s; pl.position.set(0, -0.02, -0.75); pl.rotation.z = s * -0.05; g.add(pl);
    const tf = new THREE.Mesh(tailGeo, graphite); tf.scale.x = s; tf.position.set(0, 0, -1.4); g.add(tf);
  }
  for (const s of [-1, 1]) {
    const tv = new THREE.Mesh(tailGeo, graphite); tv.rotation.z = s * Math.PI / 2; tv.position.set(0, 0, -1.4); g.add(tv);
  }
  // ducted propeller
  const zDuct = -2.0;
  const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.31, 0.46, 24, 1, true), graphite);
  duct.material = duct.material.clone(); duct.material.side = THREE.DoubleSide; duct.rotation.x = Math.PI / 2; duct.position.z = zDuct; g.add(duct);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.03, 8, 28), steel);
  lip.position.z = zDuct + 0.23; g.add(lip);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(rod(steel, 0.016, V(Math.cos(a) * 0.1, Math.sin(a) * 0.1, -1.82), V(Math.cos(a) * 0.32, Math.sin(a) * 0.32, zDuct + 0.1), 4));
  }
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc9d2da, roughness: 0.3, metalness: 0.6 });
  const { prop, disc } = makeProp(g, { z: zDuct, hubR: 0.075, hubLen: 0.3, bladeLen: 0.22, bladeW: 0.09, blades: 5, discR: 0.3, steel, bladeMat });
  // lamps flush with the nose flanks
  const zl = 1.35, rl = radiusAt(zl);
  const rig = makeLamps(g, [-1, 1].map((s) => ({ pos: V(s * rl * 0.88, -rl * 0.3, zl), target: V(s * 1.0, -0.5, 10) })));
  return finishModel(g, { prop, disc }, rig, -2.25, 1.25, { base: [silver], trim: [graphite, duct.material], accent: [red], prop: [bladeMat] });
}

/** Squid: deep-diver bathyscaphe — white pressure sphere, orange ballast tanks and belts, thick viewport, manipulator arms. ~3 m. */
function squidModel() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf1efe8, roughness: 0.4, metalness: 0.1 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.45, metalness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fe3ff, roughness: 0.05, metalness: 0.3, emissive: 0x2a7fa8, emissiveIntensity: 0.55 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x6f7a85, roughness: 0.4, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b4148, roughness: 0.5, metalness: 0.4 });

  const cy = 0.1, cz = 0.15, SR = 0.95; // sphere centre / radius
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(SR, 24, 16), white);
  sphere.position.set(0, cy, cz); g.add(sphere);
  // reinforcing belts around the sphere (axis z)
  for (const z of [-0.38, 0.62]) {
    const r = Math.sqrt(SR * SR - (z - cz) * (z - cz));
    const belt = new THREE.Mesh(new THREE.TorusGeometry(r + 0.005, 0.055, 6, 32), orange);
    belt.position.set(0, cy, z); g.add(belt);
  }
  // thick front viewport: steel collar + deep glass dome
  const zv = cz + Math.sqrt(SR * SR - 0.16) + 0.0;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.47, 0.3, 20), steel);
  collar.rotation.x = Math.PI / 2; collar.position.set(0, cy, zv); g.add(collar);
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 24), orange);
  collarRing.position.set(0, cy, zv + 0.15); g.add(collarRing);
  const view = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 10), glass);
  view.scale.set(1, 1, 0.65); view.position.set(0, cy, zv + 0.1); g.add(view);
  // side portholes
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 14), glass);
    p.rotation.z = Math.PI / 2; p.position.set(s * 0.93, cy + 0.06, cz); g.add(p);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 16), steel);
    rim.rotation.y = Math.PI / 2; rim.position.set(s * 0.94, cy + 0.06, cz); g.add(rim);
  }
  // hatch tower + lifting lug
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.2, 14), orange);
  hatch.position.set(0, cy + SR + 0.02, cz - 0.1); g.add(hatch);
  const lug = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 14), steel);
  lug.position.set(0, cy + SR + 0.2, cz - 0.1); g.add(lug);
  // ballast tanks + frame + skids
  for (const s of [-1, 1]) {
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.3, 4, 12), orange);
    tank.rotation.x = Math.PI / 2; tank.position.set(s * 0.82, -0.62, 0.05); g.add(tank);
    for (const z of [-0.45, 0.5]) {
      g.add(rod(steel, 0.03, V(s * 0.6, -0.3, z), V(s * 0.8, -0.58, z), 6));
      g.add(rod(steel, 0.03, V(s * 0.8, -0.62, z), V(s * 0.8, -1.02, z), 6));
    }
    g.add(rod(steel, 0.035, V(s * 0.8, -1.02, 0.85), V(s * 0.8, -1.02, -0.8), 6));
  }
  // manipulator arms (shoulder, upper arm, elbow, forearm, two-finger claw)
  for (const s of [-1, 1]) {
    const sh = V(s * 0.38, -0.72, 0.92), el = V(s * 0.5, -0.95, 1.28), wr = V(s * 0.3, -0.7, 1.55);
    const joint = (p, r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), dark); m.position.copy(p); g.add(m); };
    joint(sh, 0.07); joint(el, 0.06); joint(wr, 0.05);
    g.add(rod(steel, 0.035, sh, el, 6)); g.add(rod(steel, 0.03, el, wr, 6));
    for (const f of [-1, 1]) g.add(rod(dark, 0.016, wr, V(wr.x + f * 0.07 * s, wr.y - 0.02, wr.z + 0.2), 5));
  }
  // rear motor pod with ducted prop
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.6, 14), steel);
  pod.rotation.x = Math.PI / 2; pod.position.z = -1.05; g.add(pod);
  const podCap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), orange);
  podCap.rotation.x = -Math.PI / 2; podCap.position.z = -1.35; g.add(podCap);
  const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 24), orange);
  shroud.position.z = -1.55; g.add(shroud);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(rod(steel, 0.015, V(Math.cos(a) * 0.12, Math.sin(a) * 0.12, -1.42), V(Math.cos(a) * 0.3, Math.sin(a) * 0.3, -1.55), 4));
  }
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.3), orange);
  rudder.position.set(0, 0.0, -1.2); g.add(rudder);
  const elevator = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.3), orange);
  elevator.position.set(0, 0.0, -1.2); g.add(elevator);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc9d2da, roughness: 0.3, metalness: 0.6 });
  const { prop, disc } = makeProp(g, { z: -1.57, hubR: 0.06, bladeLen: 0.2, bladeW: 0.08, blades: 4, discR: 0.27, steel, bladeMat });
  // lamp housings either side of the viewport
  const lampDefs = [];
  for (const s of [-1, 1]) {
    const house = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 12), steel);
    house.rotation.x = Math.PI / 2; house.position.set(s * 0.66, -0.17, 0.82); g.add(house);
    lampDefs.push({ pos: V(s * 0.66, -0.17, 0.93), target: V(s * 1.0, -0.45, 9) });
  }
  const rig = makeLamps(g, lampDefs);
  return finishModel(g, { prop, disc }, rig, -1.75, 1.3, { base: [white], accent: [orange], prop: [bladeMat] });
}
