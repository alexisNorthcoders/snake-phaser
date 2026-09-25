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
  // Your entry is neither first nor last, and every score differs, so a wrong pick shows.
  const shuffled = [
    { id: 'rival', score: 30 },
    { id: 'me', score: 12 },
    { id: 'bot', score: 7 },
  ];
  for (const [sessionId, score] of [['rival', 30], ['me', 12], ['bot', 7]] as const) {
    const { calls, sink } = recordingSink();
    await saveRoundScore({ rankings: shuffled }, sessionId, false, sink);
    assert.deepEqual(calls, [`user ${score}`]);
  }
  const { calls, sink } = recordingSink();
  await saveRoundScore({ rankings: shuffled }, 'me', true, sink);
  assert.deepEqual(calls.sort(), ['anonymous 12', 'local 12']);
});

test('a failed post is logged, never rejected', async () => {
  const warn = console.warn;
  const warnings: unknown[] = [];
  console.warn = (...args) => { warnings.push(args); };
  try {
    const failing: RoundScoreSink = {
      postUserScore: async () => { throw new Error('offline'); },
      postAnonymousScore: async () => { throw new Error('offline'); },
      saveLocalScore: () => {},
    };
    for (const guest of [false, true]) {
      await saveRoundScore({ rankings }, 'me', guest, failing);
    }
    assert.equal(warnings.length, 2);
  } finally {
    console.warn = warn;
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
