import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isGuest } from '../src/userData.ts';

test('a stored user flagged as a guest is a guest, whatever their name', () => {
  assert.equal(isGuest({ username: 'anonymous', isGuest: true }), true);
  assert.equal(isGuest({ username: 'Sam', isGuest: true }), true);
});

test('a stored user flagged as not a guest is an account, even if named anonymous', () => {
  assert.equal(isGuest({ username: 'anonymous', isGuest: false }), false);
  assert.equal(isGuest({ username: 'alexis', isGuest: false }), false);
});

test('a session stored before the flag existed is a guest when named anonymous', () => {
  assert.equal(isGuest({ username: 'anonymous' }), true);
});

test('a session stored before the flag existed is an account under any other name', () => {
  assert.equal(isGuest({ username: 'alexis' }), false);
  assert.equal(isGuest({}), false);
});
