// Synthesized sound: every effect is built from WebAudio oscillators and noise,
// so the game ships no audio files and makes no network request. Music is a small
// step sequencer that starts on the first user gesture.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.enabled = typeof window !== 'undefined' && !!window.AudioContext;
  }

  // Create the context lazily, on a gesture, so browsers allow playback.
  ensure() {
    if (!this.enabled || this.ctx) return;
    try {
      this.ctx = new window.AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.14;
      this.musicGain.connect(this.master);
    } catch (err) {
      this.enabled = false;
    }
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.15, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  sfx(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'shoot': this.tone(880, 0.07, 'square', 0.06, 420); break;
      case 'hit': this.tone(220, 0.05, 'square', 0.08, 140); break;
      case 'explode': this.noise(0.28, 0.22, 900); this.tone(160, 0.2, 'sawtooth', 0.1, 40); break;
      case 'bigExplode': this.noise(0.5, 0.3, 700); this.tone(90, 0.45, 'sawtooth', 0.16, 30); break;
      case 'pickup': this.tone(660, 0.08, 'sine', 0.12, 990); this.tone(990, 0.12, 'sine', 0.1, 1320); break;
      case 'hurt': this.tone(140, 0.18, 'sawtooth', 0.16, 60); this.noise(0.12, 0.12, 500); break;
      case 'dash': this.noise(0.14, 0.1, 2400); break;
      case 'wave': this.tone(392, 0.25, 'triangle', 0.14, 392); this.tone(523, 0.3, 'triangle', 0.12, 523); break;
      case 'boss': this.tone(65, 0.7, 'sawtooth', 0.2, 45); this.noise(0.5, 0.14, 300); break;
      case 'upgrade': [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'sine', 0.12), i * 70)); break;
      case 'victory': [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.13), i * 110)); break;
      case 'gameover': [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'sawtooth', 0.1), i * 160)); break;
      default: break;
    }
  }

  // A quiet 8-step bass + sparkle loop. Kept deliberately sparse.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 0, 65.4, 0, 55, 0, 82.4, 73.4];
    const sparkle = [880, 0, 0, 1108, 0, 0, 1318, 0];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const i = this.musicStep % 8;
      if (bass[i]) this.tone(bass[i], 0.22, 'triangle', 0.05);
      if (sparkle[i]) this.tone(sparkle[i], 0.1, 'sine', 0.025);
      this.musicStep += 1;
    }, 210);
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
