import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tailCap } from '../src/BodyPath.ts';

test('a straight tail faces along its last segment', () => {
  const cap = tailCap([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }])!;
  assert.deepEqual(cap.centre, { x: 2, y: 0 });
  assert.equal(cap.angle, 0);
  assert.equal(tailCap([{ x: 0, y: 3 }, { x: 0, y: 2 }])!.angle, -Math.PI / 2);
});

test('a tail ending on an arc faces along the arc\'s final chord', () => {
  const cap = tailCap([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1.2, y: 0.1 }, { x: 1.2, y: 1 }])!;
  assert.deepEqual(cap.centre, { x: 1.2, y: 1 });
  assert.equal(cap.angle, Math.PI / 2);
});

test('duplicate trailing points are skipped to find a direction', () => {
  const cap = tailCap([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }])!;
  assert.deepEqual(cap.centre, { x: 1, y: 0 });
  assert.equal(cap.angle, 0);
});

test('fewer than two distinct points gives no cap', () => {
  assert.equal(tailCap([]), null);
  assert.equal(tailCap([{ x: 1, y: 1 }]), null);
  assert.equal(tailCap([{ x: 1, y: 1 }, { x: 1, y: 1 }]), null);
});
