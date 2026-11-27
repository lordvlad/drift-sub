# Drift

A quiet underwater exploration toy: steer a small yellow submarine through an endless, procedurally generated sea (three.js).

- **Desktop:** `W`/`S` thrust, `A`/`D` turn, mouse to steer (click to capture), `Space` rise, `C` dive, `Shift` burst.
- **Waves:** sea state follows your local wind (Open-Meteo, location rounded to ~11 km, never stored); falls back to a slow random drift if location is denied or offline. The "Waves" button cycles auto → still → calm → windy → gusty → stormy.
- **Light:** time of day follows your clock (dawn, morning, day, evening, night hues; "Time" button overrides). Twin headlights: `F` or the "Lamps" button cycles auto (on when dark or deep) / on / off.
- **Touch:** left stick = forward/back only, drag elsewhere to steer, ▲ ▼ rise/dive. The "Controls" button (top right) cycles auto / touch / keys.
- World = pure function of `?seed=N`; only a 5×5 window of seabed chunks is ever in memory.

```
bun install
bun run dev      # build + serve on :8080
```

Pushing to `main` deploys `dist/` to GitHub Pages via `.github/workflows/deploy.yml`
(repo Settings → Pages → Source: GitHub Actions).
