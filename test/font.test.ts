import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FONT_FAMILY, loadGameFont, withDefaultFont } from '../src/font.ts';

test('font stack is Pixelify Sans with monospace fallback', () => {
  assert.equal(FONT_FAMILY, "'Pixelify Sans', Courier, 'Courier New', monospace");
});

test('withDefaultFont adds the family but keeps other and explicit style', () => {
  assert.deepEqual(withDefaultFont({ fontSize: '20px' }), { fontFamily: FONT_FAMILY, fontSize: '20px' });
  assert.deepEqual(withDefaultFont(), { fontFamily: FONT_FAMILY });
  assert.equal(withDefaultFont({ fontFamily: 'Arial' }).fontFamily, 'Arial');
});

test('loadGameFont loads both weights', async () => {
  const seen: string[] = [];
  await loadGameFont({ load: async (f) => void seen.push(f) });
  assert.equal(seen.length, 2);
  assert.ok(seen.some((f) => f.startsWith('400')) && seen.some((f) => f.startsWith('500')));
});

test('loadGameFont swallows load failures', async () => {
  await loadGameFont({ load: async () => { throw new Error('offline'); } });
});

test('loadGameFont tolerates no FontFaceSet', async () => {
  await loadGameFont(undefined);
});
