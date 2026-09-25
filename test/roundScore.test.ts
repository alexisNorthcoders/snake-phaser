import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveRoundScore, type RoundScoreSink } from '../src/roundScore.ts';

function recordingSink() {
  const calls: string[] = [];
  const sink: RoundScoreSink = {
    postUserScore: async (score) => { calls.push(`user ${score}`); },
    postAnonymousScore: async (score) => { calls.push(`anonymous ${score}`); },
    saveLocalScore: (score) => { calls.push(`local ${score}`); },
  };
  return { calls, sink };
}

const rankings = [
  { id: 'me', score: 12 },
  { id: 'rival', score: 30 },
  { id: 'bot', score: 7 },
];
const won = { rankings, winnerId: 'me' };
const lost = { rankings, winnerId: 'rival' };

test('a logged-in player who won posts their own score once, to their account', async () => {
  const { calls, sink } = recordingSink();
  await saveRoundScore(won, 'me', false, sink);
  assert.deepEqual(calls, ['user 12']);
});

test('a logged-in player who died posts their own score once, to their account', async () => {
  const { calls, sink } = recordingSink();
  await saveRoundScore(lost, 'me', false, sink);
  assert.deepEqual(calls, ['user 12']);
});

test("a guest posts their own score once, anonymously, and saves it in the local scores", async () => {
  const { calls, sink } = recordingSink();
  await saveRoundScore({ rankings }, 'me', true, sink);
  assert.deepEqual(calls.sort(), ['anonymous 12', 'local 12']);
});

test("other snakes' scores are never posted", async () => {
  for (const guest of [false, true]) {
    const { calls, sink } = recordingSink();
    await saveRoundScore({ rankings }, 'me', guest, sink);
    assert.ok(calls.every((c) => c.endsWith(' 12')), calls.join(', '));
  }
});

test('a payload without your entry posts nothing', async () => {
  for (const sessionId of ['gone', undefined]) {
    for (const guest of [false, true]) {
      const { calls, sink } = recordingSink();
      await saveRoundScore({ rankings }, sessionId, guest, sink);
      assert.deepEqual(calls, []);
    }
  }
});
