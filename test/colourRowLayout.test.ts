import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PART_BUTTON_HEIGHT, computeColourRowLayout, computePreviewBoxRects, swatchPosition } from '../src/utils/colourRowLayout.ts';
import { computeLobbyPanelLayout, COLOUR_SPACE_HEIGHT, LOBBY_PANEL } from '../src/utils/lobbyPanelLayout.ts';

test('colour row: snake centred in the 208x124 box, right column 24px away', () => {
  const l = computeColourRowLayout(100, 50);
  assert.deepEqual(l.snakeOrigin, { x: 100 + 38, y: 50 + 40 });
  assert.equal(l.partButtons[0].x, 100 + 208 + 24);
  assert.equal(l.partButtons[1].x - l.partButtons[0].x, 92);
});

test('colour row: 16px between buttons and swatches, grid fills the box height', () => {
  const l = computeColourRowLayout(0, 0);
  assert.equal(l.swatchTop - PART_BUTTON_HEIGHT, 16);
  const last = swatchPosition(l, 11);
  assert.equal(last.y + 28, 124);
  assert.deepEqual(swatchPosition(l, 6), { x: l.swatchLeft, y: l.swatchTop + 34 });
  assert.equal(swatchPosition(l, 5).x - l.swatchLeft, 170);
});

test('colour row fits the lobby panel content width and reserved space', () => {
  const l = computeColourRowLayout(0, 0);
  assert.ok(l.partButtons[2].x + 80 <= computeLobbyPanelLayout(true).contentWidth);
  assert.equal(COLOUR_SPACE_HEIGHT, 124);
  assert.ok(LOBBY_PANEL.height > 0);
});

test('preview box: black outline, #1d1d1d fill, dark top-left edge', () => {
  const r = computePreviewBoxRects();
  assert.deepEqual(r[0], { x: 0, y: 0, w: 208, h: 124, color: 0, alpha: 1 });
  assert.equal(r[1].color, 0x1d1d1d);
});
