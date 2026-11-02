import { bossMusic, compose, type NoteEvent, type Song } from './compose';
import type { MusicDef } from '../core/types';

/**
 * Generated chiptune audio via WebAudio. No audio files: square/triangle/noise
 * voices for SFX and a small step sequencer for per-stage music.
 */
export type Sfx = 'jump' | 'dash' | 'swing' | 'shoot' | 'hit' | 'hurt' | 'kill' | 'levelup' | 'coin' | 'click'
  | 'boss' | 'slam' | 'wave' | 'victory' | 'defeat' | 'pulse' | 'gate' | 'pickup' | 'deny';

/** Songs imported from MIDI with scripts/import-midi.mjs. */
const TRACKS: Record<string, Song> = Object.fromEntries(
  Object.entries(import.meta.glob('../data/music/*.json', { eager: true, import: 'default' }))
    .map(([path, song]) => [path.split('/').pop()!.replace('.json', ''), song as Song]),
);

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

  /**
   * Starts a looping tune: an imported song if the stage names a `track`
   * (src/data/music/<track>.json), otherwise one composed from the stage's style.
   */
  playMusic(def: MusicDef, boss = false): void {
    this.stopMusic();
    const c = this.ensure();
    if (!c) return;
    const imported = def.track ? TRACKS[def.track] : undefined;
    const song: Song = imported
      ? { ...imported, tempo: Math.round(imported.tempo * (boss ? 1.15 : 1)), lead: def.lead ?? imported.lead }
      : compose(boss ? bossMusic(def) : def);
    this.currentSong = song;
    const byStep: NoteEvent[][] = Array.from({ length: song.steps }, () => []);
    for (const e of song.events) if (e.s >= 0 && e.s < song.steps) byStep[e.s].push(e);
    const stepDur = 60 / song.tempo / 4;
    const lead = (song.lead ?? 'square') as string;
    const leadWave: OscillatorType = lead === 'saw' ? 'sawtooth' : lead === 'triangle' ? 'triangle' : 'square';
    let step = 0;
    let next = c.currentTime + 0.1;
    const tick = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.25) {
        for (const e of byStep[step % song.steps]) {
          const dur = e.l * stepDur;
          if (e.c === 0) {
            this.tone(leadWave, midiHz(e.n), midiHz(e.n), dur * 0.92, lead === 'pulse' ? 0.13 : 0.17, this.music, next);
            if (lead === 'pulse') this.tone('square', midiHz(e.n) * 1.004, midiHz(e.n) * 1.004, dur * 0.9, 0.08, this.music, next);
          } else if (e.c === 1) this.tone('triangle', midiHz(e.n), midiHz(e.n), dur * 0.95, 0.36, this.music, next);
          else if (e.c === 2) this.tone('square', midiHz(e.n), midiHz(e.n), Math.min(dur, stepDur * 0.8), 0.05, this.music, next);
          else if (e.n === 0) { this.tone('sine', 140, 45, 0.12, 0.5, this.music, next); }
          else if (e.n === 1) this.noise(0.09, 0.22, this.music, 3500, next);
          else this.noise(0.03, 0.08, this.music, 9000, next);
        }
        next += stepDur;
        step++;
      }
    };
    tick();
    this.seqTimer = window.setInterval(tick, 50);
  }

  /** The tune currently playing (for tests/debugging). */
  currentSong: Song | null = null;

  stopMusic(): void {
    if (this.seqTimer !== null) { clearInterval(this.seqTimer); this.seqTimer = null; }
  }
}

export const audio = new AudioEngine();
export const MENU_MUSIC: MusicDef = { seed: 4242, tempo: 108, scale: 'hijaz', root: 57, lead: 'triangle', drums: 'halftime', style: 'sevdah' };
