import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roomEntry } from '../src/matchmaking.ts';

test('the public lobby joins or creates and sends no vsBot option', () => {
  assert.deepEqual(roomEntry(false, 2), { method: 'joinOrCreate', options: {} });
});

test('a vs-bot match creates a fresh room with a literal vsBot: true and the reaction ticks', () => {
  assert.deepEqual(roomEntry(true, 2), { method: 'create', options: { vsBot: true, botReactionTicks: 2 } });
});

test('a vs-bot match sends the bot reaction ticks; a public join never does', () => {
  assert.deepEqual(roomEntry(true, 3), { method: 'create', options: { vsBot: true, botReactionTicks: 3 } });
  assert.deepEqual(roomEntry(false, 3), { method: 'joinOrCreate', options: {} });
});
