// Registers the 3D-view models of the core species (fauna.js): fish, squid, sharks, rays, dolphins, orcas, whales.
// Tints mirror what fauna.js applies in the sea (instance colours for schools, bodyTint for solitary animals).
import * as THREE from 'three';
import { registerModel } from './registry.js';
import { fishGeometry, mantaGeometry, orcaGeometry, dolphinGeometry } from '../creatures.js';
import { sharkGeometry } from './shark.js';
import { humpbackGeometry, blueWhaleGeometry } from './whale.js';
import { squidGeometry, giantSquidGeometry } from './squid.js';
import { FISH, SQUID, SHARKS, MANTAS, WHALES, GIANT_SQUID } from '../species.js';

/** middle of the species' body-tint range (species.js bodyTint without the random part) */
const body = (sp) => new THREE.Color().setHSL(sp.hue, 1, 0.5).lerp(new THREE.Color(1, 1, 1), 1 - (sp.sat[0] + sp.sat[1]) / 2).multiplyScalar((sp.val[0] + sp.val[1]) / 2);
const mix = (cols) => new THREE.Color(cols[0]).lerp(new THREE.Color(cols[cols.length - 1]), 0.5);

for (const sp of FISH) {
  const rainbow = !sp.colors;
  registerModel(sp.id, {
    kind: 'school-member', tint: rainbow ? 0xffffff : mix(sp.colors),
    geometry: () => {
      const g = fishGeometry();
      if (rainbow) {   // rainbow runner: a hue ramp along the body
        const p = g.attributes.position, c = g.attributes.color, k = new THREE.Color();
        for (let i = 0; i < p.count; i++) { k.setHSL((0.5 - p.getZ(i)) * 0.95, 0.8, 0.55); c.setXYZ(i, k.r * 1.25, k.g * 1.25, k.b * 1.25); }
      }
      return g;
    },
  });
}
for (const sp of SQUID) registerModel(sp.id, { kind: 'school-member', tint: mix(sp.colors), geometry: squidGeometry });
for (const sp of SHARKS) registerModel(sp.id, { tint: body(sp), geometry: () => sharkGeometry(sp.id) });
for (const sp of MANTAS) registerModel(sp.id, { tint: body(sp), geometry: mantaGeometry });
for (const sp of GIANT_SQUID) registerModel(sp.id, { tint: body(sp), geometry: giantSquidGeometry });
registerModel('dolphin', { kind: 'school-member', tint: new THREE.Color().setHSL(0.58, 0.12, 0.5).lerp(new THREE.Color(1, 1, 1), 0.88), geometry: dolphinGeometry });
registerModel('orca', { tint: new THREE.Color().setHSL(0.6, 0.04, 0.5).lerp(new THREE.Color(1, 1, 1), 0.96), geometry: orcaGeometry });
for (const sp of WHALES) registerModel(sp.id, { tint: body(sp), geometry: sp.id === 'blue' ? blueWhaleGeometry : humpbackGeometry });
