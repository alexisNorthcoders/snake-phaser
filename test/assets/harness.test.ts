import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { theme } from '../../tools/assets/themes/goblin-treasure.ts'
import { resolveSlot, FOOD_TYPES } from '../../tools/assets/theme.ts'
import { buildPrompt } from '../../tools/assets/prompt.ts'
import { generateImage } from '../../tools/assets/deepinfra.ts'
import { processSprite } from '../../tools/assets/postprocess.ts'
import { resolveSlots, renderContactSheet } from '../../tools/assets/candidates.ts'

test('prompt combines item, style and key colour background', () => {
  const p = buildPrompt(theme, resolveSlot(theme, 'redApple'))
  assert.match(p, /tarnished copper coin/)
  assert.match(p, new RegExp(theme.style))
  assert.match(p, /single centred object on flat #ff00ff background/)
})

test('a slot key colour overrides the theme default', () => {
  assert.equal(resolveSlot(theme, 'cherry').keyColour, '#00ff00')
  assert.equal(resolveSlot(theme, 'banana').keyColour, '#ff00ff')
})

test('goblin theme covers every food type', () => {
  assert.deepEqual(Object.keys(theme.food).sort(), [...FOOD_TYPES].sort())
})

test('image client sends model + bearer key and decodes b64', async () => {
  let seen: any
  const fetchFn = (async (url: string, init: any) => {
    seen = { url, init }
    return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('png').toString('base64') }] }))
  }) as typeof fetch
  const out = await generateImage({ prompt: 'x', model: 'm' }, { apiKey: 'k', fetchFn })
  assert.equal(out.toString(), 'png')
  assert.equal(seen.init.headers.Authorization, 'Bearer k')
  const body = JSON.parse(seen.init.body)
  assert.equal(body.model, 'm')
  assert.equal('negative_prompt' in body || 'seed' in body, false)
})

test('image client fails clearly without a key or on non-OK', async () => {
  await assert.rejects(generateImage({ prompt: 'x', model: 'm' }, { apiKey: undefined }), /DEEPINFRA_API_KEY is not set/)
  const fetchFn = (async () => new Response(JSON.stringify({ error: { message: 'bad' } }), { status: 401 })) as typeof fetch
  await assert.rejects(generateImage({ prompt: 'x', model: 'm' }, { apiKey: 'k', fetchFn }), /HTTP 401.*bad/)
})

test('post-process removes key colour and resizes to 32x32', async () => {
  const raw = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#ff00ff' } })
    .composite([{ input: { create: { width: 32, height: 32, channels: 3, background: '#ff0000' } }, left: 16, top: 16 }])
    .png().toBuffer()
  const out = await processSprite(raw, { keyColour: '#ff00ff', size: 32 })
  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true })
  assert.equal(info.width, 32)
  assert.equal(info.height, 32)
  assert.equal(data[3], 0)
  const mid = (16 * 32 + 16) * 4
  assert.equal(data[mid + 3], 255)
  assert.equal(data[mid], 255)
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
