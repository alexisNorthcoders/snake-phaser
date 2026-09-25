import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deathText, roundHeadline, type RankedSnake } from '../src/roundSummary.ts';

const you: RankedSnake = { id: 'you', name: 'Alexis', isBot: false };
const viper: RankedSnake = { id: 'viper', name: 'Viper', isBot: false };
const bot: RankedSnake = { id: 'bot', name: 'Bot', isBot: true };
const snakes = [you, viper, bot];

test('last snake standing: you, someone else, a bot', () => {
  assert.equal(roundHeadline('last-standing', 'you', snakes, 'you'), 'You win — last snake standing');
  assert.equal(roundHeadline('last-standing', 'viper', snakes, 'you'), 'Viper wins — last snake standing');
  assert.equal(roundHeadline('last-standing', 'bot', snakes, 'you'), 'Bot [BOT] wins — last snake standing');
});

test('last standing with no winner: no survivors', () => {
  assert.equal(roundHeadline('last-standing', undefined, snakes, 'you'), 'No survivors');
});

test("time's up: you, someone else, a draw", () => {
  assert.equal(roundHeadline('time-up', 'you', snakes, 'you'), "Time's up — you win");
  assert.equal(roundHeadline('time-up', 'viper', snakes, 'you'), "Time's up — Viper wins");
  assert.equal(roundHeadline('time-up', undefined, snakes, 'you'), "Time's up — draw");
});

test('a winner missing from the rankings is still announced', () => {
  assert.equal(roundHeadline('last-standing', 'gone', snakes, 'you'), 'A snake wins — last snake standing');
});

test('each cause, into another snake', () => {
  assert.equal(deathText({ ...you, cause: 'body', by: 'viper' }, snakes, 'you'), "hit Viper's body");
  assert.equal(deathText({ ...you, cause: 'head-on', by: 'bot' }, snakes, 'you'), 'head-on with Bot [BOT]');
  assert.equal(deathText({ ...you, cause: 'self' }, snakes, 'you'), 'ran into itself');
  assert.equal(deathText({ ...you, cause: 'starved' }, snakes, 'you'), 'starved');
});

test('into you, it says so', () => {
  assert.equal(deathText({ ...viper, cause: 'body', by: 'you' }, snakes, 'you'), 'hit your body');
  assert.equal(deathText({ ...viper, cause: 'head-on', by: 'you' }, snakes, 'you'), 'head-on with you');
});

test('into a player who has since left: named from their ranking row, or unnamed once gone from it', () => {
  const leaver: RankedSnake = { id: 'leaver', name: 'Cobra', isBot: false };
  assert.equal(deathText({ ...you, cause: 'body', by: 'leaver' }, [...snakes, leaver], 'you'), "hit Cobra's body");
  assert.equal(deathText({ ...you, cause: 'body', by: 'leaver' }, snakes, 'you'), "hit a snake's body");
  assert.equal(deathText({ ...you, cause: 'head-on', by: 'leaver' }, snakes, 'you'), 'head-on with a snake');
});

test('alive at the end, or left mid-round: nothing', () => {
  assert.equal(deathText(viper, snakes, 'you'), '');
});
