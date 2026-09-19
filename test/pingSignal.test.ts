import { test } from 'node:test';
import assert from 'node:assert/strict';
import { litBars, formatPingReadout } from '../src/pingSignal.ts';

test('no ping yet lights no bars', () => {
  assert.equal(litBars(undefined), 0);
});

test('ping maps to 1-4 lit bars at the thresholds', () => {
  assert.equal(litBars(0), 4);
  assert.equal(litBars(49), 4);
  assert.equal(litBars(50), 3);
  assert.equal(litBars(99), 3);
  assert.equal(litBars(100), 2);
  assert.equal(litBars(199), 2);
  assert.equal(litBars(200), 1);
  assert.equal(litBars(5000), 1);
});

test('readout shows -- before the first ping', () => {
  assert.equal(formatPingReadout(undefined), 'Ping: --ms');
  assert.equal(formatPingReadout(42), 'Ping: 42ms');
});
