const MAX_PANEL_WIDTH = 360;
const CANVAS_MARGIN = 16;

/** Centre x and width of the Game Over panel for a given canvas width. */
export function computeGameOverLayout(canvasWidth: number): { centerX: number; panelWidth: number } {
  return {
    centerX: canvasWidth / 2,
    panelWidth: Math.max(0, Math.min(MAX_PANEL_WIDTH, canvasWidth - 2 * CANVAS_MARGIN)),
  };
}
