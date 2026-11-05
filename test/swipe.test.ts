import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFingerSwipe, createSwipe, type Direction } from '../src/swipe.ts';

type Step = ['down' | 'move', number, number] | ['up'];

// Feeds a gesture through a fresh Swipe and collects the turns that come out.
function turns(steps: Step[]): Direction[] {
  const swipe = createSwipe();
  const out: Direction[] = [];
  for (const step of steps) {
    if (step[0] === 'down') swipe.down(step[1], step[2]);
    else if (step[0] === 'up') swipe.up();
    else {
      const turn = swipe.move(step[1], step[2]);
      if (turn) out.push(turn);
    }
  }
  return out;
}

test('movement below the threshold sends nothing', () => {
  assert.deepEqual(turns([['down', 100, 100], ['move', 110, 100], ['move', 100, 120], ['up']]), []);
});

test('crossing the threshold sends exactly one turn', () => {
  assert.deepEqual(turns([['down', 100, 100], ['move', 124, 100], ['move', 130, 100], ['move', 140, 100]]), ['r']);
});

test('each axis and sign maps to its direction', () => {
  assert.deepEqual(turns([['down', 100, 100], ['move', 100, 70]]), ['u']);
  assert.deepEqual(turns([['down', 100, 100], ['move', 100, 130]]), ['d']);
  assert.deepEqual(turns([['down', 100, 100], ['move', 70, 100]]), ['l']);
  assert.deepEqual(turns([['down', 100, 100], ['move', 130, 100]]), ['r']);
});

test('a diagonal drag resolves to its dominant axis', () => {
  assert.deepEqual(turns([['down', 100, 100], ['move', 120, 70]]), ['u']);
  assert.deepEqual(turns([['down', 100, 100], ['move', 70, 115]]), ['l']);
});

test('one drag up and then left sends two turns, in that order', () => {
  assert.deepEqual(turns([['down', 100, 100], ['move', 100, 70], ['move', 95, 65], ['move', 70, 65]]), ['u', 'l']);
});

test('moving without a finger down sends nothing', () => {
  assert.deepEqual(turns([['move', 100, 100], ['move', 200, 100]]), []);
});

test('lifting ends the gesture', () => {
  assert.deepEqual(turns([['down', 100, 100], ['move', 110, 100], ['up'], ['move', 200, 100]]), []);
});

test('pressing again starts a fresh gesture from the new point', () => {
  assert.deepEqual(
    turns([['down', 100, 100], ['move', 120, 100], ['up'], ['down', 300, 300], ['move', 285, 300], ['move', 300, 330]]),
    ['d'],
  );
});

test('a press that starts on a button, such as the header Scores toggle, never steers', () => {
  const swipe = createFingerSwipe();
  swipe.down(1, 640, 20, true);
  assert.equal(swipe.move(1, 640, 120), null);
  assert.equal(swipe.move(1, 400, 120), null);
  swipe.up(1);
});

test('a button press does not claim the swipe, so another finger can still steer', () => {
  const swipe = createFingerSwipe();
  swipe.down(1, 640, 20, true);
  swipe.down(2, 100, 100, false);
  assert.equal(swipe.move(1, 640, 200), null);
  assert.equal(swipe.move(2, 130, 100), 'r');
});

test('a press off any button steers, and only its own finger does', () => {
  const swipe = createFingerSwipe();
  swipe.down(1, 100, 100, false);
  swipe.down(2, 300, 300, false);
  assert.equal(swipe.move(2, 300, 400), null);
  assert.equal(swipe.move(1, 100, 70), 'u');
  swipe.up(1);
  assert.equal(swipe.move(1, 200, 70), null);
});

test('rebasing discards the owning finger\'s travel so far', () => {
  const swipe = createFingerSwipe();
  swipe.down(1, 100, 100, false);
  swipe.rebase(1, 200, 100);
  assert.equal(swipe.move(1, 210, 100), null);
  assert.equal(swipe.move(1, 230, 100), 'r');
});
