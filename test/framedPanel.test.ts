import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDividerRects, computeFrameRects } from '../src/utils/framedPanelStyle.ts';
import { computeLobbyPanelLayout, LOBBY_PANEL } from '../src/utils/lobbyPanelLayout.ts';

test('frame: shadow, outline, scrim with given alpha, four 4px #333333 border strips', () => {
  const r = computeFrameRects(560, 480, 0.9);
  assert.deepEqual(r[0], { x: 0, y: 480, w: 560, h: 4, color: 0, alpha: 1 });
  assert.ok(r.slice(1, 5).every((o) => o.color === 0 && o.alpha === 1 && o.x >= 0 && o.y >= 0 && o.x + o.w <= 560 && o.y + o.h <= 480));
  assert.deepEqual(r[5], { x: 4, y: 4, w: 552, h: 472, color: 0, alpha: 0.9 });
  assert.equal(r.length, 10);
  assert.ok(r.slice(6).every((b) => b.color === 0x333333 && (b.w === 4 || b.h === 4)));
});

test('divider: 4px tall, alternating 4px dashes and 4px gaps', () => {
  const r = computeDividerRects(496);
  assert.equal(r.length, 62);
  assert.deepEqual(r[0], { x: 0, y: 0, w: 4, h: 4, color: 0x333333, alpha: 1 });
  assert.equal(r[1].x, 8);
});

test('lobby layout: guest stack is centred with 24px gaps', () => {
  const l = computeLobbyPanelLayout(true);
  assert.equal(l.dividerY - (l.titleY + 40), 24);
  assert.equal(l.nameRowY! - (l.dividerY + 4), 24);
  assert.equal(l.colourSpaceY - (l.nameRowY! + 44), 24);
  const bottom = l.startY + 56;
  assert.equal(l.titleY - (LOBBY_PANEL.y + 32), LOBBY_PANEL.y + LOBBY_PANEL.height - 32 - bottom);
});

test('lobby layout: accounts have no Name row', () => {
  const l = computeLobbyPanelLayout(false);
  assert.equal(l.nameRowY, undefined);
  assert.equal(l.colourSpaceY - (l.dividerY + 4), 24);
});
