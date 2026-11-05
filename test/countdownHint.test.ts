import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCountdownHint } from '../src/countdownHint.ts';

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
const GOAL = "Eat · grow · don't crash";

test('a fine pointer is told the keys, plus the goal', () => {
  assert.deepEqual(createCountdownHint(new MemoryStorage(), fine).take(), ['Arrows / WASD to steer', GOAL]);
});

test('a coarse pointer is told to swipe, plus the goal', () => {
  assert.deepEqual(createCountdownHint(new MemoryStorage(), coarse).take(), ['Swipe to steer', GOAL]);
});

for (const [name, pointer] of [['fine', fine], ['coarse', coarse]] as const) {
  test(`${name} pointer: matches 1-3 show the hint, the 4th does not`, () => {
    const hint = createCountdownHint(new MemoryStorage(), pointer);
    assert.notEqual(hint.take(), null);
    assert.notEqual(hint.take(), null);
    assert.notEqual(hint.take(), null);
    assert.equal(hint.take(), null);
    assert.equal(hint.take(), null);
  });
}

test('the count is kept across page loads', () => {
  const storage = new MemoryStorage();
  createCountdownHint(storage, fine).take();
  createCountdownHint(storage, fine).take();
  assert.notEqual(createCountdownHint(storage, fine).take(), null);
  assert.equal(createCountdownHint(storage, fine).take(), null);
});

test('a garbage stored count is treated as fresh', () => {
  const storage = new MemoryStorage();
  storage.setItem('countdownHintShown', 'abc');
  assert.notEqual(createCountdownHint(storage, fine).take(), null);
});

test('with blocked storage the hint shows every time and nothing throws', () => {
  const hint = createCountdownHint(throwingStorage, coarse);
  for (let i = 0; i < 6; i++) assert.deepEqual(hint.take(), ['Swipe to steer', GOAL]);
});

test('works without storage', () => {
  const hint = createCountdownHint(undefined, fine);
  for (let i = 0; i < 5; i++) assert.notEqual(hint.take(), null);
});
