import sharp from 'sharp'

const KEY_TOLERANCE = 80

function parseHex(hex: string): [number, number, number] {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex)
    if (!m) throw new Error(`Invalid key colour "${hex}"; expected #rrggbb`)
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Makes pixels near the key colour transparent, then resizes to size x size. */
export async function processSprite(raw: Buffer, opts: { keyColour: string; size: number }): Promise<Buffer> {
    const [kr, kg, kb] = parseHex(opts.keyColour)
    const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let i = 0; i < data.length; i += 4) {
        const dist = Math.hypot(data[i] - kr, data[i + 1] - kg, data[i + 2] - kb)
        if (dist <= KEY_TOLERANCE) data[i + 3] = 0
    }
    return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .resize(opts.size, opts.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
}
