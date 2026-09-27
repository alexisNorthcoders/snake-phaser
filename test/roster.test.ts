import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBotChoiceStore, loadRoster, methodLabel, personalityLabel, ROOKIE, type RosterFetch } from '../src/roster.ts';

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) { this.items.set(key, value); }
}

const throwingStorage = {
  getItem(): string | null { throw new Error('blocked'); },
  setItem(): void { throw new Error('blocked'); },
};

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const rookie = { id: 'rookie', name: 'Rookie', generation: 0, method: 'scripted', kind: 'scripted' };
const dummy = { id: 'dummy', name: 'Dummy', generation: 0, method: 'hand-made', kind: 'brain', encoderVersion: 1, rulesVersion: 2 };
const hunter = { id: 'hunter-7', name: 'Fang', personality: 'hunter', generation: 7, method: 'neuroevolution', kind: 'brain', encoderVersion: 1, rulesVersion: 2 };

test('the roster is fetched same-origin from the colyseus proxy', async () => {
  const urls: string[] = [];
  await loadRoster(async (url) => {
    urls.push(String(url));
    return json(200, [rookie]);
  });
  assert.deepEqual(urls, ['/colyseus/roster']);
});

test('a good response gives its entries, in order, with the fields the picker shows', async () => {
  const entries = await loadRoster(async () => json(200, [rookie, dummy, hunter]));
  assert.deepEqual(entries, [
    { id: 'rookie', name: 'Rookie', generation: 0, method: 'scripted', kind: 'scripted' },
    { id: 'dummy', name: 'Dummy', generation: 0, method: 'hand-made', kind: 'brain' },
    { id: 'hunter-7', name: 'Fang', personality: 'hunter', generation: 7, method: 'neuroevolution', kind: 'brain' },
  ]);
});

test('a failed or malformed response gives only the rookie', async () => {
  const failures: RosterFetch[] = [
    async () => { throw new TypeError('Failed to fetch'); },
    async () => json(502, [rookie, dummy]),
    async () => json(404, { error: 'nope' }),
    async () => new Response('<html>Cannot GET /roster</html>', { status: 200 }),
    async () => json(200, { entries: [rookie, dummy] }),
    async () => json(200, null),
    async () => json(200, []),
  ];
  for (const failing of failures) {
    assert.deepEqual(await loadRoster(failing), [ROOKIE]);
  }
});

test('entries that cannot be read are dropped and the rest are shown', async () => {
  const entries = await loadRoster(async () => json(200, [
    rookie,
    null,
    'dummy',
    { ...dummy, id: '' },
    { ...dummy, name: 42 },
    { ...dummy, generation: -1 },
    { ...dummy, generation: 1.5 },
    { ...dummy, method: undefined },
    { ...dummy, kind: undefined },
    { ...hunter, personality: 3 },
    { ...rookie, name: 'Rookie again' },
    dummy,
  ]));
  assert.deepEqual(entries.map((entry) => entry.id), ['rookie', 'dummy']);
});

test('a roster whose every entry is unreadable gives only the rookie', async () => {
  assert.deepEqual(await loadRoster(async () => json(200, [{ id: 7 }, 'x'])), [ROOKIE]);
});

test('methods and personalities are shown in plain words', () => {
  assert.equal(methodLabel('scripted'), 'Scripted');
  assert.equal(methodLabel('hand-made'), 'Hand-made');
  assert.equal(methodLabel('neuroevolution'), 'Neuroevolution');
  assert.equal(methodLabel('ppo'), 'PPO');
  assert.equal(methodLabel('self-play'), 'Self-play');
  assert.equal(personalityLabel('glutton'), 'Glutton');
  assert.equal(personalityLabel('survivor'), 'Survivor');
});

test('a first-time player is matched against the rookie', () => {
  assert.equal(createBotChoiceStore(new MemoryStorage()).load(), 'rookie');
});

test('the chosen opponent survives a reload', () => {
  const storage = new MemoryStorage();
  createBotChoiceStore(storage).save('dummy');
  assert.equal(createBotChoiceStore(storage).load(), 'dummy');
  createBotChoiceStore(storage).save('rookie');
  assert.equal(createBotChoiceStore(storage).load(), 'rookie');
});

test('an unreadable stored choice falls back to the rookie', () => {
  for (const bad of ['', '   ', 'not a slug!', 'x'.repeat(200)]) {
    const storage = new MemoryStorage();
    storage.setItem('botId', bad);
    assert.equal(createBotChoiceStore(storage).load(), 'rookie', JSON.stringify(bad));
  }
});

test('the choice works without storage, or with storage that throws', () => {
  for (const storage of [undefined, throwingStorage]) {
    const store = createBotChoiceStore(storage);
    assert.equal(store.load(), 'rookie');
    assert.doesNotThrow(() => store.save('dummy'));
  }
});
