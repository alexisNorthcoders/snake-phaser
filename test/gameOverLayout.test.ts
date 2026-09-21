import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGameOverContentLayout, computeGameOverLayout, GAME_OVER_BUTTON } from '../src/utils/gameOverLayout.ts';

test('desktop 800px: centre 400, width 480', () => {
  assert.deepEqual(computeGameOverLayout(800), { centerX: 400, panelWidth: 480 });
});

test('390px mobile: centred and inside the canvas with a margin', () => {
  const { centerX, panelWidth } = computeGameOverLayout(390);
  assert.equal(centerX, 195);
  assert.ok(panelWidth <= 390 - 2 * 16);
});

test('tiny canvas never yields a negative width', () => {
  assert.equal(computeGameOverLayout(10).panelWidth, 0);
});

test('height grows with every row', () => {
  const base = computeGameOverContentLayout(1, 1, false).panelHeight;
  assert.ok(computeGameOverContentLayout(3, 1, false).panelHeight > base);
  assert.ok(computeGameOverContentLayout(1, 3, false).panelHeight > base);
});

test('empty top scores still reserve one row for the placeholder', () => {
  assert.equal(computeGameOverContentLayout(2, 0, false).panelHeight, computeGameOverContentLayout(2, 1, false).panelHeight);
});

test('Save Score sits 20px under Play Again for guests only', () => {
  const guest = computeGameOverContentLayout(2, 3, true);
  assert.equal(guest.saveScoreY, guest.playAgainY + GAME_OVER_BUTTON.height + 20);
  const member = computeGameOverContentLayout(2, 3, false);
  assert.equal(member.saveScoreY, undefined);
  assert.ok(guest.panelHeight > member.panelHeight);
});

test('rankingName tags only bots', async () => {
  const { rankingName } = await import('../src/utils/gameOverLayout.ts');
  assert.equal(rankingName('Bot', true), 'Bot [BOT]');
  assert.equal(rankingName('Bot', false), 'Bot');
});
