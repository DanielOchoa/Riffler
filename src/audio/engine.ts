import { midiToFreq } from '../music/theory';

export interface ToneSpec {
  drive: number;
  brightness: number;
  level: number;
}

/**
 * All sound is synthesized live. Guitar voices are Karplus-Strong plucked
 * strings rendered into cached AudioBuffers (exact frequency, so quarter-tones
 * come free), pushed through a shared tanh waveshaper "amp". Drums are the
 * classic analog recipes: swept sine kick, filtered-noise snare and hats.
 */
export class Engine {
  readonly ctx: AudioContext;

  private master: GainNode;
  private guitarIn: GainNode;
  private guitarOut: GainNode;
  private shaper: WaveShaperNode;
  private toneFilter: BiquadFilterNode;
  private drumBus: GainNode;
  private bassBus: GainNode;
  private noiseBuf: AudioBuffer;
  private pluckCache = new Map<string, AudioBuffer>();
  private guitarLevel = 0.5;

  constructor() {
    this.ctx = new AudioContext();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 12;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    this.master.connect(limiter);
    limiter.connect(ctx.destination);

    // Guitar chain: in → highpass → waveshaper → tone lowpass → mid scoop → out
    this.guitarIn = ctx.createGain();
    const rumble = ctx.createBiquadFilter();
    rumble.type = 'highpass';
    rumble.frequency.value = 62;
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '4x';
    this.toneFilter = ctx.createBiquadFilter();
    this.toneFilter.type = 'lowpass';
    this.toneFilter.frequency.value = 3500;
    this.toneFilter.Q.value = 0.6;
    const scoop = ctx.createBiquadFilter();
    scoop.type = 'peaking';
    scoop.frequency.value = 650;
    scoop.Q.value = 0.8;
    scoop.gain.value = -2.5;
    this.guitarOut = ctx.createGain();

    this.guitarIn.connect(rumble);
    rumble.connect(this.shaper);
    this.shaper.connect(this.toneFilter);
    this.toneFilter.connect(scoop);
    scoop.connect(this.guitarOut);
    this.guitarOut.connect(this.master);

    this.drumBus = ctx.createGain();
    this.drumBus.gain.value = 0.9;
    this.drumBus.connect(this.master);

    this.bassBus = ctx.createGain();
    this.bassBus.gain.value = 0.6;
    this.bassBus.connect(this.master);

    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    this.setTone({ drive: 7, brightness: 3800, level: 0.5 });
  }

  setTone(spec: ToneSpec) {
    const n = 2048;
    const curve = new Float32Array(n);
    const k = Math.max(1, spec.drive);
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / norm;
    }
    this.shaper.curve = curve;
    this.toneFilter.frequency.value = spec.brightness;
    this.guitarLevel = spec.level;
    this.guitarOut.gain.value = spec.level;
    this.pluckCache.clear(); // pm damping differs per vibe feel; cheap to re-render
  }

  /** Hard-mute both buses briefly — used when transport stops. */
  panic() {
    const t = this.ctx.currentTime;
    for (const g of [this.guitarOut.gain, this.drumBus.gain, this.bassBus.gain]) {
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0.0001, t + 0.06);
    }
    this.guitarOut.gain.setValueAtTime(this.guitarLevel, t + 0.3);
    this.drumBus.gain.setValueAtTime(0.9, t + 0.3);
    this.bassBus.gain.setValueAtTime(0.6, t + 0.3);
  }

  // ----- guitar -----

  pluck(time: number, midi: number, vel: number, pm: boolean, holdSec: number) {
    const buf = this.getPluck(midi, pm);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vel;
    src.connect(g);
    g.connect(this.guitarIn);

    const stopAt = Math.min(buf.duration, pm ? buf.duration : holdSec + 0.25);
    if (stopAt < buf.duration) {
      g.gain.setTargetAtTime(0, time + stopAt, 0.025);
    }
    src.start(time);
    src.stop(time + buf.duration);
  }

  private getPluck(midi: number, pm: boolean): AudioBuffer {
    const key = `${Math.round(midi * 2)}|${pm ? 1 : 0}`;
    let buf = this.pluckCache.get(key);
    if (!buf) {
      buf = this.renderPluck(midiToFreq(midi), pm);
      this.pluckCache.set(key, buf);
    }
    return buf;
  }

  private renderPluck(freq: number, pm: boolean): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const seconds = pm ? 0.4 : 2.2;
    const decay = pm ? 0.16 : 1.7; // time to fall ~40 dB
    const brightness = pm ? 0.35 : 0.72; // one-pole coefficient on the excitation noise
    const len = Math.floor(seconds * sr);
    const buf = this.ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);

    // The averaging loop filter adds half a sample of delay, hence the -0.5.
    const N = Math.max(2, Math.round(sr / freq - 0.5));
    const damp = Math.pow(0.01, 1 / (decay * freq));

    const dl = new Float32Array(N);
    let lp = 0;
    let mean = 0;
    for (let i = 0; i < N; i++) {
      const w = Math.random() * 2 - 1;
      lp += brightness * (w - lp);
      dl[i] = lp;
      mean += lp;
    }
    mean /= N;
    for (let i = 0; i < N; i++) dl[i] -= mean;

    let ptr = 0;
    for (let i = 0; i < len; i++) {
      const cur = dl[ptr];
      const nxt = dl[(ptr + 1) % N];
      out[i] = cur;
      dl[ptr] = damp * 0.5 * (cur + nxt);
      ptr = (ptr + 1) % N;
    }
    // Fade the tail so loops never click.
    const fade = Math.min(512, len);
    for (let i = 0; i < fade; i++) {
      out[len - 1 - i] *= i / fade;
    }
    return buf;
  }

  // ----- bass -----

  /** Saw + sine synth bass with a plucky filter envelope. */
  bass(time: number, midi: number, vel: number, dur: number) {
    const ctx = this.ctx;
    const f = midiToFreq(midi);

    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = f;
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = f;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(900, time);
    filter.frequency.exponentialRampToValueAtTime(360, time + 0.09);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vel, time + 0.006);
    g.gain.setValueAtTime(vel, time + Math.max(0.006, dur));
    g.gain.setTargetAtTime(0, time + Math.max(0.006, dur), 0.035);

    const sawGain = ctx.createGain();
    sawGain.gain.value = 0.55;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    saw.connect(sawGain);
    sub.connect(subGain);
    sawGain.connect(filter);
    subGain.connect(filter);
    filter.connect(g);
    g.connect(this.bassBus);

    const stop = time + dur + 0.3;
    saw.start(time);
    sub.start(time);
    saw.stop(stop);
    sub.stop(stop);
  }

  // ----- drums -----

  kick(time: number, vel: number) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 1.1, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc.connect(g);
    g.connect(this.drumBus);
    osc.start(time);
    osc.stop(time + 0.32);
  }

  snare(time: number, vel: number) {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vel * 0.8, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.17);
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(this.drumBus);
    noise.start(time);
    noise.stop(time + 0.2);

    const tone = ctx.createOscillator();
    tone.type = 'triangle';
    tone.frequency.value = 186;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(vel * 0.5, time);
    tg.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
    tone.connect(tg);
    tg.connect(this.drumBus);
    tone.start(time);
    tone.stop(time + 0.09);
  }

  hat(time: number, vel: number) {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuf;
    noise.playbackRate.value = 1 + Math.random() * 0.1;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.45, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    noise.connect(hp);
    hp.connect(g);
    g.connect(this.drumBus);
    noise.start(time);
    noise.stop(time + 0.07);
  }

  click(time: number, accent: boolean) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = accent ? 1860 : 1240;
    const g = ctx.createGain();
    g.gain.setValueAtTime(accent ? 0.4 : 0.28, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    osc.connect(g);
    g.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.05);
  }
}
