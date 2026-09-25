import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModeStore, modeOf, MODE_BLURBS } from '../src/gameMode.ts';

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) { this.items.set(key, value); }
}

const throwingStorage = {
  getItem(): string | null { throw new Error('blocked'); },
  setItem(): void { throw new Error('blocked'); },
};

test('a first-time player plays timed', () => {
  assert.equal(createModeStore(new MemoryStorage()).load(), 'timed');
});

test('the chosen mode survives a reload', () => {
  const storage = new MemoryStorage();
  createModeStore(storage).save('endless');
  assert.equal(createModeStore(storage).load(), 'endless');
  createModeStore(storage).save('timed');
  assert.equal(createModeStore(storage).load(), 'timed');
});

test('an unknown stored value falls back to timed', () => {
  const storage = new MemoryStorage();
  storage.setItem('gameMode', 'battle-royale');
  assert.equal(createModeStore(storage).load(), 'timed');
  assert.equal(modeOf(undefined), 'timed');
  assert.equal(modeOf('endless'), 'endless');
});

test('works without storage, or with storage that throws', () => {
  for (const storage of [undefined, throwingStorage]) {
    const store = createModeStore(storage);
    assert.equal(store.load(), 'timed');
    assert.doesNotThrow(() => store.save('endless'));
  }
});

test('the timed blurb says a round lasts 3 minutes', () => {
  assert.match(MODE_BLURBS.timed, /3 minutes/);
  assert.match(MODE_BLURBS.endless, /last snake alive/i);
});
