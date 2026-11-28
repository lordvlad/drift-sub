/**
 * Encyclopedia sections (tabs). `Fauna` (the old bestiary) is built in; other tabs register here.
 *
 * registerSection({
 *   id: 'flora' | 'wrecks' | 'terrain' | ...,
 *   title: 'Flora',
 *   entries: [ { id, name, sci?, hint?, depth?: [min,max], facts?: [[label, value], ...],
 *                sheet: { text: [2-3 paragraphs], fun: 'fun fact', wiki: 'English Wikipedia page title' (lead image is fetched at runtime),
 *                         links?: [[label, url], ...] } } ],   // page number = index + 1; locked pages show only the number + `hint`
 *   unlockText?: 'Photograph ... to unlock'   // shown on locked pages
 * });
 *
 * The section's provider listens to bus 'snapshot' ({ rec, shot }) and, when its entry is in frame, calls
 *   enc.unlock(sectionId, entryId, rec, { x, y, frac })   // x,y: NDC centre of the subject in the snapshot, frac: its height as a fraction of frame height
 * (idempotent; a later better/larger shot replaces the picture). Returns a Promise<{ fresh: bool }>; the encyclopedia shows the toast and
 * stores the cropped picture. `enc.found(sectionId, entryId)` tells whether a page is unlocked, `enc.count(sectionId)` how many.
 * `enc` is filled in by src/encyclopedia.js at startup (the core): do not call it at import time, only from handlers.
 */
export const sections = [];
export const enc = { unlock: async () => ({ fresh: false }), found: () => false, count: () => 0, onChange: () => {} };
export function registerSection(def) {
  const i = sections.findIndex((s) => s.id === def.id);
  if (i >= 0) sections[i] = def; else sections.push(def);
  enc.onChange();
}
