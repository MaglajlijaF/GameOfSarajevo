// Converts a MIDI file into a chiptune song for the game.
//
//   node scripts/import-midi.mjs path/to/song.mid <stageId> [--bars 16] [--transpose 0]
//
// Writes src/data/music/<stageId>.json and sets `"track": "<stageId>"` on that
// stage in stages.json. The melody becomes a square/saw lead, the lowest part
// becomes a triangle bass, one more part becomes soft harmony stabs and General
// MIDI drums (channel 10) become noise/kick hits — i.e. a "pixelated" cover.
// Notes are quantised to 16th notes and the first N bars are looped.
import { readFileSync, writeFileSync } from 'node:fs';

const [file, stageId, ...rest] = process.argv.slice(2);
if (!file || !stageId) { console.error('usage: node scripts/import-midi.mjs song.mid <stageId> [--bars 16] [--transpose 0]'); process.exit(1); }
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? Number(rest[i + 1]) : d; };
const maxBars = opt('--bars', 16), transpose = opt('--transpose', 0);

const buf = readFileSync(file);
let pos = 0;
const u32 = () => { const v = buf.readUInt32BE(pos); pos += 4; return v; };
const u16 = () => { const v = buf.readUInt16BE(pos); pos += 2; return v; };
const vlq = () => { let v = 0, b; do { b = buf[pos++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
if (buf.toString('ascii', 0, 4) !== 'MThd') throw new Error('not a MIDI file');
pos = 8; const format = u16(); const ntracks = u16(); const division = u16();
if (division & 0x8000) throw new Error('SMPTE time division not supported');
let tempoUs = 500000;
const notes = []; // {start, end, note, ch, track}
for (let t = 0; t < ntracks; t++) {
  while (buf.toString('ascii', pos, pos + 4) !== 'MTrk') pos++;
  pos += 4; const len = u32(); const end = pos + len;
  let tick = 0, status = 0; const open = new Map();
  while (pos < end) {
    tick += vlq();
    let b = buf[pos];
    if (b & 0x80) { status = b; pos++; } 
    const type = status & 0xf0, ch = status & 0x0f;
    if (status === 0xff) { const meta = buf[pos++]; const l = vlq(); if (meta === 0x51 && tempoUs === 500000) tempoUs = (buf[pos] << 16) | (buf[pos + 1] << 8) | buf[pos + 2]; pos += l; continue; }
    if (status === 0xf0 || status === 0xf7) { pos += vlq(); continue; }
    const d1 = buf[pos++]; const d2 = type === 0xc0 || type === 0xd0 ? 0 : buf[pos++];
    if (type === 0x90 && d2 > 0) open.set(`${ch}:${d1}`, { start: tick, note: d1, ch, track: t });
    else if (type === 0x80 || (type === 0x90 && d2 === 0)) { const o = open.get(`${ch}:${d1}`); if (o) { notes.push({ ...o, end: tick }); open.delete(`${ch}:${d1}`); } }
  }
  pos = end;
}
void format;
const stepTicks = division / 4;
const q = (tk) => Math.round(tk / stepTicks);
const tempo = Math.round(60000000 / tempoUs);
const maxSteps = maxBars * 16;

// Group pitched notes into parts (track+channel), drums separately.
const parts = new Map();
const drums = [];
for (const n of notes) {
  if (n.ch === 9) { drums.push(n); continue; }
  const k = `${n.track}:${n.ch}`;
  if (!parts.has(k)) parts.set(k, []);
  parts.get(k).push(n);
}
const ranked = [...parts.values()].filter((p) => p.length >= 3).map((p) => ({ p, avg: p.reduce((s, n) => s + n.note, 0) / p.length }));
ranked.sort((a, b) => b.avg - a.avg);
const lead = ranked[0]?.p ?? [];
const bass = ranked.length > 1 ? ranked[ranked.length - 1].p : [];
const harmony = ranked.length > 2 ? ranked[1].p : [];

const events = [];
const mono = (list, c, lo, hi) => {
  // keep the highest (lead) or lowest (bass) note per step so each channel is monophonic like a chip
  const bySt = new Map();
  for (const n of list) {
    const s = q(n.start); if (s >= maxSteps) continue;
    const cur = bySt.get(s);
    if (!cur || (c === 1 ? n.note < cur.note : n.note > cur.note)) bySt.set(s, n);
  }
  for (const [s, n] of bySt) {
    let note = n.note + transpose;
    while (note < lo) note += 12; while (note > hi) note -= 12;
    events.push({ s, l: Math.max(1, Math.min(16, q(n.end) - s)), n: note, c });
  }
};
mono(lead, 0, 60, 96);
mono(bass, 1, 28, 52);
mono(harmony, 2, 48, 76);
for (const n of drums) {
  const s = q(n.start); if (s >= maxSteps) continue;
  const kind = n.note === 35 || n.note === 36 ? 0 : n.note === 38 || n.note === 40 || n.note === 39 ? 1 : 2;
  events.push({ s, l: 1, n: kind, c: 3 });
}
const lastStep = Math.max(16, ...events.map((e) => e.s + e.l));
const steps = Math.min(maxSteps, Math.ceil(lastStep / 16) * 16);
const song = { tempo, steps, events: events.filter((e) => e.s < steps).sort((a, b) => a.s - b.s), lead: 'square' };

const out = new URL(`../src/data/music/${stageId}.json`, import.meta.url);
writeFileSync(out, JSON.stringify(song) + '\n');
const stagesUrl = new URL('../src/data/stages.json', import.meta.url);
const stages = JSON.parse(readFileSync(stagesUrl, 'utf8'));
if (!stages.stages[stageId]) { console.error(`unknown stage ${stageId}; song written but not assigned`); process.exit(1); }
stages.stages[stageId].music.track = stageId;
writeFileSync(stagesUrl, JSON.stringify(stages, null, 1) + '\n');
console.log(`${stageId}: ${tempo} bpm, ${steps / 16} bars, lead ${lead.length} / bass ${bass.length} / harmony ${harmony.length} / drums ${drums.length} notes`);
