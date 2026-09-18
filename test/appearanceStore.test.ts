import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccountAppearanceStore, createAppearanceStore, PALETTE } from '../src/appearanceStore.ts';

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) { this.items.set(key, value); }
}

const throwingStorage = {
  getItem(): string | null { throw new Error('blocked'); },
  setItem(): void { throw new Error('blocked'); },
};

const inPalette = (color: string) => PALETTE.includes(color);

test('the palette is 12 distinct #rrggbb colours', () => {
  assert.equal(PALETTE.length, 12);
  assert.equal(new Set(PALETTE).size, 12);
  PALETTE.forEach((color) => assert.match(color, /^#[0-9a-f]{6}$/));
});

test('a first-time player gets random colours from the palette', () => {
  const store = createAppearanceStore(new MemoryStorage());
  const colours = store.load();

  assert.ok(inPalette(colours.head));
  assert.ok(inPalette(colours.body));
  assert.ok(inPalette(colours.eyes));
});

test('random picks use the injected random source', () => {
  const store = createAppearanceStore(new MemoryStorage(), () => 0);

  assert.deepEqual(store.load(), { head: PALETTE[0], body: PALETTE[0], eyes: PALETTE[0] });
});

test('a first-time player keeps the same colours across reloads', () => {
  const storage = new MemoryStorage();
  const first = createAppearanceStore(storage).load();

  assert.deepEqual(createAppearanceStore(storage).load(), first);
});

test('saved colours survive a reload', () => {
  const storage = new MemoryStorage();
  const colours = { head: PALETTE[1], body: PALETTE[2], eyes: PALETTE[3] };
  createAppearanceStore(storage).save(colours);

  assert.deepEqual(createAppearanceStore(storage).load(), colours);
});

test('corrupt stored data falls back to random palette colours', () => {
  const storage = new MemoryStorage();
  storage.setItem('appearance', '{not json');

  assert.ok(inPalette(createAppearanceStore(storage).load().head));
});

test('a stored part that is not a #rrggbb colour is replaced, the others are kept', () => {
  const storage = new MemoryStorage();
  storage.setItem('appearance', JSON.stringify({ head: 'red', body: PALETTE[4], eyes: 42 }));
  const colours = createAppearanceStore(storage).load();

  assert.ok(inPalette(colours.head));
  assert.equal(colours.body, PALETTE[4]);
  assert.ok(inPalette(colours.eyes));
});

test('works without storage, with random palette colours', () => {
  const store = createAppearanceStore(undefined);
  const colours = store.load();

  assert.ok(inPalette(colours.head));
  assert.doesNotThrow(() => store.save(colours));
});

test('storage that throws never breaks loading or saving', () => {
  const store = createAppearanceStore(throwingStorage);

  assert.ok(inPalette(store.load().body));
  assert.doesNotThrow(() => store.save({ head: PALETTE[0], body: PALETTE[1], eyes: PALETTE[2] }));
});

const json = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const quietly = async <T>(run: () => Promise<T>): Promise<T> => {
  const warn = console.warn;
  console.warn = () => {};
  try { return await run(); } finally { console.warn = warn; }
};

test('an account read returns the saved colours, sending the token', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const store = createAccountAppearanceStore({
    token: 'abc',
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return json(200, { head: '#e63946', body: '#1d3557', eyes: '#ffffff' });
    },
  });

  assert.deepEqual(await store.load(), { head: '#e63946', body: '#1d3557', eyes: '#ffffff' });
  assert.equal(calls[0].url, '/api/appearance');
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer abc');
});

test('an account with nothing saved (404) gets random palette colours', async () => {
  const store = createAccountAppearanceStore({ token: 't', fetch: async () => json(404) });
  const colours = await store.load();
  assert.ok(inPalette(colours.head) && inPalette(colours.body) && inPalette(colours.eyes));
});

test('a failed read falls back to random palette colours', async () => {
  const failures: typeof fetch[] = [
    async () => { throw new Error('offline'); },
    async () => json(500),
    async () => json(200, 'not an object'),
  ];
  for (const failing of failures) {
    const store = createAccountAppearanceStore({ token: 't', fetch: failing });
    const colours = await quietly(() => store.load());
    assert.ok(inPalette(colours.head) && inPalette(colours.body) && inPalette(colours.eyes));
  }
});

test('an account read replaces an invalid part with a random palette colour', async () => {
  const store = createAccountAppearanceStore({
    token: 't',
    fetch: async () => json(200, { head: '#e63946', body: 'red' }),
  });
  const colours = await store.load();
  assert.equal(colours.head, '#e63946');
  assert.ok(inPalette(colours.body) && inPalette(colours.eyes));
});

test('rapid account saves produce a single PUT with the last colours', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const puts: { url: string; init?: RequestInit }[] = [];
  const store = createAccountAppearanceStore({
    token: 'abc',
    fetch: async (url, init) => { puts.push({ url: String(url), init }); return json(200); },
  });

  store.save({ head: '#e63946', body: '#e63946', eyes: '#e63946' });
  t.mock.timers.tick(300);
  store.save({ head: '#f4831f', body: '#e63946', eyes: '#e63946' });
  t.mock.timers.tick(300);
  store.save({ head: '#2a9d3f', body: '#1d3557', eyes: '#ffffff' });
  assert.equal(puts.length, 0);
  t.mock.timers.tick(500);

  assert.equal(puts.length, 1);
  assert.equal(puts[0].init?.method, 'PUT');
  assert.deepEqual(JSON.parse(String(puts[0].init?.body)), { head: '#2a9d3f', body: '#1d3557', eyes: '#ffffff' });
});

test('a failed account save is logged, not retried, and does not throw', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let attempts = 0;
  const store = createAccountAppearanceStore({
    token: 't',
    fetch: async () => { attempts++; throw new Error('offline'); },
  });

  await quietly(async () => {
    store.save({ head: '#e63946', body: '#e63946', eyes: '#e63946' });
    t.mock.timers.tick(500);
    await Promise.resolve();
    t.mock.timers.tick(5000);
  });
  assert.equal(attempts, 1);
});
