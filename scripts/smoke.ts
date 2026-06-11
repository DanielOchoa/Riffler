/**
 * Generator smoke test.
 * Generates many songs per vibe, asserts they're playable, and prints one
 * ASCII tab per vibe for an eyeball check.
 */
import { VIBES } from '../src/music/vibes';
import { generate, totalSteps, STEPS_PER_BAR } from '../src/music/generator';
import { OPEN_MIDI } from '../src/music/theory';

let failures = 0;
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++;
    console.error('FAIL:', msg);
  }
};

for (const vibe of VIBES) {
  for (let seed = 1; seed <= 200; seed++) {
    const song = generate(vibe, seed * 2654435761);
    const steps = totalSteps(song);
    check(song.bars.length === 8, `${vibe.id}/${seed}: ${song.bars.length} bars`);
    check(song.sections.length === 2, `${vibe.id}/${seed}: sections`);
    check(song.events.length > 0, `${vibe.id}/${seed}: no events`);
    check(song.bpm >= vibe.tempo[0] && song.bpm <= vibe.tempo[1], `${vibe.id}/${seed}: bpm ${song.bpm}`);
    for (const sec of song.sections) {
      const lo = sec.startBar * STEPS_PER_BAR;
      const hi = (sec.startBar + sec.barCount) * STEPS_PER_BAR;
      check(
        song.events.some((e) => e.step >= lo && e.step < hi),
        `${vibe.id}/${seed}: empty ${sec.name}`,
      );
    }
    let prev = -1;
    for (const ev of song.events) {
      check(ev.step >= 0 && ev.step < steps, `${vibe.id}/${seed}: step ${ev.step}`);
      check(ev.step >= prev, `${vibe.id}/${seed}: events out of order`);
      prev = ev.step;
      check(ev.durSteps >= 1, `${vibe.id}/${seed}: dur ${ev.durSteps}`);
      check(ev.notes.length > 0, `${vibe.id}/${seed}: empty event`);
      for (const n of ev.notes) {
        check(n.str >= 1 && n.str <= 6, `${vibe.id}/${seed}: string ${n.str}`);
        check(n.fret >= 0 && n.fret <= 15, `${vibe.id}/${seed}: fret ${n.fret}`);
        check(!(n.micro > 0 && n.fret === 0), `${vibe.id}/${seed}: micro on open string`);
        check(OPEN_MIDI[n.str - 1] + n.fret >= 40, `${vibe.id}/${seed}: below low E`);
      }
    }
  }

  // Print one example
  const song = generate(vibe, 12345);
  const steps = totalSteps(song);
  console.log(`\n=== ${vibe.name} — key ${song.keyName}m, ♩=${song.bpm} ===`);
  const names = ['e', 'B', 'G', 'D', 'A', 'E'];
  for (const sec of song.sections) {
    const lo = sec.startBar * STEPS_PER_BAR;
    const hi = (sec.startBar + sec.barCount) * STEPS_PER_BAR;
    const chords = song.bars.slice(sec.startBar, sec.startBar + sec.barCount).map((b) => b.chordName);
    console.log(`-- ${sec.name}: ${chords.join(' | ')}`);
    const grid: string[][] = Array.from({ length: 6 }, () => Array(steps).fill('--'));
    for (const ev of song.events) {
      if (ev.step < lo || ev.step >= hi) continue;
      for (const n of ev.notes) {
        const label = String(n.fret) + (n.micro > 0 ? '+' : '');
        grid[n.str - 1][ev.step] = label.padEnd(2, '-');
      }
    }
    for (let s = 0; s < 6; s++) {
      let line = names[s] + '|';
      for (let step = lo; step < hi; step++) {
        line += grid[s][step];
        if (step % STEPS_PER_BAR === STEPS_PER_BAR - 1) line += '|';
      }
      console.log(line);
    }
  }
}

console.log(failures === 0 ? '\nOK: 1000 songs, all playable.' : `\n${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
