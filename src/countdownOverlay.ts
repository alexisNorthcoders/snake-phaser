export type Phase = 'lobby' | 'countdown' | 'playing' | 'ended';

/**
 * The big text over the arena: the server's countdown value while it runs, then "GO!" on the state that
 * carries the room from countdown into play. Null means no overlay.
 */
export function countdownLabel(previous: Phase | undefined, phase: Phase, countdown: number): string | null {
  if (phase === 'countdown' && countdown > 0) return String(countdown);
  if (previous === 'countdown' && phase === 'playing') return 'GO!';
  return null;
}
