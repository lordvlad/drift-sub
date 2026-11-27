/** Sea state from the user's local wind (Open-Meteo, no key). Coordinates are rounded to ~11 km and never stored. */
export const STATES = ['still', 'calm', 'windy', 'gusty', 'stormy'];

// amp: max wave height (m) · freq: wave-number scale · speed: phase speed · gust: gust modulation 0..1
// dim: light multiplier · sway: seaweed/current multiplier
export const PRESETS = {
  still:  { amp: 0.03, freq: 0.8, speed: 0.5, gust: 0,    dim: 1,    sway: 0.35 },
  calm:   { amp: 0.28, freq: 0.9, speed: 0.8, gust: 0.1,  dim: 1,    sway: 0.8 },
  windy:  { amp: 0.8,  freq: 1.0, speed: 1.2, gust: 0.15, dim: 0.92, sway: 1.5 },
  gusty:  { amp: 1.1,  freq: 1.1, speed: 1.5, gust: 0.7,  dim: 0.85, sway: 2.0 },
  stormy: { amp: 2.2,  freq: 1.2, speed: 2.0, gust: 0.4,  dim: 0.62, sway: 3.0 },
};

export function classify(wind, gust) { // km/h at 10 m
  if (wind >= 50 || gust >= 75) return 'stormy';
  if (gust >= 40 && gust > wind * 1.5) return 'gusty';
  if (wind >= 20 || gust >= 40) return 'windy';
  if (wind < 4 && gust < 10) return 'still';
  return 'calm';
}

export class Weather {
  constructor(onChange) {
    this.mode = 'auto'; this.detected = 'calm'; this.status = 'idle'; this.onChange = onChange;
    this.cur = { ...PRESETS.calm }; this.timer = 0; this.started = false; this.live = false; this.walkT = 60;
  }
  get state() { return this.mode === 'auto' ? this.detected : this.mode; }
  setMode(m) { this.mode = m; if (m === 'auto') this.refresh(); this.onChange(); }
  cycle() { const all = ['auto', ...STATES]; this.setMode(all[(all.indexOf(this.mode) + 1) % all.length]); }
  start() { if (this.started) return; this.started = true; this.refresh(); this.timer = setInterval(() => this.mode === 'auto' && this.refresh(true), 15 * 60e3); }
  async refresh(quiet) {
    if (!navigator.geolocation) { this.status = 'unavailable'; this.live = false; this.onChange(); return; }
    try {
      if (!this.pos || !quiet) {
        this.status = 'locating'; this.onChange();
        this.pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(
          (p) => res([p.coords.latitude, p.coords.longitude]), rej, { timeout: 15000, maximumAge: 3600e3 }));
      }
      const [la, lo] = this.pos.map((v) => v.toFixed(1));
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh`);
      const j = (await r.json()).current;
      this.detected = classify(j.wind_speed_10m, j.wind_gusts_10m); this.live = true;
      this.status = `${Math.round(j.wind_speed_10m)} km/h, gusts ${Math.round(j.wind_gusts_10m)}`;
    } catch (e) { this.status = 'unavailable'; this.live = false; }
    this.onChange();
  }
  /** ease current parameters toward the target preset */
  /** no live data (denied / offline / CORS): let the sea state wander by itself, one step at a time */
  walk(dt) {
    if (this.live || this.mode !== 'auto' || this.status === 'locating' || this.status === 'idle') return;
    this.walkT -= dt; if (this.walkT > 0) return;
    this.walkT = 70 + Math.random() * 110;
    const i = STATES.indexOf(this.detected), w = [0.5, 1, 1, 0.6, 0.25]; // stormy is rare
    const opts = [i - 1, i + 1].filter((j) => j >= 0 && j < STATES.length);
    const stay = Math.random() < 0.35; if (stay) return;
    const tot = opts.reduce((a, j) => a + w[j], 0); let r = Math.random() * tot;
    for (const j of opts) { r -= w[j]; if (r <= 0) { this.detected = STATES[j]; break; } }
    this.onChange();
  }
  update(dt) {
    this.walk(dt);
    const t = PRESETS[this.state], k = 1 - Math.exp(-dt * 0.5), c = this.cur;
    for (const key in t) c[key] += (t[key] - c[key]) * k;
  }
}
