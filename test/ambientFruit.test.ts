import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAmbientSnake, gridFor, inBand, LOBBY_UI_RECTS, cellRect, type Cell } from '../src/ambientSnake.ts';
import { createAmbientFruit, MAX_FRUIT } from '../src/ambientFruit.ts';

const grid = gridFor(800, 800);

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (c: Cell) => `${c.x},${c.y}`;

test('fruit sits on distinct free band cells, clear of snakes and lobby UI', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const occupied = Array.from({ length: 8 }, (_, i) => ({ x: i, y: 0 }));
    const field = createAmbientFruit({ grid, allowed: (c) => inBand(grid, c), random: seeded(seed), occupied: () => occupied, count: 4, kinds: 5 });
    assert.equal(field.fruit.length, 4);
    assert.equal(new Set(field.fruit.map((f) => key(f.cell))).size, 4);
    for (const f of field.fruit) {
      assert.ok(inBand(grid, f.cell));
      assert.ok(!occupied.some((c) => key(c) === key(f.cell)));
      assert.ok(f.kind >= 0 && f.kind < 5);
      const r = cellRect(f.cell);
      for (const ui of Object.values(LOBBY_UI_RECTS)) {
        assert.ok(!(r.x < ui.x + ui.width && ui.x < r.x + r.width && r.y < ui.y + ui.height && ui.y < r.y + r.height));
      }
    }
  }
});

test('the count is capped at the maximum', () => {
  assert.equal(createAmbientFruit({ grid, allowed: (c) => inBand(grid, c), random: seeded(1), count: 50 }).fruit.length, MAX_FRUIT);
});

test('an eaten fruit respawns after 1-3 seconds, never before, and never beyond the count', () => {
  const field = createAmbientFruit({ grid, allowed: (c) => inBand(grid, c), random: seeded(9), count: 3 });
  field.eat(field.fruit[0].cell);
  assert.equal(field.fruit.length, 2);
  field.tick(999);
  assert.equal(field.fruit.length, 2);
  field.tick(2001);
  assert.equal(field.fruit.length, 3);
  assert.equal(new Set(field.fruit.map((f) => key(f.cell))).size, 3);
  // Eating where there is no fruit does nothing.
  field.eat({ x: 20, y: 20 });
  field.tick(5000);
  assert.equal(field.fruit.length, 3);
});

test('a snake eats fruit, grows by one each time, and stops at the cap', () => {
  const field = createAmbientFruit({ grid, allowed: (c) => inBand(grid, c), random: seeded(4), count: 4 });
  let eaten = 0;
  const snake = createAmbientSnake({
    grid, random: seeded(4), length: 4, maxLength: 7, seekChance: 0.5,
    fruit: () => field.fruit.map((f) => f.cell),
    onEat: (c) => { eaten++; field.eat(c); },
  });
  let lastLength = 4;
  for (let i = 0; i < 20000; i++) {
    snake.step();
    field.tick(175);
    assert.ok(snake.cells.length <= 7);
    assert.ok(snake.cells.length - lastLength <= 1);
    lastLength = snake.cells.length;
    assert.ok(field.fruit.length <= MAX_FRUIT);
  }
  assert.ok(eaten > 10, 'ate repeatedly');
  assert.equal(snake.cells.length, 7);
});

test('eating a fruit grows the snake by exactly one', () => {
  const fruit = [{ x: 3, y: 0 }];
  const snake = createAmbientSnake({
    grid, random: () => 0.99, length: 3, maxLength: 9, fruit: () => fruit, onEat: () => fruit.pop(),
  });
  snake.step();
  assert.equal(snake.cells.length, 4);
  snake.step();
  assert.equal(snake.cells.length, 4);
});

test('seeking moves the snake towards fruit more often than the unbiased walk does, but only lightly', () => {
  // Head at 2,0 heading right, fruit directly below it: going straight moves away, dropping a lane moves closer.
  const fruit = [{ x: 2, y: 1 }];
  const towardRate = (seekChance: number) => {
    let toward = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const snake = createAmbientSnake({ grid, random: seeded(seed), length: 3, laneSwitchChance: 0, seekChance, fruit: () => fruit });
      snake.step();
      if (snake.cells[0].y === 1) toward++;
    }
    return toward / 500;
  };
  assert.equal(towardRate(0), 0);
  const biased = towardRate(0.3);
  assert.ok(biased > 0.2 && biased < 0.4, `toward rate ${biased}`);
  assert.ok(biased < towardRate(1), 'stronger seeking closes more often');
});

test('fruit on another side of the screen is ignored', () => {
  const fruit = [{ x: 20, y: 37 }];
  const snake = createAmbientSnake({ grid, random: seeded(1), length: 3, seekChance: 1, laneSwitchChance: 0, fruit: () => fruit });
  snake.step();
  assert.deepEqual(snake.cells[0], { x: 3, y: 0 });
});
