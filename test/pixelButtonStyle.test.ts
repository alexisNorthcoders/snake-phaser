import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUTTON_FILLS,
  HEADER_BUTTON,
  HEADER_ITEM_GAP,
  SCOREBOARD_BUTTON,
  computeBevelRects,
  headerButtonPosition,
  headerItemsRight,
  scoreboardButtonPosition,
} from '../src/utils/pixelButtonStyle.ts';

test('fill tokens', () => {
  assert.deepEqual(BUTTON_FILLS.button, { fill: 0x222222, hover: 0x444444 });
  assert.deepEqual(BUTTON_FILLS['button-alt'], { fill: 0x555555, hover: 0x777777 });
  assert.deepEqual(BUTTON_FILLS.action, { fill: 0x00aa00, hover: 0x00cc00 });
});

test('small: shadow, outline, fill, light top-left, dark bottom-right at 2px', () => {
  const r = computeBevelRects(80, 30, 'small', 0x222222, false);
  assert.deepEqual(r[0], { x: 0, y: 2, w: 80, h: 30, color: 0, alpha: 1 });
  assert.deepEqual(r[1], { x: 0, y: 0, w: 80, h: 30, color: 0, alpha: 1 });
  assert.deepEqual(r[2], { x: 2, y: 2, w: 76, h: 26, color: 0x222222, alpha: 1 });
  assert.equal(r[3].color, 0xffffff);
  assert.equal(r[3].alpha, 0.22);
  assert.equal(r[5].color, 0);
  assert.equal(r[5].alpha, 0.45);
  assert.equal(r.length, 7);
});

test('large uses 4px edges', () => {
  const r = computeBevelRects(100, 40, 'large', 0x00aa00, false);
  assert.deepEqual(r[0], { x: 0, y: 4, w: 100, h: 40, color: 0, alpha: 1 });
  assert.deepEqual(r[2], { x: 4, y: 4, w: 92, h: 32, color: 0x00aa00, alpha: 1 });
});

test('pressed swaps edges and drops the shadow', () => {
  const r = computeBevelRects(80, 30, 'small', 0x222222, true);
  assert.equal(r.length, 6);
  assert.equal(r[2].color, 0);
  assert.equal(r[2].alpha, 0.45);
  assert.equal(r[4].color, 0xffffff);
});

test('header button is right-aligned 20px from the edge and centred in the strip', () => {
  assert.deepEqual(headerButtonPosition(800), { x: 690, y: 5 });
});

// The canvas is a fixed 800 logical px that FIT scales to the screen (src/phaserGame.ts), so a 360 px phone
// and an 800 px desktop get these same logical positions, uniformly scaled.
const CANVAS_WIDTH = 800;
const HEADER_FONT_PX = 20;
// Worst case for text width: the monospace fallback (0.6em a glyph) shown before Pixelify Sans loads.
const textWidth = (text: string, px = HEADER_FONT_PX) => text.length * px * 0.6;

type Span = { left: number; right: number };

/** Every header item as a horizontal span in logical px, using the scene's real sizes and positions. */
function headerSpans(): Span[] {
  const pingLeft = 200;
  const pingTextRight = pingLeft + textWidth('Ping: 999ms');
  const barsLeft = pingTextRight + 8;
  const barsRight = barsLeft + 3 * (4 + 2) + 4;
  const header = headerButtonPosition(CANVAS_WIDTH);
  const scores = scoreboardButtonPosition(CANVAS_WIDTH);
  const hungerRight = headerItemsRight(CANVAS_WIDTH);
  const hungerLeft = hungerRight - 120;
  const labelRight = hungerLeft - 8;
  return [
    { left: 20, right: 20 + textWidth('Score: 999') },
    { left: pingLeft, right: barsRight },
    { left: labelRight - textWidth('Starving'), right: labelRight },
    { left: hungerLeft, right: hungerRight },
    { left: scores.x, right: scores.x + SCOREBOARD_BUTTON.width },
    { left: header.x, right: header.x + HEADER_BUTTON.width },
  ];
}

test('scoreboard button sits left of the header button, level with it', () => {
  assert.deepEqual(headerButtonPosition(CANVAS_WIDTH), { x: 690, y: 5 });
  assert.deepEqual(scoreboardButtonPosition(CANVAS_WIDTH), { x: 602, y: 5 });
  assert.equal(602 + SCOREBOARD_BUTTON.width + HEADER_BUTTON.gap, 690);
});

test('the timer and hunger bar end 16px left of the scoreboard button', () => {
  assert.equal(headerItemsRight(CANVAS_WIDTH), 586);
  assert.equal(HEADER_ITEM_GAP, 16);
});

test('the Scores label fits inside its button', () => {
  assert.ok(textWidth(SCOREBOARD_BUTTON.label) <= SCOREBOARD_BUTTON.width);
});

for (const screenWidth of [360, 800]) {
  test(`no header items overlap on a ${screenWidth} px wide screen`, () => {
    const scale = Math.min(1, screenWidth / CANVAS_WIDTH);
    const spans = headerSpans().map(({ left, right }) => ({ left: left * scale, right: right * scale }));
    for (let i = 1; i < spans.length; i++) {
      assert.ok(
        spans[i - 1].right <= spans[i].left,
        `item ${i - 1} ends at ${spans[i - 1].right} but item ${i} starts at ${spans[i].left}`,
      );
    }
    assert.ok(spans[spans.length - 1].right <= screenWidth);
  });
}
