import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTokenRefusal, lobbyRatingText, matchedWithText, ratingChangeText, ratingLines, searchingText, type RatingChange } from '../src/ranked.ts';
import { rankedRoomEntry } from '../src/matchmaking.ts';

const change = (over: Partial<RatingChange> = {}): RatingChange => ({
  accountId: 'me', ratingBefore: 1532, ratingAfter: 1548, rankedMatches: 9, provisional: false, ...over,
});

test('a Ranked match joins the ranked room with the session token', () => {
  assert.deepEqual(rankedRoomEntry('tok'), { room: 'ranked', method: 'joinOrCreate', options: { token: 'tok' } });
});

test('the search shows minutes and zero-padded seconds', () => {
  assert.equal(searchingText(0), 'Searching for opponent… 0:00');
  assert.equal(searchingText(7999), 'Searching for opponent… 0:07');
  assert.equal(searchingText(75_000), 'Searching for opponent… 1:15');
  assert.equal(searchingText(-5), 'Searching for opponent… 0:00');
});

test('the rating change shows both ratings and a signed difference', () => {
  assert.equal(ratingChangeText(change()), '1532 → 1548 (+16)');
  assert.equal(ratingChangeText(change({ ratingAfter: 1500 })), '1532 → 1500 (-32)');
  assert.equal(ratingChangeText(change({ ratingAfter: 1532 })), '1532 → 1532 (+0)');
});

test('the rating reads "updating" until the update arrives, or lacks the account', () => {
  assert.deepEqual(ratingLines(undefined, 'me'), ['Rating updating…']);
  assert.deepEqual(ratingLines({ players: [change({ accountId: 'other' })] }, 'me'), ['Rating updating…']);
});

test('the update picks your own change and drops it in place of "updating"', () => {
  const update = { players: [change({ accountId: 'other', ratingAfter: 1400 }), change()] };
  assert.deepEqual(ratingLines(update, 'me'), ['1532 → 1548 (+16)']);
});

test('a Provisional account also sees its progress', () => {
  assert.deepEqual(ratingLines({ players: [change({ provisional: true, rankedMatches: 2 })] }, 'me'), ['1532 → 1548 (+16)', 'Provisional (2/5)']);
});

test('only an auth refusal from the room counts as a token refusal', () => {
  assert.equal(isTokenRefusal({ code: 401 }), true);
  assert.equal(isTokenRefusal({ code: 4215 }), true);
  assert.equal(isTokenRefusal({ code: 500 }), false);
  assert.equal(isTokenRefusal(new Error('network')), false);
  assert.equal(isTokenRefusal(null), false);
});

test('a Ranked match names the other player, or says nothing until someone is matched', () => {
  assert.equal(matchedWithText([{ id: 'a', name: 'Me', isBot: false }], 'a'), undefined);
  assert.equal(matchedWithText([{ id: 'a', name: 'Me', isBot: false }, { id: 'b', name: 'Alex', isBot: false }], 'a'), 'Matched with Alex');
  assert.equal(matchedWithText([{ id: 'a', name: 'Me', isBot: false }, { id: 'b', name: 'Alex', isBot: false }], 'b'), 'Matched with Me');
});

test('a Stand-in opponent is labelled as a bot', () => {
  assert.equal(matchedWithText([{ id: 'a', name: 'Me', isBot: false }, { id: 'bot:r', name: 'Rookie', isBot: true }], 'a'), 'Matched with Rookie (bot)');
});

test('the lobby shows an Account\'s Rating, or its Provisional progress, and nothing for a Guest', () => {
  assert.equal(lobbyRatingText({ rating: 1532.4, rankedMatches: 9, provisional: false }), 'Rating 1532');
  assert.equal(lobbyRatingText({ rating: 1500, rankedMatches: 2, provisional: true }), 'Provisional (2/5)');
  assert.equal(lobbyRatingText(undefined), '');
});
