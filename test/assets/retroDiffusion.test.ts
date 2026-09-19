import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { estimateCost, generateCandidates, loadPalette } from '../../tools/assets/retroDiffusion.ts'

interface Call { url: string; method: string; headers: Record<string, string>; body: any }

/** Fake fetch answering from a queue of [status, json] and recording each call. */
function fakeFetch(responses: Array<[number, unknown] | Error>) {
  const calls: Call[] = []
  const fetchFn = (async (url: string, init: any) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined })
    const next = responses.shift()
    if (!next) throw new Error('unexpected extra request')
    if (next instanceof Error) throw next
    return new Response(JSON.stringify(next[1]), { status: next[0] })
  }) as typeof fetch
  return { fetchFn, calls }
}

const req = { prompt: 'a coin, on a plain white background', style: 'rd_fast__mc_item' }
const opts = { apiKey: 'rdpk-1', sleep: async () => {}, newIdempotencyKey: () => 'key-1' }
const png = (s: string) => Buffer.from(s).toString('base64')

test('polls accepted -> running -> succeeded and returns decoded images', async () => {
  const { fetchFn, calls } = fakeFetch([
    [202, { status: 'accepted', task_id: 't1' }],
    [200, { status: 'pending', task_id: 't1' }],
    [200, { status: 'running', task_id: 't1' }],
    [200, { status: 'succeeded', task_id: 't1', result: { base64_images: [png('a'), png('b')] } }],
  ])
  const out = await generateCandidates(req, { ...opts, fetchFn })
  assert.deepEqual(out.map(String), ['a', 'b'])
  assert.equal(calls.length, 4)
  const [submit, ...polls] = calls
  assert.equal(submit.url, 'https://api.retrodiffusion.ai/v2/inferences')
  assert.equal(submit.method, 'POST')
  assert.equal(submit.headers['X-RD-Token'], 'rdpk-1')
  assert.equal(submit.headers['Idempotency-Key'], 'key-1')
  assert.deepEqual(submit.body, {
    prompt: req.prompt, prompt_style: 'rd_fast__mc_item', width: 32, height: 32, num_images: 4, remove_bg: true,
  })
  assert.ok(polls.every((c) => c.method === 'GET' && c.url.endsWith('/inferences/tasks/t1')))
})

test('a failed task surfaces its error', async () => {
  const { fetchFn } = fakeFetch([
    [202, { task_id: 't1' }],
    [200, { status: 'failed', error: { status_code: 400, detail: 'bad style' } }],
  ])
  await assert.rejects(generateCandidates(req, { ...opts, fetchFn }), /t1 failed \(400\): bad style/)
})

test('HTTP errors show status and the v2 error message', async () => {
  const { fetchFn } = fakeFetch([[402, { error: { code: 'insufficient_balance', message: 'Not enough balance.' } }]])
  await assert.rejects(generateCandidates(req, { ...opts, fetchFn }), /HTTP 402.*insufficient_balance: Not enough balance\./)
})

test('a missing key fails before any request', async () => {
  const { fetchFn, calls } = fakeFetch([])
  await assert.rejects(generateCandidates(req, { ...opts, apiKey: undefined, fetchFn }), /RETRO_DIFFUSION_API_KEY is not set/)
  await assert.rejects(estimateCost([req], { apiKey: ' ', fetchFn }), /RETRO_DIFFUSION_API_KEY is not set/)
  assert.equal(calls.length, 0)
})

test('a lost submission response recovers from the task list instead of resubmitting', async () => {
  const now = Math.floor(Date.now() / 1000)
  const { fetchFn, calls } = fakeFetch([
    new Error('fetch failed'),
    [200, { tasks: [{ task_id: 't9', status: 'running', created_at: now }] }],
    [200, { status: 'succeeded', result: { base64_images: [png('a')] } }],
  ])
  const out = await generateCandidates(req, { ...opts, fetchFn })
  assert.equal(out.length, 1)
  assert.deepEqual(calls.map((c) => c.method + ' ' + c.url.replace('https://api.retrodiffusion.ai/v2', '')), [
    'POST /inferences', 'GET /inferences/tasks?limit=20', 'GET /inferences/tasks/t9',
  ])
})

test('a lost submission with no recent task refuses to resubmit', async () => {
  const { fetchFn } = fakeFetch([new Error('fetch failed'), [200, { tasks: [] }]])
  await assert.rejects(generateCandidates(req, { ...opts, fetchFn }), /no recent task was found/)
})

test('cost check is a free dry run without an Idempotency-Key and totals every request', async () => {
  const { fetchFn, calls } = fakeFetch([
    [200, { balance_cost: 0.02, remaining_balance: 10 }],
    [200, { balance_cost: 0.03, remaining_balance: 10 }],
  ])
  const est = await estimateCost([req, req], { apiKey: 'k', fetchFn })
  assert.ok(Math.abs(est.cost - 0.05) < 1e-9)
  assert.equal(est.remainingBalance, 10)
  assert.ok(calls.every((c) => c.body.check_cost === true && !('Idempotency-Key' in c.headers)))
})

test('a 5xx on submission is an unknown outcome and recovers from the task list', async () => {
  const now = Math.floor(Date.now() / 1000)
  const { fetchFn, calls } = fakeFetch([
    [502, { detail: 'bad gateway' }],
    [200, { tasks: [{ task_id: 't7', status: 'running', created_at: now }] }],
    [200, { status: 'succeeded', result: { base64_images: [png('a')] } }],
  ])
  await generateCandidates(req, { ...opts, fetchFn })
  assert.deepEqual(calls.map((c) => c.method), ['POST', 'GET', 'GET'])
})

test('a 2xx submission without a task_id recovers instead of resubmitting', async () => {
  const { fetchFn, calls } = fakeFetch([[200, {}], [200, { tasks: [] }]])
  await assert.rejects(generateCandidates(req, { ...opts, fetchFn }), /no recent task was found/)
  assert.equal(calls.filter((c) => c.method === 'POST').length, 1)
})

test('cost check fails clearly on HTTP errors and missing balance fields', async () => {
  await assert.rejects(estimateCost([req], { apiKey: 'k', fetchFn: fakeFetch([[401, { detail: 'bad token' }]]).fetchFn }), /HTTP 401.*bad token/)
  await assert.rejects(estimateCost([req], { apiKey: 'k', fetchFn: fakeFetch([[200, { balance_cost: 0.02 }]]).fetchFn }), /no usable balance_cost/)
})

test('input_palette is sent on the cost check and the paid request when a palette is set, and omitted otherwise', async () => {
  const withPalette = { ...req, palette: 'UEFMRVRURQ==' }
  const paid = fakeFetch([[202, { task_id: 't1' }], [200, { status: 'succeeded', result: { base64_images: [png('a')] } }]])
  await generateCandidates(withPalette, { ...opts, fetchFn: paid.fetchFn })
  assert.equal(paid.calls[0].body.input_palette, 'UEFMRVRURQ==')

  const cost = fakeFetch([[200, { balance_cost: 0.02, remaining_balance: 10 }]])
  await estimateCost([withPalette], { apiKey: 'k', fetchFn: cost.fetchFn })
  assert.equal(cost.calls[0].body.input_palette, 'UEFMRVRURQ==')

  const plain = fakeFetch([[202, { task_id: 't1' }], [200, { status: 'succeeded', result: { base64_images: [png('a')] } }]])
  await generateCandidates(req, { ...opts, fetchFn: plain.fetchFn })
  assert.ok(!('input_palette' in plain.calls[0].body))
})

test('loadPalette returns raw base64 without a data: prefix', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'palette-'))
  const file = join(dir, 'p.png')
  await writeFile(file, Buffer.from('PNGDATA'))
  assert.equal(await loadPalette(file), Buffer.from('PNGDATA').toString('base64'))
})

test('a missing or empty palette file fails with a clear message', async () => {
  await assert.rejects(loadPalette('/nonexistent/palette.png'), /Could not read palette image "\/nonexistent\/palette.png"/)
  const dir = await mkdtemp(join(tmpdir(), 'palette-'))
  const file = join(dir, 'empty.png')
  await writeFile(file, '')
  await assert.rejects(loadPalette(file), /is empty/)
})
