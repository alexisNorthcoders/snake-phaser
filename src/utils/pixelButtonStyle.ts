export type ButtonSize = 'small' | 'large';
export type ButtonFill = 'button' | 'button-alt' | 'action';

export const BUTTON_FILLS: Record<ButtonFill, { fill: number; hover: number }> = {
  button: { fill: 0x222222, hover: 0x444444 },
  'button-alt': { fill: 0x555555, hover: 0x777777 },
  action: { fill: 0x00aa00, hover: 0x00cc00 },
};

/** Outline, inner edge and drop-shadow thickness in px. */
export const BUTTON_EDGE: Record<ButtonSize, number> = { small: 2, large: 4 };

export interface BevelRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  alpha: number;
}

/**
 * Rects for a button of the given outer size, in draw order, relative to its top-left.
 * The drop shadow sits below the outline and is omitted when pressed; the caller moves a pressed button down.
 */
export function computeBevelRects(
  width: number,
  height: number,
  size: ButtonSize,
  fill: number,
  pressed: boolean,
): BevelRect[] {
  const e = BUTTON_EDGE[size];
  const iw = width - 2 * e;
  const ih = height - 2 * e;
  const light = { color: 0xffffff, alpha: 0.22 };
  const dark = { color: 0x000000, alpha: 0.45 };
  const topLeft = pressed ? dark : light;
  const bottomRight = pressed ? light : dark;
  const rects: BevelRect[] = [];
  if (!pressed) rects.push({ x: 0, y: e, w: width, h: height, color: 0x000000, alpha: 1 });
  rects.push(
    { x: 0, y: 0, w: width, h: height, color: 0x000000, alpha: 1 },
    { x: e, y: e, w: iw, h: ih, color: fill, alpha: 1 },
    { x: e, y: e, w: iw, h: e, ...topLeft },
    { x: e, y: e, w: e, h: ih, ...topLeft },
    { x: e, y: height - 2 * e, w: iw, h: e, ...bottomRight },
    { x: width - 2 * e, y: e, w: e, h: ih, ...bottomRight },
  );
  return rects;
}

export const HEADER_HEIGHT = 40;
export const HEADER_BUTTON = { width: 90, height: 30, margin: 20 } as const;

/** Top-left of the header button: right-aligned 20px from the canvas edge, centred in the 40px strip. */
export function headerButtonPosition(canvasWidth: number): { x: number; y: number } {
  return {
    x: canvasWidth - HEADER_BUTTON.margin - HEADER_BUTTON.width,
    y: (HEADER_HEIGHT - HEADER_BUTTON.height) / 2,
  };
}
