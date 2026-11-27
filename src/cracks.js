import { mulberry32 } from './noise.js';

/**
 * Cracks in the camera lens. A fixed set of crack origins is generated once; origin i appears when damage exceeds its
 * threshold and grows with further damage, so repairs make the cracks heal again.
 */
const rnd = mulberry32(20240607);
const ORIGINS = Array.from({ length: 9 }, (_, i) => {
  const rays = [], n = 5 + Math.floor(rnd() * 4);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (rnd() - 0.5) * 0.7, pts = [[0, 0]]; let x = 0, y = 0, ang = a;
    const segs = 5 + Math.floor(rnd() * 4), kids = [];
    for (let j = 0; j < segs; j++) {
      ang += (rnd() - 0.5) * 0.7; const l = (0.35 + rnd() * 0.6) / (1 + j * 0.25);
      x += Math.cos(ang) * l; y += Math.sin(ang) * l; pts.push([x, y]);
      if (j > 0 && rnd() < 0.45) { // side branch
        const ba = ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.7), bp = [[x, y]]; let bx = x, by = y;
        for (let m = 0; m < 3; m++) { bx += Math.cos(ba + (rnd() - 0.5) * 0.6) * 0.3 / (1 + m * 0.4); by += Math.sin(ba + (rnd() - 0.5) * 0.6) * 0.3 / (1 + m * 0.4); bp.push([bx, by]); }
        kids.push(bp);
      }
    }
    rays.push(pts, ...kids);
  }
  return { x: 0.12 + rnd() * 0.76, y: 0.14 + rnd() * 0.72, thr: 0.04 + i * 0.1, rays };
});

export const hasCracks = (damage) => damage > 0.04;

export function drawCracks(ctx, w, h, damage) {
  if (!hasCracks(damage)) return;
  const unit = Math.min(w, h);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const o of ORIGINS) {
    if (damage <= o.thr) continue;
    const sev = Math.min(1, 0.25 + (damage - o.thr) * 3), sc = unit * (0.035 + 0.07 * sev), ox = o.x * w, oy = o.y * h;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, sc * 0.5); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, sc * 0.5, 0, 6.283); ctx.fill();
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? 'rgba(255,255,255,0.8)' : 'rgba(10,20,30,0.55)'; ctx.lineWidth = pass ? Math.max(1, unit * 0.0016) : Math.max(2, unit * 0.0042);
      ctx.beginPath();
      for (const r of o.rays) {
        const upto = Math.max(1, Math.round(r.length * sev)); // crack length grows with damage
        ctx.moveTo(ox + r[0][0] * sc, oy + r[0][1] * sc);
        for (let i = 1; i < upto; i++) ctx.lineTo(ox + r[i][0] * sc, oy + r[i][1] * sc);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
