# Drift

A quiet underwater exploration toy: steer a small yellow submarine through an endless, procedurally generated sea (three.js).

- **Desktop:** `W`/`S` thrust, `A`/`D` turn, mouse to steer (click to capture), `Space` rise, `C` dive, `Shift` burst.
- **Touch:** left stick = forward/back only, drag elsewhere to steer, ▲ ▼ rise/dive. The "Controls" button (top right) cycles auto / touch / keys.
- World = pure function of `?seed=N`; only a 5×5 window of seabed chunks is ever in memory.

```
bun install
bun run dev      # build + serve on :8080
```

Pushing to `main` deploys `dist/` to GitHub Pages via `.github/workflows/deploy.yml`
(repo Settings → Pages → Source: GitHub Actions).
