import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BodyTween } from '../src/BodyTween.ts';

const TICK = 100;
const BOARD = 20;

const tween = () => new BodyTween(TICK, BOARD);

test('a freshly seen snake sits on its cells', () => {
  const t = tween();
  t.retarget([{ x: 5, y: 5 }, { x: 4, y: 5 }], 0);

  assert.deepEqual(t.positionsAt(0), [{ x: 5, y: 5 }, { x: 4, y: 5 }]);
});

test('head and tail slide together towards the new cells', () => {
  const t = tween();
  t.retarget([{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], 0);
  t.retarget([{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }], 1000);

  assert.deepEqual(t.positionsAt(1000), [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }]);
  assert.deepEqual(t.positionsAt(1050), [{ x: 5.5, y: 5 }, { x: 4.5, y: 5 }, { x: 3.5, y: 5 }]);
  assert.deepEqual(t.positionsAt(1100), [{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }]);
});

test('the body stays contiguous round a turn', () => {
  const t = tween();
  t.retarget([{ x: 5, y: 5 }, { x: 4, y: 5 }], 0);
  t.retarget([{ x: 5, y: 6 }, { x: 5, y: 5 }], 1000);

  const [head, neck] = t.positionsAt(1025);
  assert.deepEqual(head, { x: 5, y: 5.25 });
  assert.deepEqual(neck, { x: 4.25, y: 5 });
  assert.ok(Math.abs(head.x - neck.x) <= 1 && Math.abs(head.y - neck.y) <= 1);
});

test('a late patch holds on the target instead of overshooting', () => {
  const t = tween();
  t.retarget([{ x: 5, y: 5 }], 0);
  t.retarget([{ x: 6, y: 5 }], 1000);

  assert.deepEqual(t.positionsAt(1000 + TICK * 3), [{ x: 6, y: 5 }]);
});

test('a segment wrapping across the board edge snaps rather than sliding back', () => {
  const t = tween();
  t.retarget([{ x: 19, y: 5 }, { x: 18, y: 5 }], 0);
  t.retarget([{ x: 0, y: 5 }, { x: 19, y: 5 }], 1000);

  assert.deepEqual(t.positionsAt(1050), [{ x: 0, y: 5 }, { x: 18.5, y: 5 }]);
});

test('an early patch slides on from where the snake is drawn, not from the old target', () => {
  const t = tween();
  t.retarget([{ x: 5, y: 5 }], 0);
  t.retarget([{ x: 6, y: 5 }], 1000);
  t.retarget([{ x: 7, y: 5 }], 1050); // drawn at 5.5 when this lands

  assert.deepEqual(t.positionsAt(1050), [{ x: 5.5, y: 5 }]);
  assert.deepEqual(t.positionsAt(1150), [{ x: 7, y: 5 }]);
});

test('an unchanged snapshot does not restart the slide', () => {
  const t = tween();
  t.retarget([{ x: 5, y: 5 }], 0);
  t.retarget([{ x: 6, y: 5 }], 1000);
  t.retarget([{ x: 6, y: 5 }], 1050);

  assert.deepEqual(t.positionsAt(1075), [{ x: 5.75, y: 5 }]);
});

test('snap jumps straight to the target', () => {
  const t = tween();
  t.retarget([{ x: 5, y: 5 }], 0);
  t.retarget([{ x: 6, y: 5 }], 1000);
  t.snap();

  assert.deepEqual(t.positionsAt(1010), [{ x: 6, y: 5 }]);
});

test('a segment the snake has just grown sits on its cell', () => {
  const t = tween();
  t.retarget([{ x: 5, y: 5 }, { x: 4, y: 5 }], 0);
  t.retarget([{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }], 1000);

  assert.deepEqual(t.positionsAt(1050), [{ x: 5.5, y: 5 }, { x: 4.5, y: 5 }, { x: 5, y: 5 }]);
});

test('targets exposes the cells the current slide heads for', () => {
  const t = tween();
  t.retarget([{ x: 5, y: 5 }, { x: 4, y: 5 }], 0);

  assert.deepEqual(t.targets, [{ x: 5, y: 5 }, { x: 4, y: 5 }]);
});

test('tailPrevious is the tail cell before this slide, with no previous cell for a grown segment', () => {
  const t = tween();
  t.retarget([{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], 0);
  t.retarget([{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }], 1000);

  assert.deepEqual(t.tailPrevious, { x: 3, y: 5 });

  t.retarget([{ x: 7, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }], 2000);
  assert.deepEqual(t.tailPrevious, { x: 5, y: 5 });
});

test('snap does not collapse tailPrevious onto the tail\'s own cell', () => {
  const t = tween();
  t.retarget([{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], 0);
  t.retarget([{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }], 1000);
  t.snap();

  assert.deepEqual(t.tailPrevious, { x: 3, y: 5 });
});
