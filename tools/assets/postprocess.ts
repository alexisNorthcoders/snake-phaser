import sharp from 'sharp'

/** Max RGB distance from the background colour that still counts as background (covers anti-aliased fringes). */
const BACKGROUND_TOLERANCE = 40
const ALPHA_THRESHOLD = 128

export type Rgb = [number, number, number]

export function colourDistance(data: Buffer, offset: number, colour: Rgb): number {
    return Math.hypot(data[offset] - colour[0], data[offset + 1] - colour[1], data[offset + 2] - colour[2])
}

/** The background colour: the average of the most common (coarsely bucketed) colour along the image border, so an object touching a corner doesn't get sampled. */
function dominantBorderColour(data: Buffer, width: number, height: number): Rgb {
    const buckets = new Map<number, { count: number; sum: Rgb }>()
    const add = (x: number, y: number) => {
        const o = (y * width + x) * 4
        const key = (data[o] >> 5) * 64 + (data[o + 1] >> 5) * 8 + (data[o + 2] >> 5)
        const b = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] as Rgb }
        b.count++
        for (let c = 0; c < 3; c++) b.sum[c] += data[o + c]
        buckets.set(key, b)
    }
    for (let x = 0; x < width; x++) {
        add(x, 0)
        add(x, height - 1)
    }
    for (let y = 1; y < height - 1; y++) {
        add(0, y)
        add(width - 1, y)
    }
    const best = [...buckets.values()].reduce((a, b) => (b.count > a.count ? b : a))
    return [best.sum[0] / best.count, best.sum[1] / best.count, best.sum[2] / best.count]
}

/** Clears the alpha of background-coloured pixels reachable from the image edges; enclosed ones stay. */
function clearBackgroundFromEdges(data: Buffer, width: number, height: number, background: Rgb): void {
    const isBackground = (p: number) => colourDistance(data, p * 4, background) <= BACKGROUND_TOLERANCE
    const seen = new Uint8Array(width * height)
    const stack: number[] = []
    const visit = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return
        const p = y * width + x
        if (seen[p] || !isBackground(p)) return
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

/**
 * Turns a Pixel Fixer result (an opaque size x size image on the flat background colour) into a sprite:
 * the background colour is the dominant border colour and is flood-filled away from the edges only,
 * with no resizing, then alpha is hardened to 0/255.
 */
export async function removeBackground(fixed: Buffer, size: number): Promise<Buffer> {
    const { data, info } = await sharp(fixed).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    if (info.width !== size || info.height !== size) {
        throw new Error(`Expected a ${size}x${size} image but got ${info.width}x${info.height}`)
    }
    clearBackgroundFromEdges(data, info.width, info.height, dominantBorderColour(data, info.width, info.height))
    hardenAlpha(data)
    return sharp(data, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer()
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

/**
 * Crops a transparent sprite to its opaque pixels and centres them on the smallest square canvas with
 * `margin` transparent pixels around, so the game (which stretches every food texture to one cell)
 * draws the item filling the cell. Pixels are moved, never resampled; an empty sprite is returned unchanged.
 */
export async function trimToContent(sprite: Buffer, margin = 1): Promise<Buffer> {
    const { data, info } = await sharp(sprite).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let left = info.width, top = info.height, right = -1, bottom = -1
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            if (data[(y * info.width + x) * 4 + 3] === 0) continue
            left = Math.min(left, x)
            right = Math.max(right, x)
            top = Math.min(top, y)
            bottom = Math.max(bottom, y)
        }
    }
    if (right < 0) return sprite
    const width = right - left + 1
    const height = bottom - top + 1
    const side = Math.max(width, height) + 2 * margin
    const padLeft = Math.floor((side - width) / 2)
    const padTop = Math.floor((side - height) / 2)
    return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .extract({ left, top, width, height })
        .extend({ left: padLeft, right: side - width - padLeft, top: padTop, bottom: side - height - padTop, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
}

/**
 * Finishes a background tile: confirms the size and flattens it to fully opaque, so a stray
 * transparent pixel can't punch a hole through the board when the tile repeats.
 */
export async function finishTile(raw: Buffer, size: number): Promise<Buffer> {
    const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    if (info.width !== size || info.height !== size) {
        throw new Error(`Expected a ${size}x${size} tile but got ${info.width}x${info.height}`)
    }
    for (let i = 3; i < data.length; i += 4) data[i] = 255
    return sharp(data, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer()
}
