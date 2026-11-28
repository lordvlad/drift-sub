/**
 * Feature plug-ins. A feature is a module exporting { name, init(game), update?(dt, game) }.
 * Add yours by importing it here and listing it in FEATURES. `game` is built in main.js (see `game` there).
 */
import logbook from './features/logbook.js';
import wardrobe from './features/wardrobe.js';
import gallery from './features/gallery.js';
import { equipment } from './features/equipment.js';
import commissions from './features/commissions.js';
import deep from './groups/deep.js';
import places from './features/places.js';
import pelagic from './groups/pelagic.js';
import flora from './encyclopedia/flora.js';   // registers the Encyclopedia Flora tab at import time
import terrain from './encyclopedia/terrain-pages.js';   // registers the Encyclopedia Terrain tab at import time
import wrecks from './encyclopedia/wrecks.js';   // registers the Encyclopedia Wrecks tab at import time (rare wrecks, src/wrecks)
export const FEATURES = [logbook, wardrobe, gallery, commissions, equipment, deep, places, pelagic, flora, terrain, wrecks];
