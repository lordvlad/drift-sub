/** Soft generative underwater ambience: brown-noise wash, slow pad, engine hum, distant whale song. */
export class Audio {
  constructor() { this.ctx = null; this.muted = false; this.whaleT = 0; }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(c.destination);
    // brown noise wash
    const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    const ns = c.createBufferSource(); ns.buffer = buf; ns.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const ng = c.createGain(); ng.gain.value = 0.35; ns.connect(lp); lp.connect(ng); ng.connect(this.master); ns.start();
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 140; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    // pad: pentatonic drones with slow tremolo
    for (const f of [110, 164.8, 220, 277.2, 329.6]) {
      const o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lgn = c.createGain();
      o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004);
      g.gain.value = 0.012; l.frequency.value = 0.03 + Math.random() * 0.07; lgn.gain.value = 0.011;
      l.connect(lgn); lgn.connect(g.gain); o.connect(g); g.connect(this.master); o.start(); l.start();
    }
    // engine
    this.eng = c.createOscillator(); this.eng.type = 'sawtooth'; this.eng.frequency.value = 50;
    this.engF = c.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 160;
    this.engG = c.createGain(); this.engG.gain.value = 0; this.eng.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.master); this.eng.start();
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.1); }
  update(dt, sub, whaleLevel) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, w = Math.abs(sub.omega);
    this.eng.frequency.setTargetAtTime(38 + w * 1.6, t, 0.2);
    this.engF.frequency.setTargetAtTime(120 + w * 6, t, 0.2);
    this.engG.gain.setTargetAtTime(Math.min(0.05, w * 0.0022), t, 0.2);
    this.whaleT -= dt;
    if (whaleLevel > 0.03 && this.whaleT <= 0) { this.whaleCall(whaleLevel); this.whaleT = 9 + Math.random() * 10; }
  }
  whaleCall(level) {
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    const base = 90 + Math.random() * 60, dur = 4 + Math.random() * 3;
    o.type = 'sine'; f.type = 'lowpass'; f.frequency.value = 500;
    o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 2.2, t + dur * 0.4); o.frequency.exponentialRampToValueAtTime(base * 0.8, t + dur);
    const v = c.createOscillator(), vg = c.createGain(); v.frequency.value = 5; vg.gain.value = 4; v.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18 * level, t + dur * 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); v.start(t); o.stop(t + dur + 0.1); v.stop(t + dur + 0.1);
  }
}
