import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGameOverContentLayout, computeGameOverLayout, GAME_OVER_BUTTON, GAME_OVER_RANKING_ROW, GAME_OVER_ROW_HEIGHT } from '../src/utils/gameOverLayout.ts';

test('desktop 800px: centre 400, width 480', () => {
  assert.deepEqual(computeGameOverLayout(800), { centerX: 400, panelWidth: 480, contentWidth: 416 });
});

test('390px mobile: centred and inside the canvas with a margin', () => {
  const { centerX, panelWidth } = computeGameOverLayout(390);
  assert.equal(centerX, 195);
  assert.ok(panelWidth <= 390 - 2 * 16);
});

test('tiny canvas never yields a negative width', () => {
  assert.equal(computeGameOverLayout(10).panelWidth, 0);
  assert.equal(computeGameOverLayout(10).contentWidth, 0);
});

test('height grows with every row', () => {
  const base = computeGameOverContentLayout(1, 1, false, 24).panelHeight;
  assert.ok(computeGameOverContentLayout(3, 1, false, 24).panelHeight > base);
  assert.ok(computeGameOverContentLayout(1, 3, false, 24).panelHeight > base);
});

test('the headline sits between the title and the divider, and a wrapped one grows the panel', () => {
  const one = computeGameOverContentLayout(2, 3, false, 24);
  assert.ok(one.headlineY > one.titleY);
  assert.ok(one.dividerY >= one.headlineY + 24);
  const two = computeGameOverContentLayout(2, 3, false, 48);
  assert.equal(two.dividerY - one.dividerY, 24);
  assert.equal(two.roomRowsY - one.roomRowsY, 24);
  assert.equal(two.panelHeight - one.panelHeight, 24);
});

test('ranking rows are tall enough for a cause line under the name; top score rows are not', () => {
  const { height, nameY, causeY } = GAME_OVER_RANKING_ROW;
  assert.ok(nameY < causeY && causeY < height);
  assert.ok(height > GAME_OVER_ROW_HEIGHT);
  const base = computeGameOverContentLayout(1, 1, false, 24);
  assert.equal(computeGameOverContentLayout(2, 1, false, 24).subheadingY - base.subheadingY, height);
  assert.equal(computeGameOverContentLayout(1, 2, false, 24).playAgainY - base.playAgainY, GAME_OVER_ROW_HEIGHT);
});

test('empty top scores still reserve one row for the placeholder', () => {
  assert.equal(computeGameOverContentLayout(2, 0, false, 24).panelHeight, computeGameOverContentLayout(2, 1, false, 24).panelHeight);
});

test('Save Score sits 20px under Play Again for guests only', () => {
  const guest = computeGameOverContentLayout(2, 3, true, 24);
  assert.equal(guest.saveScoreY, guest.playAgainY + GAME_OVER_BUTTON.height + 20);
  const member = computeGameOverContentLayout(2, 3, false, 24);
  assert.equal(member.saveScoreY, undefined);
  assert.ok(guest.panelHeight > member.panelHeight);
});

test('rankingName tags only bots', async () => {
  const { rankingName } = await import('../src/utils/gameOverLayout.ts');
  assert.equal(rankingName('Bot', true), 'Bot [BOT]');
  assert.equal(rankingName('Bot', false), 'Bot');
});
