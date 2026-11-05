import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');

test('page title and share tags say Snake MP with absolute URLs', () => {
  assert.match(html, /<title>Snake MP<\/title>/);
  assert.match(html, /property="og:url" content="https:\/\/snakemp\.duckdns\.org\/"/);
  for (const tag of ['og:title', 'og:description', 'og:type', 'twitter:title', 'twitter:description']) {
    assert.ok(html.includes(`"${tag}"`), tag);
  }
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /name="description"/);
  assert.doesNotMatch(html, /og:image|twitter:image/);
});

test('favicon is linked and shipped as a real file', () => {
  assert.match(html, /<link rel="icon" href="\/favicon\.ico"/);
  assert.ok(existsSync('public/favicon.ico'));
});
