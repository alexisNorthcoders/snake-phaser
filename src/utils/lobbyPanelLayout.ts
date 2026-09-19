export const LOBBY_PANEL = { x: 120, y: 80, width: 560, height: 480, padding: 32, gap: 24, scrimAlpha: 0.9 } as const;

export const TITLE_HEIGHT = 40;
export const DIVIDER_HEIGHT = 4;
export const NAME_ROW_HEIGHT = 44;
export const START_BUTTON = { width: 200, height: 56 } as const;
/** Room kept for the colour picker, which stays where it is until it is moved into the panel. */
export const COLOUR_SPACE_HEIGHT = 176;

export interface LobbyPanelLayout {
  contentX: number;
  contentWidth: number;
  titleY: number;
  dividerY: number;
  /** Top of the Name row; undefined for accounts, which have no Name row. */
  nameRowY?: number;
  colourSpaceY: number;
  startY: number;
}

/** Vertical positions of the panel's contents, stacked with equal gaps and centred inside the padding. */
export function computeLobbyPanelLayout(guest: boolean): LobbyPanelLayout {
  const p = LOBBY_PANEL;
  const heights = [TITLE_HEIGHT, DIVIDER_HEIGHT, ...(guest ? [NAME_ROW_HEIGHT] : []), COLOUR_SPACE_HEIGHT, START_BUTTON.height];
  const total = heights.reduce((a, b) => a + b, 0) + p.gap * (heights.length - 1);
  let y = p.y + p.padding + (p.height - 2 * p.padding - total) / 2;
  const tops = heights.map((h) => {
    const top = y;
    y += h + p.gap;
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
    colourSpaceY: rest[0],
    startY: rest[1],
  };
}
