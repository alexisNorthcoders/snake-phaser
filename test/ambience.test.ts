import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FADE_MS, RESPAWN_LENGTH, RESPAWN_MS, createAmbience, pickAmbientColours, type Ambience,
} from '../src/ambience.ts';
import { PALETTE, type Appearance } from '../src/appearanceStore.ts';
import { STEP_MS, gridFor, inBand, type Cell } from '../src/ambientSnake.ts';

const grid = gridFor(800, 800);
const player: Appearance = { head: '#e63946', body: '#2a9d3f', eyes: '#ffffff' };

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (c: Cell) => `${c.x},${c.y}`;
const DIRS = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];

/** A 4x2 band completely filled by two length-4 snakes: both are trapped from the first step. */
const cramped = () => createAmbience({ grid: { cols: 4, rows: 2 }, random: seeded(1), count: 2, length: 4 });

test('three snakes start spaced round the ring, in the band, facing both ways round', () => {
  const world = createAmbience({ grid, random: seeded(1) });
  assert.equal(world.snakes.length, 3);
  const all = world.snakes.flatMap((s) => s.cells.map(key));
  assert.equal(new Set(all).size, all.length, 'no shared cells');
  world.snakes.forEach((s) => s.cells.forEach((c) => assert.ok(inBand(grid, c))));
  const heads = world.snakes.map((s) => s.cells[0]);
  // Head-to-head spacing is even round the 148-cell ring, give or take the alternating direction.
  const dist = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  assert.ok(dist(heads[0], heads[1]) > 20 && dist(heads[1], heads[2]) > 20);
  const first = new Set(world.snakes.map((s) => key({ x: s.cells[0].x - s.cells[1].x, y: s.cells[0].y - s.cells[1].y })));
  assert.ok(first.size > 1, 'not all heading the same way');
});

test('snakes never overlap or leave the band, and each moves one cell at a time', () => {
  for (const seed of [1, 2, 3]) {
    const world = createAmbience({ grid, random: seeded(seed) });
    for (let i = 0; i < 4000; i++) {
      world.step();
      const seen = new Set<string>();
      for (const s of world.snakes) {
        if (s.opacity === 0) continue;
        for (const c of s.cells) {
          assert.ok(inBand(grid, c));
          assert.ok(!seen.has(key(c)), `overlap at ${key(c)} (seed ${seed}, step ${i})`);
          seen.add(key(c));
        }
      }
    }
  }
});

/** Whether a snake could move: a free neighbour of its head. Its tail cell is vacated by the move. */
function hasFreeMove(cells: readonly Cell[], others: Set<string>): boolean {
  const body = new Set(cells.slice(0, -1).map(key));
  return DIRS.some((d) => {
    const n = { x: cells[0].x + d.x, y: cells[0].y + d.y };
    return inBand(grid, n) && !body.has(key(n)) && !others.has(key(n));
  });
}

test('a snake dies only when it has no free move, and deaths are occasional', () => {
  let deaths = 0;
  let steps = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const world = createAmbience({ grid, random: seeded(seed) });
    const wasDead = world.snakes.map(() => false);
    for (let i = 0; i < 3000; i++) {
      const before = world.snakes.map((s) => [...s.cells]);
      world.step();
      steps++;
      world.snakes.forEach((s, n) => {
        if (s.dead && !wasDead[n]) {
          deaths++;
          // Snakes move in order: earlier ones have already moved, later ones are still where they were.
          const others = new Set(world.snakes.flatMap((o, m) => {
            if (m === n || o.opacity === 0) return [];
            return (m < n ? o.cells : before[m]).map(key);
          }));
          assert.ok(!hasFreeMove(before[n], others), `seed ${seed} step ${i}: snake ${n} died with a free move`);
        }
        wasDead[n] = s.dead;
      });
    }
  }
  const secondsPerDeath = (steps * STEP_MS) / 1000 / deaths;
  assert.ok(deaths > 0, 'never died');
  assert.ok(secondsPerDeath >= 20 && secondsPerDeath <= 60, `one death per ${secondsPerDeath}s`);
});

test('a trapped snake shows dead, fades over one second, then respawns at length 3 after two', () => {
  const world = cramped();
  world.step(0);
  assert.ok(world.snakes.every((s) => s.dead), 'both are trapped');
  assert.equal(world.snakes[0].opacity, 1);
  world.step(FADE_MS / 2);
  assert.equal(world.snakes[0].opacity, 0.5);
  world.step(FADE_MS / 2);
  assert.equal(world.snakes[0].opacity, 0);
  world.step(RESPAWN_MS - FADE_MS - 1);
  assert.ok(world.snakes[0].dead, 'still waiting just before the delay');
  world.step(1);
  assert.equal(world.snakes[0].dead, false);
  assert.equal(world.snakes[0].opacity, 1);
  assert.equal(world.snakes[0].cells.length, RESPAWN_LENGTH);
});

test('a respawned snake lands on free in-band cells, never on another snake', () => {
  for (const seed of [1, 2, 3, 4]) {
    const world = createAmbience({ grid: { cols: 4, rows: 2 }, random: seeded(seed), count: 2, length: 4 });
    const revived: Ambience['snakes'][number][] = [];
    for (let i = 0; i < 200; i++) {
      const dead = world.snakes.map((s) => s.dead);
      world.step(STEP_MS);
      world.snakes.forEach((s, n) => {
        if (dead[n] && !s.dead) revived.push(s);
      });
      const seen = new Set<string>();
      for (const s of world.snakes) {
        if (s.opacity === 0) continue;
        for (const c of s.cells) {
          assert.ok(inBand({ cols: 4, rows: 2 }, c));
          assert.ok(!seen.has(key(c)), `overlap at ${key(c)}`);
          seen.add(key(c));
        }
      }
    }
    assert.ok(revived.length > 0, 'something respawned');
    assert.ok(revived.every((s) => s.cells.length === RESPAWN_LENGTH));
  }
});

test('the same seed gives the same world', () => {
  const run = (seed: number) => {
    const world = createAmbience({ grid, random: seeded(seed) });
    for (let i = 0; i < 500; i++) world.step();
    return JSON.stringify(world.snakes.map((s) => [s.cells, s.colours, s.dead]));
  };
  assert.equal(run(9), run(9));
  assert.notEqual(run(9), run(10));
});

test('ambient colours come from the palette, differ from each other and never match the player head or body', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { head, body } = pickAmbientColours(seeded(seed), player);
    assert.ok(PALETTE.includes(head) && PALETTE.includes(body));
    assert.notEqual(head, body);
    for (const c of [head, body]) assert.ok(c !== player.head && c !== player.body);
  }
  const world = createAmbience({ grid, random: seeded(3), playerColours: () => player });
  for (const s of world.snakes) assert.ok(![s.colours.head, s.colours.body].some((c) => c === player.head || c === player.body));
});

test('colours that clash once the account colours arrive or the player changes them are replaced', () => {
  let current: Appearance | undefined;
  const world = createAmbience({ grid, random: seeded(4), playerColours: () => current });
  world.step();
  // The player's colours land on exactly what one ambient snake is wearing.
  current = { head: world.snakes[0].colours.head, body: world.snakes[1].colours.body, eyes: '#ffffff' };
  world.step();
  for (const s of world.snakes) {
    assert.ok(![s.colours.head, s.colours.body].some((c) => c === current!.head || c === current!.body));
    assert.notEqual(s.colours.head, s.colours.body);
  }
});

test('every ambient snake eats fruit it lands on and grows by one', () => {
  const band: Cell[] = [];
  for (let x = 0; x < grid.cols; x++) for (let y = 0; y < grid.rows; y++) if (inBand(grid, { x, y })) band.push({ x, y });
  const eaten: Cell[] = [];
  // Fruit on every band cell, so whatever move each snake makes lands on one.
  const world = createAmbience({ grid, random: seeded(3), fruit: () => band, onEat: (c) => eaten.push(c) });
  const before = world.snakes.map((s) => s.cells.length);
  world.step(STEP_MS);
  assert.deepEqual(world.snakes.map((s) => s.cells.length), before.map((n) => n + 1));
  assert.deepEqual(eaten.map(key).sort(), world.snakes.map((s) => key(s.cells[0])).sort());
});
