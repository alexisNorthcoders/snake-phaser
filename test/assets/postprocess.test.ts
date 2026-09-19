import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { finishNativeSprite, removeBackground } from '../../tools/assets/postprocess.ts'

type Rgb = [number, number, number]
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

const BG: Rgb = [230, 230, 230]

/** A 32x32 image: BG around a red ring (with an enclosed BG-coloured pixel block) and slightly off-BG fringe. */
const ring = () =>
  image(32, 32, (x, y) => {
    if (inRect(x, y, 14, 14, 18, 18)) return BG
    return inRect(x, y, 8, 8, 24, 24) ? RED : BG
  })

test('background around the edge becomes transparent', async () => {
  const { at } = await pixels(await removeBackground(await ring(), 32))
  assert.equal(at(0, 0)[3], 0)
  assert.equal(at(31, 31)[3], 0)
  assert.deepEqual(at(8, 8), [255, 0, 0, 255])
})

test('background-coloured pixels enclosed by the object are kept', async () => {
  const { at } = await pixels(await removeBackground(await ring(), 32))
  assert.deepEqual(at(15, 15), [...BG, 255])
})

test('output alpha is only 0 or 255 and the size is unchanged', async () => {
  const raw = await image(32, 32, (x, y) => (x + y < 32 ? [200, 60, 60] : [BG[0] + 10, BG[1] - 10, BG[2]]))
  const { data, info } = await pixels(await removeBackground(raw, 32))
  assert.equal(info.width, 32)
  for (let i = 3; i < data.length; i += 4) assert.ok(data[i] === 0 || data[i] === 255, `alpha ${data[i]}`)
})

test('a result that is not the requested size is rejected', async () => {
  await assert.rejects(removeBackground(await image(64, 64, () => BG), 32), /Expected a 32x32 image but got 64x64/)
})

test('native sprites keep their pixels, only hardening alpha', async () => {
  const data = Buffer.alloc(32 * 32 * 4)
  data.set([10, 20, 30, 200], 0)
  data.set([40, 50, 60, 20], 4)
  const raw = await sharp(data, { raw: { width: 32, height: 32, channels: 4 } }).png().toBuffer()
  const { at, info } = await pixels(await finishNativeSprite(raw, 32))
  assert.equal(info.width, 32)
  assert.deepEqual(at(0, 0), [10, 20, 30, 255])
  assert.deepEqual(at(1, 0), [0, 0, 0, 0])
})

test('native sprites of the wrong size are rejected', async () => {
  await assert.rejects(finishNativeSprite(await image(64, 64, () => RED), 32), /Expected a 32x32 image but got 64x64/)
})
