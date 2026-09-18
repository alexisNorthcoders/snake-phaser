import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arcBodyPath, arcBodyLength } from '../src/BodyPath.ts';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const pathLength = (points: { x: number; y: number }[]) =>
  points.slice(1).reduce((sum, p, i) => sum + dist(points[i], p), 0);

test('a straight body has pre-trim length equal to the segment count', () => {
  const targets = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  const tailPrevious = { x: 2, y: 5 };

  assert.equal(arcBodyLength(targets, tailPrevious), targets.length);
});

test('a straight body is a straight line trimmed to n - 1 cells', () => {
  const targets = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  const tailPrevious = { x: 2, y: 5 };

  const path = arcBodyPath(targets, tailPrevious, 0.5);
  const first = path[0];
  const last = path[path.length - 1];

  assert.ok(path.every((p) => Math.abs(p.y - 5) < 1e-9), 'stays on the row');
  assert.ok(Math.abs(dist(first, last) - (targets.length - 1)) < 1e-9);
});

test('one corner still contributes a full cell of length, not a shortcut', () => {
  // Head at (5,5) heading up into a left turn towards (3,3).
  const targets = [{ x: 5, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 3 }];
  const tailPrevious = { x: 4, y: 3 };

  assert.equal(arcBodyLength(targets, tailPrevious), targets.length);
});

test('one corner rounds into a quarter-arc of radius 0.5 around the fillet centre', () => {
  const targets = [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }];
  const tailPrevious = { x: 0, y: 2 };

  // t = 1 shows the full pre-trim path minus one cell off the tail end, which
  // keeps everything from the head through the corner and just past it.
  const path = arcBodyPath(targets, tailPrevious, 1);
  const center = { x: 0.5, y: 0.5 };

  const nearCorner = path.filter((p) => dist(p, center) < 0.6 && dist(p, center) > 0.4);
  assert.ok(nearCorner.length > 2, 'several samples land on the fillet');
  for (const p of nearCorner) {
    assert.ok(Math.abs(dist(p, center) - 0.5) < 1e-6, `point ${JSON.stringify(p)} is radius 0.5 from the fillet centre`);
  }
});

test('a trim partway through a tick lands at the expected point on a straight run', () => {
  const targets = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  const tailPrevious = { x: 2, y: 5 };

  // t = 0.25: head trimmed by 0.75 cells, tail trimmed by 0.25 cells.
  const path = arcBodyPath(targets, tailPrevious, 0.25);
  const first = path[0];
  const last = path[path.length - 1];

  assert.ok(Math.abs(first.x - 4.25) < 1e-9 && Math.abs(first.y - 5) < 1e-9);
  assert.ok(Math.abs(last.x - 2.25) < 1e-9 && Math.abs(last.y - 5) < 1e-9);
});

test('at t = 0 the path sits exactly where the body was drawn before this tick', () => {
  const targets = [{ x: 5, y: 5 }, { x: 4, y: 5 }];
  const tailPrevious = { x: 3, y: 5 };

  const path = arcBodyPath(targets, tailPrevious, 0);
  assert.ok(Math.abs(pathLength(path) - (targets.length - 1)) < 1e-6);
  assert.deepEqual(path[0], { x: 4, y: 5 });
});

test('at t = 1 the path sits exactly on the new target cells', () => {
  const targets = [{ x: 5, y: 5 }, { x: 4, y: 5 }];
  const tailPrevious = { x: 3, y: 5 };

  const path = arcBodyPath(targets, tailPrevious, 1);
  assert.deepEqual(path[0], { x: 5, y: 5 });
  assert.deepEqual(path[path.length - 1], { x: 4, y: 5 });
});

test('a segment just grown (no distance to its predecessor) adds no length', () => {
  const targets = [{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }];
  const tailPrevious = { x: 5, y: 5 }; // the grown segment has no previous cell of its own

  // Only the head-to-neck hop has any distance; the grown tail sits still.
  assert.equal(arcBodyLength(targets, tailPrevious), 1);
});
