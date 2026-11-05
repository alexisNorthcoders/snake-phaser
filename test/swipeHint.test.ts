import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSwipeHint } from '../src/swipeHint.ts';

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) { this.items.set(key, value); }
}

const throwingStorage = {
  getItem(): string | null { throw new Error('blocked'); },
  setItem(): void { throw new Error('blocked'); },
};

const coarse = () => true;
const fine = () => false;

test('a first-time phone player is shown the hint on their first countdown', () => {
  assert.equal(createSwipeHint(new MemoryStorage(), coarse).take(), true);
});

test('once seen, the hint never shows again on that device', () => {
  const storage = new MemoryStorage();
  assert.equal(createSwipeHint(storage, coarse).take(), true);
  const reloaded = createSwipeHint(storage, coarse);
  assert.equal(reloaded.take(), false);
  assert.equal(reloaded.take(), false);
});

test('a fine pointer never sees the hint', () => {
  const storage = new MemoryStorage();
  const hint = createSwipeHint(storage, fine);
  assert.equal(hint.take(), false);
  assert.equal(hint.take(), false);
  assert.equal(createSwipeHint(storage, coarse).take(), true);
});

test('storage that throws never breaks the hint', () => {
  const hint = createSwipeHint(throwingStorage, coarse);
  assert.doesNotThrow(() => hint.take());
  assert.equal(createSwipeHint(throwingStorage, coarse).take(), true);
});

test('works without storage', () => {
  assert.equal(createSwipeHint(undefined, coarse).take(), true);
});
