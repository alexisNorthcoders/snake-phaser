import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LocalScoresManager, localScoreMode, topScoresForMode } from '../src/utils/localScoresManager.ts';

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) { this.items.set(key, value); }
  removeItem(key: string) { this.items.delete(key); }
}

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
});

test('a saved local score records its mode', () => {
  LocalScoresManager.saveScore(12, 'timed');
  LocalScoresManager.saveScore(30, 'endless');
  assert.deepEqual(LocalScoresManager.getClientScores().map((s) => [s.score, s.mode]), [[12, 'timed'], [30, 'endless']]);
});

test('an entry saved before scores had a mode reads as endless', () => {
  assert.equal(localScoreMode({}), 'endless');
  assert.equal(localScoreMode({ mode: 'timed' }), 'timed');
  assert.equal(localScoreMode({ mode: 'endless' }), 'endless');
});

test("\"Mine\" for a mode keeps only that mode's entries, best first, old ones as endless", () => {
  const entries = [
    { score: 5, mode: 'timed' as const },
    { score: 40 },
    { score: 9, mode: 'endless' as const },
    { score: 20, mode: 'timed' as const },
  ];
  assert.deepEqual(topScoresForMode(entries, 'timed', 5).map((e) => e.score), [20, 5]);
  assert.deepEqual(topScoresForMode(entries, 'endless', 5).map((e) => e.score), [40, 9]);
  assert.deepEqual(topScoresForMode(entries, 'endless', 1).map((e) => e.score), [40]);
});

test("the manager's top scores are for one mode", () => {
  LocalScoresManager.saveScore(12, 'timed');
  LocalScoresManager.saveScore(30, 'endless');
  LocalScoresManager.saveScore(18, 'timed');
  assert.deepEqual(LocalScoresManager.getTopScores('timed').map((s) => s.score), [18, 12]);
  assert.deepEqual(LocalScoresManager.getTopScores('endless').map((s) => s.score), [30]);
});
