import type { Phase } from './countdownOverlay';
import type { GameMode } from './gameMode';

/** Seconds left at or under which the HUD timer turns urgent. */
const URGENT_SECONDS = 10;

/** What the HUD timer shows: the label, and whether it is in its last few seconds. */
export type HudTimeLeft = { label: string; urgent: boolean };

/** Whole seconds left, rounded up so any time still left reads as at least a second. */
function secondsLeft(ticksLeft: number, tickMs: number): number {
  return Math.max(0, Math.ceil((ticksLeft * tickMs) / 1000));
}

function formatSeconds(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The server's ticks left times its tick length, as `m:ss`. */
export function formatTimeLeft(ticksLeft: number, tickMs: number): string {
  return formatSeconds(secondsLeft(ticksLeft, tickMs));
}

/**
 * The HUD timer for a room state patch: shown only while a timed round is in play, never in the lobby, the
 * countdown, after the round (which can end early, with time still left) or in an endless room. Null means no timer.
 */
export function hudTimeLeft(phase: Phase, mode: GameMode, ticksLeft: number, tickMs: number): HudTimeLeft | null {
  if (mode !== 'timed' || phase !== 'playing') return null;
  const seconds = secondsLeft(ticksLeft, tickMs);
  return { label: formatSeconds(seconds), urgent: seconds <= URGENT_SECONDS };
}
