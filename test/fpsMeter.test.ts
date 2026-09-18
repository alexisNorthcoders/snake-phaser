import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFpsMeter, formatFpsReadout, fpsOf, frameTimesOf, type FpsReport } from '../src/fpsMeter.ts';

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
  const results: (FpsReport | undefined)[] = [];
  for (let i = 0; i < 30; i++) results.push(meter.frame(1000 / 60 * (60 / 60)));

  const reported = results.filter((r) => r !== undefined);
  assert.equal(reported.length, 1);
  assert.equal(reported[0]?.fps, 60);
  assert.equal(results[0], undefined);
});

test('each window is measured on its own', () => {
  const meter = createFpsMeter(500);
  let last: number | undefined;
  const fps = (r: FpsReport | undefined) => r?.fps;
  for (let i = 0; i < 30; i++) last = fps(meter.frame(1000 / 60)) ?? last;
  assert.equal(last, 60);
  for (let i = 0; i < 10; i++) last = fps(meter.frame(50)) ?? last;
  assert.equal(last, 20);
});

test('overshoot past the window is carried into the next window', () => {
  const meter = createFpsMeter(500);
  assert.equal(meter.frame(400), undefined);
  assert.equal(meter.frame(200)?.fps, 3); // 2 frames over 600ms closes the window, 100ms carried
  assert.equal(meter.frame(350), undefined); // 100 + 350 < 500
  assert.equal(meter.frame(50)?.fps, 4); // 100 carried + 350 + 50 = 500ms over 2 frames
});

test('mixed deltas report roughly twice a second', () => {
  const meter = createFpsMeter(500);
  let reports = 0;
  for (let i = 0; i < 240; i++) if (meter.frame(i % 2 ? 20 : 13) !== undefined) reports++;
  // 240 frames * 16.5ms = 3960ms -> 7 windows
  assert.equal(reports, 7);
});

test('an empty window has zero frame times', () => {
  assert.deepEqual(frameTimesOf(0, 0, 0), { avgMs: 0, worstMs: 0 });
});

test('the report carries the average and the worst frame of the window', () => {
  const meter = createFpsMeter(500);
  let report: FpsReport | undefined;
  for (const d of [100, 100, 100, 100, 100]) report = meter.frame(d) ?? report;
  assert.deepEqual(report, { fps: 10, avgMs: 100, worstMs: 100 });

  const meter2 = createFpsMeter(100);
  for (const d of [20, 20, 30, 20, 20]) report = meter2.frame(d) ?? report;
  assert.deepEqual(report, { fps: 45, avgMs: 22, worstMs: 30 });
});

test('deltas over 1000ms are dropped from the window', () => {
  const meter = createFpsMeter(500);
  assert.equal(meter.frame(5000), undefined);
  assert.equal(meter.frame(1001), undefined);
  let report: FpsReport | undefined;
  for (let i = 0; i < 30; i++) report = meter.frame(1000 / 60) ?? report;
  assert.equal(report?.fps, 60);
  assert.ok((report?.worstMs ?? Infinity) < 20);
});

test('a tab-switch gap mid-window does not leave a huge worst frame', () => {
  const meter = createFpsMeter(500);
  let report: FpsReport | undefined;
  for (let i = 0; i < 10; i++) report = meter.frame(16) ?? report;
  meter.frame(8000);
  for (let i = 0; i < 40; i++) report = meter.frame(16) ?? report;
  assert.equal(report?.worstMs, 16);
});

test('the readout shows FPS, average frame time and worst frame', () => {
  assert.equal(formatFpsReadout({ fps: 60, avgMs: 16.666, worstMs: 24 }), 'FPS: 60 (16.7ms, worst 24ms)');
});
