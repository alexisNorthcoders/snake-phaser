import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCOREBOARD_PANEL, computeScoreboardLayout, parseColour, scoreboardRows } from '../src/utils/scoreboardLayout.ts';

const player = (id: string, name: string, score: number, headColour = '#ff0000') => ({
  id, name, score, isDead: false, headColour,
});

test('panel sits at (560, 56), 220 wide, scrim 0.6', () => {
  assert.deepEqual(
    [SCOREBOARD_PANEL.x, SCOREBOARD_PANEL.y, SCOREBOARD_PANEL.width, SCOREBOARD_PANEL.scrimAlpha],
    [560, 56, 220, 0.6],
  );
});

test('rows sort highest score first and label the local player "You"', () => {
  const rows = scoreboardRows([player('a', 'Ann', 1), player('b', 'Bob', 9), player('c', '', 5)], 'a');
  assert.deepEqual(rows.map((r) => r.label), ['Bob', 'Player', 'You']);
  assert.deepEqual(rows.map((r) => r.score), [9, 5, 1]);
});

test('rows carry the head colour as a number', () => {
  assert.equal(scoreboardRows([player('a', 'Ann', 1, '#00ff00')], undefined)[0].headColour, 0x00ff00);
});

test('parseColour handles hex, short hex, rgb() and garbage', () => {
  assert.equal(parseColour('#102030'), 0x102030);
  assert.equal(parseColour('#fff'), 0xffffff);
  assert.equal(parseColour('rgb(1, 2, 3)'), 0x010203);
  assert.equal(parseColour('nope'), 0xffffff);
});

test('panel height grows by one row plus gap per player', () => {
  const h1 = computeScoreboardLayout(1).height;
  const h2 = computeScoreboardLayout(2).height;
  const h3 = computeScoreboardLayout(3).height;
  assert.equal(h2 - h1, 24);
  assert.equal(h3 - h2, 24);
  assert.ok(computeScoreboardLayout(0).height < h1);
});

test('last row ends inside the padded panel', () => {
  const l = computeScoreboardLayout(4);
  assert.equal(l.rowY(3) + 16 + 12, SCOREBOARD_PANEL.y + l.height);
});

test('rgb() channels clamp and long names truncate', () => {
  assert.equal(parseColour('rgb(300, 0, 0)'), 0xff0000);
  assert.ok(scoreboardRows([player('a', 'x'.repeat(30), 1)], undefined)[0].label.length <= 12);
});
