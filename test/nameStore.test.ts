import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNameStore, normaliseName } from '../src/nameStore.ts';

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) { this.items.set(key, value); }
}

const throwingStorage = {
  getItem(): string | null { throw new Error('blocked'); },
  setItem(): void { throw new Error('blocked'); },
};

test('a first-time player has no saved name and plays as anonymous', () => {
  const store = createNameStore(new MemoryStorage());
  assert.equal(store.saved(), '');
  assert.equal(store.load(), 'anonymous');
});

test('surrounding whitespace is trimmed', () => {
  assert.equal(normaliseName('  Ada  '), 'Ada');
  assert.equal(createNameStore(new MemoryStorage()).save('  Ada  '), 'Ada');
});

test('names are cut to 16 characters', () => {
  assert.equal(normaliseName('a'.repeat(20)), 'a'.repeat(16));
  assert.equal(createNameStore(new MemoryStorage()).save('b'.repeat(40)), 'b'.repeat(16));
});

test('a name cut to 16 characters has no trailing space', () => {
  assert.equal(normaliseName('a'.repeat(15) + ' zzz'), 'a'.repeat(15));
});

test('an empty or whitespace-only name plays as anonymous', () => {
  assert.equal(normaliseName(''), 'anonymous');
  assert.equal(normaliseName('   '), 'anonymous');
  assert.equal(createNameStore(new MemoryStorage()).save('   '), 'anonymous');
});

test('a saved name survives a reload', () => {
  const storage = new MemoryStorage();
  createNameStore(storage).save('Ada');
  const reloaded = createNameStore(storage);
  assert.equal(reloaded.saved(), 'Ada');
  assert.equal(reloaded.load(), 'Ada');
});

test('saving an empty name clears the prefill', () => {
  const storage = new MemoryStorage();
  const store = createNameStore(storage);
  store.save('Ada');
  store.save('');
  assert.equal(store.saved(), '');
  assert.equal(store.load(), 'anonymous');
});

test('two players can use the same name', () => {
  assert.equal(createNameStore(new MemoryStorage()).save('Ada'), createNameStore(new MemoryStorage()).save('Ada'));
});

test('works without storage', () => {
  const store = createNameStore(undefined);
  assert.equal(store.saved(), '');
  assert.equal(store.load(), 'anonymous');
  assert.equal(store.save('Ada'), 'Ada');
});

test('storage that throws never breaks loading or saving', () => {
  const store = createNameStore(throwingStorage);
  assert.equal(store.saved(), '');
  assert.equal(store.load(), 'anonymous');
  assert.doesNotThrow(() => store.save('Ada'));
  assert.equal(store.save('Ada'), 'Ada');
});

test('an over-long stored name is cut when read back', () => {
  const storage = new MemoryStorage();
  storage.setItem('playerName', 'c'.repeat(30));
  assert.equal(createNameStore(storage).load(), 'c'.repeat(16));
});
