import sharp from 'sharp'

/** Max RGB distance from the background colour that still counts as background (covers anti-aliased fringes). */
const BACKGROUND_TOLERANCE = 40
const ALPHA_THRESHOLD = 128

export type Rgb = [number, number, number]

export function colourDistance(data: Buffer, offset: number, colour: Rgb): number {
    return Math.hypot(data[offset] - colour[0], data[offset + 1] - colour[1], data[offset + 2] - colour[2])
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
 * the background colour is sampled from the top-left corner and flood-filled away from the edges only,
 * with no resizing, then alpha is hardened to 0/255.
 */
export async function removeBackground(fixed: Buffer, size: number): Promise<Buffer> {
    const { data, info } = await sharp(fixed).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    if (info.width !== size || info.height !== size) {
        throw new Error(`Expected a ${size}x${size} image but got ${info.width}x${info.height}`)
    }
    clearBackgroundFromEdges(data, info.width, info.height, [data[0], data[1], data[2]])
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
