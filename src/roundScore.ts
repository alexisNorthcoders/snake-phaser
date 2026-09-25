/** Where a round's score goes: the account, the anonymous scores, or this browser's local scores. */
export interface RoundScoreSink {
  postUserScore(score: number): Promise<void>;
  postAnonymousScore(score: number): Promise<void>;
  saveLocalScore(score: number): void;
}

/** The part of the `gameOver` payload that says each snake's score. */
export interface RoundScores {
  rankings: readonly { id: string; score: number }[];
}

/**
 * Saves your own score for the round, once: to your account when logged in, or anonymously
 * and in the local scores as a guest. Nothing is saved without your entry in the rankings.
 * Never rejects: a failure is logged, so the caller can fire and forget.
 */
export async function saveRoundScore(
  payload: RoundScores,
  sessionId: string | undefined,
  guest: boolean,
  sink: RoundScoreSink,
): Promise<void> {
  const own = payload.rankings.find((r) => r.id === sessionId);
  if (sessionId === undefined || !own) return;
  try {
    if (guest) {
      sink.saveLocalScore(own.score);
      await sink.postAnonymousScore(own.score);
    } else {
      await sink.postUserScore(own.score);
    }
  } catch (error) {
    console.warn('[roundScore] Failed to save the round score:', error);
  }
}
