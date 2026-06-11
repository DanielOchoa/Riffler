# ROADMAP

Ideas backlog for Riffler. Effort tags: **S** (an hour-ish), **M** (a session),
**L** (multi-session). Items under "Up next" are endorsed by Daniel — start
there. When an item ships, move its line to the Shipped section at the bottom
with a date.

## Up next (endorsed)

- **Song sections / more bars (verse–chorus)** *(M)* — generate two related
  riffs in the same key (A = verse, B = chorus with more motion or a lift),
  arrange as AABB or AAB B; section labels on the sheet, per-section looping.
  Touches: generator (multi-section Song), tab (section headers), player
  (longer step grid).
- **Chord voicing variety** *(M)* — today every chord is a power chord (root +
  fifth, +octave for doom): 2 fingers by design, since thirds turn to mud
  through heavy distortion. Add a voicing library (open E/A/G/D/C shapes,
  minor & major, sus2/add9 colors, 3-string triads/double-stops on the top
  strings) with a per-vibe palette — garage gets open chords at lower gain,
  desert gets QOTSA-ish sus/add9 stabs, heavy gets high triad answers.
  Gain-aware: full chords only on cleaner vibes or with drive rolled back.

## Musician hat

- **Section loop** *(S)* — loop bars 1–2 or a click-dragged region of the tab.
  Biggest practice-value-per-effort item on the list.
- **Tempo ladder** *(S)* — auto-trainer: start at 70%, +4 BPM every N clean
  loops. Builds directly on the existing scheduler.
- **Drop-D + alternate tunings** *(M)* — theory layer is already parameterized
  on `OPEN_MIDI`; drop-D unlocks real Audioslave/doom voicings.
- **Bass + scratch layer** *(S/M)* — synth bass following chord roots so
  guitar-off practice feels like a band; RATM-style dead-note scratches.
- **Feel engine** *(M)* — per-vibe swing amount, velocity humanization, slight
  push/drag. Everything is machine-straight today.
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

- 2026-06-10 — v1: five vibes, seeded generator, SVG tab, KS guitar + drum
  synthesis, tempo/loop/count-in/click/guitar-off, URL-hash sharing.
