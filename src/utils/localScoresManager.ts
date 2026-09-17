import { ClientIdManager } from './clientIdManager';

export interface LocalScore {
  clientId: string;
  score: number;
  timestamp: number;
}

const SCORES_KEY = 'localScores';

export class LocalScoresManager {
  static saveScore(score: number): void {
    const clientId = ClientIdManager.getOrCreateClientId();
    const timestamp = Date.now();

    const allScores = this.getAllScores();

    allScores.push({
      clientId,
      score,
      timestamp
    });

    localStorage.setItem(SCORES_KEY, JSON.stringify(allScores));
    console.log(`[LocalScoresManager] Saved score: ${score} for client ${clientId}`);
  }

  static getAllScores(): LocalScore[] {
    const scoresJson = localStorage.getItem(SCORES_KEY);
    return scoresJson ? JSON.parse(scoresJson) : [];
  }

  static getClientScores(): LocalScore[] {
    const clientId = ClientIdManager.getOrCreateClientId();
    const allScores = this.getAllScores();
    return allScores.filter(s => s.clientId === clientId);
  }

  static getTopScores(limit: number = 5): LocalScore[] {
    const clientScores = this.getClientScores();
    return clientScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  static clearAllScores(): void {
    localStorage.removeItem(SCORES_KEY);
    console.log('[LocalScoresManager] Cleared all scores');
  }

  static clearClientScores(): void {
    const clientId = ClientIdManager.getOrCreateClientId();
    const allScores = this.getAllScores();
    const filteredScores = allScores.filter(s => s.clientId !== clientId);
    localStorage.setItem(SCORES_KEY, JSON.stringify(filteredScores));
    console.log(`[LocalScoresManager] Cleared scores for client ${clientId}`);
  }
}
