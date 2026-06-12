import type { Song, RiffEvent } from './music/generator';
import { STEPS_PER_BAR, totalSteps } from './music/generator';
import { TUNING_LABELS } from './music/theory';

/**
 * Renders a song as a tab sheet, 2 bars per row, with section tags (VERSE /
 * CHORUS) above the rows that start a section. Returns the geometry the
 * playhead needs. All sizes are viewBox units; CSS scales it.
 */
const COL = 24; // width of one 16th-note column
const GUT = 36; // left gutter for string names
const PAD = 16;
const BARS_PER_ROW = 2;
const STEPS_PER_ROW = STEPS_PER_BAR * BARS_PER_ROW;
const STR_GAP = 14;
const CHORD_Y = 18;
const STAFF_TOP = 36;
const STAFF_H = STR_GAP * 5;
const PM_Y = STAFF_TOP + STAFF_H + 22;
const ROW_H = 150;
const SECTION_PAD = 26; // extra space above a row that starts a section

export const TAB_W = GUT + PAD * 2 + STEPS_PER_ROW * COL;

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface TabView {
  svg: SVGSVGElement;
  /** Event index covering each step, or -1. */
  evAtStep: number[];
  cursor: SVGGElement;
  eventGroups: SVGGElement[];
  posToXY(pos: number): { x: number; rowTop: number };
}

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  text?: string,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
}

function stepX(stepInRow: number): number {
  return GUT + PAD + stepInRow * COL + COL / 2;
}

export function renderTab(song: Song): TabView {
  const steps = totalSteps(song);
  const rows = Math.ceil(song.bars.length / BARS_PER_ROW);
  const stringLabels = TUNING_LABELS[song.tuning].strings;

  // Rows that start a section get extra headroom for the section tag.
  const sectionAtRow = new Map<number, string>();
  for (const s of song.sections) {
    sectionAtRow.set(Math.floor(s.startBar / BARS_PER_ROW), s.name);
  }
  const rowTops: number[] = [];
  let y = 0;
  for (let r = 0; r < rows; r++) {
    if (sectionAtRow.has(r)) y += SECTION_PAD;
    rowTops.push(y);
    y += ROW_H;
  }
  const tabH = y;

  const svg = el('svg', {
    viewBox: `0 0 ${TAB_W} ${tabH}`,
    class: 'tab-svg',
    role: 'img',
    'aria-label': `Guitar tab, ${song.bars.length} bars in ${song.keyName}`,
  }) as SVGSVGElement;

  const stringY = (rowTop: number, str: number) => rowTop + STAFF_TOP + (str - 1) * STR_GAP;

  for (let row = 0; row < rows; row++) {
    const rowTop = rowTops[row];

    // Section tag
    const secName = sectionAtRow.get(row);
    if (secName) {
      const w = secName.length * 9 + 16;
      svg.appendChild(
        el('rect', { x: GUT + PAD - 12, y: rowTop - 16, width: w, height: 17, class: 'section-tag-bg' }),
      );
      svg.appendChild(
        el('text', { x: GUT + PAD - 12 + w / 2, y: rowTop - 3.5, class: 'section-tag', 'text-anchor': 'middle' }, secName),
      );
    }

    // String labels + staff lines
    for (let s = 1; s <= 6; s++) {
      const sy = stringY(rowTop, s);
      svg.appendChild(
        el('text', { x: GUT - 10, y: sy + 3.5, class: 'str-label', 'text-anchor': 'end' }, stringLabels[s - 1]),
      );
      svg.appendChild(
        el('line', { x1: GUT, y1: sy, x2: TAB_W - PAD + 6, y2: sy, class: 'staff-line' }),
      );
    }

    for (let b = 0; b <= BARS_PER_ROW; b++) {
      const x = GUT + PAD + b * STEPS_PER_BAR * COL - (b === 0 ? PAD : COL / 2);
      const isSongEdge = (row === 0 && b === 0) || (row === rows - 1 && b === BARS_PER_ROW);
      svg.appendChild(
        el('line', {
          x1: x,
          y1: stringY(rowTop, 1),
          x2: x,
          y2: stringY(rowTop, 6),
          class: isSongEdge ? 'barline thick' : 'barline',
        }),
      );
      // Repeat dots at the loop boundaries
      if (isSongEdge) {
        const dx = row === 0 && b === 0 ? 7 : -7;
        for (const dy of [1.5 * STR_GAP, 3.5 * STR_GAP]) {
          svg.appendChild(
            el('circle', { cx: x + dx, cy: stringY(rowTop, 1) + dy, r: 2.6, class: 'repeat-dot' }),
          );
        }
      }
    }

    // Beat ticks + chord names
    for (let b = 0; b < BARS_PER_ROW; b++) {
      const barIdx = row * BARS_PER_ROW + b;
      if (barIdx >= song.bars.length) break;
      for (let beat = 0; beat < 4; beat++) {
        const x = stepX(b * STEPS_PER_BAR + beat * 4);
        svg.appendChild(
          el('line', {
            x1: x,
            y1: rowTop + STAFF_TOP - 8,
            x2: x,
            y2: rowTop + STAFF_TOP - 4,
            class: 'beat-tick',
          }),
        );
      }
      // A chord name is "fresh" when it changes from the previous bar (or starts a section).
      const sectionStart = song.sections.some((s) => s.startBar === barIdx);
      const prev = barIdx > 0 ? song.bars[barIdx - 1].chordName : null;
      const name = song.bars[barIdx].chordName;
      svg.appendChild(
        el(
          'text',
          {
            x: stepX(b * STEPS_PER_BAR) - COL / 2,
            y: rowTop + CHORD_Y,
            class: name !== prev || sectionStart ? 'chord-name fresh' : 'chord-name',
          },
          name,
        ),
      );
    }
  }

  // Palm-mute group markers: "PM" + dashed line under runs of muted steps.
  const pmRanges: { start: number; end: number }[] = [];
  for (const ev of song.events) {
    if (!ev.pm) continue;
    const last = pmRanges[pmRanges.length - 1];
    if (last && ev.step <= last.end + 2) last.end = ev.step + ev.durSteps - 1;
    else pmRanges.push({ start: ev.step, end: ev.step + ev.durSteps - 1 });
  }
  for (const r of pmRanges) {
    const row = Math.floor(r.start / STEPS_PER_ROW);
    const rowTop = rowTops[row];
    const end = Math.min(r.end, (row + 1) * STEPS_PER_ROW - 1); // clamp to row
    const x1 = stepX(r.start % STEPS_PER_ROW) - 6;
    const x2 = stepX(end % STEPS_PER_ROW) + 6;
    svg.appendChild(el('text', { x: x1, y: rowTop + PM_Y, class: 'pm-label' }, 'PM'));
    if (x2 > x1 + 20) {
      svg.appendChild(
        el('line', { x1: x1 + 20, y1: rowTop + PM_Y - 3, x2, y2: rowTop + PM_Y - 3, class: 'pm-line' }),
      );
    }
  }

  // Notes
  const evAtStep = new Array<number>(steps).fill(-1);
  const eventGroups: SVGGElement[] = [];

  song.events.forEach((ev: RiffEvent, idx: number) => {
    for (let s = ev.step; s < ev.step + ev.durSteps && s < evAtStep.length; s++) {
      evAtStep[s] = idx;
    }
    const row = Math.floor(ev.step / STEPS_PER_ROW);
    const rowTop = rowTops[row];
    const x = stepX(ev.step % STEPS_PER_ROW);
    const g = el('g', { class: 'ev' }) as SVGGElement;

    if (ev.slide) {
      const sy = stringY(rowTop, ev.notes[0].str);
      g.appendChild(el('text', { x: x - COL * 0.58, y: sy + 4, class: 'slide-mark' }, '/'));
    }
    for (const n of ev.notes) {
      const sy = stringY(rowTop, n.str);
      const t = el(
        'text',
        { x, y: sy + 4, class: ev.accent ? 'fret acc' : 'fret', 'text-anchor': 'middle' },
        String(n.fret),
      );
      if (n.micro > 0) {
        t.appendChild(el('tspan', { dy: -5, class: 'micro-mark' }, '+'));
      }
      g.appendChild(t);
    }
    svg.appendChild(g);
    eventGroups.push(g);
  });

  // Playhead cursor (hidden until playback starts)
  const cursor = el('g', { class: 'cursor', visibility: 'hidden' }) as SVGGElement;
  cursor.appendChild(
    el('rect', {
      x: -COL / 2,
      y: STAFF_TOP - 14,
      width: COL,
      height: STAFF_H + 28,
      rx: 3,
      class: 'cursor-glow',
    }),
  );
  cursor.appendChild(
    el('line', { x1: 0, y1: STAFF_TOP - 14, x2: 0, y2: STAFF_TOP + STAFF_H + 14, class: 'cursor-line' }),
  );
  svg.appendChild(cursor);

  const posToXY = (pos: number) => {
    const p = Math.max(0, Math.min(steps, pos));
    const row = Math.min(rows - 1, Math.floor(p / STEPS_PER_ROW));
    const within = p - row * STEPS_PER_ROW;
    return { x: GUT + PAD + within * COL + COL / 2, rowTop: rowTops[row] };
  };

  return { svg, evAtStep, cursor, eventGroups, posToXY };
}

export function moveCursor(view: TabView, pos: number) {
  const { x, rowTop } = view.posToXY(pos);
  view.cursor.setAttribute('transform', `translate(${x}, ${rowTop})`);
  view.cursor.setAttribute('visibility', 'visible');
}

export function hideCursor(view: TabView) {
  view.cursor.setAttribute('visibility', 'hidden');
}
