import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGameOverLayout } from '../src/utils/gameOverLayout.ts';

test('desktop 800px is unchanged: centre 400, width 360', () => {
  assert.deepEqual(computeGameOverLayout(800), { centerX: 400, panelWidth: 360 });
});

test('390px mobile: centred and inside the canvas with a margin', () => {
  const { centerX, panelWidth } = computeGameOverLayout(390);
  assert.equal(centerX, 195);
  assert.ok(panelWidth <= 390 - 2 * 16);
});

test('tiny canvas never yields a negative width', () => {
  assert.equal(computeGameOverLayout(10).panelWidth, 0);
});
