import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON_FILLS, computeBevelRects, headerButtonPosition } from '../src/utils/pixelButtonStyle.ts';

test('fill tokens', () => {
  assert.deepEqual(BUTTON_FILLS.button, { fill: 0x222222, hover: 0x444444 });
  assert.deepEqual(BUTTON_FILLS['button-alt'], { fill: 0x555555, hover: 0x777777 });
  assert.deepEqual(BUTTON_FILLS.action, { fill: 0x00aa00, hover: 0x00cc00 });
});

test('small: shadow, outline, fill, light top-left, dark bottom-right at 2px', () => {
  const r = computeBevelRects(80, 30, 'small', 0x222222, false);
  assert.deepEqual(r[0], { x: 0, y: 2, w: 80, h: 30, color: 0, alpha: 1 });
  assert.deepEqual(r[1], { x: 0, y: 0, w: 80, h: 30, color: 0, alpha: 1 });
  assert.deepEqual(r[2], { x: 2, y: 2, w: 76, h: 26, color: 0x222222, alpha: 1 });
  assert.equal(r[3].color, 0xffffff);
  assert.equal(r[3].alpha, 0.22);
  assert.equal(r[5].color, 0);
  assert.equal(r[5].alpha, 0.45);
  assert.equal(r.length, 7);
});

test('large uses 4px edges', () => {
  const r = computeBevelRects(100, 40, 'large', 0x00aa00, false);
  assert.deepEqual(r[0], { x: 0, y: 4, w: 100, h: 40, color: 0, alpha: 1 });
  assert.deepEqual(r[2], { x: 4, y: 4, w: 92, h: 32, color: 0x00aa00, alpha: 1 });
});

test('pressed swaps edges and drops the shadow', () => {
  const r = computeBevelRects(80, 30, 'small', 0x222222, true);
  assert.equal(r.length, 6);
  assert.equal(r[2].color, 0);
  assert.equal(r[2].alpha, 0.45);
  assert.equal(r[4].color, 0xffffff);
});

test('header button is right-aligned 20px from the edge and centred in the strip', () => {
  assert.deepEqual(headerButtonPosition(800), { x: 690, y: 5 });
});
