/** Frame edge thickness; matches PANEL_EDGE in framedPanelStyle. */
const PANEL_EDGE = 4;

const MAX_PANEL_WIDTH = 480;
const CANVAS_MARGIN = 16;

export const GAME_OVER_BUTTON = { width: 280, height: 52, gap: 20 } as const;
export const GAME_OVER_ROW_HEIGHT = 28;
/** A row of the round's ranking: the name line, and under it how that snake died. `nameY` and `causeY` are line centres. */
export const GAME_OVER_RANKING_ROW = { height: 44, nameY: 14, causeY: 34 } as const;
const PADDING = 32;
const TITLE_HEIGHT = 40;
const SECTION_GAP = 16;
const SUBHEADING_HEIGHT = 32;
const HEADLINE_GAP = 8;

/** Centre x and width of the Game Over panel for a given canvas width, and the width inside its padding. */
export function computeGameOverLayout(canvasWidth: number): { centerX: number; panelWidth: number; contentWidth: number } {
  const panelWidth = Math.max(0, Math.min(MAX_PANEL_WIDTH, canvasWidth - 2 * CANVAS_MARGIN));
  return {
    centerX: canvasWidth / 2,
    panelWidth,
    contentWidth: Math.max(0, panelWidth - 2 * PADDING),
  };
}

export interface GameOverContentLayout {
  panelHeight: number;
  padding: number;
  titleY: number;
  headlineY: number;
  dividerY: number;
  roomRowsY: number;
  subheadingY: number;
  topRowsY: number;
  playAgainY: number;
  saveScoreY?: number;
}

/**
 * Vertical positions relative to the panel's top, so the height fits the content.
 * `headlineHeight` is the headline's rendered height, which grows when it wraps on a narrow panel.
 */
export function computeGameOverContentLayout(
  roomRows: number,
  topRows: number,
  guest: boolean,
  headlineHeight: number,
): GameOverContentLayout {
  const titleY = PANEL_EDGE + PADDING;
  const headlineY = titleY + TITLE_HEIGHT + HEADLINE_GAP;
  const dividerY = headlineY + headlineHeight + SECTION_GAP / 2;
  const roomRowsY = dividerY + PANEL_EDGE + SECTION_GAP;
  const subheadingY = roomRowsY + roomRows * GAME_OVER_RANKING_ROW.height + SECTION_GAP;
  const topRowsY = subheadingY + SUBHEADING_HEIGHT;
  const playAgainY = topRowsY + Math.max(topRows, 1) * GAME_OVER_ROW_HEIGHT + SECTION_GAP * 2;
  const saveScoreY = guest ? playAgainY + GAME_OVER_BUTTON.height + GAME_OVER_BUTTON.gap : undefined;
  const lastBottom = (saveScoreY ?? playAgainY) + GAME_OVER_BUTTON.height;
  return {
    panelHeight: lastBottom + PADDING + PANEL_EDGE,
    padding: PADDING,
    titleY,
    headlineY,
    dividerY,
    roomRowsY,
    subheadingY,
    topRowsY,
    playAgainY,
    saveScoreY,
  };
}

/** Game Over ranking name; a bot's row is tagged using the room's synced `isBot` flag. */
export function rankingName(name: string, isBot: boolean): string {
  return isBot ? `${name} [BOT]` : name;
}
