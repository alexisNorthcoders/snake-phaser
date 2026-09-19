/** Frame edge thickness; matches PANEL_EDGE in framedPanelStyle. */
const PANEL_EDGE = 4;

const MAX_PANEL_WIDTH = 480;
const CANVAS_MARGIN = 16;

export const GAME_OVER_BUTTON = { width: 280, height: 52, gap: 20 } as const;
export const GAME_OVER_ROW_HEIGHT = 28;
const PADDING = 32;
const TITLE_HEIGHT = 40;
const SECTION_GAP = 16;
const SUBHEADING_HEIGHT = 32;

/** Centre x and width of the Game Over panel for a given canvas width. */
export function computeGameOverLayout(canvasWidth: number): { centerX: number; panelWidth: number } {
  return {
    centerX: canvasWidth / 2,
    panelWidth: Math.max(0, Math.min(MAX_PANEL_WIDTH, canvasWidth - 2 * CANVAS_MARGIN)),
  };
}

export interface GameOverContentLayout {
  panelHeight: number;
  padding: number;
  titleY: number;
  dividerY: number;
  roomRowsY: number;
  subheadingY: number;
  topRowsY: number;
  playAgainY: number;
  saveScoreY?: number;
}

/** Vertical positions relative to the panel's top, so the height fits the content. */
export function computeGameOverContentLayout(roomRows: number, topRows: number, guest: boolean): GameOverContentLayout {
  const titleY = PANEL_EDGE + PADDING;
  const dividerY = titleY + TITLE_HEIGHT + SECTION_GAP / 2;
  const roomRowsY = dividerY + PANEL_EDGE + SECTION_GAP;
  const subheadingY = roomRowsY + roomRows * GAME_OVER_ROW_HEIGHT + SECTION_GAP;
  const topRowsY = subheadingY + SUBHEADING_HEIGHT;
  const playAgainY = topRowsY + Math.max(topRows, 1) * GAME_OVER_ROW_HEIGHT + SECTION_GAP * 2;
  const saveScoreY = guest ? playAgainY + GAME_OVER_BUTTON.height + GAME_OVER_BUTTON.gap : undefined;
  const lastBottom = (saveScoreY ?? playAgainY) + GAME_OVER_BUTTON.height;
  return {
    panelHeight: lastBottom + PADDING + PANEL_EDGE,
    padding: PADDING,
    titleY,
    dividerY,
    roomRowsY,
    subheadingY,
    topRowsY,
    playAgainY,
    saveScoreY,
  };
}
