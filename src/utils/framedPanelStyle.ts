export const PANEL_EDGE = 4;
export const PANEL_BORDER = 0x333333;

export interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  alpha: number;
}

/**
 * Rects for a framed panel of the given outer size, in draw order, relative to its top-left:
 * a black drop shadow below, the black outline, the scrim fill, then a 4px #333333 inner border.
 */
export function computeFrameRects(width: number, height: number, scrimAlpha: number): PanelRect[] {
  const e = PANEL_EDGE;
  const iw = width - 2 * e;
  const ih = height - 2 * e;
  return [
    { x: 0, y: e, w: width, h: height, color: 0x000000, alpha: 1 },
    { x: 0, y: 0, w: width, h: height, color: 0x000000, alpha: 1 },
    { x: e, y: e, w: iw, h: ih, color: 0x000000, alpha: scrimAlpha },
    { x: e, y: e, w: iw, h: e, color: PANEL_BORDER, alpha: 1 },
    { x: e, y: height - 2 * e, w: iw, h: e, color: PANEL_BORDER, alpha: 1 },
    { x: e, y: 2 * e, w: e, h: ih - 2 * e, color: PANEL_BORDER, alpha: 1 },
    { x: width - 2 * e, y: 2 * e, w: e, h: ih - 2 * e, color: PANEL_BORDER, alpha: 1 },
  ];
}

/** Dashed divider of the given width: 4px tall, alternating 4px #333333 dashes and 4px gaps. */
export function computeDividerRects(width: number): PanelRect[] {
  const rects: PanelRect[] = [];
  for (let x = 0; x < width; x += 2 * PANEL_EDGE) {
    rects.push({ x, y: 0, w: Math.min(PANEL_EDGE, width - x), h: PANEL_EDGE, color: PANEL_BORDER, alpha: 1 });
  }
  return rects;
}
