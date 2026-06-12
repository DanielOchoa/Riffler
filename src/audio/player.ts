import type { Engine } from './engine';
import type { Song, RiffEvent } from '../music/generator';
import { totalSteps, STEPS_PER_BAR } from '../music/generator';
import type { Vibe } from '../music/vibes';
import { pitchOf } from '../music/theory';

const LOOKAHEAD_SEC = 0.14;
const TICK_MS = 25;
const COUNT_IN_STEPS = 16;

/**
 * Lookahead scheduler (the "tale of two clocks" pattern): a JS interval walks
 * a step counter slightly ahead of the AudioContext clock and schedules audio
 * at exact times. Recently scheduled steps are kept as anchors so the UI can
 * interpolate a smooth playhead position.
 *
 * Playback is scoped to a loop region [regionStart, regionEnd) so the user
 * can drill just the verse or just the chorus. Count-in occupies the 16 steps
 * before regionStart.
 */
const LADDER_BPM_PER_LOOP = 4;

export class Player {
  bpm = 120;
  loop = true;
  countIn = true;
  clickOn = false;
  guitarOn = true;
  /** Tempo ladder: each completed loop climbs bpm toward ladderTarget. */
  ladder = false;
  ladderTarget: number | null = null;
  onStateChange: (() => void) | null = null;
  onBpmChange: (() => void) | null = null;

  private song: Song | null = null;
  private vibe: Vibe | null = null;
  private eventsByStep = new Map<number, RiffEvent[]>();
  private regionStart = 0;
  private regionEnd = 0;
  private timer: number | null = null;
  private endTimer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private anchors: { time: number; step: number }[] = [];
  private _playing = false;

  constructor(private engine: Engine) {}

  get playing() {
    return this._playing;
  }

  setSong(song: Song, vibe: Vibe) {
    if (this._playing) this.stop();
    this.song = song;
    this.vibe = vibe;
    this.bpm = song.bpm;
    this.ladderTarget = song.bpm;
    this.regionStart = 0;
    this.regionEnd = totalSteps(song);
    this.engine.setTone({ drive: vibe.drive, brightness: vibe.brightness, level: vibe.level });
    this.eventsByStep.clear();
    for (const ev of song.events) {
      const list = this.eventsByStep.get(ev.step) ?? [];
      list.push(ev);
      this.eventsByStep.set(ev.step, list);
    }
  }

  /** Scope playback to [start, end) steps. Restarts if currently playing. */
  setRegion(start: number, end: number) {
    const wasPlaying = this._playing;
    if (wasPlaying) this.stop();
    this.regionStart = start;
    this.regionEnd = end;
    if (wasPlaying) this.start();
  }

  getRegion(): { start: number; end: number } {
    return { start: this.regionStart, end: this.regionEnd };
  }

  start() {
    if (!this.song || !this.vibe || this._playing) return;
    void this.engine.ctx.resume();
    this._playing = true;
    this.step = this.regionStart - (this.countIn ? COUNT_IN_STEPS : 0);
    this.nextTime = this.engine.ctx.currentTime + 0.12;
    this.anchors = [];
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.onStateChange?.();
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    if (this.endTimer !== null) window.clearTimeout(this.endTimer);
    this.timer = null;
    this.endTimer = null;
    if (this._playing) this.engine.panic();
    this._playing = false;
    this.anchors = [];
    this.onStateChange?.();
  }

  toggle() {
    this._playing ? this.stop() : this.start();
  }

  /** Current position as a fractional step (before regionStart = count-in), or null. */
  position(): number | null {
    if (!this._playing || this.anchors.length === 0) return null;
    const now = this.engine.ctx.currentTime;
    let anchor = this.anchors[0];
    for (const a of this.anchors) {
      if (a.time <= now) anchor = a;
      else break;
    }
    const stepDur = 60 / (this.bpm * 4);
    const frac = Math.min(1, Math.max(0, (now - anchor.time) / stepDur));
    return anchor.step + frac;
  }

  private stepDur(): number {
    return 60 / (this.bpm * 4);
  }

  private tick() {
    const ctx = this.engine.ctx;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_SEC) {
      this.scheduleStep(this.step, this.nextTime);
      this.anchors.push({ time: this.nextTime, step: this.step });
      this.nextTime += this.stepDur();
      this.step++;
      if (this.step >= this.regionEnd) {
        if (this.loop) {
          this.step = this.regionStart;
          if (this.ladder && this.ladderTarget !== null && this.bpm < this.ladderTarget) {
            this.bpm = Math.min(this.ladderTarget, this.bpm + LADDER_BPM_PER_LOOP);
            this.onBpmChange?.();
          }
        } else {
          const msLeft = (this.nextTime - ctx.currentTime + 0.4) * 1000;
          if (this.timer !== null) window.clearInterval(this.timer);
          this.timer = null;
          this.endTimer = window.setTimeout(() => {
            this.endTimer = null;
            this._playing = false;
            this.anchors = [];
            this.onStateChange?.();
          }, msLeft);
          break;
        }
      }
    }
    // Drop anchors older than a second; keep the most recent ones for the UI.
    const cutoff = ctx.currentTime - 1;
    while (this.anchors.length > 2 && this.anchors[1].time < cutoff) {
      this.anchors.shift();
    }
  }

  private scheduleStep(step: number, time: number) {
    if (!this.song || !this.vibe) return;

    if (step < this.regionStart) {
      // Count-in bar: clicks on the quarters only.
      if ((this.regionStart - step) % 4 === 0) {
        this.engine.click(time, step === this.regionStart - COUNT_IN_STEPS);
      }
      return;
    }

    const within = step % STEPS_PER_BAR;
    const d = this.vibe.drums;
    if (d.kick[within]) this.engine.kick(time, d.kick[within]);
    if (d.snare[within]) this.engine.snare(time, d.snare[within]);
    if (d.hat[within]) this.engine.hat(time, d.hat[within]);
    if (this.clickOn && within % 4 === 0) this.engine.click(time, within === 0);

    if (!this.guitarOn) return;
    const events = this.eventsByStep.get(step);
    if (!events) return;
    for (const ev of events) {
      const size = ev.notes.length;
      // Big chords get a softer per-string pick: less input into the waveshaper
      // means less saturation — the "roll the volume knob back" move. The amp's
      // compression keeps the loudness close.
      const chordScale = size >= 4 ? 0.45 : size === 3 ? 0.62 : 1;
      const vel = (ev.accent ? 1 : 0.78) * chordScale;
      const strumGap = size >= 4 ? 0.011 : 0.004;
      const hold = ev.durSteps * this.stepDur();
      // Downstroke strum: low strings first.
      const notes = [...ev.notes].sort((a, b) => b.str - a.str);
      notes.forEach((n, i) => {
        this.engine.pluck(time + i * strumGap, pitchOf(n), vel, ev.pm, hold);
      });
    }
  }
}
