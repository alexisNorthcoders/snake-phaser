import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roomEntry } from '../src/matchmaking.ts';

test('the public lobby joins or creates and sends the speed and mode', () => {
  assert.deepEqual(roomEntry(false, 2, 8, 'timed'), { method: 'joinOrCreate', options: { speed: 8, mode: 'timed' } });
});

test('a vs-bot match creates a fresh room with a literal vsBot: true, the reaction ticks, the speed and the mode', () => {
  assert.deepEqual(roomEntry(true, 2, 8, 'timed'), { method: 'create', options: { vsBot: true, botReactionTicks: 2, speed: 8, mode: 'timed' } });
});

test('a vs-bot match sends the bot reaction ticks; a public join never does', () => {
  assert.deepEqual(roomEntry(true, 3, 8, 'timed'), { method: 'create', options: { vsBot: true, botReactionTicks: 3, speed: 8, mode: 'timed' } });
  assert.deepEqual(roomEntry(false, 3, 8, 'timed'), { method: 'joinOrCreate', options: { speed: 8, mode: 'timed' } });
});

test('both room-entry paths send the requested speed', () => {
  assert.deepEqual(roomEntry(false, 2, 12, 'timed').options.speed, 12);
  assert.deepEqual(roomEntry(true, 2, 12, 'timed').options.speed, 12);
});

test('both room-entry paths carry the chosen mode', () => {
  assert.equal(roomEntry(false, 2, 8, 'endless').options.mode, 'endless');
  assert.equal(roomEntry(true, 2, 8, 'endless').options.mode, 'endless');
});
