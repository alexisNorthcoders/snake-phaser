import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roomEntry } from '../src/matchmaking.ts';

test('the public lobby joins or creates and sends the speed and mode', () => {
  assert.deepEqual(roomEntry(undefined, 2, 8, 'timed'), { method: 'joinOrCreate', options: { speed: 8, mode: 'timed' } });
});

test('a vs-bot match creates a fresh room with a literal vsBot: true, the chosen bot, the reaction ticks, the speed and the mode', () => {
  assert.deepEqual(roomEntry('dummy', 2, 8, 'timed'), { method: 'create', options: { vsBot: true, botId: 'dummy', botReactionTicks: 2, speed: 8, mode: 'timed' } });
});

test('a vs-bot match carries the chosen bot id; a public join never does', () => {
  assert.equal(roomEntry('rookie', 2, 8, 'timed').options.botId, 'rookie');
  assert.equal('botId' in roomEntry(undefined, 2, 8, 'timed').options, false);
});

test('a vs-bot match sends the bot reaction ticks; a public join never does', () => {
  assert.equal(roomEntry('rookie', 3, 8, 'timed').options.botReactionTicks, 3);
  assert.deepEqual(roomEntry(undefined, 3, 8, 'timed'), { method: 'joinOrCreate', options: { speed: 8, mode: 'timed' } });
});

test('both room-entry paths send the requested speed', () => {
  assert.equal(roomEntry(undefined, 2, 12, 'timed').options.speed, 12);
  assert.equal(roomEntry('rookie', 2, 12, 'timed').options.speed, 12);
});

test('both room-entry paths carry the chosen mode', () => {
  assert.equal(roomEntry(undefined, 2, 8, 'endless').options.mode, 'endless');
  assert.equal(roomEntry('rookie', 2, 8, 'endless').options.mode, 'endless');
});
