import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { DEFAULT_PROVIDER, isFoodType } from './theme.ts'
import { loadTheme } from './loadTheme.ts'
import { CANDIDATES_PER_SLOT, candidateFile, renderContactSheet, resolveSlots, type Candidate } from './candidates.ts'
import { buildPrompt } from './prompt.ts'
import { estimateCost, generateCandidates } from './retroDiffusion.ts'
import { finishNativeSprite } from './postprocess.ts'

const OUTPUT_ROOT = 'tools/assets/output'

/** Reads the processed candidates already on disk, so re-rolled slots keep the others' candidates in the sheet. */
async function listCandidates(dir: string): Promise<Candidate[]> {
    const found: Candidate[] = []
    for (const file of await readdir(`${dir}/food`)) {
        const m = /^(.+)-(\d+)\.png$/.exec(file)
        if (!m || !isFoodType(m[1])) continue
        const index = Number(m[2])
        // Only the fixed 1..N indices count; leftovers from older runs must not appear in the sheet.
        if (index >= 1 && index <= CANDIDATES_PER_SLOT) found.push({ slot: m[1], index })
    }
    return found
}

async function main() {
    const { values, positionals } = parseArgs({
        options: { theme: { type: 'string' }, only: { type: 'string', multiple: true } },
        allowPositionals: true,
    })
    if (!values.theme) throw new Error('Usage: npm run assets:generate -- --theme <name> [--only <foodType>[,<foodType>...]]... (repeat --only or comma-separate)')
    if (positionals.length > 0) {
        throw new Error(`Unexpected argument(s): ${positionals.join(' ')}. Use --only a --only b or --only a,b`)
    }

    try {
        process.loadEnvFile('.env.local')
    } catch {
        // No env file: the key may still come from the environment.
    }

    const theme = await loadTheme(values.theme)
    // Repeated flags are collected by parseArgs; resolveSlots also splits comma lists.
    const slots = resolveSlots(values.only ?? [])

    const dir = `${OUTPUT_ROOT}/${theme.name}`
    await mkdir(`${dir}/raw`, { recursive: true })
    await mkdir(`${dir}/food`, { recursive: true })

    const provider = theme.provider ?? DEFAULT_PROVIDER
    const apiKey = process.env.RETRO_DIFFUSION_API_KEY
    const requests = slots.map((slot) => ({ slot, prompt: buildPrompt(theme, slot), style: provider.style }))

    const { cost, remainingBalance } = await estimateCost(requests, { apiKey })
    console.log(`Cost check (free): $${cost.toFixed(3)} for ${requests.length} slot(s); remaining balance $${remainingBalance.toFixed(2)}`)

    // Sequential on purpose: a lost submission is recovered from the newest task, which is only unambiguous one at a time.
    for (const { slot, prompt, style } of requests) {
        console.log(`Generating ${CANDIDATES_PER_SLOT} candidates for ${slot} with ${style}...`)
        const images = await generateCandidates({ prompt, style }, { apiKey })
        if (images.length < CANDIDATES_PER_SLOT) {
            throw new Error(`Expected ${CANDIDATES_PER_SLOT} candidates for ${slot} but got ${images.length}`)
        }
        for (const [i, raw] of images.slice(0, CANDIDATES_PER_SLOT).entries()) {
            const file = candidateFile(slot, i + 1)
            await writeFile(`${dir}/raw/${file}`, raw)
            await writeFile(`${dir}/food/${file}`, await finishNativeSprite(raw, theme.size))
        }
    }

    await writeFile(`${dir}/index.html`, renderContactSheet(theme.name, await listCandidates(dir)))
    console.log(`Contact sheet: ${dir}/index.html`)
}

main().catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
})
