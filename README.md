# Drift

A quiet underwater exploration toy: steer a small yellow submarine through an endless, procedurally generated sea (three.js).

- **Desktop:** `W`/`S` thrust, `A`/`D` turn, mouse to steer (click to capture), `Space` rise, `C` dive, `Shift` burst.
- **Waves:** sea state follows your local wind (Open-Meteo, location rounded to ~11 km, never stored); falls back to a slow random drift if location is denied or offline. The "Waves" button cycles auto → still → calm → windy → gusty → stormy.
- **Light:** time of day follows your clock (dawn, morning, day, evening, night hues; "Time" button overrides). Twin headlights: `F` or the "Lamps" button cycles auto (on when dark or deep) / on / off.
- **Fullscreen:** a dismissible banner suggests it a few seconds after diving (hidden where the Fullscreen API is missing, e.g. iPhone Safari).
- **PWA:** installable (manifest + service worker; works offline after the first visit). Add `?nosw` to skip the service worker.
- **Viewfinder:** the camera button (or `P`) enters viewfinder mode: first-person view from the sub's nose, you can turn/aim (mouse, `A`/`D`, drag) but not accelerate. `Space`/`Enter`/shutter takes the shot, the Lamps button (or `F`) works in it, `Esc`/Exit leaves.
- **Selling:** every snapshot is priced when taken (pearls ◎): animals seen (rarer = more, bigger in frame and nearer the centre = more, more individuals = more), species variety, coral and seaweed in the background, visible light rays (none at night), golden hour and deep-dive bonuses. Open it in the album to see the breakdown and sell it (or "Sell all"). Pearls are kept on this device.
- **Species & depths (m):** fish — anthias 2–28, yellow tang 2–30, blue chromis 3–40, cyan damsel 3–32, green wrasse 4–38, coral snapper 15–55, violet basslet 8–48 (rare), sardine 3–50, trevally 6–45, mackerel 8–60, fusilier 5–40, ghost cardinal 28–60 (rare), prism school 5–55 (rare); sharks — blacktip 3–35, grey reef 5–45, tiger 12–60; whales — humpback 8–50, blue 15–60. Definitions live in `src/species.js`.
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
