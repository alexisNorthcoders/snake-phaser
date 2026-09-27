import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROSTER_CARD, ROSTER_PICKER, computeRosterPickerLayout } from '../src/utils/rosterPickerLayout.ts';
import { LOBBY_PANEL } from '../src/utils/lobbyPanelLayout.ts';

const CANVAS = 800;

test('the picker covers the lobby panel', () => {
  const l = computeRosterPickerLayout(2);
  assert.equal(l.panel.x, LOBBY_PANEL.x);
  assert.equal(l.panel.y, LOBBY_PANEL.y);
  assert.equal(l.panel.width, LOBBY_PANEL.width);
  assert.equal(l.panel.height, LOBBY_PANEL.height);
});

test('cards run two to a row, left to right then down, inside the padding', () => {
  const l = computeRosterPickerLayout(3);
  const left = LOBBY_PANEL.x + ROSTER_PICKER.padding;
  const right = LOBBY_PANEL.x + LOBBY_PANEL.width - ROSTER_PICKER.padding;
  assert.equal(l.cards.length, 3);
  assert.equal(l.cards[0].x, left);
  assert.equal(l.cards[1].x + ROSTER_CARD.width, right);
  assert.equal(l.cards[0].y, l.cards[1].y);
  assert.equal(l.cards[2].x, left);
  assert.equal(l.cards[2].y, l.cards[0].y + ROSTER_CARD.height + ROSTER_PICKER.cardGap);
  assert.ok(l.cards[0].y > l.dividerY);
});

test('the close button sits in the top-right corner, level with the title', () => {
  const l = computeRosterPickerLayout(1);
  assert.equal(l.closeX + ROSTER_PICKER.closeSize, LOBBY_PANEL.x + LOBBY_PANEL.width - ROSTER_PICKER.padding);
  assert.equal(l.closeY, l.titleY);
});

test('a long roster grows the panel to fit, and eight snakes stay on the canvas', () => {
  const short = computeRosterPickerLayout(2);
  const long = computeRosterPickerLayout(8);
  const lastCard = long.cards[7];
  assert.ok(long.panel.height > short.panel.height);
  assert.equal(lastCard.y + ROSTER_CARD.height + ROSTER_PICKER.padding, long.panel.y + long.panel.height);
  assert.ok(long.panel.y + long.panel.height <= CANVAS);
});

test('every card line, the record line last, fits inside the card padding', () => {
  const linesBottom = ROSTER_CARD.padding + (ROSTER_CARD.recordLine + 1) * ROSTER_CARD.lineHeight;
  assert.ok(linesBottom + ROSTER_CARD.padding <= ROSTER_CARD.height);
});
