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

/** One Swipe driven by raw pointer events: the first finger down owns it, and a press that starts on a button never swipes. */
export interface FingerSwipe {
  down(fingerId: number, x: number, y: number, onButton: boolean): void;
  move(fingerId: number, x: number, y: number): Direction | null;
  /** Moves the owning finger's origin without turning, discarding its travel so far. */
  rebase(fingerId: number, x: number, y: number): void;
  up(fingerId: number): void;
}

export function createFingerSwipe(): FingerSwipe {
  const swipe = createSwipe();
  let owner: number | null = null;
  return {
    down(fingerId, x, y, onButton) {
      if (owner !== null || onButton) return;
      owner = fingerId;
      swipe.down(x, y);
    },
    move(fingerId, x, y) {
      return fingerId === owner ? swipe.move(x, y) : null;
    },
    rebase(fingerId, x, y) {
      if (fingerId === owner) swipe.down(x, y);
    },
    up(fingerId) {
      if (fingerId !== owner) return;
      owner = null;
      swipe.up();
    },
  };
}
