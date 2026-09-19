import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPixelFixer, PIXEL_FIXER_URL } from '../../tools/assets/pixelFixer.ts'

const png = Buffer.from('input')
const ok = () => new Response(JSON.stringify({ base64_images: [Buffer.from('fixed').toString('base64')] }), { status: 200 })

function setup(responses: Array<() => Response>) {
  let clock = 0
  const calls: Array<{ url: string; init: any }> = []
  const sleeps: number[] = []
  const fetchFn = (async (url: string, init: any) => {
    calls.push({ url, init })
    const next = responses.shift()
    if (!next) throw new Error('unexpected extra request')
    return next()
  }) as typeof fetch
  const sleep = async (ms: number) => { sleeps.push(ms); clock += ms }
  return { calls, sleeps, options: { apiKey: 'rdpk', fetchFn, sleep, now: () => clock } }
}

test('posts the image with the token and returns the decoded result', async () => {
  const { calls, options } = setup([ok])
  assert.deepEqual(await createPixelFixer(options)(png, 32), Buffer.from('fixed'))
  assert.equal(calls[0].url, PIXEL_FIXER_URL)
  assert.equal(calls[0].init.headers['X-RD-Token'], 'rdpk')
  assert.deepEqual(JSON.parse(calls[0].init.body), { input_image: png.toString('base64'), width: 32, height: 32 })
})

test('consecutive calls are spaced to stay under 10 a minute', async () => {
  const { sleeps, options } = setup([ok, ok, ok])
  const fix = createPixelFixer(options)
  for (let i = 0; i < 3; i++) await fix(png, 32)
  assert.equal(sleeps.length, 2)
  assert.ok(sleeps.every((ms) => ms >= 6000))
})

test('retries after a 429, honouring Retry-After', async () => {
  const limited = () => new Response('{}', { status: 429, headers: { 'retry-after': '20' } })
  const { calls, sleeps, options } = setup([limited, ok])
  await createPixelFixer(options)(png, 32)
  assert.equal(calls.length, 2)
  assert.ok(sleeps.includes(20000))
})

test('gives up with a clear error when still rate limited', async () => {
  const limited = () => new Response('{}', { status: 429 })
  const { options } = setup(Array(5).fill(limited))
  await assert.rejects(createPixelFixer(options)(png, 32), /rate limited \(HTTP 429\)/)
})

test('a missing key is reported before any request', async () => {
  const { calls, options } = setup([ok])
  await assert.rejects(createPixelFixer({ ...options, apiKey: undefined })(png, 32), /RETRO_DIFFUSION_API_KEY is not set/)
  assert.equal(calls.length, 0)
})

test('API errors and missing images are reported clearly', async () => {
  const bad = () => new Response(JSON.stringify({ error: { message: 'bad image' } }), { status: 400 })
  await assert.rejects(createPixelFixer(setup([bad]).options)(png, 32), /HTTP 400.*bad image/)
  const empty = () => new Response('{}', { status: 200 })
  await assert.rejects(createPixelFixer(setup([empty]).options)(png, 32), /no base64_images/)
})

test('an oversized input is refused before sending', async () => {
  const { calls, options } = setup([ok])
  await assert.rejects(createPixelFixer(options)(Buffer.alloc(800_000), 32), /limit/)
  assert.equal(calls.length, 0)
})
