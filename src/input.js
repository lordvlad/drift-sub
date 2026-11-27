const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class Input {
  constructor(canvas, ui) {
    this.canvas = canvas; this.ui = ui;
    this.keys = new Set(); this.sens = 1;
    this.lookX = 0; this.lookY = 0;
    this.joy = { x: 0, y: 0 }; this.btnUp = false; this.btnDown = false;
    this.boost = false; this.locked = false; this.mode = 'auto'; this.touchUI = false;
    this.coarse = matchMedia('(pointer: coarse)').matches || (matchMedia('(hover: none)').matches && navigator.maxTouchPoints > 0);
    this._bindKeys(); this._bindMouse(); this._bindTouch();
    this.setMode('auto');
  }
  get thrust() { return clamp((this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) + (this.touchUI ? this.joy.y : 0), -1, 1); }
  get turn() { return clamp((this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0), -1, 1); }
  get rise() { return (this.keys.has('Space') || this.keys.has('KeyE') || this.btnUp ? 1 : 0) - (this.keys.has('KeyC') || this.keys.has('KeyQ') || this.btnDown ? 1 : 0); }
  takeLookX() { const v = this.lookX; this.lookX = 0; return v; }
  takeLookY() { const v = this.lookY; this.lookY = 0; return v; }

  setMode(m) {
    this.mode = m;
    this.touchUI = m === 'touch' || (m === 'auto' && this.coarse);
    this.ui.applyMode(this.mode, this.touchUI);
    if (!this.touchUI) { this.joy.x = this.joy.y = 0; this.btnUp = this.btnDown = false; }
  }
  cycleMode() { this.setMode(this.mode === 'auto' ? 'touch' : this.mode === 'touch' ? 'keys' : 'auto'); }

  _bindKeys() {
    addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      this.keys.add(e.code); this.boost = e.shiftKey;
      if (this.mode === 'auto' && this.touchUI && !e.repeat) { this.coarse = false; this.setMode('auto'); }
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); this.boost = e.shiftKey; });
    addEventListener('blur', () => { this.keys.clear(); this.boost = false; });
  }
  _bindMouse() {
    const c = this.canvas; let drag = false;
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === c; });
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      if (this.touchUI && this.mode === 'auto') { this.coarse = false; this.setMode('auto'); }
      drag = true; c.setPointerCapture(e.pointerId);
      if (!this.touchUI && c.requestPointerLock) try { const p = c.requestPointerLock(); p && p.catch && p.catch(() => {}); } catch {}
    });
    c.addEventListener('pointerup', (e) => { drag = false; });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      if (this.locked || drag) { this.lookX += e.movementX; this.lookY += e.movementY; }
    });
  }
  _bindTouch() {
    const ui = this.ui, joyEl = ui.joy, knob = ui.knob;
    let joyId = null, lookId = null, jc = { x: 0, y: 0 }, lp = { x: 0, y: 0 };
    const RMAX = 55;
    const setJoy = (e) => {
      let dx = 0, dy = e.clientY - jc.y; const l = Math.hypot(dx, dy);
      if (l > RMAX) { dx *= RMAX / l; dy *= RMAX / l; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const dz = 0.1, fx = dx / RMAX, fy = -dy / RMAX;
      this.joy.x = Math.abs(fx) < dz ? 0 : fx; this.joy.y = Math.abs(fy) < dz ? 0 : fy;
    };
    joyEl.addEventListener('pointerdown', (e) => {
      e.preventDefault(); joyId = e.pointerId; joyEl.setPointerCapture(joyId);
      const r = joyEl.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; setJoy(e);
    });
    joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) setJoy(e); });
    const endJoy = (e) => { if (e.pointerId !== joyId) return; joyId = null; this.joy.x = this.joy.y = 0; knob.style.transform = 'translate(0,0)'; };
    joyEl.addEventListener('pointerup', endJoy); joyEl.addEventListener('pointercancel', endJoy);
    const hold = (el, key) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); this[key] = true; el.setPointerCapture(e.pointerId); el.classList.add('on'); });
      const off = () => { this[key] = false; el.classList.remove('on'); };
      el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
    };
    hold(ui.btnUp, 'btnUp'); hold(ui.btnDown, 'btnDown');
    // look: touches on the canvas
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      if (this.mode === 'auto' && !this.touchUI) { this.coarse = true; this.setMode('auto'); }
      lookId = e.pointerId; lp = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      this.lookX += (e.clientX - lp.x) * 1.4; this.lookY += (e.clientY - lp.y) * 1.4; lp = { x: e.clientX, y: e.clientY };
    });
    const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
    c.addEventListener('pointerup', endLook); c.addEventListener('pointercancel', endLook);
  }
}
