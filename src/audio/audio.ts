/**
 * Web Audio synth: an ambient sea loop, placement plinks, a tide swell and
 * sinking blubs. The context starts on the first user gesture.
 */
import { AUDIO } from '../data/audio';

const MUTE_KEY = 'tidebound.muted';

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // Storage unavailable: default to sound on.
    }
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : AUDIO.master;
    this.master.connect(this.ctx.destination);
    this.noise = this.makeNoise(4);
    this.startSea();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      // Ignore.
    }
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : AUDIO.master, this.ctx.currentTime, 0.1);
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Brownish noise: softer than white, good for surf. */
  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    let seed = 12345;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const white = (seed / 0x7fffffff) * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  }

  private noiseSource(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    return src;
  }

  private startSea(): void {
    const ctx = this.ctx!;
    const s = AUDIO.sea;
    // Low rolling wash with a slow swell.
    const low = this.noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = s.lowpassHz;
    const lowGain = ctx.createGain();
    lowGain.gain.value = s.volume;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = s.swellRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = s.volume * 0.6;
    lfo.connect(lfoGain).connect(lowGain.gain);
    low.connect(lp).connect(lowGain).connect(this.master!);
    // A thin hiss of surf on a different, slower cycle.
    const hi = this.noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = s.surfHz;
    bp.Q.value = 0.6;
    const hiGain = ctx.createGain();
    hiGain.gain.value = s.surfVolume;
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = s.surfRate;
    const lfo2Gain = ctx.createGain();
    lfo2Gain.gain.value = s.surfVolume * 0.8;
    lfo2.connect(lfo2Gain).connect(hiGain.gain);
    hi.connect(bp).connect(hiGain).connect(this.master!);
    low.start();
    hi.start(0, 1.3);
    lfo.start();
    lfo2.start();
  }

  private tone(freq: number, at: number, volume: number, decay: number, type: OscillatorType = 'triangle'): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(volume, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(g).connect(this.master!);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }

  private note(step: number): number {
    return AUDIO.baseHz * Math.pow(2, step / 12);
  }

  /** Placement plink: higher and brighter for bigger scores, low and soft for losses. */
  plink(score: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const p = AUDIO.plink;
    if (score < 0) {
      this.tone(this.note(-5), t, p.volume * 0.7, p.decay, 'sine');
      this.tone(this.note(-8), t + 0.08, p.volume * 0.5, p.decay, 'sine');
      return;
    }
    const idx = Math.min(Math.round(Math.sqrt(score) * 2), AUDIO.scale.length - 1);
    const f = this.note(AUDIO.scale[idx]);
    this.tone(f, t, p.volume, p.decay);
    this.tone(f * 2, t, p.volume * 0.25, p.decay * 0.6, 'sine');
  }

  /** Rising arpeggio when a threshold is crossed. */
  chime(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 4, 7, 12].forEach((s, i) => this.tone(this.note(s + 7), t + i * AUDIO.chime.stepSeconds, AUDIO.chime.volume, 0.6));
  }

  /** The sea drawing in and rising: a filtered noise swell with a low hum. */
  tide(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const { volume, seconds } = AUDIO.tide;
    const src = this.noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.exponentialRampToValueAtTime(1100, t + seconds * 0.5);
    lp.frequency.exponentialRampToValueAtTime(200, t + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + seconds * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(lp).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + seconds + 0.1);
    const hum = ctx.createOscillator();
    hum.frequency.setValueAtTime(70, t);
    hum.frequency.linearRampToValueAtTime(92, t + seconds);
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.0001, t);
    hg.gain.exponentialRampToValueAtTime(volume * 0.35, t + seconds * 0.4);
    hg.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    hum.connect(hg).connect(this.master!);
    hum.start(t);
    hum.stop(t + seconds + 0.1);
  }

  /** A building going under: a downward glug. */
  sink(delay = 0): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(AUDIO.sink.volume, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  /** Soft UI tick. */
  tick(): void {
    if (!this.ctx) return;
    this.tone(this.note(12), this.ctx.currentTime, 0.06, 0.08, 'sine');
  }
}
