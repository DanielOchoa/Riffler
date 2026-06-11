# CLAUDE.md

Riffler is a vibe-to-riff guitar practice web app: pick a vibe (Garage Stomp,
Heavy Groove, Microtonal Psych, Desert Fuzz, Doom Ritual), a seeded rule-based
generator produces a 4-bar chord progression + riff rendered as SVG guitar
tab, and Web Audio plays it Songsterr-style with a moving cursor. Purpose is
**deliberate practice** (learning progressions across the fretboard, timing),
so practice features (tempo slider, loop, count-in, click, guitar-off mode)
outrank playback fidelity.

## Commands

```sh
npm run dev        # vite dev server → localhost:5173
npm run build      # tsc --noEmit && vite build (this is the typecheck too)
npm run preview    # serve dist/
# generator smoke test (1000 seeded riffs, asserts playability, prints ASCII tabs):
./node_modules/.bin/esbuild scripts/smoke.ts --bundle --format=cjs --platform=node | node
```

There is no test framework; the smoke script is the test suite. Run it after
touching anything in `src/music/`.

## Architecture (data flow)

```
vibes.ts ──recipe──▶ generator.ts ──Song──▶ tab.ts (SVG render + playhead geometry)
                                      └────▶ player.ts (lookahead scheduler)
                                                └──▶ engine.ts (Web Audio synthesis)
main.ts wires UI ◀── style.css (all theming, including SVG tab classes)
```

- `src/music/theory.ts` — tuning, MIDI math, root placement, power chords.
  Strings are indexed **1..6 where 6 = low E**; `OPEN_MIDI[str - 1]`.
- `src/music/vibes.ts` — one `Vibe` object per style: keys, scale, progression
  templates, rhythm patterns, drum grid, amp settings, accent color.
- `src/music/generator.ts` — seeded RNG (mulberry32), maps progressions onto
  4 bars, lick walker random-walks the scale near the chord-root anchor.
- `src/audio/engine.ts` — Karplus-Strong guitar rendered into cached
  AudioBuffers → tanh waveshaper amp; synthesized kick/snare/hat/click.
- `src/audio/player.ts` — lookahead scheduler ("tale of two clocks"); keeps
  recent step→time anchors so the UI can interpolate a smooth playhead.
- `src/tab.ts` — SVG tab renderer; exports geometry (`posToXY`) for the cursor.
- `src/main.ts` — DOM wiring, URL hash, keyboard shortcuts, rAF loop.

## Invariants — break these and things get weird

- **Determinism**: the same (vibe, seed) must always generate the same song;
  the shareable URL hash `#v=<vibe>&s=<hexseed>` depends on it. Inside the
  generator, randomness only ever comes from the passed `rng` — never
  `Math.random()` (fine elsewhere, e.g. audio noise).
- **Rhythm pattern grammar**: exactly 16 chars per bar of 4/4 16ths.
  `C/c` chord (accented/stab), `X/x` root chug (palm-muted), `L/l` lick note,
  `~` extends the previous event one step, `.` rest. `vibes.ts` throws at
  import time on wrong lengths; the smoke test catches musical breakage.
- **Time grid**: 16 steps/bar × 4 bars = 64 steps. Count-in is steps −16..−1.
- **Guitar synthesis is rendered KS buffers, not a DelayNode feedback loop** —
  Web Audio clamps cycle delays to 128 samples, which detunes notes above
  ~344 Hz. Rendered buffers also give exact frequencies, which the microtonal
  vibe's quarter-tones (+0.5 semitone, marked `+` in tab) require.
- **AudioContext is created lazily** on first user gesture (`ensureAudio()` in
  main.ts) — never at module init, or autoplay policy bites.
- Progressions are **semitone offsets from the key root** (e.g. `[0, 3, 5]` =
  i–bIII–IV), all voiced as power chords; `placeRoot` keeps successive chord
  roots near each other on the neck (frets 0–11, strings 6/5).

## Environment gotchas

- Local Node is **20.15** → stay on Vite 6 (Vite 7 needs Node 20.19+).
- Zero runtime dependencies, vanilla TS, no framework — keep it that way
  unless something genuinely can't be done lean.
- Headless-Chrome screenshots fire before the CSS load-stagger animations
  finish; pass `--force-prefers-reduced-motion`. Related: the reduced-motion
  media query must zero `animation-delay`, not just durations.

## Design system (gig-poster letterpress)

- Palette lives in `:root` of `style.css`: `--ink` (near-black), `--bone`
  (aged white), `--paper` (the tab sheet), and `--accent`, which is **set from
  JS per vibe** (`vibe.hue`) — the whole app re-inks when you switch vibes.
  New UI must use `var(--accent)`, never hardcoded reds.
- Type: Alfa Slab One for display, IBM Plex Mono for everything else (Google
  Fonts, loaded in index.html). No other fonts.
- Language: hard offset shadows (`4px 4px 0 #000`), 2px borders, rotated
  rubber-stamp chips, hazard stripes, film-grain overlay, no rounded corners
  beyond 2–3px, no gradients except atmosphere/vignette.
- The tab is plain SVG styled by classes in `style.css` (`.fret`, `.staff-line`,
  `.cursor-line`…) — style there, not via attributes in `tab.ts`.
