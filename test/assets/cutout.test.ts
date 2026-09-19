import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { cutOutObjects, MARGIN_RATIO } from '../../tools/assets/cutout.ts'

type Rgb = [number, number, number]
const GREY: Rgb = [235, 235, 235]
const RED: Rgb = [255, 0, 0]
const BLUE: Rgb = [0, 0, 255]

interface Rect { l: number; t: number; r: number; b: number; colour: Rgb }

async function sheet(w: number, h: number, background: Rgb, rects: Rect[]): Promise<Buffer> {
  const data = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const rect = rects.find((q) => x >= q.l && x < q.r && y >= q.t && y < q.b)
    data.set(rect?.colour ?? background, (y * w + x) * 3)
  }
  return sharp(data, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}

/** The colour of the first pixel in the crop that is not the background. */
async function objectColour(png: Buffer): Promise<Rgb> {
  const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 3) {
    if (Math.abs(data[i] - GREY[0]) > 40 || Math.abs(data[i + 1] - GREY[1]) > 40) return [data[i], data[i + 1], data[i + 2]]
  }
  throw new Error('no object in crop')
}

const COLOURS: Rgb[] = [RED, BLUE, [0, 160, 0], [200, 120, 0]]

test('separate objects on a flat background are found in reading order', async () => {
  // Painted out of order; 2x2 grid with slightly uneven rows. Each is 60x60 = 3600px.
  const rects: Rect[] = [
    { l: 150, t: 20, r: 210, b: 80, colour: COLOURS[1] }, // top right
    { l: 20, t: 150, r: 80, b: 210, colour: COLOURS[2] }, // bottom left
    { l: 20, t: 30, r: 80, b: 90, colour: COLOURS[0] }, // top left (lower than top right)
    { l: 150, t: 160, r: 210, b: 220, colour: COLOURS[3] }, // bottom right
  ]
  const crops = await cutOutObjects(await sheet(240, 240, GREY, rects))
  assert.equal(crops.length, 4)
  assert.deepEqual(await Promise.all(crops.map(objectColour)), COLOURS)
})

test('the background is sampled from the corner, so a non-grey background works', async () => {
  const crops = await cutOutObjects(await sheet(100, 100, [20, 40, 60], [{ l: 20, t: 20, r: 80, b: 80, colour: RED }]))
  assert.equal(crops.length, 1)
})

test('specks under the minimum area are dropped', async () => {
  const crops = await cutOutObjects(
    await sheet(200, 100, GREY, [
      { l: 10, t: 10, r: 70, b: 70, colour: RED }, // 3600px
      { l: 120, t: 10, r: 150, b: 40, colour: BLUE }, // 900px
    ]),
  )
  assert.equal(crops.length, 1)
})

test('each crop is square with the margin applied and padded with the background', async () => {
  const w = 80
  const h = 60
  const crops = await cutOutObjects(await sheet(200, 200, GREY, [{ l: 50, t: 50, r: 50 + w, b: 50 + h, colour: RED }]))
  const margin = Math.ceil(w * MARGIN_RATIO)
  const { data, info } = await sharp(crops[0]).raw().toBuffer({ resolveWithObject: true })
  assert.equal(info.width, w + 2 * margin)
  assert.equal(info.height, w + 2 * margin)
  assert.deepEqual(Array.from(data.subarray(0, 3)), GREY)
  // The object's left edge sits `margin` pixels in, at the vertical centre.
  const centre = Math.floor(info.height / 2)
  const px = (x: number) => Array.from(data.subarray((centre * info.width + x) * 3, (centre * info.width + x) * 3 + 3))
  assert.deepEqual(px(margin - 1), GREY)
  assert.deepEqual(px(margin), RED)
})

test('a neighbouring object inside the crop is painted out', async () => {
  // Tall object with a short one tucked in its bounding box's margin zone.
  const crops = await cutOutObjects(
    await sheet(300, 200, GREY, [
      { l: 20, t: 20, r: 80, b: 180, colour: RED },
      { l: 84, t: 20, r: 124, b: 80, colour: BLUE }, // within the tall object's margin, 2400px
    ]),
  )
  assert.equal(crops.length, 2)
  // Reading order puts the higher-centred blue object first, so the tall red one is second.
  const { data } = await sharp(crops[1]).raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 3) assert.notDeepEqual(Array.from(data.subarray(i, i + 3)), BLUE)
})
