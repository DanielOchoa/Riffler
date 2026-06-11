// Standard tuning, string 1 (high E) → string 6 (low E), as MIDI note numbers.
export const OPEN_MIDI = [64, 59, 55, 50, 45, 40];

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(pc: number): string {
  return NOTE_NAMES[((pc % 12) + 12) % 12];
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** One fretted (or open) note on the neck. micro is +0.5 for a quarter-sharp. */
export interface TabNote {
  str: number; // 1..6, 6 = low E
  fret: number;
  micro: number; // 0 or 0.5 semitones
}

export function pitchOf(n: TabNote): number {
  return OPEN_MIDI[n.str - 1] + n.fret + n.micro;
}

export interface RootPos {
  str: 5 | 6;
  fret: number;
}

/**
 * Place a chord root (pitch class) on string 6 or 5, near the previous
 * anchor fret so progressions don't leap all over the neck.
 */
export function placeRoot(pc: number, prevFret: number | null): RootPos {
  const norm = (n: number) => ((n % 12) + 12) % 12;
  const f6 = norm(pc - 4); // low E is pc 4
  const f5 = norm(pc - 9); // A is pc 9
  const cands: RootPos[] = [];
  for (const f of [f6, f6 + 12]) if (f <= 11) cands.push({ str: 6, fret: f });
  for (const f of [f5, f5 + 12]) if (f <= 11) cands.push({ str: 5, fret: f });
  const anchor = prevFret ?? 2; // bias toward open position
  let best = cands[0];
  let bestScore = Infinity;
  for (const c of cands) {
    const score =
      Math.abs(c.fret - anchor) + (c.str === 5 ? 0.75 : 0) + (c.fret > 9 ? 1.5 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** Power chord (root + fifth, optional octave) built on a root position. */
export function powerChord(pos: RootPos, withOctave: boolean): TabNote[] {
  const notes: TabNote[] = [
    { str: pos.str, fret: pos.fret, micro: 0 },
    { str: pos.str - 1, fret: pos.fret + 2, micro: 0 },
  ];
  if (withOctave && pos.str - 2 >= 1) {
    notes.push({ str: pos.str - 2, fret: pos.fret + 2, micro: 0 });
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Chord voicings beyond power chords (used by chorus sections).
// ---------------------------------------------------------------------------

export type ChordQuality = 'maj' | 'min' | 'sus' | 'pow';

export interface Voicing {
  name: string;
  rootPc: number;
  quality: ChordQuality;
  notes: TabNote[];
}

const N = (str: number, fret: number): TabNote => ({ str, fret, micro: 0 });

/** Cowboy-chord shapes. 'sus' marks the colored variants (sus2/add9). */
export const OPEN_VOICINGS: Voicing[] = [
  { name: 'E', rootPc: 4, quality: 'maj', notes: [N(6, 0), N(5, 2), N(4, 2), N(3, 1), N(2, 0), N(1, 0)] },
  { name: 'Em', rootPc: 4, quality: 'min', notes: [N(6, 0), N(5, 2), N(4, 2), N(3, 0), N(2, 0), N(1, 0)] },
  { name: 'A', rootPc: 9, quality: 'maj', notes: [N(5, 0), N(4, 2), N(3, 2), N(2, 2), N(1, 0)] },
  { name: 'Am', rootPc: 9, quality: 'min', notes: [N(5, 0), N(4, 2), N(3, 2), N(2, 1), N(1, 0)] },
  { name: 'Asus2', rootPc: 9, quality: 'sus', notes: [N(5, 0), N(4, 2), N(3, 2), N(2, 0), N(1, 0)] },
  { name: 'D', rootPc: 2, quality: 'maj', notes: [N(4, 0), N(3, 2), N(2, 3), N(1, 2)] },
  { name: 'Dm', rootPc: 2, quality: 'min', notes: [N(4, 0), N(3, 2), N(2, 3), N(1, 1)] },
  { name: 'Dsus2', rootPc: 2, quality: 'sus', notes: [N(4, 0), N(3, 2), N(2, 3), N(1, 0)] },
  { name: 'G', rootPc: 7, quality: 'maj', notes: [N(6, 3), N(5, 2), N(4, 0), N(3, 0), N(2, 0), N(1, 3)] },
  { name: 'C', rootPc: 0, quality: 'maj', notes: [N(5, 3), N(4, 2), N(3, 0), N(2, 1), N(1, 0)] },
  { name: 'Cadd9', rootPc: 0, quality: 'sus', notes: [N(5, 3), N(4, 2), N(3, 0), N(2, 3), N(1, 0)] },
];

/** Movable 3-string triad on D/G/B strings (the RATM/funk triple-stop). */
export function triadVoicing(pc: number, quality: 'maj' | 'min'): Voicing | null {
  let f = (((pc - 2) % 12) + 12) % 12; // root on the D string (open D is pc 2)
  if (f < 2) f += 12; // the shape needs two frets below the root
  if (f > 13) return null;
  const notes =
    quality === 'maj'
      ? [N(4, f), N(3, f - 1), N(2, f - 2)]
      : [N(4, f), N(3, f - 2), N(2, f - 2)];
  return { name: noteName(pc) + (quality === 'min' ? 'm' : ''), rootPc: pc, quality, notes };
}

/** Power chord voiced an octave up, on D/G strings — a tight, barky stab. */
export function highPower(pc: number): Voicing {
  const f = (((pc - 2) % 12) + 12) % 12;
  return { name: noteName(pc) + '5', rootPc: pc, quality: 'pow', notes: [N(4, f), N(3, f + 2)] };
}

export type VoicingKind = 'open' | 'open-color' | 'triad' | 'high5' | 'power';

/**
 * Walk the vibe's voicing palette in preference order; fall back to a plain
 * power chord at the riff anchor if nothing in the palette fits this root.
 */
export function chooseVoicing(
  pc: number,
  quality: 'maj' | 'min',
  palette: VoicingKind[],
  anchor: RootPos,
  withOctave: boolean,
): Voicing {
  for (const kind of palette) {
    if (kind === 'open') {
      const v = OPEN_VOICINGS.find((o) => o.rootPc === pc && o.quality === quality);
      if (v) return v;
    } else if (kind === 'open-color') {
      const v = OPEN_VOICINGS.find((o) => o.rootPc === pc && o.quality === 'sus');
      if (v) return v;
    } else if (kind === 'triad') {
      const v = triadVoicing(pc, quality);
      if (v) return v;
    } else if (kind === 'high5') {
      return highPower(pc);
    }
  }
  return {
    name: noteName(pc) + '5',
    rootPc: pc,
    quality: 'pow',
    notes: powerChord(anchor, withOctave),
  };
}
