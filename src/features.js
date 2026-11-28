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
export const FEATURES = [logbook, wardrobe, gallery, commissions, equipment, deep, places, pelagic];
