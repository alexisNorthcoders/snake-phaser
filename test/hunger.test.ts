import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hungerFill, isStarving, trackHunger } from '../src/hunger.ts';

const endless = { mode: 'endless', phase: 'playing', hungerTicks: 80 } as const;
const alive = (hunger: number, score: number) => ({ hunger, score, isDead: false });

test('a snake starts starving on the tick its hunger reaches hungerTicks, when the drain begins', () => {
  assert.equal(isStarving(0, 80), false);
  assert.equal(isStarving(79, 80), false);
  assert.equal(isStarving(80, 80), true);
  assert.equal(isStarving(95, 80), true);
});

test('the bar is full at the score the drain began from and empties towards zero', () => {
  assert.equal(hungerFill(40, 40), 1);
  assert.equal(hungerFill(30, 40), 0.75);
  assert.equal(hungerFill(10, 40), 0.25);
  assert.equal(hungerFill(0, 40), 0);
});

test('a score drained below zero reads as an empty bar', () => {
  assert.equal(hungerFill(-5, 40), 0);
});

test('a drain that began at zero has nothing left to show', () => {
  assert.equal(hungerFill(0, 0), 0);
});

test('while fed there is no bar, and the score is remembered as where a drain would begin', () => {
  assert.deepEqual(trackHunger(undefined, endless, alive(10, 40)), { startScore: 40, fill: null });
  assert.deepEqual(trackHunger(40, endless, alive(79, 40)), { startScore: 40, fill: null });
});

test('once starving the bar measures the score left against the score before the first drain', () => {
  // The first drain lands on the same patch that shows the snake starving.
  assert.deepEqual(trackHunger(40, endless, alive(80, 35)), { startScore: 40, fill: 35 / 40 });
  assert.deepEqual(trackHunger(40, endless, alive(96, 20)), { startScore: 40, fill: 0.5 });
  assert.deepEqual(trackHunger(40, endless, alive(120, 0)), { startScore: 40, fill: 0 });
});

test('eating resets the hunger, which hides the bar and starts over from the new score', () => {
  const starving = trackHunger(40, endless, alive(96, 20));
  const fed = trackHunger(starving.startScore, endless, alive(0, 21));
  assert.deepEqual(fed, { startScore: 21, fill: null });
  assert.deepEqual(trackHunger(fed.startScore, endless, alive(80, 16)), { startScore: 21, fill: 16 / 21 });
});

test('a snake first seen already starving starts its bar from the score it has', () => {
  assert.deepEqual(trackHunger(undefined, endless, alive(90, 25)), { startScore: 25, fill: 1 });
});

test('timed games never starve', () => {
  assert.equal(trackHunger(40, { ...endless, mode: 'timed' }, alive(200, 10)).fill, null);
});

test('no bar outside play or on a dead snake', () => {
  assert.equal(trackHunger(40, { ...endless, phase: 'countdown' }, alive(90, 30)).fill, null);
  assert.equal(trackHunger(40, { ...endless, phase: 'ended' }, alive(90, 30)).fill, null);
  assert.equal(trackHunger(40, endless, { hunger: 90, score: -5, isDead: true }).fill, null);
});
