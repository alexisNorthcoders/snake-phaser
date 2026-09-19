import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countdownLabel } from '../src/countdownOverlay.ts';

test('a running countdown shows its value', () => {
  assert.equal(countdownLabel('lobby', 'countdown', 3), '3');
  assert.equal(countdownLabel('countdown', 'countdown', 2), '2');
  assert.equal(countdownLabel('countdown', 'countdown', 1), '1');
});

test('the countdown handing over to play shows GO!', () => {
  assert.equal(countdownLabel('countdown', 'playing', 0), 'GO!');
});

test('a countdown with no seconds still ends in GO!', () => {
  assert.equal(countdownLabel('countdown', 'countdown', 0), null);
  assert.equal(countdownLabel('lobby', 'playing', 0), null);
});

test('no overlay outside the countdown', () => {
  assert.equal(countdownLabel(undefined, 'lobby', 0), null);
  assert.equal(countdownLabel('playing', 'playing', 0), null);
  assert.equal(countdownLabel('playing', 'ended', 0), null);
});
