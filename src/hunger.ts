import type { Phase } from './countdownOverlay';
import type { GameMode } from './gameMode';

/** The room state a snake's hunger is read against. */
export type HungerRound = { mode: GameMode; phase: Phase; hungerTicks: number };

/** The synced parts of a snake its hunger bar is worked out from. */
export type SnakeHunger = { hunger: number; score: number; isDead: boolean };

/**
 * A snake's hunger bar for one patch: `startScore` is the score its drain began from (or would, while it is fed),
 * kept for the next patch; `fill` runs from 1 (that score) down to 0 (none left), and null means no bar.
 */
export type HungerTrack = { startScore: number; fill: number | null };

/** Starving from the tick a snake's hunger reaches the room's `hungerTicks`: the server drains its score on that tick. */
export function isStarving(hunger: number, hungerTicks: number): boolean {
  return hunger >= hungerTicks;
}

/** How much of the score the drain began from is left, from 1 down to 0; a score drained below zero is empty. */
export function hungerFill(score: number, startScore: number): number {
  if (startScore <= 0) return 0;
  return Math.min(1, Math.max(0, score / startScore));
}

/**
 * Tracks one snake's hunger bar across patches. The client isn't told how much the drain takes, so the first patch
 * showing a snake starving already carries the first drain: while it is fed its score is remembered instead, as the
 * score the drain begins from. Eating resets `hunger`, which hides the bar and remembers the new score. Only while an
 * endless round is in play, and only for a live snake.
 */
export function trackHunger(prevStartScore: number | undefined, round: HungerRound, snake: SnakeHunger): HungerTrack {
  const { mode, phase, hungerTicks } = round;
  if (!isStarving(snake.hunger, hungerTicks)) return { startScore: snake.score, fill: null };
  const startScore = prevStartScore ?? snake.score;
  if (mode !== 'endless' || phase !== 'playing' || snake.isDead) return { startScore, fill: null };
  return { startScore, fill: hungerFill(snake.score, startScore) };
}
