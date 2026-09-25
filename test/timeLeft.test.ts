import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTimeLeft, hudTimeLeft } from '../src/timeLeft.ts';

test('whole minutes show as m:00', () => {
  assert.equal(formatTimeLeft(1440, 125), '3:00');
  assert.equal(formatTimeLeft(480, 125), '1:00');
});

test('seconds are zero-padded', () => {
  assert.equal(formatTimeLeft(8 * 65, 125), '1:05');
  assert.equal(formatTimeLeft(8 * 9, 125), '0:09');
});

test('part of a second left rounds up, so it never shows 0:00 while time is left', () => {
  assert.equal(formatTimeLeft(1, 125), '0:01');
  assert.equal(formatTimeLeft(7, 125), '0:01');
  assert.equal(formatTimeLeft(9, 125), '0:02');
  assert.equal(formatTimeLeft(479, 125), '1:00');
  assert.equal(formatTimeLeft(1439, 125), '3:00');
});

test('no ticks left is 0:00', () => {
  assert.equal(formatTimeLeft(0, 125), '0:00');
  assert.equal(formatTimeLeft(-3, 125), '0:00');
});

test('the tick length scales the time', () => {
  assert.equal(formatTimeLeft(60, 1000), '1:00');
  assert.equal(formatTimeLeft(1, 50), '0:01');
});

test('a timed game in play shows the time left', () => {
  assert.deepEqual(hudTimeLeft('playing', 'timed', 1440, 125), { label: '3:00', urgent: false });
});

test('the last ten seconds are urgent', () => {
  assert.deepEqual(hudTimeLeft('playing', 'timed', 80, 125), { label: '0:10', urgent: true });
  assert.deepEqual(hudTimeLeft('playing', 'timed', 81, 125), { label: '0:11', urgent: false });
  assert.deepEqual(hudTimeLeft('playing', 'timed', 1, 125), { label: '0:01', urgent: true });
});

test('the time stays up, at 0:00, once the round has ended', () => {
  assert.deepEqual(hudTimeLeft('ended', 'timed', 0, 125), { label: '0:00', urgent: true });
});

test('no timer in the lobby, the countdown, or an endless game', () => {
  assert.equal(hudTimeLeft('lobby', 'timed', 1440, 125), null);
  assert.equal(hudTimeLeft('countdown', 'timed', 1440, 125), null);
  assert.equal(hudTimeLeft('playing', 'endless', 0, 125), null);
  assert.equal(hudTimeLeft('ended', 'endless', 0, 125), null);
});
