import sharp from 'sharp'

/** Max RGB distance from the key colour that still counts as background (covers anti-aliased fringes). */
const KEY_TOLERANCE = 80
/** Empty border added around the trimmed object, as a fraction of its longest side, on each side. */
const MARGIN_RATIO = 0.08
const ALPHA_THRESHOLD = 128

export interface SpriteOptions {
    keyColour: string
    /** Output edge length in pixels. */
    size: number
    /** Max number of distinct opaque colours in the output; omitted means no reduction. */
    palette?: number
}

function parseHex(hex: string): [number, number, number] {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex)
    if (!m) throw new Error(`Invalid key colour "${hex}"; expected #rrggbb`)
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Clears the alpha of key-coloured pixels reachable from the image edges; enclosed key pixels stay. */
function keyOutFromEdges(data: Buffer, width: number, height: number, key: [number, number, number]): void {
    const isKey = (p: number) =>
        Math.hypot(data[p * 4] - key[0], data[p * 4 + 1] - key[1], data[p * 4 + 2] - key[2]) <= KEY_TOLERANCE
    const seen = new Uint8Array(width * height)
    const stack: number[] = []
    const visit = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return
        const p = y * width + x
        if (seen[p] || !isKey(p)) return
        seen[p] = 1
        data[p * 4 + 3] = 0
        stack.push(p)
    }
    for (let x = 0; x < width; x++) {
        visit(x, 0)
        visit(x, height - 1)
    }
    for (let y = 0; y < height; y++) {
        visit(0, y)
        visit(width - 1, y)
    }
    while (stack.length > 0) {
        const p = stack.pop()!
        const x = p % width
        const y = (p - x) / width
        visit(x - 1, y)
        visit(x + 1, y)
        visit(x, y - 1)
        visit(x, y + 1)
    }
}

/** Snaps every pixel to fully opaque or fully transparent (transparent pixels are zeroed). */
function hardenAlpha(data: Buffer): void {
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] >= ALPHA_THRESHOLD) {
            data[i + 3] = 255
        } else {
            data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0
        }
    }
}

function opaqueBounds(data: Buffer, width: number, height: number) {
    let left = width, top = height, right = -1, bottom = -1
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] === 0) continue
            if (x < left) left = x
            if (x > right) right = x
            if (y < top) top = y
            if (y > bottom) bottom = y
        }
    }
    if (right < 0) throw new Error('Nothing left after removing the key colour; the image is all background')
    return { left, top, width: right - left + 1, height: bottom - top + 1 }
}

/**
 * Turns a raw generated image into a finished sprite: keys out the background, trims, centres on a
 * square with a margin, downscales to size x size, hardens alpha to 0/255 and optionally reduces colours.
 */
export async function processSprite(raw: Buffer, opts: SpriteOptions): Promise<Buffer> {
    const key = parseHex(opts.keyColour)
    const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    keyOutFromEdges(data, info.width, info.height, key)

    const box = opaqueBounds(data, info.width, info.height)
    const side = Math.max(box.width, box.height)
    const margin = Math.ceil(side * MARGIN_RATIO)
    const trimmed = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .extract(box)
        .extend({
            top: margin + Math.floor((side - box.height) / 2),
            bottom: margin + Math.ceil((side - box.height) / 2),
            left: margin + Math.floor((side - box.width) / 2),
            right: margin + Math.ceil((side - box.width) / 2),
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer()

    // sharp averages source pixels when shrinking, and resizes with premultiplied alpha.
    const small = await sharp(trimmed)
        .resize(opts.size, opts.size, { kernel: 'linear' })
        .raw()
        .toBuffer()

    hardenAlpha(small)

    const out = sharp(small, { raw: { width: opts.size, height: opts.size, channels: 4 } })
    return (opts.palette ? out.png({ palette: true, colours: opts.palette, dither: 0 }) : out.png()).toBuffer()
}

/**
 * Finishes a native-resolution transparent sprite (e.g. from Retro Diffusion): no key-out, trim or
 * downscale; only confirms the size and hardens alpha to 0/255.
 */
export async function finishNativeSprite(raw: Buffer, size: number): Promise<Buffer> {
    const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    if (info.width !== size || info.height !== size) {
        throw new Error(`Expected a ${size}x${size} image but got ${info.width}x${info.height}`)
    }
    hardenAlpha(data)
    return sharp(data, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer()
}
