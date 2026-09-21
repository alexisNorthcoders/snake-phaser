import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGuestSession, restoreSession } from '../src/session.ts';

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) { this.items.set(key, value); }
  removeItem(key: string) { this.items.delete(key); }
}

const throwingStorage = {
  getItem(): string | null { throw new Error('blocked'); },
  setItem(): void { throw new Error('blocked'); },
  removeItem(): void { throw new Error('blocked'); },
};

const json = (body: unknown, ok = true) => async () => ({ ok, json: async () => body }) as Response;
const validToken = json({ message: 'Token is valid', user: { username: 'bob' }, userId: 7, expiresIn: 60 });

function stored(user: object) {
  const storage = new MemoryStorage();
  storage.setItem('userData', JSON.stringify(user));
  return storage;
}

test('a valid stored token returns the refreshed session and stores it', async () => {
  const storage = stored({ token: 't', username: 'old', isGuest: false });
  const user = await restoreSession({ fetch: validToken as typeof fetch, storage });
  assert.deepEqual(user, { token: 't', username: 'bob', userId: 7, expiresIn: 60, isGuest: false });
  assert.deepEqual(JSON.parse(storage.getItem('userData')!), user);
});

test('no stored session returns undefined without calling the server', async () => {
  const fetch = async () => { throw new Error('should not be called'); };
  assert.equal(await restoreSession({ fetch: fetch as typeof globalThis.fetch, storage: new MemoryStorage() }), undefined);
});

test('an invalid token returns undefined and clears the stored session', async () => {
  const storage = stored({ token: 't' });
  assert.equal(await restoreSession({ fetch: json({}, false) as typeof fetch, storage }), undefined);
  assert.equal(storage.getItem('userData'), null);
});

test('a rejected fetch returns undefined and clears the stored session', async () => {
  const storage = stored({ token: 't' });
  const fetch = async () => { throw new Error('server down'); };
  assert.equal(await restoreSession({ fetch: fetch as typeof globalThis.fetch, storage }), undefined);
  assert.equal(storage.getItem('userData'), null);
});

test('a stored guest session that verifies stays a guest', async () => {
  const storage = stored({ token: 't', username: 'anonymous', isGuest: true });
  const user = await restoreSession({ fetch: validToken as typeof fetch, storage });
  assert.equal(user?.isGuest, true);
});

test('guest creation stores a guest session', async () => {
  const storage = new MemoryStorage();
  const calls: string[] = [];
  const fetch = async (url: string) => { calls.push(url); return json({ accessToken: 'g', userId: 3 })(); };
  const user = await createGuestSession({ fetch: fetch as typeof globalThis.fetch, storage });
  assert.deepEqual(user, { token: 'g', username: 'anonymous', userId: 3, isGuest: true });
  assert.deepEqual(JSON.parse(storage.getItem('userData')!), user);
  assert.deepEqual(calls, ['/api/anonymous']);
});

test('a failed guest login returns undefined', async () => {
  assert.equal(await createGuestSession({ fetch: json({}, false) as typeof fetch, storage: new MemoryStorage() }), undefined);
});

test('storage that throws does not crash either function', async () => {
  assert.equal(await restoreSession({ fetch: validToken as typeof fetch, storage: throwingStorage }), undefined);
  const user = await createGuestSession({ fetch: json({ accessToken: 'g', userId: 3 }) as typeof fetch, storage: throwingStorage });
  assert.equal(user?.isGuest, true);
});

test('missing storage is tolerated', async () => {
  assert.equal(await restoreSession({ fetch: validToken as typeof fetch, storage: undefined }), undefined);
});
