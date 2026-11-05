export type Direction = 'u' | 'd' | 'l' | 'r';

// Distance in CSS px the finger travels along one axis before a Swipe turns the snake.
export const SWIPE_THRESHOLD = 24;

export interface Swipe {
  down(x: number, y: number): void;
  /** Returns the turn this movement makes, if it crossed the threshold. */
  move(x: number, y: number): Direction | null;
  up(): void;
}

/** Turns one finger's down/move/up positions (CSS px) into turns; a single drag can chain several. */
export function createSwipe(): Swipe {
  let origin: { x: number; y: number } | null = null;

  return {
    down(x, y) {
      origin = { x, y };
    },
    move(x, y) {
      if (!origin) return null;
      const dx = x - origin.x;
      const dy = y - origin.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return null;
      origin = { x, y };
      if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'r' : 'l';
      return dy > 0 ? 'd' : 'u';
    },
    up() {
      origin = null;
    },
  };
}
