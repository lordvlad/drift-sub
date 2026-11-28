/**
 * Model registry for the Encyclopedia's 3D view. Every species with a page registers how to build its in-game model:
 *   registerModel(id, { geometry: () => THREE.BufferGeometry   // fresh geometry (nose +z, up +y); the viewer disposes it
 *                       tint?: THREE.Color | hex (> 15) | css string | [r,g,b] | brightness gain (number <= 15)   // multiplies the vertex colours (the in-game instance / body tint)
 *                       scale?: number                       // extra display scale (default 1; the viewer fits the model to the frame anyway)
 *                       material?: 'creature' | 'plain'      // creature (default): vertex colours x tint, glow attribute `aGlow` if present; plain: tint only
 *                       kind?: 'school-member' | 'single' }) // school-member: shown with a few smaller companions
 * Registering at import time is fine (factories are only called when a viewer opens).
 */
const models = new Map();
export const registerModel = (id, def) => { models.set(id, { kind: 'single', material: 'creature', scale: 1, ...def }); };
export const getModel = (id) => models.get(id) || null;
export const hasModel = (id) => models.has(id);
export const modelIds = () => [...models.keys()];
