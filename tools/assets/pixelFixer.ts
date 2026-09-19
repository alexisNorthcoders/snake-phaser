export const PIXEL_FIXER_URL = 'https://api.retrodiffusion.ai/v1/pixel-fixer/neural'
/** Free endpoint, limited to 10 requests a minute per token; spacing calls evenly stays under it. */
const MIN_INTERVAL_MS = 6500
const RETRY_AFTER_429_MS = 15000
const MAX_ATTEMPTS = 5
/** The request body is limited to about 900 KB. */
const MAX_BODY_BYTES = 900_000

export interface PixelFixerOptions {
    apiKey: string | undefined
    fetchFn?: typeof fetch
    /** Injectable so tests don't wait. */
    sleep?: (ms: number) => Promise<void>
    now?: () => number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Rebuilds images on a real size x size pixel grid, one request at a time, throttled to the rate limit. */
export function createPixelFixer({ apiKey, fetchFn = fetch, sleep = defaultSleep, now = Date.now }: PixelFixerOptions) {
    let lastRequestAt = -Infinity

    return async function fix(png: Buffer, size: number): Promise<Buffer> {
        if (!apiKey?.trim()) {
            throw new Error('RETRO_DIFFUSION_API_KEY is not set; add it to .env.local to call the Retro Diffusion Pixel Fixer.')
        }
        const body = JSON.stringify({ input_image: png.toString('base64'), width: size, height: size })
        if (body.length > MAX_BODY_BYTES) {
            throw new Error(`Pixel Fixer input is ${body.length} bytes; the limit is about ${MAX_BODY_BYTES}.`)
        }

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const wait = lastRequestAt + MIN_INTERVAL_MS - now()
            if (wait > 0) await sleep(wait)
            lastRequestAt = now()

            let res: Response
            try {
                res = await fetchFn(PIXEL_FIXER_URL, {
                    method: 'POST',
                    headers: { 'X-RD-Token': apiKey.trim(), 'Content-Type': 'application/json' },
                    body,
                })
            } catch (err) {
                throw new Error(`Pixel Fixer request failed: ${(err as Error).message}`)
            }
            if (res.status === 429) {
                if (attempt === MAX_ATTEMPTS) throw new Error(`Pixel Fixer still rate limited (HTTP 429) after ${MAX_ATTEMPTS} attempts.`)
                const retryAfter = Number(res.headers.get('retry-after'))
                await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_AFTER_429_MS)
                lastRequestAt = now()
                continue
            }
            let json: any
            try {
                json = await res.json()
            } catch {
                throw new Error(`Pixel Fixer returned non-JSON (HTTP ${res.status}).`)
            }
            if (!res.ok) {
                const detail = json?.error?.message ?? json?.detail ?? JSON.stringify(json)
                throw new Error(`Pixel Fixer error (HTTP ${res.status}): ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
            }
            const image = json?.base64_images?.[0]
            if (typeof image !== 'string') throw new Error(`Pixel Fixer returned no base64_images: ${JSON.stringify(json).slice(0, 200)}`)
            return Buffer.from(image, 'base64')
        }
        throw new Error('unreachable')
    }
}
