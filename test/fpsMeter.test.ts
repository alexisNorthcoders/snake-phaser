import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFpsMeter, fpsOf } from '../src/fpsMeter.ts';

test('an empty window reports 0 FPS', () => {
  assert.equal(fpsOf(0, 500), 0);
  assert.equal(fpsOf(0, 0), 0);
  assert.equal(fpsOf(5, 0), 0);
});

test('fpsOf is frames per second, rounded', () => {
  assert.equal(fpsOf(30, 500), 60);
  assert.equal(fpsOf(10, 300), 33);
});

test('the meter reports nothing until the window fills, then the window FPS', () => {
  const meter = createFpsMeter(500);
  const results: (number | undefined)[] = [];
  for (let i = 0; i < 30; i++) results.push(meter.frame(1000 / 60 * (60 / 60)));

  const reported = results.filter((r) => r !== undefined);
  assert.equal(reported.length, 1);
  assert.equal(reported[0], 60);
  assert.equal(results[0], undefined);
});

test('each window is measured on its own', () => {
  const meter = createFpsMeter(500);
  let last: number | undefined;
  for (let i = 0; i < 30; i++) last = meter.frame(1000 / 60) ?? last;
  assert.equal(last, 60);
  for (let i = 0; i < 10; i++) last = meter.frame(50) ?? last;
  assert.equal(last, 20);
});
