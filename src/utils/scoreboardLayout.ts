export const SCOREBOARD_PANEL = { x: 560, y: 56, width: 220, scrimAlpha: 0.6 } as const;

export const SCOREBOARD_MAX_ROWS = 10;

const PADDING_Y = 12;
const PADDING_X = 16;
const HEADING_HEIGHT = 18;
const ROW_HEIGHT = 16;
const ROW_GAP = 8;
export const SCOREBOARD_SWATCH_SIZE = 12;
export const SCOREBOARD_SWATCH_OUTLINE = 2;

export interface ScoreboardPlayer {
  id: string;
  name: string;
  score: number;
  isDead: boolean;
  headColour: string;
}

export interface ScoreboardRow {
  id: string;
  label: string;
  score: number;
  isDead: boolean;
  headColour: number;
}

const MAX_NAME_CHARS = 12;
const truncate = (name: string) => (name.length > MAX_NAME_CHARS ? name.slice(0, MAX_NAME_CHARS - 1) + '…' : name);

/** Highest score first, capped at the visible maximum; the local player is labelled "You". */
export function scoreboardRows(players: ScoreboardPlayer[], selfId: string | undefined): ScoreboardRow[] {
  return [...players]
    .sort((a, b) => b.score - a.score)
    .slice(0, SCOREBOARD_MAX_ROWS)
    .map((p) => ({
      id: p.id,
      label: p.id === selfId ? 'You' : truncate(p.name || 'Player'),
      score: p.score,
      isDead: p.isDead,
      headColour: parseColour(p.headColour),
    }));
}

const c = (v: string) => Math.min(255, Number(v));

/** Accepts "#rrggbb", "#rgb" and "rgb(r, g, b)"; anything else falls back to white. */
export function parseColour(value: string): number {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (hex) return parseInt(hex[1], 16);
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value.trim());
  if (short) return parseInt(short[1] + short[1] + short[2] + short[2] + short[3] + short[3], 16);
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(value.trim());
  if (rgb) return (c(rgb[1]) << 16) | (c(rgb[2]) << 8) | c(rgb[3]);
  return 0xffffff;
}

export interface ScoreboardLayout {
  height: number;
  contentX: number;
  headingY: number;
  /** Top of row `i`. */
  rowY: (i: number) => number;
  /** Left edge of the outlined swatch and of the name (after a gap). */
  swatchX: number;
  nameX: number;
  /** Right edge of the right-aligned score column. */
  scoreRight: number;
}

/** Panel grows with the row count: padding, heading, then rows separated by the row gap. */
export function computeScoreboardLayout(rowCount: number): ScoreboardLayout {
  const p = SCOREBOARD_PANEL;
  const contentX = p.x + PADDING_X;
  const rowsTop = p.y + PADDING_Y + HEADING_HEIGHT + ROW_GAP;
  const rowsHeight = rowCount > 0 ? rowCount * ROW_HEIGHT + (rowCount - 1) * ROW_GAP : 0;
  return {
    height: PADDING_Y + HEADING_HEIGHT + (rowCount > 0 ? ROW_GAP + rowsHeight : 0) + PADDING_Y,
    contentX,
    headingY: p.y + PADDING_Y,
    rowY: (i) => rowsTop + i * (ROW_HEIGHT + ROW_GAP),
    swatchX: contentX,
    nameX: contentX + SCOREBOARD_SWATCH_SIZE + 2 * SCOREBOARD_SWATCH_OUTLINE + 8,
    scoreRight: p.x + p.width - PADDING_X,
  };
}
