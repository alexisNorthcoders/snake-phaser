export const PREVIEW_BOX = { width: 208, height: 124 } as const;
export const PREVIEW_CELL = 44;
export const PREVIEW_SNAKE_CELLS = 3;
export const COLUMN_GAP = 24;
export const ROW_GAP = 16;
export const PART_BUTTON = { width: 80, gap: 12 } as const;
export const SWATCH = { size: 28, gap: 6, cols: 6, rows: 2 } as const;
export const SWATCH_GRID_HEIGHT = SWATCH.rows * SWATCH.size + (SWATCH.rows - 1) * SWATCH.gap;
/** Button row height: what is left of the row (the preview box height) after the gap and swatch grid, so the right column is exactly as tall as the box. */
export const PART_BUTTON_HEIGHT = PREVIEW_BOX.height - ROW_GAP - SWATCH_GRID_HEIGHT;

export interface Point {
  x: number;
  y: number;
}

export interface ColourRowLayout {
  box: Point;
  snakeOrigin: Point;
  /** Top-left of each part button, in Head, Body, Eyes order. */
  partButtons: Point[];
  swatchTop: number;
  swatchLeft: number;
}

/** Positions inside the colour row whose top-left is (x, y): preview box on the left, buttons over swatches on the right. */
export function computeColourRowLayout(x: number, y: number): ColourRowLayout {
  const right = x + PREVIEW_BOX.width + COLUMN_GAP;
  return {
    box: { x, y },
    snakeOrigin: {
      x: x + (PREVIEW_BOX.width - PREVIEW_CELL * PREVIEW_SNAKE_CELLS) / 2,
      y: y + (PREVIEW_BOX.height - PREVIEW_CELL) / 2,
    },
    partButtons: [0, 1, 2].map((i) => ({ x: right + i * (PART_BUTTON.width + PART_BUTTON.gap), y })),
    swatchLeft: right,
    swatchTop: y + PART_BUTTON_HEIGHT + ROW_GAP,
  };
}

/** Top-left of the palette swatch at the given index (6 columns by 2 rows). */
export function swatchPosition(layout: ColourRowLayout, index: number): Point {
  return {
    x: layout.swatchLeft + (index % SWATCH.cols) * (SWATCH.size + SWATCH.gap),
    y: layout.swatchTop + Math.floor(index / SWATCH.cols) * (SWATCH.size + SWATCH.gap),
  };
}

export interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  alpha: number;
}

const OUTLINE = 4;

/** Preview box rects relative to its top-left: 4px black outline, #1d1d1d fill, dark inner top-left edge. */
export function computePreviewBoxRects(): BoxRect[] {
  const { width: w, height: h } = PREVIEW_BOX;
  const e = OUTLINE;
  return [
    { x: 0, y: 0, w, h, color: 0x000000, alpha: 1 },
    { x: e, y: e, w: w - 2 * e, h: h - 2 * e, color: 0x1d1d1d, alpha: 1 },
    { x: e, y: e, w: w - 2 * e, h: e, color: 0x000000, alpha: 0.45 },
    { x: e, y: e, w: e, h: h - 2 * e, color: 0x000000, alpha: 0.45 },
  ];
}

/** Swatch rects relative to its top-left: colour fill, light top-left and dark bottom-right 2px inner edges. */
export function computeSwatchEdgeRects(): BoxRect[] {
  const s = SWATCH.size;
  const e = 2;
  return [
    { x: 0, y: 0, w: s, h: e, color: 0xffffff, alpha: 0.3 },
    { x: 0, y: 0, w: e, h: s, color: 0xffffff, alpha: 0.3 },
    { x: 0, y: s - e, w: s, h: e, color: 0x000000, alpha: 0.4 },
    { x: s - e, y: 0, w: e, h: s, color: 0x000000, alpha: 0.4 },
  ];
}
