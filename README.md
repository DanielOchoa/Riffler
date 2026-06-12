<p align="center">
  <img src="assets/riffler.jpg" alt="RIFFLER" width="700" />
</p>

Vibe-to-riff practice engine. Pick a vibe (garage stomp, heavy groove,
microtonal psych, desert fuzz, doom ritual), get a generated verse–chorus
song — riffy verse, fuller chord voicings in the chorus — as guitar tab with
a suggested tempo, then play along with a moving cursor, synthesized guitar +
drums, count-in, and section looping.

## Run it

```sh
npm install
npm run dev      # → http://localhost:5173
```

## Practice workflow

1. Pick a vibe, hit **NEW RIFF** until you find one you like (riffs are
   seeded — the URL hash is shareable / reload-safe).
2. Use **VERSE** / **CHORUS** to loop just the section you're drilling.
3. Drag the tempo down, turn **CLICK** on, and learn the shape.
4. Turn **GUITAR** off to play the riff yourself over bass + drums.
5. Turn **LADDER** on — it starts you around 70% of the suggested tempo and
   climbs +4 BPM every completed loop until you're back at full speed.
6. Hit **★ SAVE** to pin a keeper to THE NOTEBOOK (stored in localStorage);
   click any saved flyer to pull it back up.

Keyboard: `SPACE` play/stop · `N` new riff · `S` save · `↑/↓` tempo.

## How it works

- **Generation** (`src/music/`) — rule-based, no AI: each vibe defines keys,
  a scale, progression templates (semitone offsets), 16-step rhythm patterns,
  drum grooves, chord-voicing palettes, and amp settings. A seeded RNG picks
  and mutates; a lick walker random-walks the scale near the chord root so
  everything stays in one playable position. Verses stick to power chords
  (thirds turn to mud under distortion); choruses pull from a voicing library
  (open shapes, movable triads, high 5th stabs) with a softer per-string pick
  so the amp cleans up.
- **Audio** (`src/audio/`) — Web Audio API. Guitar is Karplus-Strong plucked
  string synthesis rendered into cached buffers (exact frequencies, so the
  quarter-tone "+" notes in Microtonal Psych are real quarter-tones), fed
  through a tanh waveshaper amp. Drums are classic analog recipes. A
  lookahead scheduler keeps timing sample-accurate.
- **Tab** (`src/tab.ts`) — custom SVG renderer: 6-line tab, chord names,
  palm-mute spans, slide/accent/microtone markers, repeat barlines, and a
  playhead the UI interpolates every frame.

## Tab legend

`PM` palm mute · `+` quarter-sharp (light bend) · `/` slide in ·
bold = accent · 𝄆 𝄇 = the 4 bars loop.
