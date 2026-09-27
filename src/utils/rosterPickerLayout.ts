import { DIVIDER_HEIGHT, LOBBY_PANEL, TITLE_HEIGHT } from './lobbyPanelLayout.ts';

const COLUMNS = 2;

/**
 * The picker's frame, over the lobby panel: `titleGap` is above and below the divider, `cardGap` between cards, and
 * `closeSize` the square close button's side. Opaque, so the lobby under it doesn't show through.
 */
export const ROSTER_PICKER = { padding: 32, titleGap: 16, cardGap: 16, closeSize: 36, scrimAlpha: 1 } as const;

/**
 * One card: the name (with the baseline tag on its right), then personality, then generation and method, then a
 * last line, `recordLine`, kept free for the record against humans. Each line sits `lineHeight` below the one before.
 */
export const ROSTER_CARD = {
  width: (LOBBY_PANEL.width - 2 * ROSTER_PICKER.padding - (COLUMNS - 1) * ROSTER_PICKER.cardGap) / COLUMNS,
  height: 128,
  padding: 12,
  lineHeight: 26,
  recordLine: 3,
} as const;

export interface RosterPickerLayout {
  panel: { x: number; y: number; width: number; height: number };
  titleY: number;
  dividerY: number;
  closeX: number;
  closeY: number;
  /** Top of the area the cards (or the loading line) fill. */
  cardsY: number;
  /** Top-left of each card, in roster order. */
  cards: { x: number; y: number }[];
}

/** The picker for `count` cards: the lobby panel's box, grown downward only when the cards need more room. */
export function computeRosterPickerLayout(count: number): RosterPickerLayout {
  const p = LOBBY_PANEL;
  const pad = ROSTER_PICKER.padding;
  const titleY = p.y + pad;
  const dividerY = titleY + TITLE_HEIGHT + ROSTER_PICKER.titleGap;
  const cardsY = dividerY + DIVIDER_HEIGHT + ROSTER_PICKER.titleGap;
  const cards = Array.from({ length: count }, (_, i) => ({
    x: p.x + pad + (i % COLUMNS) * (ROSTER_CARD.width + ROSTER_PICKER.cardGap),
    y: cardsY + Math.floor(i / COLUMNS) * (ROSTER_CARD.height + ROSTER_PICKER.cardGap),
  }));
  const rows = Math.ceil(count / COLUMNS);
  const cardsBottom = cardsY + rows * ROSTER_CARD.height + Math.max(rows - 1, 0) * ROSTER_PICKER.cardGap;
  const height = Math.max(p.height, cardsBottom + pad - p.y);
  return {
    panel: { x: p.x, y: p.y, width: p.width, height },
    titleY,
    dividerY,
    closeX: p.x + p.width - pad - ROSTER_PICKER.closeSize,
    closeY: titleY,
    cardsY,
    cards,
  };
}
