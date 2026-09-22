import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roomEntry } from '../src/matchmaking.ts';

test('the public lobby joins or creates and sends only the speed', () => {
  assert.deepEqual(roomEntry(false, 2, 8), { method: 'joinOrCreate', options: { speed: 8 } });
});

test('a vs-bot match creates a fresh room with a literal vsBot: true, the reaction ticks, and the speed', () => {
  assert.deepEqual(roomEntry(true, 2, 8), { method: 'create', options: { vsBot: true, botReactionTicks: 2, speed: 8 } });
});

test('a vs-bot match sends the bot reaction ticks; a public join never does', () => {
  assert.deepEqual(roomEntry(true, 3, 8), { method: 'create', options: { vsBot: true, botReactionTicks: 3, speed: 8 } });
  assert.deepEqual(roomEntry(false, 3, 8), { method: 'joinOrCreate', options: { speed: 8 } });
});

test('both room-entry paths send the requested speed', () => {
  assert.deepEqual(roomEntry(false, 2, 12), { method: 'joinOrCreate', options: { speed: 12 } });
  assert.deepEqual(roomEntry(true, 2, 12), { method: 'create', options: { vsBot: true, botReactionTicks: 2, speed: 12 } });
});
