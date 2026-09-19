export const RETRO_DIFFUSION_API = 'https://api.retrodiffusion.ai/v2'
export const NATIVE_SIZE = 32
export const IMAGES_PER_REQUEST = 4

export interface RetroDiffusionOptions {
    apiKey: string | undefined
    fetchFn?: typeof fetch
    /** Delay between task polls; injectable so tests don't wait. */
    sleep?: (ms: number) => Promise<void>
    pollIntervalMs?: number
    /** Give up polling after this many polls. */
    maxPolls?: number
    newIdempotencyKey?: () => string
}

export interface ImageRequest {
    prompt: string
    style: string
}

export interface CostEstimate {
    cost: number
    remainingBalance: number
}

/** The server answered with a definite refusal (4xx), so nothing was accepted or charged. */
class RefusedError extends Error {}

/** The server may have accepted the request but we never got a usable answer (network failure, 5xx, unreadable body). */
class UnknownOutcomeError extends Error {}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function requireKey(apiKey: string | undefined): string {
    if (!apiKey?.trim()) {
        throw new Error('RETRO_DIFFUSION_API_KEY is not set; add it to .env.local to call Retro Diffusion.')
    }
    return apiKey.trim()
}

function body(req: ImageRequest, extra: Record<string, unknown>) {
    return {
        prompt: req.prompt,
        prompt_style: req.style,
        width: NATIVE_SIZE,
        height: NATIVE_SIZE,
        num_images: IMAGES_PER_REQUEST,
        remove_bg: true,
        ...extra,
    }
}

function describeError(json: any): string {
    const e = json?.error
    if (e?.message) {
        const issues = e.details?.issues ? ` ${JSON.stringify(e.details.issues)}` : ''
        return `${e.code ? `${e.code}: ` : ''}${e.message}${issues}`
    }
    const detail = json?.detail
    if (typeof detail === 'string') return detail
    if (detail?.message) return detail.message
    if (Array.isArray(detail)) return detail.map((d) => d?.msg ?? JSON.stringify(d)).join('; ')
    return 'Unknown error'
}

/** Sends one request and returns parsed JSON, turning non-JSON and non-OK responses into clear errors. */
async function call(fetchFn: typeof fetch, key: string, method: 'GET' | 'POST', path: string, payload?: unknown, headers: Record<string, string> = {}): Promise<any> {
    let res: Response
    try {
        res = await fetchFn(`${RETRO_DIFFUSION_API}${path}`, {
            method,
            headers: { 'X-RD-Token': key, ...(payload ? { 'Content-Type': 'application/json' } : {}), ...headers },
            ...(payload ? { body: JSON.stringify(payload) } : {}),
        })
    } catch (err) {
        throw new UnknownOutcomeError(`Retro Diffusion request failed for ${method} ${path}: ${(err as Error).message}`)
    }
    let json: any
    try {
        json = await res.json()
    } catch {
        const msg = `Retro Diffusion API returned non-JSON (HTTP ${res.status}) for ${method} ${path}`
        throw res.ok || res.status >= 500 ? new UnknownOutcomeError(msg) : new RefusedError(msg)
    }
    if (!res.ok) {
        const msg = `Retro Diffusion API error (HTTP ${res.status}) for ${method} ${path}: ${describeError(json)}`
        throw res.status >= 500 ? new UnknownOutcomeError(msg) : new RefusedError(msg)
    }
    return json
}

/** Free dry run (`check_cost`): totals the price of every request and reports the remaining balance. Charges nothing. */
export async function estimateCost(
    requests: readonly ImageRequest[],
    { apiKey, fetchFn = fetch }: RetroDiffusionOptions,
): Promise<CostEstimate> {
    const key = requireKey(apiKey)
    let cost = 0
    let remainingBalance = NaN
    for (const req of requests) {
        const json = await call(fetchFn, key, 'POST', '/inferences', body(req, { check_cost: true }))
        const requestCost = Number(json?.balance_cost)
        const balance = Number(json?.remaining_balance)
        if (json?.balance_cost == null || json?.remaining_balance == null || !Number.isFinite(requestCost) || !Number.isFinite(balance)) {
            throw new Error(`Retro Diffusion cost check returned no usable balance_cost/remaining_balance: ${JSON.stringify(json)}`)
        }
        cost += requestCost
        remainingBalance = balance
    }
    if (!Number.isFinite(remainingBalance)) throw new Error('Retro Diffusion cost check ran no requests, so it has no balance to report.')
    return { cost, remainingBalance }
}

/** Recovers a task whose submission response was lost, instead of submitting (and paying) again. */
async function recoverTask(fetchFn: typeof fetch, key: string, submittedAtSec: number, cause: unknown): Promise<string> {
    const json = await call(fetchFn, key, 'GET', '/inferences/tasks?limit=20')
    const recent = (json.tasks ?? [])
        .filter((t: any) => t?.task_id && Number(t.created_at) >= submittedAtSec - 5)
        .sort((a: any, b: any) => Number(b.created_at) - Number(a.created_at))
    const task = recent[0]
    if (!task) {
        throw new Error(
            `Submission response was lost (${(cause as Error).message}) and no recent task was found. ` +
                'Check your Retro Diffusion dashboard before retrying, to avoid paying twice.',
        )
    }
    return task.task_id
}

/** Submits one paid request, polls its task until it finishes, and returns the decoded PNG candidates. */
export async function generateCandidates(
    req: ImageRequest,
    {
        apiKey,
        fetchFn = fetch,
        sleep = defaultSleep,
        pollIntervalMs = 2000,
        maxPolls = 300,
        newIdempotencyKey = () => crypto.randomUUID(),
    }: RetroDiffusionOptions,
): Promise<Buffer[]> {
    const key = requireKey(apiKey)
    const submittedAtSec = Math.floor(Date.now() / 1000)

    let taskId: string | undefined
    try {
        taskId = (await call(fetchFn, key, 'POST', '/inferences', body(req, {}), { 'Idempotency-Key': newIdempotencyKey() })).task_id
        if (!taskId) throw new UnknownOutcomeError('Retro Diffusion accepted the request but returned no task_id.')
    } catch (err) {
        // Only a definite refusal (4xx) is safe to surface; any unknown outcome is recovered by listing tasks, never by resubmitting.
        if (!(err instanceof UnknownOutcomeError)) throw err
        taskId = await recoverTask(fetchFn, key, submittedAtSec, err)
    }

    for (let poll = 0; poll < maxPolls; poll++) {
        const task = await call(fetchFn, key, 'GET', `/inferences/tasks/${taskId}`)
        if (task.status === 'succeeded') {
            const images: string[] = task.result?.base64_images ?? []
            if (images.length === 0) throw new Error(`Retro Diffusion task ${taskId} succeeded but returned no base64 images.`)
            return images.map((b64) => Buffer.from(b64, 'base64'))
        }
        if (task.status === 'failed') {
            const e = task.error
            throw new Error(`Retro Diffusion task ${taskId} failed${e?.status_code ? ` (${e.status_code})` : ''}: ${e?.detail ?? e?.message ?? JSON.stringify(e ?? 'no error given')}`)
        }
        await sleep(pollIntervalMs)
    }
    throw new Error(`Retro Diffusion task ${taskId} did not finish after ${maxPolls} polls; it may still complete and be charged.`)
}
