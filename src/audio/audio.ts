import { Rng } from '../core/rng';
import type { MusicDef } from '../core/types';

/**
 * Generated chiptune audio via WebAudio. No audio files: square/triangle/noise
 * voices for SFX and a small step sequencer for per-stage music.
 */
export type Sfx = 'jump' | 'dash' | 'swing' | 'shoot' | 'hit' | 'hurt' | 'kill' | 'levelup' | 'coin' | 'click'
  | 'boss' | 'slam' | 'wave' | 'victory' | 'defeat' | 'pulse' | 'gate' | 'pickup' | 'deny';

const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], hijaz: [0, 1, 4, 5, 7, 8, 10],
};

const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private noiseBuf!: AudioBuffer;
  private seqTimer: number | null = null;
  private vol = { master: 0.8, music: 0.6, sfx: 0.8 };
  private lastPlayed: Partial<Record<Sfx, number>> = {};

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.music.connect(this.master); this.sfx.connect(this.master); this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    return this.ctx;
  }

  /** Browsers need a user gesture before audio can start. */
  unlock(): void { const c = this.ensure(); if (c && c.state === 'suspended') void c.resume(); }

  setVolumes(master: number, music: number, sfx: number): void {
    this.vol = { master, music, sfx };
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.music.gain.value = this.vol.music * 0.35;
    this.sfx.gain.value = this.vol.sfx * 0.5;
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, dest: AudioNode, at?: number) {
    const c = this.ctx!;
    const t = at ?? c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }
  private noise(dur: number, vol: number, dest: AudioNode, filterHz = 4000, at?: number) {
    const c = this.ctx!;
    const t = at ?? c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterHz;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name: Sfx): void {
    const c = this.ensure();
    if (!c || c.state !== 'running') return;
    // Rate-limit identical sounds so 40 enemies don't clip the mixer.
    const now = c.currentTime;
    if ((this.lastPlayed[name] ?? -1) > now - 0.035) return;
    this.lastPlayed[name] = now;
    const d = this.sfx;
    switch (name) {
      case 'jump': this.tone('square', 300, 600, 0.12, 0.25, d); break;
      case 'dash': this.noise(0.15, 0.3, d, 2500); this.tone('square', 500, 200, 0.12, 0.12, d); break;
      case 'swing': this.noise(0.08, 0.25, d, 6000); break;
      case 'shoot': this.tone('square', 900, 400, 0.07, 0.12, d); break;
      case 'hit': this.tone('square', 220, 90, 0.08, 0.25, d); this.noise(0.05, 0.2, d, 3000); break;
      case 'hurt': this.tone('sawtooth', 300, 80, 0.25, 0.3, d); break;
      case 'kill': this.tone('square', 600, 1200, 0.1, 0.18, d); this.tone('square', 900, 1800, 0.1, 0.12, d, now + 0.06); break;
      case 'levelup': [0, 4, 7, 12].forEach((s, i) => this.tone('square', midiHz(72 + s), midiHz(72 + s), 0.14, 0.2, d, now + i * 0.08)); break;
      case 'coin': this.tone('square', 988, 988, 0.06, 0.2, d); this.tone('square', 1319, 1319, 0.2, 0.2, d, now + 0.06); break;
      case 'click': this.tone('square', 700, 700, 0.03, 0.12, d); break;
      case 'deny': this.tone('square', 200, 150, 0.15, 0.2, d); break;
      case 'boss': this.tone('sawtooth', 110, 55, 0.8, 0.35, d); this.noise(0.6, 0.2, d, 800); break;
      case 'slam': this.noise(0.35, 0.5, d, 600); this.tone('sine', 120, 40, 0.3, 0.5, d); break;
      case 'wave': this.tone('triangle', 440, 880, 0.2, 0.3, d); break;
      case 'gate': this.tone('square', 330, 330, 0.08, 0.15, d); this.tone('square', 494, 494, 0.12, 0.15, d, now + 0.08); break;
      case 'pulse': this.tone('triangle', 1200, 300, 0.35, 0.3, d); break;
      case 'pickup': this.tone('triangle', 660, 990, 0.1, 0.2, d); break;
      case 'victory': [0, 4, 7, 12, 7, 12].forEach((s, i) => this.tone('square', midiHz(67 + s), midiHz(67 + s), 0.18, 0.22, d, now + i * 0.13)); break;
      case 'defeat': [7, 3, 0, -5].forEach((s, i) => this.tone('triangle', midiHz(60 + s), midiHz(60 + s), 0.3, 0.3, d, now + i * 0.22)); break;
    }
  }

  /** Starts a looping procedurally composed tune. Same def → same tune. */
  playMusic(def: MusicDef): void {
    this.stopMusic();
    const c = this.ensure();
    if (!c) return;
    const rng = new Rng(def.seed);
    const scale = SCALES[def.scale] ?? SCALES.minor;
    const steps = 32;
    const deg = (d: number) => { const o = Math.floor(d / scale.length); return scale[((d % scale.length) + scale.length) % scale.length] + 12 * o; };
    // Melody: random walk on scale degrees with rests; 2 phrases A A' 
    const phrase: (number | null)[] = [];
    let cur = 4;
    for (let i = 0; i < 16; i++) {
      if (rng.chance(0.22) && i % 4 !== 0) { phrase.push(null); continue; }
      cur = Math.max(0, Math.min(11, cur + rng.pick([-2, -1, -1, 0, 1, 1, 2, 3, -3])));
      phrase.push(cur);
    }
    const melody = [...phrase, ...phrase.map((n, i) => (n === null || i < 12 ? n : Math.max(0, n - 2)))];
    const chords = [0, 3, 4, 0].map((x) => (rng.chance(0.3) ? x + 1 : x));
    const stepDur = 60 / def.tempo / 2;
    let step = 0;
    let next = c.currentTime + 0.1;
    const tick = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.25) {
        const s = step % steps;
        const n = melody[s];
        if (n !== null) this.tone('square', midiHz(def.root + 12 + deg(n)), midiHz(def.root + 12 + deg(n)), stepDur * 0.9, 0.18, this.music, next);
        const chord = chords[Math.floor(s / 8)];
        if (s % 2 === 0) this.tone('triangle', midiHz(def.root - 12 + deg(chord)), midiHz(def.root - 12 + deg(chord)), stepDur * 1.6, 0.35, this.music, next);
        if (s % 4 === 2) this.tone('square', midiHz(def.root + deg(chord + 2)), midiHz(def.root + deg(chord + 2)), stepDur * 0.5, 0.08, this.music, next);
        if (s % 4 === 0) this.noise(0.08, 0.25, this.music, 200, next);
        if (s % 4 === 2) this.noise(0.05, 0.12, this.music, 6000, next);
        next += stepDur;
        step++;
      }
    };
    tick();
    this.seqTimer = window.setInterval(tick, 60);
  }

  stopMusic(): void {
    if (this.seqTimer !== null) { clearInterval(this.seqTimer); this.seqTimer = null; }
  }
}

export const audio = new AudioEngine();
export const MENU_MUSIC: MusicDef = { seed: 4242, tempo: 112, scale: 'hijaz', root: 57 };
