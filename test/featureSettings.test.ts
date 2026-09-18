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

test('with nothing stored, the snake is drawn as blocks at width 0.8', () => {
  const feature = createFeatureSettings(new MemoryStorage(), quietLog());

  assert.equal(feature.snakeBody, 'blocks');
  assert.equal(feature.snakeBodyWidth, 0.8);
});

test('assigned settings survive a reload', () => {
  const storage = new MemoryStorage();
  const feature = createFeatureSettings(storage, quietLog());
  feature.snakeBody = 'joints';
  feature.snakeBodyWidth = 1;

  const reloaded = createFeatureSettings(storage, quietLog());
  assert.equal(reloaded.snakeBody, 'joints');
  assert.equal(reloaded.snakeBodyWidth, 1);
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
});

test('creating the settings prints nothing', () => {
  const storage = new MemoryStorage();
  storage.setItem('feature', JSON.stringify({ snakeBody: 'joints' }));
  const out = quietLog();
  createFeatureSettings(storage, out);

  assert.equal(out.lines.length, 0);
});
