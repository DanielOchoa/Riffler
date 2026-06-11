/**
 * Vibe recipes. Rhythm patterns are 16-character strings, one char per
 * 16th-note step in a 4/4 bar:
 *
 *   C  chord hit (accented)     c  chord stab
 *   X  accented root chug       x  palm-muted root chug
 *   L  accented lick note       l  lick note
 *   ~  extend the previous event by one step
 *   .  rest
 */
import type { VoicingKind } from './theory';

export interface DrumPattern {
  kick: number[];
  snare: number[];
  hat: number[];
}

export interface Vibe {
  id: string;
  name: string;
  artists: string;
  blurb: string;
  tip: string;
  hue: string; // accent color when this vibe is loaded
  tempo: [number, number];
  keys: number[]; // candidate key root pitch classes
  scale: number[]; // semitone offsets from the key root, for lick notes
  micro?: { degrees: number[]; chance: number }; // quarter-sharp inflections
  progressions: number[][]; // semitone offsets from key root, power chords
  rhythms: string[];
  fills: string[]; // bar-4 candidates, lick-heavy
  chorusRhythms: string[]; // strummy, chord-forward patterns for the chorus
  voicings: VoicingKind[]; // chorus chord palette, in preference order
  chordQuality?: Record<number, 'maj' | 'min'>; // per-offset quality overrides
  drums: DrumPattern;
  drive: number; // waveshaper intensity
  brightness: number; // post-drive lowpass Hz
  level: number; // guitar bus gain
  lickPm: number; // chance a lick note is palm muted
  octaveChord: boolean;
}

export const VIBES: Vibe[] = [
  {
    id: 'garage',
    name: 'Garage Stomp',
    artists: 'White Stripes · The Hives · Black Keys',
    blurb: 'Two chords and the truth. Red, white, and overdriven.',
    tip: 'All downstrokes. Dig in — the gaps are part of the stomp.',
    hue: '#e2422c',
    tempo: [104, 148],
    keys: [4, 9, 7], // E, A, G
    scale: [0, 3, 5, 7, 10], // minor pentatonic
    progressions: [
      [0, 3, 5],
      [0, 10, 5],
      [0, 5, 10],
      [0, 3, 7, 5],
      [0, 5, 3, 10],
    ],
    rhythms: [
      'C~~~C~~~C~~~c.c.',
      'C~~~~~c~C~~~c~~~',
      'X.x.x.x.X.x.x.l.',
      'C~~~c~~~C~~~l.l.',
    ],
    fills: ['l.l.l.l.l.l.l.l.', 'L~l.l.l~l.l.c~~~', 'l.l.x.x.l.l.X~~~'],
    chorusRhythms: ['C~~~C~~~C~~~C~~~', 'C~~~~~C~C~~~~~~~', 'C~C~C~C~C~C~C~C~'],
    voicings: ['open', 'power'],
    drums: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0],
    },
    drive: 7,
    brightness: 3800,
    level: 0.5,
    lickPm: 0.1,
    octaveChord: false,
  },
  {
    id: 'heavy',
    name: 'Heavy Groove',
    artists: 'Audioslave · RATM · Soundgarden',
    blurb: 'Low-end syncopation. Riffs that hit like a dropped engine block.',
    tip: 'Lock to the kick. Palm-mute tight, let the accents bark.',
    hue: '#e0762b',
    tempo: [86, 112],
    keys: [4, 2, 7], // E, D, G
    scale: [0, 3, 5, 6, 7, 10], // blues
    progressions: [[0], [0, 3, 0, 10], [0, 8, 10], [0, 6, 5]],
    rhythms: [
      'X~.x~.x~X~.x~.l.',
      'X.x...x.X.x...l.',
      'X~~.x.x.X~~.l.l.',
      'X.x.x~~.X.x.x~~.',
    ],
    fills: ['l~.l~.l~x.x.L~~~', 'l..l..l.l..l..X.', 'x.x.l.l.x.x.l~l~'],
    chorusRhythms: ['C~~~~~~.c.c.C~~~', 'C~~~~~c~C~~~~~c~', 'C~.c~.c~C~.c~.c~'],
    voicings: ['high5', 'triad'],
    drums: {
      kick: [1, 0, 0, 0.8, 0, 0, 0.8, 0, 1, 0, 0, 0.8, 0, 0, 0.6, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0.7, 0, 0.5, 0, 0.7, 0, 0.5, 0, 0.7, 0, 0.5, 0, 0.7, 0, 0.5, 0],
    },
    drive: 10,
    brightness: 3200,
    level: 0.45,
    lickPm: 0.5,
    octaveChord: false,
  },
  {
    id: 'micro',
    name: 'Microtonal Psych',
    artists: 'King Gizzard · Anatolian rock',
    blurb: 'Phrygian flavor with quarter-tone stingers. Hypnotic and slightly alien.',
    tip: 'Keep the 8ths even and hypnotic. Hit “+” notes with a light bend.',
    hue: '#9ab83d',
    tempo: [118, 160],
    keys: [4, 9], // E, A
    scale: [0, 1, 4, 5, 7, 8, 10], // phrygian dominant
    micro: { degrees: [1, 8], chance: 0.55 },
    progressions: [
      [0, 1],
      [0, 1, 0, 10],
      [0, 1, 3, 1],
      [0, 10, 1],
    ],
    rhythms: [
      'x.l.l.l.x.l.l.l.',
      'l.l.l.l.l.l.l.l.',
      'X.x.l.l.x.x.l.l.',
      'x.l.l~~.x.l.l.l.',
    ],
    fills: ['l.lll.l.l.lll.l.', 'l.l.l.lll.l.l.l.', 'lllllllll.l.l~~.'],
    chorusRhythms: ['C~~~c~c~C~~~c~c~', 'C~C~C~C~C~C~C~C~', 'C~~~c~C~~~c~C~~~'],
    voicings: ['triad', 'open'],
    chordQuality: { 0: 'maj', 1: 'maj' }, // phrygian dominant: i and bII are major
    drums: {
      kick: [1, 0, 0, 0, 0, 0, 0.8, 0, 1, 0, 0, 0, 0, 0, 0.8, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0.6, 0.3, 0.5, 0.3, 0.6, 0.3, 0.5, 0.3, 0.6, 0.3, 0.5, 0.3, 0.6, 0.3, 0.5, 0.3],
    },
    drive: 4.5,
    brightness: 4500,
    level: 0.55,
    lickPm: 0.15,
    octaveChord: false,
  },
  {
    id: 'desert',
    name: 'Desert Fuzz',
    artists: 'QOTSA · Kyuss · Fu Manchu',
    blurb: 'Robot rock from the high desert. Chrome 8th notes, fuzz for days.',
    tip: 'Robot right hand: dead-even 8ths, zero swing, staccato.',
    hue: '#d9a441',
    tempo: [102, 126],
    keys: [4, 5, 7], // E, F, G
    scale: [0, 1, 3, 5, 6, 7, 10], // minor penta + b2 + b5
    progressions: [
      [0, 1, 2],
      [0, 3, 2],
      [0, 2, 3],
      [0, 0, 1, 2],
    ],
    rhythms: [
      'x.x.x.x.x.x.x.x.',
      'X.x.x.x.X.x.x.x.',
      'x.x.c~~.x.x.c~~.',
      'X.x.x.X.x.x.X.x.',
    ],
    fills: ['x.x.l.l.x.x.l.l.', 'l.l.x.x.l.l.x.x.', 'x.x.x.x.l.l.l.l.'],
    chorusRhythms: ['C~c~C~c~C~c~C~c~', 'C~~~C~c~C~~~C~c~', 'C~c~c~C~C~c~c~C~'],
    voicings: ['open-color', 'triad', 'power'],
    drums: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0.5, 0, 0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0, 0.8, 0, 0.5, 0, 0.8, 0],
    },
    drive: 9,
    brightness: 2800,
    level: 0.48,
    lickPm: 0.5,
    octaveChord: false,
  },
  {
    id: 'doom',
    name: 'Doom Ritual',
    artists: 'Black Sabbath · Sleep · Electric Wizard',
    blurb: 'Slow-motion avalanche. Tritones, space, and dread.',
    tip: 'Let chords bloom their full length. Count the silence.',
    hue: '#9a6fd0',
    tempo: [58, 84],
    keys: [4, 9, 2], // E, A, D
    scale: [0, 3, 5, 6, 7, 10], // blues
    progressions: [
      [0, 6],
      [0, 3, 0, 6],
      [0, 10, 8],
      [0, 5, 6],
    ],
    rhythms: [
      'C~~~~~~~~~~~c~c~',
      'C~~~~~c~~~~~C~~~',
      'X~x.x.X~C~~~~~~~',
      'C~~~~~~~c~c~C~~~',
    ],
    fills: ['l~~.l~~.l.l.C~~~', 'l~l~l~x.C~~~~~~~', 'C~~~~~~~l~l~l~l~'],
    chorusRhythms: ['C~~~~~~~C~~~~~~~', 'C~~~~~~~~~~~C~~~', 'C~~~~~c~c~~~C~~~'],
    voicings: ['power'], // full chords would be mud at this gain — and that's doom anyway
    drums: {
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      hat: [0.7, 0, 0, 0, 0.5, 0, 0, 0, 0.7, 0, 0, 0, 0.5, 0, 0, 0],
    },
    drive: 12,
    brightness: 2400,
    level: 0.5,
    lickPm: 0.2,
    octaveChord: true,
  },
];

export function vibeById(id: string): Vibe {
  return VIBES.find((v) => v.id === id) ?? VIBES[0];
}

// Guard against pattern typos: every rhythm must be exactly 16 steps.
for (const v of VIBES) {
  for (const p of [...v.rhythms, ...v.fills, ...v.chorusRhythms]) {
    if (p.length !== 16) {
      throw new Error(`Vibe "${v.id}" has a pattern of length ${p.length}: "${p}"`);
    }
  }
}
