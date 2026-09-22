import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFeatureSettings } from '../src/featureSettings.ts';

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) { this.items.set(key, value); }
}

const quietLog = () => {
  const lines: string[] = [];
  return { lines, log: (...a: unknown[]) => lines.push(a.join(' ')), warn: (...a: unknown[]) => lines.push(a.join(' ')) };
};

test('with nothing stored, the snake is drawn as blocks at width 0.8 and the head follows the curve', () => {
  const feature = createFeatureSettings(new MemoryStorage(), quietLog());

  assert.equal(feature.snakeBody, 'blocks');
  assert.equal(feature.snakeBodyWidth, 0.8);
  assert.equal(feature.snakeHeadFollowsArc, true);
});

test('assigned settings survive a reload', () => {
  const storage = new MemoryStorage();
  const feature = createFeatureSettings(storage, quietLog());
  feature.snakeBody = 'joints';
  feature.snakeBodyWidth = 1;
  feature.snakeHeadFollowsArc = false;

  const reloaded = createFeatureSettings(storage, quietLog());
  assert.equal(reloaded.snakeBody, 'joints');
  assert.equal(reloaded.snakeBodyWidth, 1);
  assert.equal(reloaded.snakeHeadFollowsArc, false);
});

test('a non-boolean snakeHeadFollowsArc warns and resets to true', () => {
  const out = quietLog();
  const feature = createFeatureSettings(new MemoryStorage(), out);
  feature.snakeHeadFollowsArc = false;
  feature.snakeHeadFollowsArc = 'yes' as never;

  assert.equal(feature.snakeHeadFollowsArc, true);
  assert.match(out.lines.join('\n'), /snakeHeadFollowsArc/);
});

test('an unknown body style warns and resets to blocks', () => {
  const out = quietLog();
  const feature = createFeatureSettings(new MemoryStorage(), out);
  feature.snakeBody = 'joints';
  feature.snakeBody = 'noodles' as never;

  assert.equal(feature.snakeBody, 'blocks');
  assert.match(out.lines.join('\n'), /noodles/);
});

test('a width outside 0.5–1 warns and is clamped; a non-number warns and resets to 0.8', () => {
  const out = quietLog();
  const feature = createFeatureSettings(new MemoryStorage(), out);

  feature.snakeBodyWidth = 3;
  assert.equal(feature.snakeBodyWidth, 1);
  feature.snakeBodyWidth = 0.1;
  assert.equal(feature.snakeBodyWidth, 0.5);
  feature.snakeBodyWidth = 'wide' as never;
  assert.equal(feature.snakeBodyWidth, 0.8);
  assert.equal(out.lines.length, 3);
});

test('garbage in storage falls back to the defaults', () => {
  const storage = new MemoryStorage();
  storage.setItem('feature', JSON.stringify({ snakeBody: 'noodles', snakeBodyWidth: 9 }));
  const feature = createFeatureSettings(storage, quietLog());
  assert.equal(feature.snakeBody, 'blocks');
  assert.equal(feature.snakeBodyWidth, 1);

  storage.setItem('feature', '{not json');
  const again = createFeatureSettings(storage, quietLog());
  assert.equal(again.snakeBody, 'blocks');
  assert.equal(again.snakeBodyWidth, 0.8);
});

test('a throwing or missing localStorage leaves the settings working for this session', () => {
  const throwing = {
    getItem(): string | null { throw new Error('SecurityError'); },
    setItem(): void { throw new Error('QuotaExceededError'); },
  };

  for (const storage of [throwing, undefined]) {
    const feature = createFeatureSettings(storage, quietLog());
    assert.equal(feature.snakeBody, 'blocks');
    feature.snakeBody = 'joints';
    assert.equal(feature.snakeBody, 'joints');
  }
});

test('list() prints every setting with its current value and the values it accepts', () => {
  const out = quietLog();
  const feature = createFeatureSettings(new MemoryStorage(), out);
  feature.snakeBodyWidth = 0.6;
  out.lines.length = 0;

  feature.list();
  const printed = out.lines.join('\n');
  assert.match(printed, /feature\.snakeBody = 'blocks'.*'blocks' \| 'joints' \| 'arcs'/);
  assert.match(printed, /feature\.snakeBodyWidth = 0\.6.*0\.5–1/);
  assert.match(printed, /feature\.snakeHeadFollowsArc = true.*true \| false/);
});

test('creating the settings prints nothing', () => {
  const storage = new MemoryStorage();
  storage.setItem('feature', JSON.stringify({ snakeBody: 'joints' }));
  const out = quietLog();
  createFeatureSettings(storage, out);

  assert.equal(out.lines.length, 0);
});

test('showFps defaults to false, persists, and a non-boolean warns and resets to false', () => {
  const storage = new MemoryStorage();
  const out = quietLog();
  const feature = createFeatureSettings(storage, out);
  assert.equal(feature.showFps, false);

  feature.showFps = true;
  assert.equal(createFeatureSettings(storage, quietLog()).showFps, true);

  feature.showFps = 'yes' as never;
  assert.equal(feature.showFps, false);
  assert.match(out.lines.join('\n'), /showFps/);

  storage.setItem('feature', JSON.stringify({ showFps: 1 }));
  assert.equal(createFeatureSettings(storage, quietLog()).showFps, false);
});

test('list() shows showFps', () => {
  const out = quietLog();
  createFeatureSettings(new MemoryStorage(), out).list();
  assert.match(out.lines.join('\n'), /feature\.showFps = false.*true \| false/);
});

test('lobbyAmbience defaults to true, persists, and a non-boolean warns and resets to true', () => {
  const storage = new MemoryStorage();
  const out = quietLog();
  const feature = createFeatureSettings(storage, out);
  assert.equal(feature.lobbyAmbience, true);

  feature.lobbyAmbience = false;
  assert.equal(createFeatureSettings(storage, quietLog()).lobbyAmbience, false);

  feature.lobbyAmbience = 'no' as never;
  assert.equal(feature.lobbyAmbience, true);
  assert.match(out.lines.join('\n'), /lobbyAmbience/);

  storage.setItem('feature', JSON.stringify({ lobbyAmbience: 0 }));
  assert.equal(createFeatureSettings(storage, quietLog()).lobbyAmbience, true);
});

test('list() shows lobbyAmbience', () => {
  const out = quietLog();
  createFeatureSettings(new MemoryStorage(), out).list();
  assert.match(out.lines.join('\n'), /feature\.lobbyAmbience = true.*true \| false/);
});

test('assetTheme defaults to goblin-treasure, persists, and an unknown value warns and falls back to goblin-treasure', () => {
  const storage = new MemoryStorage();
  const out = quietLog();
  const feature = createFeatureSettings(storage, out);
  assert.equal(feature.assetTheme, 'goblin-treasure');

  feature.assetTheme = 'classic';
  assert.equal(createFeatureSettings(storage, quietLog()).assetTheme, 'classic');

  feature.assetTheme = 'neon' as never;
  assert.equal(feature.assetTheme, 'goblin-treasure');
  assert.match(out.lines.join('\n'), /assetTheme.*neon/);

  storage.setItem('feature', JSON.stringify({ assetTheme: 3 }));
  assert.equal(createFeatureSettings(storage, quietLog()).assetTheme, 'goblin-treasure');
});

test('list() shows assetTheme with its allowed values', () => {
  const out = quietLog();
  createFeatureSettings(new MemoryStorage(), out).list();
  assert.match(out.lines.join('\n'), /feature\.assetTheme = 'goblin-treasure'.*'classic' \| 'goblin-treasure'/);
});

test('vsBot is off by default, survives a reload, and a non-boolean warns and resets to off', () => {
  const storage = new MemoryStorage();
  const out = quietLog();
  const feature = createFeatureSettings(storage, out);
  assert.equal(feature.vsBot, false);

  feature.vsBot = true;
  assert.equal(createFeatureSettings(storage, quietLog()).vsBot, true);

  feature.vsBot = 'yes' as never;
  assert.equal(feature.vsBot, false);
  assert.match(out.lines.join('\n'), /vsBot/);
});

test('botReactionTicks defaults to 2, persists, clamps to 0–4 with a warning, and rejects non-integers', () => {
  const storage = new MemoryStorage();
  const out = quietLog();
  const feature = createFeatureSettings(storage, out);
  assert.equal(feature.botReactionTicks, 2);

  feature.botReactionTicks = 3;
  assert.equal(createFeatureSettings(storage, quietLog()).botReactionTicks, 3);

  feature.botReactionTicks = 9;
  assert.equal(feature.botReactionTicks, 4);
  feature.botReactionTicks = -1;
  assert.equal(feature.botReactionTicks, 0);
  assert.match(out.lines.join('\n'), /botReactionTicks.*clamped/);

  feature.botReactionTicks = 1.5;
  assert.equal(feature.botReactionTicks, 2);
  feature.botReactionTicks = 'fast' as never;
  assert.equal(feature.botReactionTicks, 2);

  storage.setItem('feature', JSON.stringify({ botReactionTicks: 'x' }));
  assert.equal(createFeatureSettings(storage, quietLog()).botReactionTicks, 2);
});

test('list() shows botReactionTicks', () => {
  const out = quietLog();
  createFeatureSettings(new MemoryStorage(), out).list();
  assert.match(out.lines.join('\n'), /feature\.botReactionTicks = 2.*0–4/);
});

test('gameSpeed defaults to 8, persists, clamps to 4–15 with a warning, and rejects non-integers', () => {
  const storage = new MemoryStorage();
  const out = quietLog();
  const feature = createFeatureSettings(storage, out);
  assert.equal(feature.gameSpeed, 8);

  feature.gameSpeed = 6;
  assert.equal(createFeatureSettings(storage, quietLog()).gameSpeed, 6);

  feature.gameSpeed = 20;
  assert.equal(feature.gameSpeed, 15);
  feature.gameSpeed = 1;
  assert.equal(feature.gameSpeed, 4);
  assert.match(out.lines.join('\n'), /gameSpeed.*clamped/);

  feature.gameSpeed = 7.5;
  assert.equal(feature.gameSpeed, 8);
  feature.gameSpeed = 'fast' as never;
  assert.equal(feature.gameSpeed, 8);

  storage.setItem('feature', JSON.stringify({ gameSpeed: 'x' }));
  assert.equal(createFeatureSettings(storage, quietLog()).gameSpeed, 8);
});

test('list() shows gameSpeed', () => {
  const out = quietLog();
  createFeatureSettings(new MemoryStorage(), out).list();
  assert.match(out.lines.join('\n'), /feature\.gameSpeed = 8.*4–15/);
});
