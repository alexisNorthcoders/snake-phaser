import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { processSprite } from '../../tools/assets/postprocess.ts'

type Rgb = [number, number, number]
const MAGENTA: Rgb = [255, 0, 255]
const RED: Rgb = [255, 0, 0]

/** Builds a synthetic RGB image; paint(x, y) returns the pixel colour. */
async function image(w: number, h: number, paint: (x: number, y: number) => Rgb): Promise<Buffer> {
  const data = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(paint(x, y), (y * w + x) * 3)
  return sharp(data, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}

const inRect = (x: number, y: number, l: number, t: number, r: number, b: number) => x >= l && x < r && y >= t && y < b

async function pixels(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const at = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4))
  return { data, info, at }
}

const squareOnKey = (key: Rgb) => image(64, 64, (x, y) => (inRect(x, y, 16, 16, 48, 48) ? RED : key))

test('edge-connected key background becomes transparent', async () => {
  const { at } = await pixels(await processSprite(await squareOnKey(MAGENTA), { keyColour: '#ff00ff', size: 32 }))
  assert.equal(at(0, 0)[3], 0)
  assert.equal(at(31, 31)[3], 0)
  assert.deepEqual(at(16, 16), [255, 0, 0, 255])
})

test('key-coloured pixels enclosed by the object are preserved', async () => {
  const raw = await image(64, 64, (x, y) => {
    if (inRect(x, y, 28, 28, 36, 36)) return MAGENTA
    return inRect(x, y, 8, 8, 56, 56) ? RED : MAGENTA
  })
  const { at } = await pixels(await processSprite(raw, { keyColour: '#ff00ff', size: 32 }))
  assert.deepEqual(at(16, 16), [255, 0, 255, 255])
  assert.equal(at(0, 0)[3], 0)
})

test('near-key fringe pixels are removed', async () => {
  const fringe: Rgb = [230, 30, 230]
  const raw = await image(64, 64, (x, y) => {
    if (inRect(x, y, 20, 20, 44, 44)) return RED
    return inRect(x, y, 16, 16, 48, 48) ? fringe : MAGENTA
  })
  const { data } = await pixels(await processSprite(raw, { keyColour: '#ff00ff', size: 32 }))
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 255) assert.deepEqual([data[i], data[i + 1], data[i + 2]], RED)
  }
})

test('output is size x size with the object trimmed and centred with a margin', async () => {
  // Off-centre, non-square object: 10 wide x 20 tall at the top-left area.
  const raw = await image(80, 80, (x, y) => (inRect(x, y, 5, 3, 15, 23) ? RED : MAGENTA))
  const { info, data } = await pixels(await processSprite(raw, { keyColour: '#ff00ff', size: 32 }))
  assert.equal(info.width, 32)
  assert.equal(info.height, 32)
  let l = 32, r = -1, t = 32, b = -1
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (data[(y * 32 + x) * 4 + 3] === 0) continue
    l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y)
  }
  assert.ok(t >= 1 && t <= 4, `top margin ${t}`)
  assert.ok(31 - b >= 1 && 31 - b <= 4, `bottom margin ${31 - b}`)
  assert.ok(Math.abs(l - (31 - r)) <= 1, `horizontally centred: ${l} vs ${31 - r}`)
  assert.ok(Math.abs(t - (31 - b)) <= 1, `vertically centred: ${t} vs ${31 - b}`)
})

test('alpha values are only 0 or 255', async () => {
  // A diagonal edge forces anti-aliased alpha during downscale.
  const raw = await image(100, 100, (x, y) => (x + y < 100 ? RED : MAGENTA))
  const { data } = await pixels(await processSprite(raw, { keyColour: '#ff00ff', size: 32 }))
  for (let i = 3; i < data.length; i += 4) assert.ok(data[i] === 0 || data[i] === 255, `alpha ${data[i]}`)
})

test('palette N limits distinct opaque colours', async () => {
  const raw = await image(64, 64, (x, y) => (inRect(x, y, 8, 8, 56, 56) ? [x * 4, y * 4, (x + y) * 2] : MAGENTA))
  const { data } = await pixels(await processSprite(raw, { keyColour: '#ff00ff', size: 32, palette: 4 }))
  const colours = new Set<string>()
  for (let i = 0; i < data.length; i += 4) {
    assert.ok(data[i + 3] === 0 || data[i + 3] === 255)
    if (data[i + 3] === 255) colours.add(`${data[i]},${data[i + 1]},${data[i + 2]}`)
  }
  assert.ok(colours.size >= 1 && colours.size <= 4, `${colours.size} colours`)
})

test('a custom key colour is honoured', async () => {
  const GREEN: Rgb = [0, 255, 0]
  const raw = await squareOnKey(GREEN)
  const { at } = await pixels(await processSprite(raw, { keyColour: '#00ff00', size: 32 }))
  assert.equal(at(0, 0)[3], 0)
  assert.deepEqual(at(16, 16), [255, 0, 0, 255])
  // The same image keyed as magenta leaves the green background opaque.
  const wrong = await pixels(await processSprite(raw, { keyColour: '#ff00ff', size: 32 }))
  assert.deepEqual(wrong.at(5, 5), [0, 255, 0, 255])
})
