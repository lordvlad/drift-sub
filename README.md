# Drift

A quiet underwater exploration toy: steer a small yellow submarine through an endless, procedurally generated sea (three.js).

- **Desktop:** `W`/`S` thrust, `A`/`D` turn, mouse to steer (click to capture), `Space` rise, `C` dive, `Shift` burst.
- **Waves:** sea state follows your local wind (Open-Meteo, location rounded to ~11 km, never stored); falls back to a slow random drift if location is denied or offline. The "Waves" button cycles auto → still → calm → windy → gusty → stormy.
- **Controls UI:** every control is an icon button (hover for the label); tapping one briefly shows its new state (e.g. "lamps on") in the same quiet line as the calming notes.
- **Light:** time of day follows your clock (dawn, morning, day, evening, night hues; "Time" button overrides). Twin headlights: `F` or the "Lamps" button cycles auto (on when dark or deep) / on / off.
- **Fullscreen:** a dismissible banner suggests it a few seconds after diving (hidden where the Fullscreen API is missing, e.g. iPhone Safari).
- **PWA:** installable (manifest + service worker; works offline after the first visit). Add `?nosw` to skip the service worker.
- **Viewfinder:** the camera button (or `P`) enters viewfinder mode: first-person view from the sub's nose, you can turn/aim (mouse, `A`/`D`, drag) but not accelerate. `Space`/`Enter`/shutter takes the shot, the Lamps button (or `F`) works in it, `Esc`/Exit leaves.
- **Selling:** every snapshot is priced when taken (pearls ◎): animals seen (rarer = more, bigger in frame and nearer the centre = more, more individuals = more), species variety, coral and seaweed in the background, visible light rays (none at night), golden hour and deep-dive bonuses. Prices are hidden: you only learn what a shot was worth after selling it, so choose what to sell by judging the composition yourself. Compositions you already sold are remembered (up to 400, on this device): each earlier sale of a similar shot (same species, group size, side of frame, scenery, depth band and light) cuts the price by ×0.55, down to ×0.1. Pearls are kept on this device.
- **Shy animals:** how far animals keep from the sub grows steeply with its speed. Drift in slowly for close-ups; rush in and fish schools scatter (individual fish dart away), sharks drop their curiosity and bolt, dolphins/orcas/mantas/giant squid turn and speed off, whales can't outrun you but lumber away.
- **Time of day:** at night about half the fish schools are hidden in the reef, firefly squid are much more common, sharks and giant squid show up more, dolphins and mantas less; dusk and dawn sit in between.
- **Species & depths (m):** fish — anthias 2–28, yellow tang 2–30, blue chromis 3–40, cyan damsel 3–32, green wrasse 4–38, coral snapper 15–55, violet basslet 8–48 (rare), sardine 3–50, trevally 6–45, mackerel 8–60, fusilier 5–40, ghost cardinal 28–60 (rare), prism school 5–55 (rare); sharks — blacktip 3–35, grey reef 5–45, tiger 12–60; whales — humpback 8–50, blue 15–60; squid — bigfin reef squid 2–30 (schools of 5–18), firefly squid 25–60 (glowing schools of 30–90, rare), giant squid 40–60 (solitary, very rare); manta ray 3–40; dolphins 1–25 (pods of 3–9); orcas 2–40 (pods of 2–6). Every large animal stays clear of the seabed. Definitions live in `src/species.js`.
- **Damage:** hidden, no health bar. Hard bumps hurt: rocks and steep ground most, coral and whales a lot, flat sand only a little; ploughing through seaweed scrapes the hull. Damage shows as a red glow growing from the screen edges, a lower safe dive depth (down to 40% of 60 m at worst), and cracks on the camera lens (visible in the viewfinder and baked into snapshots, which sell for much less). The sub repairs itself slowly (a full wreck mends in about 12 minutes of play).
- **Snapshots:** `P` or the camera button captures what the sub sees (hull hidden, up to 1920 px, JPEG). The album keeps the newest 100 in IndexedDB on your device; open it from "Album", view, download or delete. Nothing is uploaded.
- **Depth:** left-side gauge shows depth; the sub is limited to 60 m (turns red and pushes back near the limit) even though the seabed goes deeper.
- **Touch:** left lever = thrust only, drag elsewhere to steer, ▲ ▼ rise/dive. The "Controls" button (top right) cycles auto / touch / keys.
- World = pure function of `?seed=N`; only a 5×5 window of seabed chunks is ever in memory.

```
bun install
bun run dev      # build + serve on :8080
```

Pushing to `main` deploys `dist/` to GitHub Pages via `.github/workflows/deploy.yml`
(repo Settings → Pages → Source: GitHub Actions).
