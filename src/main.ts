import './style.css';
import { VIBES, vibeById, type Vibe } from './music/vibes';
import { generate, totalSteps, STEPS_PER_BAR, type Song } from './music/generator';
import { Engine } from './audio/engine';
import { Player } from './audio/player';
import { renderTab, moveCursor, hideCursor, type TabView } from './tab';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const vibesEl = $('#vibes');
const playBtn = $<HTMLButtonElement>('#play');
const newBtn = $<HTMLButtonElement>('#newriff');
const bpmSlider = $<HTMLInputElement>('#bpm');
const bpmOut = $('#bpm-out');
const bpmReset = $<HTMLButtonElement>('#bpm-reset');
const tabwrap = $('#tabwrap');
const countBadge = $('#count-badge');
const seedOut = $('#seed-out');
const keyOut = $('#key-out');
const tempoOut = $('#tempo-out');
const progOut = $('#prog-out');
const tipOut = $('#tip-out');
const segEl = $('#seg-section');

let engine: Engine | null = null;
let player: Player | null = null;
let vibe: Vibe = VIBES[0];
let song: Song;
let view: TabView;
let highlighted = -1;
let selectedSection: number | 'full' = 'full';

// ----- URL hash (#v=garage&s=1a2b3c) so riffs are shareable/reload-safe -----

function readHash(): { v: string | null; s: number | null } {
  const params = new URLSearchParams(location.hash.slice(1));
  const s = params.get('s');
  return { v: params.get('v'), s: s ? parseInt(s, 16) : null };
}

function writeHash() {
  history.replaceState(null, '', `#v=${vibe.id}&s=${song.seed.toString(16)}`);
}

// ----- vibe cards -----

function buildVibeCards() {
  for (const v of VIBES) {
    const card = document.createElement('button');
    card.className = 'vibe-card';
    card.dataset.id = v.id;
    card.setAttribute('aria-pressed', 'false');
    card.innerHTML = `
      <span class="vibe-name">${v.name}</span>
      <span class="vibe-artists">${v.artists}</span>
      <span class="vibe-blurb">${v.blurb}</span>
      <span class="vibe-meta">♩ ${v.tempo[0]}–${v.tempo[1]}</span>
      <span class="vibe-stamp" aria-hidden="true">LOADED</span>
    `;
    card.addEventListener('click', () => {
      if (vibe.id !== v.id) {
        vibe = v;
        newRiff();
      }
    });
    vibesEl.appendChild(card);
  }
}

function syncVibeCards() {
  document.documentElement.style.setProperty('--accent', vibe.hue);
  vibesEl.querySelectorAll<HTMLButtonElement>('.vibe-card').forEach((c) => {
    c.setAttribute('aria-pressed', String(c.dataset.id === vibe.id));
  });
}

// ----- loop region (full song / one section) -----

function regionFor(): { start: number; end: number } {
  if (selectedSection !== 'full') {
    const sec = song.sections[selectedSection];
    if (sec) {
      return {
        start: sec.startBar * STEPS_PER_BAR,
        end: (sec.startBar + sec.barCount) * STEPS_PER_BAR,
      };
    }
  }
  return { start: 0, end: totalSteps(song) };
}

function applyRegion() {
  if (!player) return;
  const r = regionFor();
  player.setRegion(r.start, r.end);
}

// ----- song lifecycle -----

function loadSong(s: Song) {
  song = s;
  player?.setSong(song, vibe);
  applyRegion();

  view = renderTab(song);
  tabwrap.replaceChildren(view.svg);
  highlighted = -1;

  seedOut.textContent = song.seed.toString(16).toUpperCase().padStart(8, '0');
  keyOut.textContent = `KEY ${song.keyName}m`;
  tempoOut.textContent = `♩=${song.bpm} SUGG.`;
  tipOut.textContent = vibe.tip;

  // Progression chips, grouped by section.
  const chips: HTMLElement[] = [];
  for (const sec of song.sections) {
    const label = document.createElement('span');
    label.className = 'prog-sec-label';
    label.textContent = sec.name;
    chips.push(label);
    for (let i = sec.startBar; i < sec.startBar + sec.barCount; i++) {
      const bar = song.bars[i];
      const chip = document.createElement('span');
      chip.className = 'prog-chip';
      chip.textContent = bar.chordName;
      if (i > sec.startBar && song.bars[i - 1].chordName === bar.chordName) {
        chip.classList.add('repeat');
      }
      chips.push(chip);
    }
  }
  progOut.replaceChildren(...chips);

  bpmSlider.value = String(song.bpm);
  bpmOut.textContent = String(song.bpm);
  if (player) player.bpm = song.bpm;

  syncVibeCards();
  writeHash();
}

function newRiff() {
  const wasPlaying = player?.playing ?? false;
  player?.stop();
  loadSong(generate(vibe, (Math.random() * 0xffffffff) >>> 0));
  if (wasPlaying) startPlayback();
}

// ----- playback -----

function ensureAudio() {
  if (!engine) {
    engine = new Engine();
    player = new Player(engine);
    player.loop = $<HTMLInputElement>('#t-loop').checked;
    player.countIn = $<HTMLInputElement>('#t-count').checked;
    player.clickOn = $<HTMLInputElement>('#t-click').checked;
    player.guitarOn = $<HTMLInputElement>('#t-guitar').checked;
    player.onStateChange = syncTransport;
    player.setSong(song, vibe);
    player.bpm = Number(bpmSlider.value);
    applyRegion();
  }
}

function startPlayback() {
  ensureAudio();
  player!.start();
}

function syncTransport() {
  const playing = player?.playing ?? false;
  playBtn.textContent = playing ? '■ STOP' : '▶ PLAY';
  playBtn.classList.toggle('is-playing', playing);
  if (!playing) {
    hideCursor(view);
    countBadge.classList.remove('show');
    setHighlight(-1);
  }
}

function setHighlight(idx: number) {
  if (idx === highlighted) return;
  if (highlighted >= 0) view.eventGroups[highlighted]?.classList.remove('on');
  if (idx >= 0) view.eventGroups[idx]?.classList.add('on');
  highlighted = idx;
}

function frame() {
  const pos = player?.playing ? player.position() : null;
  if (pos === null) {
    requestAnimationFrame(frame);
    return;
  }
  const { start, end } = regionFor();
  if (pos < start) {
    // Count-in: big 4-3-2-1 over the sheet.
    hideCursor(view);
    countBadge.textContent = String(Math.ceil((start - pos) / 4));
    countBadge.classList.add('show');
    setHighlight(-1);
  } else {
    countBadge.classList.remove('show');
    moveCursor(view, pos);
    const step = Math.min(end - 1, Math.floor(pos));
    setHighlight(view.evAtStep[step] ?? -1);
  }
  requestAnimationFrame(frame);
}

// ----- controls -----

playBtn.addEventListener('click', () => {
  ensureAudio();
  player!.toggle();
});
newBtn.addEventListener('click', newRiff);

segEl.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    segEl.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b === btn));
    selectedSection = btn.dataset.sec === 'full' ? 'full' : Number(btn.dataset.sec);
    applyRegion(); // restarts (with count-in) if currently playing
  });
});

bpmSlider.addEventListener('input', () => {
  bpmOut.textContent = bpmSlider.value;
  if (player) player.bpm = Number(bpmSlider.value);
});
bpmReset.addEventListener('click', () => {
  bpmSlider.value = String(song.bpm);
  bpmOut.textContent = bpmSlider.value;
  if (player) player.bpm = song.bpm;
});

const bindToggle = (id: string, apply: (on: boolean) => void) => {
  const box = $<HTMLInputElement>(id);
  box.addEventListener('change', () => apply(box.checked));
};
bindToggle('#t-loop', (on) => player && (player.loop = on));
bindToggle('#t-count', (on) => player && (player.countIn = on));
bindToggle('#t-click', (on) => player && (player.clickOn = on));
bindToggle('#t-guitar', (on) => player && (player.guitarOn = on));

window.addEventListener('keydown', (e) => {
  // Let focused buttons/inputs keep their native Space behavior (no double-toggle).
  const onControl = e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement;
  if (e.code === 'Space' && !onControl) {
    e.preventDefault();
    ensureAudio();
    player!.toggle();
  } else if (e.key === 'n' || e.key === 'N') {
    newRiff();
  } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !onControl) {
    e.preventDefault();
    const delta = e.key === 'ArrowUp' ? 2 : -2;
    bpmSlider.value = String(Math.max(50, Math.min(200, Number(bpmSlider.value) + delta)));
    bpmSlider.dispatchEvent(new Event('input'));
  }
});

// ----- boot -----

buildVibeCards();
const hash = readHash();
if (hash.v) vibe = vibeById(hash.v);
loadSong(generate(vibe, hash.s ?? (Math.random() * 0xffffffff) >>> 0));
requestAnimationFrame(frame);
