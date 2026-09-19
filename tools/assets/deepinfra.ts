export const DEEPINFRA_IMAGES_URL = 'https://api.deepinfra.com/v1/openai/images/generations'
export const SHEET_SIZE = 1024

export interface DeepInfraOptions {
    apiKey: string | undefined
    fetchFn?: typeof fetch
}

/** Renders one sheet image (PNG bytes) from a prompt. */
export async function renderSheet(prompt: string, model: string, { apiKey, fetchFn = fetch }: DeepInfraOptions): Promise<Buffer> {
    if (!apiKey?.trim()) throw new Error('DEEPINFRA_API_KEY is not set; add it to .env.local to call DeepInfra.')
    let res: Response
    try {
        res = await fetchFn(DEEPINFRA_IMAGES_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt, n: 1, size: `${SHEET_SIZE}x${SHEET_SIZE}`, response_format: 'b64_json' }),
        })
    } catch (err) {
        throw new Error(`DeepInfra request failed: ${(err as Error).message}`)
    }
    let json: any
    try {
        json = await res.json()
    } catch {
        throw new Error(`DeepInfra returned non-JSON (HTTP ${res.status}).`)
    }
    if (!res.ok) {
        const detail = json?.error?.message ?? json?.detail ?? JSON.stringify(json)
        throw new Error(`DeepInfra error (HTTP ${res.status}): ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
    }
    const b64 = json?.data?.[0]?.b64_json
    if (typeof b64 !== 'string') throw new Error(`DeepInfra returned no image: ${JSON.stringify(json).slice(0, 200)}`)
    return Buffer.from(b64, 'base64')
}
