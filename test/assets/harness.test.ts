import { test } from 'node:test'
import assert from 'node:assert/strict'
import { theme } from '../../tools/assets/themes/goblin-treasure.ts'
import { FOOD_TYPES } from '../../tools/assets/theme.ts'
import { buildPrompt, buildSheetPrompt } from '../../tools/assets/prompt.ts'
import { resolveSlots, renderContactSheet } from '../../tools/assets/candidates.ts'

test('prompt is the description plus the stated background, with no style words', () => {
  assert.equal(buildPrompt(theme, 'banana'), `${theme.food.banana}, on a plain white background`)
  const dark = { ...theme, background: 'flat magenta' }
  assert.equal(buildPrompt(dark, 'banana'), `${theme.food.banana}, on a flat magenta background`)
})

test('goblin theme covers every food type and uses Retro Diffusion mc_item', () => {
  assert.deepEqual(Object.keys(theme.food).sort(), [...FOOD_TYPES].sort())
  assert.deepEqual(theme.provider, { kind: 'retro-diffusion', style: 'rd_fast__mc_item' })
})

test('resolveSlots accepts repeats, comma lists, dedupes, and defaults to all', () => {
  assert.deepEqual(resolveSlots([]), FOOD_TYPES)
  assert.deepEqual(resolveSlots(['banana', 'cherry,banana']), ['banana', 'cherry'])
  assert.throws(() => resolveSlots(['nope']), /Unknown food type "nope"/)
})

test('contact sheet labels each candidate and links raw renders', () => {
  const html = renderContactSheet('t', [{ slot: 'banana', index: 2 }, { slot: 'banana', index: 1 }])
  assert.match(html, /banana #1/)
  assert.match(html, /src="food\/banana-2\.png" width="32"/)
  assert.match(html, /src="food\/banana-2\.png" width="128"/)
  assert.match(html, /href="raw\/banana-2\.png"/)
  assert.ok(html.indexOf('banana #1') < html.indexOf('banana #2'))
  assert.doesNotMatch(html, /cherry/)
})

test('sheet prompt names every food item on the flat background with no shadows or text', () => {
  const prompt = buildSheetPrompt(theme)
  for (const slot of FOOD_TYPES) assert.ok(prompt.includes(theme.food[slot]))
  assert.match(prompt, /flat plain white background/)
  assert.match(prompt, /no shadows, no text/)
})

test('contact sheet lists numbered sheet candidates', () => {
  const html = renderContactSheet('t', [], [2, 1])
  assert.match(html, /sheet #1/)
  assert.match(html, /src="food\/sheet-2\.png" width="128"/)
  assert.match(html, /href="raw\/sheet-2\.png"/)
  assert.ok(html.indexOf('sheet #1') < html.indexOf('sheet #2'))
})
