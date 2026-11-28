/**
 * Encyclopedia "Wrecks" tab: one page for each of the 20 rare wrecks (src/wrecks/data.js). Common random wrecks get no page.
 * A page unlocks when a snapshot has a named rare wreck (rec.shot.landmarks: type 'wreck' with a rare id) close and big enough in frame.
 * Also adds the test helper __sim.gotoWreck(id).
 */
import { registerSection, enc } from './api.js';
import { RARE_WRECKS } from '../wrecks/data.js';
import { forceRare } from '../wrecks/place.js';

const MIN_FRAC = 0.12, MAX_DIST = 70;
const BY_ID = new Map(RARE_WRECKS.map((w) => [w.id, w]));

registerSection({
  id: 'wrecks',
  title: 'Wrecks',
  unlockText: 'A famous wreck: find it and photograph it from close by, with the whole ship well inside the frame, to unlock this page. A faint brass bell marks the rare ones.',
  entries: RARE_WRECKS.map((w) => ({
    id: w.id, name: w.name, sci: w.sci, hint: w.hint, depth: w.depth, facts: w.facts,
    sheet: { text: w.sheet.text, fun: w.sheet.fun, wiki: w.sheet.wiki, links: w.sheet.links },
  })),
});

export default {
  name: 'wrecks',
  init(game) {
    game.bus.on('snapshot', ({ rec }) => {
      const lms = rec && rec.shot && rec.shot.landmarks;
      if (!lms) return;
      for (const lm of lms) {
        if (lm.type !== 'wreck' || typeof lm.id !== 'string' || !BY_ID.has(lm.id)) continue;
        if (lm.frac < MIN_FRAC || lm.dist > MAX_DIST) continue;
        enc.unlock('wrecks', lm.id, rec, { x: lm.x, y: lm.y, frac: lm.frac });
      }
    });
  },
  update(dt, game) { if (!installed && window.__sim) { installed = true; installDebug(game); } },
};
let installed = false;

/** __sim.gotoWreck(id): forces rare wreck `id` into every wreck feature (clears the cached places), then flies to the nearest wreck (opts as __sim.goto). gotoWreck(null) restores normal placement. */
function installDebug(game) {
  const sim = window.__sim, { field, terrain, sub } = game;
  if (!sim) return;
  sim.gotoWreck = (id, opts = {}) => {
    forceRare(id);
    field.places.resetCells();
    terrain.reset();
    if (!id) return null;
    const f = sim.goto('wreck', { dist: 34, up: 8, ...opts });
    terrain.update(sub.pos.x, sub.pos.z, 99);
    return f && { id: f.id, x: Math.round(f.x), z: Math.round(f.z), r: f.r, depth: Math.round(-f.y) };
  };
}
