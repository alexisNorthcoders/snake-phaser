import { PREVIEW_BOX } from './colourRowLayout.ts';

export const LOBBY_PANEL = { x: 120, y: 80, width: 560, height: 480, padding: 32, gap: 24, scrimAlpha: 0.9 } as const;

export const TITLE_HEIGHT = 40;
export const DIVIDER_HEIGHT = 4;
export const NAME_ROW_HEIGHT = 44;
/** The Mode row: the Timed / Endless toggle buttons over a one-line blurb of the chosen mode. */
export const MODE_ROW = { buttonWidth: 140, buttonHeight: 36, blurbGap: 6, blurbHeight: 22 } as const;
export const MODE_ROW_HEIGHT = MODE_ROW.buttonHeight + MODE_ROW.blurbGap + MODE_ROW.blurbHeight;
export const START_BUTTON = { width: 200, height: 56 } as const;
/** Height of the colour row: the preview box, which the buttons and swatches match. */
export const COLOUR_SPACE_HEIGHT: number = PREVIEW_BOX.height;

export interface LobbyPanelLayout {
  contentX: number;
  contentWidth: number;
  titleY: number;
  dividerY: number;
  /** Top of the Name row; undefined for accounts, which have no Name row. */
  nameRowY?: number;
  modeRowY: number;
  colourSpaceY: number;
  startY: number;
}

/**
 * Vertical positions of the panel's contents, stacked with equal gaps and centred inside the padding. The gaps are
 * the panel's usual 24px, tightened just enough for a guest's taller stack to fit.
 */
export function computeLobbyPanelLayout(guest: boolean): LobbyPanelLayout {
  const p = LOBBY_PANEL;
  const heights = [TITLE_HEIGHT, DIVIDER_HEIGHT, ...(guest ? [NAME_ROW_HEIGHT] : []), MODE_ROW_HEIGHT, COLOUR_SPACE_HEIGHT, START_BUTTON.height];
  const content = heights.reduce((a, b) => a + b, 0);
  const inner = p.height - 2 * p.padding;
  const gap = Math.min(p.gap, Math.floor((inner - content) / (heights.length - 1)));
  const total = content + gap * (heights.length - 1);
  let y = p.y + p.padding + (inner - total) / 2;
  const tops = heights.map((h) => {
    const top = y;
    y += h + gap;
    return top;
  });
  const [titleY, dividerY, ...rest] = tops;
  const nameRowY = guest ? rest.shift() : undefined;
  return {
    contentX: p.x + p.padding,
    contentWidth: p.width - 2 * p.padding,
    titleY,
    dividerY,
    nameRowY,
    modeRowY: rest[0],
    colourSpaceY: rest[1],
    startY: rest[2],
  };
}
