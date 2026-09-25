import { rankingName } from './utils/gameOverLayout.ts';

/** Why the round ended, as sent in `gameOver`. */
export type RoundEndReason = 'last-standing' | 'time-up';
/** How a snake died: into its own body, another's body, another's head, or of hunger. */
export type DeathCause = 'self' | 'body' | 'head-on' | 'starved';

/** A ranking row: its snake died of `cause` into `by`, or has neither if alive at the end or it left. */
export interface RankedSnake {
  id: string;
  name: string;
  isBot: boolean;
  cause?: DeathCause;
  by?: string;
}

/** The snake's ranking name, `you` for your own, or undefined once it's gone from the rankings. */
function nameOf(id: string, snakes: readonly RankedSnake[], youId: string | undefined) {
  if (id === youId) return 'you';
  const snake = snakes.find((s) => s.id === id);
  return snake ? rankingName(snake.name, snake.isBot) : undefined;
}

/** The game-over headline: why the round ended and who, if anyone, won it. */
export function roundHeadline(
  reason: RoundEndReason,
  winnerId: string | undefined,
  snakes: readonly RankedSnake[],
  youId: string | undefined,
): string {
  if (reason === 'time-up') {
    if (winnerId === undefined) return "Time's up — draw";
    const winner = nameOf(winnerId, snakes, youId) ?? 'a snake';
    return `Time's up — ${winner} ${winnerId === youId ? 'win' : 'wins'}`;
  }
  if (winnerId === undefined) return 'No survivors';
  if (winnerId === youId) return 'You win — last snake standing';
  return `${nameOf(winnerId, snakes, youId) ?? 'A snake'} wins — last snake standing`;
}

/**
 * How a ranking row's snake died; empty if it was alive at the end or left,
 * or if the snake it hit is no longer in the rankings to be named.
 */
export function deathText(snake: RankedSnake, snakes: readonly RankedSnake[], youId: string | undefined): string {
  const by = snake.by === undefined ? undefined : nameOf(snake.by, snakes, youId);
  switch (snake.cause) {
    case 'self':
      return 'ran into itself';
    case 'starved':
      return 'starved';
    case 'body':
      if (by === undefined) return '';
      return `hit ${snake.by === youId ? 'your' : `${by}'s`} body`;
    case 'head-on':
      return by === undefined ? '' : `head-on with ${by}`;
    default:
      return '';
  }
}
