export const DEEPINFRA_IMAGE_GENERATIONS_URL = 'https://api.deepinfra.com/v1/openai/images/generations'

export interface GenerateImageOptions {
    apiKey: string | undefined
    fetchFn?: typeof fetch
}

/** Calls DeepInfra's OpenAI-compatible images endpoint and returns the decoded PNG. No negative prompt or seed: the endpoint doesn't support them. */
export async function generateImage(
    args: { prompt: string; model: string },
    { apiKey, fetchFn = fetch }: GenerateImageOptions,
): Promise<Buffer> {
    if (!apiKey?.trim()) {
        throw new Error('DEEPINFRA_API_KEY is not set; add it to .env.local to call DeepInfra image models.')
    }
    const res = await fetchFn(DEEPINFRA_IMAGE_GENERATIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({ prompt: args.prompt, model: args.model, size: '1024x1024', n: 1 }),
    })

    let json: any
    try {
        json = await res.json()
    } catch {
        throw new Error(`DeepInfra images API returned non-JSON (HTTP ${res.status})`)
    }
    if (!res.ok) {
        const msg = json?.error?.message ?? json?.message ?? 'Unknown error'
        throw new Error(`DeepInfra images API error (HTTP ${res.status}): ${msg}`)
    }
    const b64 = json?.data?.[0]?.b64_json
    if (!b64) throw new Error('DeepInfra returned no image data (expected b64_json).')
    return Buffer.from(b64, 'base64')
}
