import sharp from 'sharp'
import { colourDistance, type Rgb } from './postprocess.ts'

/** Colour distance from the sampled background above which a pixel is foreground (from the #53 spike). */
export const FOREGROUND_THRESHOLD = 40
/** Objects with fewer foreground pixels than this are specks and are dropped (from the #53 spike). */
export const MIN_OBJECT_PIXELS = 1500
/** Margin around each object, as a fraction of its longest side, on each side. */
export const MARGIN_RATIO = 0.08

interface Box {
    left: number
    top: number
    right: number
    bottom: number
}

interface Component extends Box {
    id: number
    pixels: number
}

/** Labels 8-connected foreground objects; label 0 is background. */
function findObjects(foreground: Uint8Array, width: number, height: number): { labels: Int32Array; objects: Component[] } {
    const labels = new Int32Array(width * height)
    const objects: Component[] = []
    for (let start = 0; start < labels.length; start++) {
        if (!foreground[start] || labels[start]) continue
        const id = objects.length + 1
        const obj: Component = { id, pixels: 0, left: width, top: height, right: -1, bottom: -1 }
        const stack = [start]
        labels[start] = id
        while (stack.length > 0) {
            const p = stack.pop()!
            const x = p % width
            const y = (p - x) / width
            obj.pixels++
            obj.left = Math.min(obj.left, x)
            obj.right = Math.max(obj.right, x)
            obj.top = Math.min(obj.top, y)
            obj.bottom = Math.max(obj.bottom, y)
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx
                    const ny = y + dy
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
                    const n = ny * width + nx
                    if (foreground[n] && !labels[n]) {
                        labels[n] = id
                        stack.push(n)
                    }
                }
            }
        }
        objects.push(obj)
    }
    return { labels, objects }
}

/** Reading order: rows top to bottom, left to right within a row. An object joins a row when its centre lies inside the row's first object. */
function readingOrder(objects: Component[]): Component[] {
    const centreY = (o: Component) => (o.top + o.bottom) / 2
    const sorted = [...objects].sort((a, b) => centreY(a) - centreY(b))
    const rows: Component[][] = []
    for (const obj of sorted) {
        const row = rows.at(-1)
        const anchor = row?.[0]
        if (row && anchor && centreY(obj) <= anchor.bottom) row.push(obj)
        else rows.push([obj])
    }
    return rows.flatMap((row) => row.sort((a, b) => a.left - b.left))
}

/**
 * Cuts each separate object out of a sheet rendered on a flat background. The background colour is
 * sampled from the top-left corner; every pixel further than FOREGROUND_THRESHOLD from it is foreground.
 * Each returned PNG is a square crop (object plus margin) padded with the background colour, in reading order.
 */
export async function cutOutObjects(sheet: Buffer): Promise<Buffer[]> {
    const { data, info } = await sharp(sheet).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width, height } = info
    const background: Rgb = [data[0], data[1], data[2]]
    const foreground = new Uint8Array(width * height)
    for (let p = 0; p < foreground.length; p++) {
        foreground[p] = colourDistance(data, p * 3, background) > FOREGROUND_THRESHOLD ? 1 : 0
    }
    const { labels, objects } = findObjects(foreground, width, height)

    const crops: Buffer[] = []
    for (const obj of readingOrder(objects.filter((o) => o.pixels >= MIN_OBJECT_PIXELS))) {
        const w = obj.right - obj.left + 1
        const h = obj.bottom - obj.top + 1
        const side = Math.max(w, h) + 2 * Math.ceil(Math.max(w, h) * MARGIN_RATIO)
        const x0 = obj.left - Math.floor((side - w) / 2)
        const y0 = obj.top - Math.floor((side - h) / 2)
        const out = Buffer.alloc(side * side * 3)
        for (let y = 0; y < side; y++) {
            for (let x = 0; x < side; x++) {
                const sx = x0 + x
                const sy = y0 + y
                const inside = sx >= 0 && sy >= 0 && sx < width && sy < height
                // Pixels of other objects and outside the sheet become background so only this object is sent on.
                const p = sy * width + sx
                const own = inside && (labels[p] === obj.id || !foreground[p])
                out.set(own ? data.subarray(p * 3, p * 3 + 3) : background, (y * side + x) * 3)
            }
        }
        crops.push(await sharp(out, { raw: { width: side, height: side, channels: 3 } }).png().toBuffer())
    }
    return crops
}
