/**
 * Encyclopedia "Flora" tab: the corals, sponges, weeds and vent organisms the sea actually grows (ids = templates.js FLORA, one id per decor kind).
 * Page content: src/data/flora-sheets.js. Detection: photo.js scorePhoto -> shot.flora (src/encyclopedia/flora-detect.js). Unlock rule below.
 */
import { registerSection, enc } from './api.js';
import { bus } from '../bus.js';
import { FLORA } from '../templates.js';
import { FLORA_SHEETS } from '../data/flora-sheets.js';

const inat = (q) => ['iNaturalist', 'https://www.inaturalist.org/taxa/search?q=' + encodeURIComponent(q)];

registerSection({
  id: 'flora',
  title: 'Flora',
  unlockText: 'Photograph this plant, coral or reef organism, close enough to fill a fair part of the frame, to unlock the page.',
  entries: FLORA.map((id) => {
    const s = FLORA_SHEETS[id];
    return { id, name: s.name, sci: s.sci, hint: s.hint, depth: s.depth, facts: s.facts, sheet: { text: s.text, fun: s.fun, wiki: s.wiki, links: [inat(s.inat)] } };
  }),
});

/** unlock rule: one plant clearly in frame (>= 6 % of the frame height), or a patch of 5+ with the nearest at >= 3 % */
export const floraSeen = (f) => (f.count >= 1 && f.frac >= 0.06) || (f.count >= 5 && f.frac >= 0.03);
/** page-picture size: a plant that overfills the frame (lens pressed against it) makes a poor portrait, so it ranks below a well-framed shot */
const portraitFrac = (frac) => (frac > 0.85 ? Math.max(0.3, 0.85 - (frac - 0.85) * 0.6) : frac);

export default {
  name: 'flora',
  init() {
    bus.on('snapshot', ({ rec, shot }) => {
      for (const f of (shot && shot.flora) || []) {
        if (floraSeen(f)) Promise.resolve(enc.unlock('flora', f.id, rec, { x: f.x, y: f.y, frac: portraitFrac(f.frac) })).catch((e) => console.warn('flora unlock failed', e));
      }
    });
  },
};
