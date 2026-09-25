import { GAME_MODES } from '../gameMode.ts';

export type LeaderboardTab = 'global' | 'mine';

export const LEADERBOARD_ROWS = 5;

const PADDING_Y = 16;
const PADDING_X = 24;
const HEADER_ROW_HEIGHT = 24;
const HEADER_GAP = 8;
const ROW_HEIGHT = 20;
const RANK_WIDTH = 40;

export const LEADERBOARD_REFRESH_BUTTON = { width: 90, height: 24 } as const;
export const LEADERBOARD_TAB_GAP = 24;
/** One Timed / Endless button; the pair sits left of Refresh. */
export const LEADERBOARD_MODE_BUTTON = { width: 76, height: 24 } as const;
const MODE_BUTTON_GAP = 8;
/** Space between the Timed / Endless switch and the Refresh button. */
const MODE_SWITCH_GAP = 24;

/** Panel box: 560 wide at (120, 600), tall enough for the header and five rows plus padding. */
export const LEADERBOARD_PANEL = {
  x: 120,
  y: 600,
  width: 560,
  height: PADDING_Y + HEADER_ROW_HEIGHT + HEADER_GAP + LEADERBOARD_ROWS * ROW_HEIGHT + PADDING_Y,
  scrimAlpha: 0.8,
} as const;

export interface LeaderboardPanelLayout {
  contentX: number;
  contentWidth: number;
  headerY: number;
  headerHeight: number;
  rowsY: number;
  rowHeight: number;
  /** Left edge of each mode button, in `GAME_MODES` order. */
  modeButtonXs: number[];
  refreshX: number;
  rankX: number;
  nameX: number;
  /** Right edge of the right-aligned score column. */
  scoreRight: number;
}

export function computeLeaderboardPanelLayout(): LeaderboardPanelLayout {
  const p = LEADERBOARD_PANEL;
  const contentX = p.x + PADDING_X;
  const contentWidth = p.width - 2 * PADDING_X;
  const headerY = p.y + PADDING_Y;
  const refreshX = contentX + contentWidth - LEADERBOARD_REFRESH_BUTTON.width;
  const modeStep = LEADERBOARD_MODE_BUTTON.width + MODE_BUTTON_GAP;
  const modeSwitchX = refreshX - MODE_SWITCH_GAP - (GAME_MODES.length * modeStep - MODE_BUTTON_GAP);
  return {
    contentX,
    contentWidth,
    headerY,
    headerHeight: HEADER_ROW_HEIGHT,
    rowsY: headerY + HEADER_ROW_HEIGHT + HEADER_GAP,
    rowHeight: ROW_HEIGHT,
    modeButtonXs: GAME_MODES.map((_, i) => modeSwitchX + i * modeStep),
    refreshX,
    rankX: contentX,
    nameX: contentX + RANK_WIDTH,
    scoreRight: contentX + contentWidth,
  };
}

export interface LeaderboardRow {
  rank: string;
  label: string;
  score: string;
}

export interface LocalScoreEntry {
  score: number;
  timestamp: number;
}

export interface GlobalScoreEntry {
  username: string;
  score: number;
}

/** Top five global entries as rank / name / score rows. */
export function globalRows(entries: readonly GlobalScoreEntry[]): LeaderboardRow[] {
  return entries.slice(0, LEADERBOARD_ROWS).map((e, i) => ({
    rank: `${i + 1}.`,
    label: e.username,
    score: String(e.score),
  }));
}

/** Top five of the player's own scores as rank / date / score rows. */
export function mineRows(
  entries: readonly LocalScoreEntry[],
  formatDate: (timestamp: number) => string = (t) => new Date(t).toLocaleDateString(),
): LeaderboardRow[] {
  return entries.slice(0, LEADERBOARD_ROWS).map((e, i) => ({
    rank: `${i + 1}.`,
    label: formatDate(e.timestamp),
    score: String(e.score),
  }));
}
