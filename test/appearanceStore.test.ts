import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAppearanceStore, PALETTE } from '../src/appearanceStore.ts';

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) { this.items.set(key, value); }
}

const throwingStorage = {
  getItem(): string | null { throw new Error('blocked'); },
  setItem(): void { throw new Error('blocked'); },
};

const inPalette = (color: string) => PALETTE.includes(color);

test('the palette is 12 distinct #rrggbb colours', () => {
  assert.equal(PALETTE.length, 12);
  assert.equal(new Set(PALETTE).size, 12);
  PALETTE.forEach((color) => assert.match(color, /^#[0-9a-f]{6}$/));
});

test('a first-time player gets random colours from the palette', () => {
  const store = createAppearanceStore(new MemoryStorage());
  const colours = store.load();

  assert.ok(inPalette(colours.head));
  assert.ok(inPalette(colours.body));
  assert.ok(inPalette(colours.eyes));
});

test('random picks use the injected random source', () => {
  const store = createAppearanceStore(new MemoryStorage(), () => 0);

  assert.deepEqual(store.load(), { head: PALETTE[0], body: PALETTE[0], eyes: PALETTE[0] });
});

test('a first-time player keeps the same colours across reloads', () => {
  const storage = new MemoryStorage();
  const first = createAppearanceStore(storage).load();

  assert.deepEqual(createAppearanceStore(storage).load(), first);
});

test('saved colours survive a reload', () => {
  const storage = new MemoryStorage();
  const colours = { head: PALETTE[1], body: PALETTE[2], eyes: PALETTE[3] };
  createAppearanceStore(storage).save(colours);

  assert.deepEqual(createAppearanceStore(storage).load(), colours);
});

test('corrupt stored data falls back to random palette colours', () => {
  const storage = new MemoryStorage();
  storage.setItem('appearance', '{not json');

  assert.ok(inPalette(createAppearanceStore(storage).load().head));
});

test('a stored part that is not a #rrggbb colour is replaced, the others are kept', () => {
  const storage = new MemoryStorage();
  storage.setItem('appearance', JSON.stringify({ head: 'red', body: PALETTE[4], eyes: 42 }));
  const colours = createAppearanceStore(storage).load();

  assert.ok(inPalette(colours.head));
  assert.equal(colours.body, PALETTE[4]);
  assert.ok(inPalette(colours.eyes));
});

test('works without storage, with random palette colours', () => {
  const store = createAppearanceStore(undefined);
  const colours = store.load();

  assert.ok(inPalette(colours.head));
  assert.doesNotThrow(() => store.save(colours));
});

test('storage that throws never breaks loading or saving', () => {
  const store = createAppearanceStore(throwingStorage);

  assert.ok(inPalette(store.load().body));
  assert.doesNotThrow(() => store.save({ head: PALETTE[0], body: PALETTE[1], eyes: PALETTE[2] }));
});
