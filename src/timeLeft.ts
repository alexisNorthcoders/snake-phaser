import type { Phase } from './countdownOverlay';
import type { GameMode } from './gameMode';

/** Seconds left at or under which the HUD timer turns urgent. */
export const URGENT_SECONDS = 10;

/** Whole seconds left, rounded up so any time still left reads as at least a second. */
function secondsLeft(ticksLeft: number, tickMs: number): number {
  return Math.max(0, Math.ceil((ticksLeft * tickMs) / 1000));
}

/** The server's ticks left times its tick length, as `m:ss`. */
export function formatTimeLeft(ticksLeft: number, tickMs: number): string {
  const seconds = secondsLeft(ticksLeft, tickMs);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * The HUD timer for a room state patch: shown once a timed round is under way (and left at 0:00 when it ends),
 * never in the lobby, the countdown or an endless room. Null means no timer.
 */
export function hudTimeLeft(
  phase: Phase,
  mode: GameMode,
  ticksLeft: number,
  tickMs: number,
): { label: string; urgent: boolean } | null {
  if (mode !== 'timed' || (phase !== 'playing' && phase !== 'ended')) return null;
  return { label: formatTimeLeft(ticksLeft, tickMs), urgent: secondsLeft(ticksLeft, tickMs) <= URGENT_SECONDS };
}
