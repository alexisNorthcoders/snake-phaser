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
});

test('favicon is linked and shipped as a real file', () => {
  assert.match(html, /<link rel="icon" href="\/favicon\.ico"/);
  assert.ok(existsSync('public/favicon.ico'));
});

test('share image is an absolute URL, 1200x630, and shipped as a real file', () => {
  const url = 'https://snakemp.duckdns.org/share-card.png';
  assert.ok(html.includes(`property="og:image" content="${url}"`));
  assert.ok(html.includes(`name="twitter:image" content="${url}"`));
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  const png = readFileSync('public/share-card.png');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});
