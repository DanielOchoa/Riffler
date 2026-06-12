# ROADMAP

Ideas backlog for Riffler. Effort tags: **S** (an hour-ish), **M** (a session),
**L** (multi-session). Items under "Up next" are endorsed by Daniel — start
there. When an item ships, move its line to the Shipped section at the bottom
with a date.

## Up next (endorsed)

*(empty — pick from below and move it up here)*

## Musician hat

- **Arbitrary-region loop** *(S)* — the FULL/VERSE/CHORUS switcher shipped;
  still open: loop any click-dragged bar range of the tab.
- **More tunings** *(S/M)* — drop-D shipped (heavy + doom). Still open: drop-C
  / C-standard for sludge, or a user-facing tuning override per riff.
- **Scratch layer** *(S)* — bass shipped; still open: RATM-style dead-note
  guitar scratches ("chka") as a rhythm texture in heavy verses.
- **Push/drag feel** *(S)* — swing + humanize shipped; still open: intentional
  per-vibe push (rushing) or drag (laying back) of whole instruments relative
  to the grid, e.g. snare a hair late for doom.
- **Real techniques** *(M)* — hammer-on/pull-off pairs, audible pitch bends
  (ramp the buffer playbackRate or render bent KS buffers), vibrato on doom
  sustains.
- **Odd meters** *(M)* — 7/8 psych or 6/8 doom for timing practice; requires
  un-hardcoding the 16-steps-per-bar grid.
- **Fretboard overlay** *(M)* — diagram of the scale box the riff lives in;
  directly serves the learn-the-neck goal.
- **Riff difficulty dial** *(M)* — gate note density, position span, and
  techniques behind a beginner/intermediate/advanced setting.

## Designer hat

- **Riff poster export** *(M)* — downloadable gig-poster PNG of the riff sheet
  (canvas render: title, stamps, tab, vibe art).
- **Print-as-zine stylesheet** *(S)* — `@media print` so the sheet prints like
  a photocopied tab zine for a music stand.
- **Riff notebook** *(M)* — favorited riffs (vibe+seed in localStorage)
  browsed as a wall of torn flyers.
- **Stage-light pulse** *(S)* — background vignette breathes with the kick,
  reduced-motion aware.
- **Deeper vibe theming** *(M)* — beyond `--accent`: doom gets ink bleed,
  psych gets a liquid-warped masthead, desert gets sun-bleached paper.
- **Music-stand mobile mode** *(M)* — sticky bottom transport, giant tap
  targets, tab fills the screen; practice happens with guitar in hand.

## Flagship

- **Mic listening** *(L)* — `getUserMedia` + onset detection, score the
  player's timing against the step grid ("87% in the pocket"). Closes the
  loop on timing practice; the step clock and click already exist.

## Shipped

- 2026-06-11 — **Drop-D tuning**: Heavy Groove and Doom Ritual now generate in
  drop D — riffs live on the low string, power chords on a string-6 root come
  out as the one-finger same-fret barre (fret offsets derive from string
  intervals), tab labels and the tuning stamp follow the song.
- 2026-06-11 — **Bass layer**: saw+sine synth bass derived live from the kick
  pattern + chord roots (locks to kick velocity, holds until the next kick,
  chromatic approach notes into chord changes). BASS toggle in the deck;
  guitar-off practice now feels like a rhythm section.
- 2026-06-11 — **Feel engine**: per-vibe swing (`swing`/`swingUnit` on Vibe —
  garage and doom swing 8ths, heavy swings 16ths, desert/micro stay straight)
  plus velocity + timing humanization at schedule time. The metronome click
  stays dead straight on purpose.
- 2026-06-11 — **Tempo ladder**: LADDER toggle drops you to ~70% of the
  suggested tempo and climbs +4 BPM every completed loop until target.
- 2026-06-10 — **Song sections (verse–chorus)**: every song is now VERSE +
  CHORUS (4 bars each) with section tags on the sheet, grouped progression
  chips, and a FULL/VERSE/CHORUS loop switcher in the deck.
- 2026-06-10 — **Chord voicing variety**: voicing library in theory.ts (open
  cowboy shapes, movable D/G/B triads, high 5th stabs) with per-vibe chorus
  palettes and aeolian quality mapping (phrygian-dominant override for psych);
  big chords are picked softer so the amp cleans up.
- 2026-06-10 — v1: five vibes, seeded generator, SVG tab, KS guitar + drum
  synthesis, tempo/loop/count-in/click/guitar-off, URL-hash sharing.
