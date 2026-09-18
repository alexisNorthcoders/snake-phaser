import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AMBIENT_CELL, BAND_LANES, LOBBY_UI_RECTS, cellRect, createAmbientSnake, gridFor, inBand, type Cell, type Rect,
} from '../src/ambientSnake.ts';

const grid = gridFor(800, 800);

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('the grid covers the screen below the 40px HUD bar in 20px cells', () => {
  assert.deepEqual(grid, { cols: 40, rows: 38 });
});

test('the band is two lanes wide round the edge and empty inside', () => {
  assert.equal(inBand(grid, { x: 0, y: 0 }), true);
  assert.equal(inBand(grid, { x: BAND_LANES - 1, y: 20 }), true);
  assert.equal(inBand(grid, { x: BAND_LANES, y: 20 }), false);
  assert.equal(inBand(grid, { x: 20, y: BAND_LANES }), false);
  assert.equal(inBand(grid, { x: 39, y: 37 }), true);
  assert.equal(inBand(grid, { x: 40, y: 10 }), false);
  assert.equal(inBand(grid, { x: 10, y: -1 }), false);
});

test('no band cell overlaps any lobby UI area, and the band sits below the HUD bar', () => {
  for (let x = 0; x < grid.cols; x++) {
    for (let y = 0; y < grid.rows; y++) {
      if (!inBand(grid, { x, y })) continue;
      const rect = cellRect({ x, y });
      assert.ok(rect.y >= 40, `cell ${x},${y} is under the HUD bar`);
      for (const [name, ui] of Object.entries(LOBBY_UI_RECTS)) {
        assert.equal(overlaps(rect, ui), false, `cell ${x},${y} overlaps ${name}`);
      }
    }
  }
});

test('every move stays in the band, one cell at a time, without overlapping itself', () => {
  const snake = createAmbientSnake({ grid, random: seeded(1) });
  for (let i = 0; i < 3000; i++) {
    snake.step();
    const head = snake.cells[0];
    assert.ok(inBand(grid, head), `left the band at ${head.x},${head.y}`);
    // Contiguous body (the snake may reverse out of a self-made dead end, swapping head and tail).
    snake.cells.slice(1).forEach((c, j) => {
      const p = snake.cells[j];
      assert.equal(Math.abs(c.x - p.x) + Math.abs(c.y - p.y), 1);
    });
    assert.equal(new Set(snake.cells.map((c) => `${c.x},${c.y}`)).size, snake.cells.length);
  }
});

test('it goes all the way round and now and then changes lane', () => {
  const snake = createAmbientSnake({ grid, random: seeded(7) });
  const seen = new Set<string>();
  const lanes = new Set<number>();
  for (let i = 0; i < 3000; i++) {
    snake.step();
    seen.add(`${snake.cells[0].x},${snake.cells[0].y}`);
    if (snake.cells[0].y < BAND_LANES && snake.cells[0].x > 5 && snake.cells[0].x < 35) lanes.add(snake.cells[0].y);
  }
  assert.ok(seen.has('39,37') || seen.has('0,37'), 'reached the bottom corners');
  assert.equal(lanes.size, 2, 'used both top lanes');
});

test('the same seed gives the same walk; a different seed a different one', () => {
  const walk = (seed: number) => {
    const snake = createAmbientSnake({ grid, random: seeded(seed) });
    const heads: Cell[] = [];
    for (let i = 0; i < 300; i++) {
      snake.step();
      heads.push({ ...snake.cells[0] });
    }
    return heads;
  };
  assert.deepEqual(walk(3), walk(3));
  assert.notDeepEqual(walk(3), walk(4));
});

test('it never steps onto a blocked cell, and waits when boxed in', () => {
  const blockedCell = { x: 4, y: 0 };
  const snake = createAmbientSnake({
    grid, random: seeded(2), length: 4,
    blocked: (c) => c.x === blockedCell.x && c.y === blockedCell.y,
  });
  for (let i = 0; i < 500; i++) {
    snake.step();
    assert.ok(!snake.cells.some((c) => c.x === 4 && c.y === 0));
  }

  let boxedIn = false;
  const boxed = createAmbientSnake({ grid, random: seeded(2), length: 4, blocked: () => boxedIn });
  boxedIn = true;
  const before = JSON.stringify(boxed.cells);
  boxed.step();
  assert.equal(JSON.stringify(boxed.cells), before);
});

test('with no randomness a snake goes straight, turns at the corner and never leaves', () => {
  const snake = createAmbientSnake({ grid, random: () => 0.99, length: 3 });
  for (let i = 0; i < 37; i++) snake.step();
  assert.deepEqual(snake.cells[0], { x: 39, y: 0 });
  snake.step();
  assert.equal(snake.cells[0].x, 39);
  assert.equal(snake.cells[0].y, 1);
  assert.equal(AMBIENT_CELL, 20);
});

test('it starts on a free in-band stretch, and rejects a band with none', () => {
  const snake = createAmbientSnake({ grid, random: seeded(1), length: 8, blocked: (c) => c.y === 0 && c.x < 3 });
  for (const c of snake.cells) {
    assert.ok(inBand(grid, c));
    assert.ok(!(c.y === 0 && c.x < 3));
  }
  assert.throws(() => createAmbientSnake({ grid, random: seeded(1), blocked: () => true }));
});

test('it reverses out of a dead end and keeps circulating', () => {
  // A wall across both top lanes at x=20 blocks forward and sideways-free options only after reversing.
  const snake = createAmbientSnake({
    grid, random: seeded(5), length: 4,
    blocked: (c) => c.x === 20 && c.y < BAND_LANES,
  });
  const seen = new Set<number>();
  for (let i = 0; i < 3000; i++) {
    snake.step();
    assert.ok(inBand(grid, snake.cells[0]));
    assert.ok(!snake.cells.some((c) => c.x === 20 && c.y < BAND_LANES));
    seen.add(snake.cells[0].x);
  }
  assert.ok(seen.has(0) || seen.has(1), 'went back the other way round');
  assert.ok(seen.has(39), 'reached the far side');
});
