import { LocalScoresManager } from './localScoresManager';
import { ClientIdManager } from './clientIdManager';

export async function migrateAnonymousScores(token: string, userId: string): Promise<string> {
  const clientId = ClientIdManager.getClientId();
  if (!clientId) {
    console.log('[scoreMigrationHelper] No client ID found, skipping score migration');
    return 'Login successful!';
  }

  const anonScores = LocalScoresManager.getClientScores();
  if (anonScores.length === 0) {
    console.log('[scoreMigrationHelper] No anonymous scores to migrate');
    return 'Login successful!';
  }

  try {
    const response = await fetch(`/api/scores/migrate/${clientId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ userId }),
    });

    if (response.ok) {
      const data = await response.json();
      const migratedCount = data.count || 0;

      // Clear anonymous scores from localStorage
      LocalScoresManager.clearClientScores();

      if (migratedCount > 0) {
        console.log(`[scoreMigrationHelper] ${migratedCount} score(s) migrated successfully`);
        return `Your ${migratedCount} score(s) have been saved!`;
      } else {
        console.log('[scoreMigrationHelper] No scores found to migrate');
        return 'Login successful!';
      }
    } else {
      console.error('[scoreMigrationHelper] Score migration failed:', response.statusText);
      // Keep localStorage intact on error
      return `Login successful, but scores couldn't be saved. Try again later.`;
    }
  } catch (error) {
    console.error('[scoreMigrationHelper] Score migration error:', error);
    // Keep localStorage intact on error
    return `Login successful, but scores couldn't be saved. Try again later.`;
  }
}
