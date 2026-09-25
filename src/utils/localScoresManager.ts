import { ClientIdManager } from './clientIdManager.ts';
import { modeOf, type GameMode } from '../gameMode.ts';

export interface LocalScore {
  clientId: string;
  score: number;
  timestamp: number;
  /** Missing on entries saved before scores had a mode; see `localScoreMode`. */
  mode?: GameMode;
}

/** The mode a local score was played in; entries saved before scores had one count as endless, as on the server. */
export function localScoreMode(entry: { mode?: unknown }): GameMode {
  return modeOf(entry.mode, 'endless');
}

/** The best `limit` of `entries` played in `mode`, highest first. */
export function topScoresForMode<T extends { score: number; mode?: unknown }>(
  entries: readonly T[],
  mode: GameMode,
  limit: number,
): T[] {
  return entries
    .filter((e) => localScoreMode(e) === mode)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const SCORES_KEY = 'localScores';

export class LocalScoresManager {
  /**
   * Save a score to localStorage for the current client.
   *
   * Edge case: If localStorage is cleared by the user, their anonymous scores are lost permanently.
   * This is by design — persistence across sessions requires authentication.
   * Users can authenticate after a game to ensure their scores are persisted in the server database.
   */
  static saveScore(score: number, mode: GameMode): void {
    const clientId = ClientIdManager.getOrCreateClientId();
    const timestamp = Date.now();

    try {
      const allScores = this.getAllScores();

      allScores.push({
        clientId,
        score,
        timestamp,
        mode,
      });

      localStorage.setItem(SCORES_KEY, JSON.stringify(allScores));
      console.log(`[LocalScoresManager] Saved ${mode} score: ${score} for client ${clientId}`);
    } catch (error) {
      console.error('[LocalScoresManager] Failed to save score to localStorage:', error);

      // Check if localStorage is disabled or quota exceeded
      if (error instanceof Error) {
        if (error.name === 'QuotaExceededError') {
          console.warn('[LocalScoresManager] localStorage quota exceeded. Consider clearing old games or logging in to persist scores on the server.');
        } else if (error.name === 'SecurityError' || error.message?.includes('disabled')) {
          console.warn('[LocalScoresManager] localStorage is disabled or not available in this context.');
        }
      }

      // Notify but don't crash the game
      // The score will be lost, but the game continues to work
    }
  }

  static getAllScores(): LocalScore[] {
    try {
      const scoresJson = localStorage.getItem(SCORES_KEY);
      return scoresJson ? JSON.parse(scoresJson) : [];
    } catch (error) {
      console.error('[LocalScoresManager] Failed to read scores from localStorage:', error);
      // Return empty array if we can't read from localStorage
      return [];
    }
  }

  static getClientScores(): LocalScore[] {
    const clientId = ClientIdManager.getOrCreateClientId();
    const allScores = this.getAllScores();
    return allScores.filter(s => s.clientId === clientId);
  }

  static getTopScores(mode: GameMode, limit: number = 5): LocalScore[] {
    return topScoresForMode(this.getClientScores(), mode, limit);
  }

  static clearAllScores(): void {
    localStorage.removeItem(SCORES_KEY);
    console.log('[LocalScoresManager] Cleared all scores');
  }

  static clearClientScores(): void {
    try {
      const clientId = ClientIdManager.getOrCreateClientId();
      const allScores = this.getAllScores();
      const filteredScores = allScores.filter(s => s.clientId !== clientId);
      localStorage.setItem(SCORES_KEY, JSON.stringify(filteredScores));
      console.log(`[LocalScoresManager] Cleared scores for client ${clientId}`);
    } catch (error) {
      console.error('[LocalScoresManager] Failed to clear scores from localStorage:', error);
      // Non-critical operation, continue gracefully
    }
  }
}
