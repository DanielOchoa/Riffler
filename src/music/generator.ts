import type { TabNote, RootPos } from './theory';
import { OPEN_MIDI, noteName, placeRoot, powerChord } from './theory';
import type { Vibe } from './vibes';

export interface RiffEvent {
  step: number; // absolute 16th step, 0..63 (4 bars of 4/4)
  durSteps: number;
  notes: TabNote[];
  pm: boolean;
  accent: boolean;
  slide: boolean; // slide into this note from the previous one
  kind: 'chord' | 'chug' | 'lick';
}

export interface BarInfo {
  chordName: string;
  rootPc: number;
}

export interface Song {
  vibeId: string;
  seed: number;
  keyPc: number;
  keyName: string;
  bpm: number;
  bars: BarInfo[];
  events: RiffEvent[]; // sorted by step
  progressionLabel: string;
}

export const STEPS_PER_BAR = 16;
export const BARS = 4;
export const TOTAL_STEPS = STEPS_PER_BAR * BARS;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const rint = (rng: () => number, lo: number, hi: number) =>
  lo + Math.floor(rng() * (hi - lo + 1));

/** Map a progression of N chords onto 4 bars. */
function stretchProgression(rng: () => number, len: number): number[] {
  switch (len) {
    case 1:
      return [0, 0, 0, 0];
    case 2:
      return pick(rng, [
        [0, 0, 1, 1],
        [0, 1, 0, 1],
        [0, 0, 0, 1],
      ]);
    case 3:
      return pick(rng, [
        [0, 0, 1, 2],
        [0, 1, 2, 2],
        [0, 1, 2, 0],
      ]);
    default:
      return [0, 1, 2, 3];
  }
}

interface ParsedHit {
  pos: number;
  len: number;
  ch: string;
}

function parsePattern(p: string): ParsedHit[] {
  const hits: ParsedHit[] = [];
  for (let i = 0; i < STEPS_PER_BAR; i++) {
    const c = p[i];
    if (c === '.' || c === '~') continue;
    let len = 1;
    let j = i + 1;
    while (j < STEPS_PER_BAR && p[j] === '~') {
      len++;
      j++;
    }
    hits.push({ pos: i, len, ch: c });
  }
  return hits;
}

/**
 * Random-walks the vibe's scale around the current chord root, mapping each
 * degree to a playable string/fret near the anchor position.
 */
class LickWalker {
  private idx = 0;
  private prevStr = 6;

  constructor(
    private rng: () => number,
    private scale: number[],
    private micro?: { degrees: number[]; chance: number },
  ) {}

  reset() {
    this.idx = 0;
  }

  private offsetAt(idx: number): number {
    const len = this.scale.length;
    const deg = ((idx % len) + len) % len;
    const oct = Math.floor(idx / len);
    return this.scale[deg] + 12 * oct;
  }

  next(rootMidi: number, anchorFret: number): TabNote {
    const r = this.rng();
    if (r < 0.18) {
      // repeat current degree
    } else if (r < 0.74) {
      this.idx += this.rng() < 0.5 ? -1 : 1;
    } else {
      this.idx += this.rng() < 0.5 ? -2 : 2;
    }
    this.idx = Math.max(-2, Math.min(this.scale.length + 3, this.idx));

    let midi = rootMidi + this.offsetAt(this.idx);
    while (midi < OPEN_MIDI[5]) midi += 12;

    const note = this.place(midi, anchorFret);
    this.prevStr = note.str;

    if (this.micro && note.fret > 0 && this.rng() < this.micro.chance) {
      const pcOff = (((midi - rootMidi) % 12) + 12) % 12;
      if (this.micro.degrees.includes(pcOff)) note.micro = 0.5;
    }
    return note;
  }

  private place(midi: number, anchorFret: number): TabNote {
    let best: TabNote | null = null;
    let bestScore = Infinity;
    for (let str = 6; str >= 2; str--) {
      const fret = midi - OPEN_MIDI[str - 1];
      if (fret < 0 || fret > 13) continue;
      let score = Math.abs(fret - anchorFret);
      if (fret === 0) score *= 0.5; // open strings are always in reach
      if (str === this.prevStr) score -= 0.3;
      if (score < bestScore) {
        bestScore = score;
        best = { str, fret, micro: 0 };
      }
    }
    // Out of range — fall back to the chord root.
    return best ?? { str: 6, fret: Math.max(0, Math.min(11, anchorFret)), micro: 0 };
  }
}

export function generate(vibe: Vibe, seed: number): Song {
  const rng = mulberry32(seed);

  const keyPc = pick(rng, vibe.keys);
  const bpm = rint(rng, vibe.tempo[0], vibe.tempo[1]);
  const prog = pick(rng, vibe.progressions);
  const barChordIdx = stretchProgression(rng, prog.length);

  // Place each bar's chord root on the neck, near the previous one.
  const bars: BarInfo[] = [];
  const anchors: RootPos[] = [];
  let prevFret: number | null = null;
  for (let b = 0; b < BARS; b++) {
    const pc = (keyPc + prog[barChordIdx[b]]) % 12;
    const pos = placeRoot(pc, prevFret);
    prevFret = pos.fret;
    anchors.push(pos);
    bars.push({ chordName: noteName(pc) + '5', rootPc: pc });
  }

  // Riffs repeat: bars 1–2 share a rhythm, bar 3 sometimes varies, bar 4 fills.
  const r1 = pick(rng, vibe.rhythms);
  const r3 = rng() < 0.35 ? pick(rng, vibe.rhythms) : r1;
  const r4 = rng() < 0.7 ? pick(rng, vibe.fills) : r1;
  const patterns = [r1, r1, r3, r4];

  const walker = new LickWalker(rng, vibe.scale, vibe.micro);
  const events: RiffEvent[] = [];

  for (let b = 0; b < BARS; b++) {
    const anchor = anchors[b];
    const rootMidi = OPEN_MIDI[anchor.str - 1] + anchor.fret;
    const rootNote: TabNote = { str: anchor.str, fret: anchor.fret, micro: 0 };

    for (const hit of parsePattern(patterns[b])) {
      const step = b * STEPS_PER_BAR + hit.pos;
      const accent = hit.ch === 'C' || hit.ch === 'X' || hit.ch === 'L';
      let notes: TabNote[];
      let pm = false;
      let kind: RiffEvent['kind'];

      if (hit.ch === 'C' || hit.ch === 'c') {
        notes = powerChord(anchor, vibe.octaveChord);
        kind = 'chord';
      } else if (hit.ch === 'X' || hit.ch === 'x') {
        notes = [{ ...rootNote }];
        pm = true;
        kind = 'chug';
      } else {
        notes = [walker.next(rootMidi, anchor.fret)];
        pm = rng() < vibe.lickPm;
        kind = 'lick';
      }

      events.push({ step, durSteps: hit.len, notes, pm, accent, slide: false, kind });
    }
  }

  // Mark slides: consecutive single lick notes on the same string, a jump apart.
  for (let i = 1; i < events.length; i++) {
    const a = events[i - 1];
    const b = events[i];
    if (
      a.kind === 'lick' &&
      b.kind === 'lick' &&
      a.notes[0].str === b.notes[0].str &&
      Math.abs(a.notes[0].fret - b.notes[0].fret) >= 2 &&
      b.notes[0].fret > 0 &&
      rng() < 0.35
    ) {
      b.slide = true;
    }
  }

  // Usually resolve the last lick back to home so the loop lands.
  const last = events[events.length - 1];
  if (last && last.kind === 'lick' && rng() < 0.6) {
    last.notes = [{ str: anchors[0].str, fret: anchors[0].fret, micro: 0 }];
    last.slide = false;
  }

  const chordSeq: string[] = [];
  for (const bar of bars) {
    if (chordSeq[chordSeq.length - 1] !== bar.chordName) chordSeq.push(bar.chordName);
  }

  return {
    vibeId: vibe.id,
    seed,
    keyPc,
    keyName: noteName(keyPc),
    bpm,
    bars,
    events,
    progressionLabel: chordSeq.join(' – '),
  };
}
