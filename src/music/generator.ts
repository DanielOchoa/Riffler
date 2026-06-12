import type { TabNote, RootPos, TuningId, Voicing } from './theory';
import { TUNINGS, noteName, placeRoot, powerChord, chooseVoicing } from './theory';
import type { Vibe } from './vibes';

export interface RiffEvent {
  step: number; // absolute 16th step from song start
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

export interface SectionInfo {
  name: string; // 'VERSE' | 'CHORUS'
  startBar: number;
  barCount: number;
}

export interface Song {
  vibeId: string;
  seed: number;
  keyPc: number;
  keyName: string;
  tuning: TuningId;
  bpm: number;
  bars: BarInfo[];
  sections: SectionInfo[];
  events: RiffEvent[]; // sorted by step
}

export const STEPS_PER_BAR = 16;
export const SECTION_BARS = 4;

export function totalSteps(song: Song): number {
  return song.bars.length * STEPS_PER_BAR;
}

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

/**
 * Chord quality per semitone offset from the key root, assuming the aeolian /
 * rock-minor world these vibes live in (i, bIII, iv, v, bVI, bVII...).
 * Vibes can override (e.g. phrygian dominant's major i).
 */
const OFFSET_QUALITY: Record<number, 'maj' | 'min'> = {
  0: 'min',
  1: 'maj',
  2: 'maj',
  3: 'maj',
  5: 'min',
  6: 'maj',
  7: 'min',
  8: 'maj',
  10: 'maj',
};

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
    private tuning: number[],
    private micro?: { degrees: number[]; chance: number },
  ) {}

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
    while (midi < this.tuning[5]) midi += 12;

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
      const fret = midi - this.tuning[str - 1];
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

interface SectionResult {
  bars: BarInfo[];
  events: RiffEvent[]; // section-local steps
  endAnchorFret: number;
  progIdx: number;
}

function generateSection(
  vibe: Vibe,
  rng: () => number,
  keyPc: number,
  type: 'verse' | 'chorus',
  walker: LickWalker,
  startAnchorFret: number | null,
  avoidProgIdx: number | null,
): SectionResult {
  // Chorus prefers a different progression than the verse, when there's a choice.
  let progIdx = Math.floor(rng() * vibe.progressions.length);
  if (avoidProgIdx !== null && vibe.progressions.length > 1 && progIdx === avoidProgIdx) {
    progIdx = (progIdx + 1) % vibe.progressions.length;
  }
  const prog = vibe.progressions[progIdx];
  const barChordIdx = stretchProgression(rng, prog.length);
  const tuning = TUNINGS[vibe.tuning];

  // Place each bar's chord root on the neck, near the previous one.
  const bars: BarInfo[] = [];
  const anchors: RootPos[] = [];
  const voicings: (Voicing | null)[] = [];
  let prevFret = startAnchorFret;
  for (let b = 0; b < SECTION_BARS; b++) {
    const off = prog[barChordIdx[b]];
    const pc = (keyPc + off) % 12;
    const pos = placeRoot(pc, prevFret, tuning);
    prevFret = pos.fret;
    anchors.push(pos);

    if (type === 'chorus') {
      const quality = vibe.chordQuality?.[off] ?? OFFSET_QUALITY[off] ?? 'min';
      const v = chooseVoicing(pc, quality, vibe.voicings, pos, vibe.octaveChord, tuning);
      voicings.push(v);
      bars.push({ chordName: v.name, rootPc: pc });
    } else {
      voicings.push(null);
      bars.push({ chordName: noteName(pc) + '5', rootPc: pc });
    }
  }

  // Riffs repeat: bars 1–2 share a rhythm, bar 3 sometimes varies, bar 4 fills.
  const pool = type === 'chorus' ? vibe.chorusRhythms : vibe.rhythms;
  const r1 = pick(rng, pool);
  const r3 = rng() < 0.35 ? pick(rng, pool) : r1;
  const fillChance = type === 'chorus' ? 0.3 : 0.7;
  const r4 = rng() < fillChance ? pick(rng, vibe.fills) : r1;
  const patterns = [r1, r1, r3, r4];

  const events: RiffEvent[] = [];

  for (let b = 0; b < SECTION_BARS; b++) {
    const anchor = anchors[b];
    const rootMidi = tuning[anchor.str - 1] + anchor.fret;
    const rootNote: TabNote = { str: anchor.str, fret: anchor.fret, micro: 0 };

    for (const hit of parsePattern(patterns[b])) {
      const step = b * STEPS_PER_BAR + hit.pos;
      const accent = hit.ch === 'C' || hit.ch === 'X' || hit.ch === 'L';
      let notes: TabNote[];
      let pm = false;
      let kind: RiffEvent['kind'];

      if (hit.ch === 'C' || hit.ch === 'c') {
        const v = voicings[b];
        notes = v ? v.notes.map((n) => ({ ...n })) : powerChord(anchor, vibe.octaveChord, tuning);
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

  // Usually resolve the section's last lick back to its home chord root.
  const last = events[events.length - 1];
  if (last && last.kind === 'lick' && rng() < 0.6) {
    last.notes = [{ str: anchors[0].str, fret: anchors[0].fret, micro: 0 }];
    last.slide = false;
  }

  return { bars, events, endAnchorFret: prevFret ?? 2, progIdx };
}

export function generate(vibe: Vibe, seed: number): Song {
  const rng = mulberry32(seed);

  const keyPc = pick(rng, vibe.keys);
  const bpm = rint(rng, vibe.tempo[0], vibe.tempo[1]);
  const walker = new LickWalker(rng, vibe.scale, TUNINGS[vibe.tuning], vibe.micro);

  const verse = generateSection(vibe, rng, keyPc, 'verse', walker, null, null);
  const chorus = generateSection(
    vibe,
    rng,
    keyPc,
    'chorus',
    walker,
    verse.endAnchorFret,
    verse.progIdx,
  );

  const verseSteps = SECTION_BARS * STEPS_PER_BAR;
  const events = [
    ...verse.events,
    ...chorus.events.map((ev) => ({ ...ev, step: ev.step + verseSteps })),
  ];

  return {
    vibeId: vibe.id,
    seed,
    keyPc,
    keyName: noteName(keyPc),
    tuning: vibe.tuning,
    bpm,
    bars: [...verse.bars, ...chorus.bars],
    sections: [
      { name: 'VERSE', startBar: 0, barCount: SECTION_BARS },
      { name: 'CHORUS', startBar: SECTION_BARS, barCount: SECTION_BARS },
    ],
    events,
  };
}
