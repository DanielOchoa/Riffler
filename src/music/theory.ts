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
