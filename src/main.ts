import './style.css';
import { VIBES, vibeById, type Vibe } from './music/vibes';
import { generate, totalSteps, STEPS_PER_BAR, type Song } from './music/generator';
import { Engine } from './audio/engine';
import { Player } from './audio/player';
import { renderTab, moveCursor, hideCursor, type TabView } from './tab';
import { TUNING_LABELS } from './music/theory';

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
const ladderBox = $<HTMLInputElement>('#t-ladder');
const bpmGoal = $('#bpm-goal');

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

// ----- tempo ladder -----

function syncBpmDisplay() {
  bpmOut.textContent = bpmSlider.value;
  bpmGoal.hidden = !ladderBox.checked;
  bpmGoal.textContent = `↗ ${song.bpm}`;
}

/** Starting rung: drop to ~70% of the suggested tempo unless already below. */
function applyLadderStart() {
  if (Number(bpmSlider.value) >= song.bpm) {
    const start = Math.max(50, Math.round(song.bpm * 0.7));
    bpmSlider.value = String(start);
    if (player) player.bpm = start;
  }
  syncBpmDisplay();
}

// ----- riff notebook (localStorage) -----

interface NotebookEntry {
  vibeId: string;
  seed: number;
  key: string;
  bpm: number;
  chords: string;
  savedAt: number;
}

const NB_KEY = 'riffler.notebook.v1';
const NB_MAX = 30;
const saveBtn = $<HTMLButtonElement>('#save');
const notebookEl = $('#notebook');
const nbGrid = $('#nb-grid');

function loadNotebook(): NotebookEntry[] {
  try {
    const list = JSON.parse(localStorage.getItem(NB_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persistNotebook(list: NotebookEntry[]) {
  localStorage.setItem(NB_KEY, JSON.stringify(list));
}

function chordSummary(s: Song): string {
  const sec = (start: number, count: number) => {
    const names: string[] = [];
    for (let i = start; i < start + count; i++) {
      const name = s.bars[i].chordName;
      if (names[names.length - 1] !== name) names.push(name);
    }
    return names.join('·');
  };
  return s.sections.map((x) => sec(x.startBar, x.barCount)).join(' — ');
}

function isSaved(): boolean {
  return loadNotebook().some((e) => e.vibeId === song.vibeId && e.seed === song.seed);
}

function syncSaveBtn() {
  const saved = isSaved();
  saveBtn.textContent = saved ? '★ IN BOOK' : '★ SAVE';
  saveBtn.classList.toggle('saved', saved);
}

function saveCurrentRiff() {
  if (isSaved()) return;
  const list = loadNotebook();
  list.unshift({
    vibeId: song.vibeId,
    seed: song.seed,
    key: song.keyName,
    bpm: song.bpm,
    chords: chordSummary(song),
    savedAt: Date.now(),
  });
  persistNotebook(list.slice(0, NB_MAX));
  syncSaveBtn();
  renderNotebook();
}

function removeRiff(entry: NotebookEntry) {
  persistNotebook(loadNotebook().filter((e) => !(e.vibeId === entry.vibeId && e.seed === entry.seed)));
  syncSaveBtn();
  renderNotebook();
}

function renderNotebook() {
  const list = loadNotebook();
  notebookEl.hidden = list.length === 0;
  nbGrid.replaceChildren(
    ...list.map((entry) => {
      const v = vibeById(entry.vibeId);
      const card = document.createElement('button');
      card.className = 'nb-card';
      card.style.setProperty('--card-accent', v.hue);
      const date = new Date(entry.savedAt)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        .toUpperCase();
      card.innerHTML = `
        <span class="nb-name">${v.name}</span>
        <span class="nb-no">№ ${entry.seed.toString(16).toUpperCase().padStart(8, '0')}</span>
        <span class="nb-meta">KEY ${entry.key}m · ♩=${entry.bpm} · ${date}</span>
        <span class="nb-chords">${entry.chords}</span>
        <span class="nb-x" title="Remove from notebook" aria-label="Remove">✕</span>
      `;
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('nb-x')) {
          removeRiff(entry);
          return;
        }
        const wasPlaying = player?.playing ?? false;
        player?.stop();
        vibe = v;
        loadSong(generate(vibe, entry.seed));
        if (wasPlaying) startPlayback();
      });
      return card;
    }),
  );
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
  $('#tuning-out').textContent = TUNING_LABELS[song.tuning].stamp;
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
  if (player) player.bpm = song.bpm;
  if (ladderBox.checked) applyLadderStart();
  syncBpmDisplay();

  syncVibeCards();
  syncSaveBtn();
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
    player.bassOn = $<HTMLInputElement>('#t-bass').checked;
    player.guitarOn = $<HTMLInputElement>('#t-guitar').checked;
    player.ladder = ladderBox.checked;
    player.onStateChange = syncTransport;
    player.onBpmChange = () => {
      bpmSlider.value = String(player!.bpm);
      syncBpmDisplay();
      bpmOut.classList.remove('tick');
      void bpmOut.offsetWidth; // restart the pop animation
      bpmOut.classList.add('tick');
    };
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
saveBtn.addEventListener('click', saveCurrentRiff);

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
bindToggle('#t-ladder', (on) => {
  if (player) player.ladder = on;
  if (on) applyLadderStart();
  else syncBpmDisplay();
});
bindToggle('#t-click', (on) => player && (player.clickOn = on));
bindToggle('#t-bass', (on) => player && (player.bassOn = on));
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
  } else if (e.key === 's' || e.key === 'S') {
    saveCurrentRiff();
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
renderNotebook();
requestAnimationFrame(frame);
