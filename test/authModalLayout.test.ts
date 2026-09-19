import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAuthModalLayout, type Box } from '../src/utils/authModalLayout.ts';

const left = (b: Box) => b.x - b.width / 2;
const right = (b: Box) => b.x + b.width / 2;
const top = (b: Box) => b.y - b.height / 2;
const bottom = (b: Box) => b.y + b.height / 2;

for (const [w, h] of [[800, 600], [390, 700]]) {
  for (const hasSubtitle of [true, false]) {
    const name = `canvas ${w}x${h}, subtitle ${hasSubtitle}`;
    const l = computeAuthModalLayout(w, h, hasSubtitle);
    const rows = [l.title, l.subtitle, l.usernameLabel, l.usernameInput, l.passwordLabel, l.passwordInput, l.error, l.submit, l.toggle, l.back]
      .filter((b): b is Box => b !== null);

    test(`${name}: panel is centred and within the canvas`, () => {
      assert.equal(l.panel.x, w / 2);
      assert.equal(l.panel.y, h / 2);
      assert.equal(l.panel.width, Math.min(360, w - 32));
      assert.ok(left(l.panel) >= 0 && right(l.panel) <= w);
      assert.ok(top(l.panel) >= 0 && bottom(l.panel) <= h);
    });

    test(`${name}: every row is centred within the panel`, () => {
      for (const b of rows) {
        assert.equal(b.x, l.panel.x);
        assert.ok(left(b) >= left(l.panel) && right(b) <= right(l.panel));
        assert.ok(top(b) >= top(l.panel) && bottom(b) <= bottom(l.panel));
      }
    });

    test(`${name}: rows do not overlap and run in order`, () => {
      for (let i = 1; i < rows.length; i++) {
        assert.ok(top(rows[i]) >= bottom(rows[i - 1]), `row ${i} overlaps row ${i - 1}`);
      }
    });

    test(`${name}: panel bottom hugs the Back text`, () => {
      assert.ok(bottom(l.panel) - bottom(l.back) <= 40);
    });

    test(`${name}: subtitle presence matches`, () => {
      assert.equal(l.subtitle !== null, hasSubtitle);
    });
  }
}
