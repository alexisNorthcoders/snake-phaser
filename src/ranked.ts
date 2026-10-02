/** Matches an Account must play before its Rating stops being Provisional; mirrors the servers. */
export const PROVISIONAL_MATCHES = 5;

/** An Account's Rating around one Ranked match, as sent in `ratingUpdate`. */
export interface RatingChange {
  accountId: string;
  ratingBefore: number;
  ratingAfter: number;
  rankedMatches: number;
  provisional: boolean;
}

/** The `ratingUpdate` message. */
export interface RatingUpdate {
  players: RatingChange[];
}

/** "Searching for opponent… m:ss" for how long the Ranked queue has been waited in. */
export function searchingText(elapsedMs: number): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  return `Searching for opponent… ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** "1532 → 1548 (+16)". */
export function ratingChangeText(change: RatingChange): string {
  const delta = change.ratingAfter - change.ratingBefore;
  return `${change.ratingBefore} → ${change.ratingAfter} (${delta < 0 ? '-' : '+'}${Math.abs(delta)})`;
}

/** The Game Over lines for a Ranked match: the change, or "Rating updating…" until it arrives, then Provisional progress. */
export function ratingLines(update: RatingUpdate | undefined, accountId: string | undefined): string[] {
  const own = update?.players.find((p) => p.accountId === accountId);
  if (!own) return ['Rating updating…'];
  const lines = [ratingChangeText(own)];
  if (own.provisional) lines.push(`Provisional (${own.rankedMatches}/${PROVISIONAL_MATCHES})`);
  return lines;
}

/** Lines the Game Over panel reserves for a Ranked match, so the panel doesn't resize when the update arrives. */
export const RATING_LINE_COUNT = 2;

/** True when the room refused the join over the token: invalid, expired, or not an Account. */
export function isTokenRefusal(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 401 || code === 4215;
}

/** A player as the room lists them. */
export interface RoomPlayer {
  id: string;
  name: string;
  isBot: boolean;
}

/** "Matched with Alex", or "Matched with Rookie (bot)" for a Stand-in; undefined until an opponent is seated. */
export function matchedWithText(players: RoomPlayer[], selfId: string | undefined): string | undefined {
  const opponent = players.find((p) => p.id !== selfId);
  if (!opponent) return undefined;
  return `Matched with ${opponent.name}${opponent.isBot ? ' (bot)' : ''}`;
}
