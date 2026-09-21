import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roomEntry } from '../src/matchmaking.ts';

test('the public lobby joins or creates and sends no vsBot option', () => {
  assert.deepEqual(roomEntry(false), { method: 'joinOrCreate', options: {} });
});

test('a vs-bot match creates a fresh room with a literal vsBot: true', () => {
  assert.deepEqual(roomEntry(true), { method: 'create', options: { vsBot: true } });
});
