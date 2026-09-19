import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEADERBOARD_PANEL,
  computeLeaderboardPanelLayout,
  globalRows,
  mineRows,
} from '../src/utils/leaderboardPanelLayout.ts';

test('panel sits at (120, 600), 560 wide, scrim 0.8, and stays on the 800px canvas', () => {
  assert.equal(LEADERBOARD_PANEL.x, 120);
  assert.equal(LEADERBOARD_PANEL.y, 600);
  assert.equal(LEADERBOARD_PANEL.width, 560);
  assert.equal(LEADERBOARD_PANEL.scrimAlpha, 0.8);
  assert.ok(LEADERBOARD_PANEL.height >= 160);
  assert.ok(LEADERBOARD_PANEL.y + LEADERBOARD_PANEL.height + 4 <= 800);
});

test('header plus five rows fit inside the padded panel', () => {
  const l = computeLeaderboardPanelLayout();
  assert.equal(l.contentX, 144);
  assert.equal(l.headerY, 616);
  const rowsBottom = l.rowsY + 5 * l.rowHeight;
  assert.equal(rowsBottom + 16, LEADERBOARD_PANEL.y + LEADERBOARD_PANEL.height);
});

test('columns run rank, name, then score right-aligned to the content edge', () => {
  const l = computeLeaderboardPanelLayout();
  assert.ok(l.rankX < l.nameX && l.nameX < l.scoreRight);
  assert.equal(l.scoreRight, 120 + 560 - 24);
});

test('global rows keep the top five with ranks and names', () => {
  const rows = globalRows(Array.from({ length: 8 }, (_, i) => ({ username: `p${i}`, score: 100 - i })));
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0], { rank: '1.', label: 'p0', score: '100' });
  assert.equal(rows[4].rank, '5.');
});

test('mine rows show the date in place of the name', () => {
  const rows = mineRows([{ score: 7, timestamp: 42 }], (t) => `d${t}`);
  assert.deepEqual(rows, [{ rank: '1.', label: 'd42', score: '7' }]);
});

test('no entries yields no rows', () => {
  assert.deepEqual(globalRows([]), []);
  assert.deepEqual(mineRows([]), []);
});
