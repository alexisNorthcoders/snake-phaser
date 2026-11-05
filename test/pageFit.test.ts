import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('page never blocks the player from zooming', () => {
  const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)?.[1] ?? '';
  assert.ok(viewport.includes('width=device-width'));
  assert.doesNotMatch(viewport, /user-scalable|maximum-scale/);
});

test('gestures over the game do not scroll, zoom or pull to refresh the page', () => {
  assert.match(html, /#game-container\s*{[^}]*touch-action:\s*none/);
  assert.match(html, /overscroll-behavior:\s*none/);
});

test('page height follows the dynamic viewport, not 100vh', () => {
  assert.doesNotMatch(html, /100vh/);
  assert.match(html, /100dvh/);
});
