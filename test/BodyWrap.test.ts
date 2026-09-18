import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrapChain, wrapPieces, wrapCell } from '../src/BodyWrap.ts';

const N = 20;

test('a body crossing the right edge splits into pieces that each overhang by half a cell', () => {
  // Head just re-entered on the left; the neck and tail are still on the right.
  const chain = [{ x: 0, y: 5 }, { x: 19, y: 5 }, { x: 18, y: 5 }];
  const pieces = wrapPieces(unwrapChain(chain, N), N);

  assert.equal(pieces.length, 2);
  const xs = pieces.map((piece) => piece.map((p) => p.x));
  const entering = xs.find((row) => Math.min(...row) < 0)!;
  const leaving = xs.find((row) => Math.max(...row) > N - 1)!;

  // The board spans x in [-0.5, N - 0.5]; half a cell past is [-1, N].
  assert.equal(Math.min(...entering), -1);
  assert.equal(Math.max(...leaving), N);
  assert.equal(Math.max(...entering), 0);
  assert.equal(Math.min(...leaving), 18);
  for (const piece of pieces) {
    assert.ok(piece.every((p) => p.y === 5), 'stays on its row');
  }
});

test('crossing the top edge splits vertically, and an unwrapped body stays whole', () => {
  const top = wrapPieces(unwrapChain([{ x: 3, y: 19 }, { x: 3, y: 0 }, { x: 3, y: 1 }], N), N);
  assert.equal(top.length, 2);
  assert.ok(top.some((piece) => piece.some((p) => p.y === -1)));
  assert.ok(top.some((piece) => piece.some((p) => p.y === N)));

  const whole = wrapPieces([{ x: 5, y: 5 }, { x: 4, y: 5 }], N);
  assert.deepEqual(whole, [[{ x: 5, y: 5 }, { x: 4, y: 5 }]]);
});

test('wrapCell puts a cell past the edge back on the board', () => {
  const back = wrapCell({ x: -0.6, y: 20.2 }, N);
  assert.ok(Math.abs(back.x - 19.4) < 1e-9);
  assert.ok(Math.abs(back.y - 0.2) < 1e-9);
});
