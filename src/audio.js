/**
 * Dinlendirici ses tasarımı: yumuşak su sesi, hafif rüzgâr, seyrek kuş / baykuş / çan,
 * tüm efektler sinüs tabanlı ve hafif yankılı. Sert (kare / testere dişi, yüksek frekanslı çıtırtı) ses yok.
 * Su altında ses kısılır (alçak geçiren filtre) ve yumuşak kabarcık sesleri duyulur.
 */
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99]; // C majör pentatonik (do re mi sol la…)
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.night = 0; this.under = 0; this.bubT = 3; this.zone = 1; this.birdT = 2; this.gustT = 4; this.owlT = 12; this.frogT = 8; this.leafT = 6; }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 18000; this.lp.Q.value = 0.4;
    this.master.connect(this.lp); this.lp.connect(ctx.destination);
    // yumuşak yankı (üretilen darbe cevabı)
    const len = (ctx.sampleRate * 2.4) | 0, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * (t < 0.01 ? t * 100 : 1); } }
    this.rev = ctx.createConvolver(); this.rev.buffer = ir; this.revG = ctx.createGain(); this.revG.gain.value = 0.55; this.rev.connect(this.revG); this.revG.connect(this.master);
    this.send = ctx.createGain(); this.send.gain.value = 1; this.send.connect(this.rev);
    const noiseBuf = (sec, brown) => { const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate); const d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; } return b; };
    this.noise = noiseBuf(2, false); this.soft = noiseBuf(2, true);
    const mk = (buf, type, freq, gain, q = 0.7) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(this.master); s.start(); return { s, f, g }; };
    this.lap = mk(noiseBuf(6, true), 'lowpass', 380, 0.13); this.wind = mk(this.soft, 'bandpass', 520, 0.02, 0.4);
    // dalga ritmi: yavaş, düzensiz kabarıp inen gürültü
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11; const lg = ctx.createGain(); lg.gain.value = 0.05; lfo.connect(lg); lg.connect(this.lap.g.gain); lfo.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.05; const lg2 = ctx.createGain(); lg2.gain.value = 0.015; lfo2.connect(lg2); lg2.connect(this.wind.g.gain); lfo2.start();
    // orman: yaprak hışırtısı (rüzgâr esintileriyle kabarır) + hafif yaprak sesi
    this.rustle = mk(this.noise, 'bandpass', 2300, 0.004, 0.55); this.leaf = mk(this.soft, 'bandpass', 1000, 0.01, 0.4);
    const lfo3 = ctx.createOscillator(); lfo3.frequency.value = 0.07; const lg3 = ctx.createGain(); lg3.gain.value = 0.007; lfo3.connect(lg3); lg3.connect(this.leaf.g.gain); lfo3.start();
    this.setZone(this.zone, true);
  }
  setMotor(v) {
    if (!this.ctx) return;
    if (!this.mo) { const ctx = this.ctx; const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 48; const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 24; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 170; const g = ctx.createGain(); g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master); o.start(); o2.start(); this.mo = { o, o2, g, f }; }
    const t = this.ctx.currentTime; this.mo.g.gain.setTargetAtTime(v * 0.05, t, 0.2); this.mo.o.frequency.setTargetAtTime(44 + v * 30, t, 0.25); this.mo.o2.frequency.setTargetAtTime(22 + v * 14, t, 0.25); this.mo.f.frequency.setTargetAtTime(140 + v * 120, t, 0.25);
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.8; }
  setNight(n) { this.night = n; }
  /** z: 1 = gölün yanında, 0 = göle uzak / ormanın içinde (su kısılır, orman sesleri artar) */
  setZone(z, now) {
    z = Math.max(0, Math.min(1, z)); if (!this.ctx || (!now && Math.abs(z - this.zone) < 0.03)) { this.zone = z; return; } this.zone = z; if (this.under) return;
    const t = this.ctx.currentTime; this.lap.g.gain.setTargetAtTime(0.035 + 0.1 * z, t, 0.8); this.leaf.g.gain.setTargetAtTime(0.008 + 0.012 * (1 - z), t, 1.2);
  }
  /** su altı: ses yumuşakça kısılır */
  setUnder(u) {
    if (!this.ctx || u === this.under) return; this.under = u; const t = this.ctx.currentTime;
    this.lp.frequency.setTargetAtTime(u ? 650 : 18000, t, u ? 0.25 : 0.3); this.lap.g.gain.setTargetAtTime(u ? 0.07 : 0.035 + 0.1 * this.zone, t, 0.4); this.rustle.g.gain.setTargetAtTime(u ? 0 : 0.004, t, 0.4);
  }
  update(dt) {
    if (!this.ctx) return; const n = this.night, z = this.zone, ctx = this.ctx;
    if (this.under) { this.bubT -= dt; if (this.bubT <= 0) { this.bubT = 4 + Math.random() * 6; this.sfx('bubble'); } return; }
    // rüzgâr esintisi: ağaç yapraklarında kabarıp sönen hışırtı
    this.gustT -= dt; if (this.gustT <= 0) { this.gustT = 5 + Math.random() * 9; const g = this.rustle.g.gain, t = ctx.currentTime, pk = 0.012 + 0.022 * (1 - z) + 0.006 * Math.random(); g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(pk, t + 1.8 + Math.random()); g.linearRampToValueAtTime(0.004, t + 5.5 + Math.random() * 2); this.rustle.f.frequency.setTargetAtTime(1800 + Math.random() * 1400, t, 0.5); }
    if (n < 0.5) { // gündüz: kuş sesleri (ormanda daha sık)
      this.birdT -= dt; if (this.birdT <= 0) { this.birdT = (0.9 + Math.random() * 3.2) * (0.55 + 0.9 * z); this.bird(); }
    } else { // gece: baykuş, kurbağa
      this.owlT -= dt; if (this.owlT <= 0) { this.owlT = 12 + Math.random() * 18; this.owl(); }
      this.frogT -= dt; if (this.frogT <= 0) { this.frogT = (4 + Math.random() * 8) * (z > 0.3 ? 1 : 2.5); this.frog(); }
    }
  }
  /** tek bir yumuşak cıvıltı notası: süzülen sinüs, yavaş giriş (tıkırtı yok) */
  chirp(dest, t, f0, f1, dur, gain) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0003, t + dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.03);
  }
  bird() {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.02, pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; const out = ctx.createGain(); out.gain.value = 0.5 + 0.5 * (1 - this.zone);
    if (pan) { pan.pan.value = Math.random() * 1.8 - 0.9; out.connect(pan); pan.connect(this.master); pan.connect(this.send); } else { out.connect(this.master); out.connect(this.send); }
    const r = Math.random(), C = (t, a, b, d, g) => this.chirp(out, t, a, b, d, g);
    if (r < 0.3) { // serçe / ispinoz: kısa yükselen cıvıltılar
      const n = 3 + (Math.random() * 3 | 0), base = 3000 + Math.random() * 1100; for (let i = 0; i < n; i++) C(t0 + i * (0.17 + Math.random() * 0.06), base * (0.95 + Math.random() * 0.1), base * (1.15 + Math.random() * 0.2), 0.11 + Math.random() * 0.03, 0.017);
    } else if (r < 0.58) { // karatavuk / bülbül: akıcı, değişken ezgi
      const n = 6 + (Math.random() * 4 | 0); let t = t0, f = 1900 + Math.random() * 700; for (let i = 0; i < n; i++) { const f2 = Math.max(1500, Math.min(3600, f * (0.75 + Math.random() * 0.6))); const d = 0.1 + Math.random() * 0.12; C(t, f, f2, d, 0.02); t += d * 0.9 + 0.02; f = f2; }
    } else if (r < 0.74) { // kanarya: hızlı titreşimli çırpınış
      const n = 8 + (Math.random() * 6 | 0), base = 3300 + Math.random() * 700; for (let i = 0; i < n; i++) C(t0 + i * 0.07, base * (1 + (i % 2) * 0.14), base * (1.06 + ((i + 1) % 2) * 0.14), 0.09, 0.009);
    } else if (r < 0.88) { // guguk: uzaktan iki notalı
      const rep = 1 + (Math.random() * 3 | 0); for (let i = 0; i < rep; i++) { const t = t0 + i * 1.0; C(t, 720, 700, 0.3, 0.03); C(t + 0.42, 580, 560, 0.34, 0.026); }
    } else { // kumru: alçak, yumuşak "ku-kuuu-ku"
      const t = t0; C(t, 400, 430, 0.22, 0.026); C(t + 0.35, 430, 400, 0.5, 0.03); C(t + 1.0, 410, 380, 0.4, 0.024);
    }
  }
  /** baykuş "huu-huuu" */
  owl() {
    const ctx = this.ctx, t0 = ctx.currentTime; [[0, 392, 0.55], [0.7, 330, 1.0]].forEach(([d, f, dur]) => { const o = ctx.createOscillator(), g = ctx.createGain(); const st = t0 + d; o.type = 'sine'; o.frequency.setValueAtTime(f * 1.04, st); o.frequency.exponentialRampToValueAtTime(f, st + 0.15); o.frequency.exponentialRampToValueAtTime(f * 0.93, st + dur); g.gain.setValueAtTime(0.0001, st); g.gain.linearRampToValueAtTime(0.02, st + 0.15); g.gain.linearRampToValueAtTime(0.013, st + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0004, st + dur); o.connect(g); g.connect(this.master); g.connect(this.send); o.start(st); o.stop(st + dur + 0.05); });
  }
  /** uzaktan yumuşak kurbağa */
  frog() {
    const ctx = this.ctx, t0 = ctx.currentTime, n = 1 + (Math.random() * 3 | 0), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; const out = ctx.createGain(); out.gain.value = 1; if (pan) { pan.pan.value = Math.random() * 2 - 1; out.connect(pan); pan.connect(this.master); pan.connect(this.send); } else out.connect(this.master);
    for (let i = 0; i < n; i++) { const st = t0 + i * 0.34; this.chirp(out, st, 200, 340, 0.2, 0.013); this.chirp(out, st + 0.16, 340, 240, 0.18, 0.009); }
  }
  /** çan: sinüs + hafif üst ton, uzun sönüm, yankıya gönderilir */
  bell(freq, gain, dur, delay = 0) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime + delay;
    [[1, 1], [2.01, 0.22], [3.0, 0.08]].forEach(([m, a]) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = freq * m; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain * a, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0004, t + dur / m); o.connect(g); g.connect(this.master); g.connect(this.send); o.start(t); o.stop(t + dur + 0.1); });
  }
  burst(freq, dur, gain, type = 'bandpass', q = 0.8, sweepTo, wet = 0.4) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime; const s = ctx.createBufferSource(); s.buffer = this.soft; s.loopStart = Math.random() * 1.5; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur); f.Q.value = q; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(0.04, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); s.connect(f); f.connect(g); g.connect(this.master); if (wet) { const w = this.ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.send); } s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  tone(freq, dur, gain, type = 'sine', delay = 0, to, wet = 0.5) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime + delay; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type === 'square' || type === 'sawtooth' ? 'sine' : type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); o.connect(g); g.connect(this.master); if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.send); } o.start(t); o.stop(t + dur + 0.05);
  }
  sfx(name) {
    switch (name) {
      case 'splash': this.burst(900, 0.6, 0.12, 'bandpass', 0.5, 320); break;
      case 'plop': this.burst(450, 0.3, 0.12, 'bandpass', 0.9, 220); this.tone(360, 0.22, 0.07, 'sine', 0, 170); break;
      case 'cast': this.burst(380, 0.5, 0.06, 'bandpass', 0.9, 1400); break;
      case 'nibble': this.tone(300, 0.35, 0.03, 'sine', 0, 380, 0.6); break;
      case 'bite': this.tone(300, 0.35, 0.09, 'sine', 0, 150); this.burst(700, 0.35, 0.07); break;
      case 'tick': break; // makara tıkırtısı kaldırıldı
      case 'snap': this.burst(500, 0.35, 0.08, 'lowpass', 0.6, 160); this.tone(260, 0.3, 0.06, 'sine', 0, 110); break;
      case 'win': [0, 2, 4, 5, 7].forEach((q, i) => this.bell(PENTA[q] * 2, 0.045, 1.8, i * 0.12)); break;
      case 'row': this.burst(360, 0.9, 0.035, 'lowpass', 0.5, 200, 0.3); break;
      case 'ui': this.bell(PENTA[4] * 2, 0.03, 0.7); break;
      case 'coin': this.bell(PENTA[5] * 2, 0.04, 1.0); this.bell(PENTA[7] * 2, 0.035, 1.2, 0.09); break;
      case 'buy': [0, 2, 4, 6].forEach((q, i) => this.bell(PENTA[q] * 2, 0.04, 1.2, i * 0.09)); break;
      case 'ding': this.bell(PENTA[6] * 2, 0.05, 1.6); this.bell(PENTA[8] * 2, 0.03, 1.8, 0.14); break;
      case 'fire': this.burst(420, 0.9, 0.09, 'bandpass', 0.7, 900); this.tone(140, 0.7, 0.05, 'sine', 0, 90); break;
      case 'sizzle': break; // çıtırtı kaldırıldı
      case 'bowdraw': this.tone(170, 0.4, 0.022, 'sine', 0, 250, 0.2); break;
      case 'bowshot': this.burst(650, 0.28, 0.06, 'bandpass', 0.8, 280, 0.3); this.tone(150, 0.18, 0.05, 'sine', 0, 90, 0.2); break;
      case 'thud': this.tone(120, 0.3, 0.07, 'sine', 0, 70, 0.25); this.burst(300, 0.15, 0.04, 'lowpass', 0.6, 150, 0.1); break;
      case 'wade': break; // adım / su tıkırtısı kaldırıldı
      case 'bubble': { const f = 300 + Math.random() * 200; this.tone(f, 0.5, 0.02, 'sine', 0, f * 1.5, 0.8); break; }
    }
  }
}
