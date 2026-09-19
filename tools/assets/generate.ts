import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { DEFAULT_MODEL, isFoodType, resolveSlot } from './theme.ts'
import { loadTheme } from './loadTheme.ts'
import { CANDIDATES_PER_SLOT, candidateFile, renderContactSheet, resolveSlots, type Candidate } from './candidates.ts'
import { buildPrompt } from './prompt.ts'
import { generateImage } from './deepinfra.ts'
import { processSprite } from './postprocess.ts'

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

    for (const slot of slots) {
        const resolved = resolveSlot(theme, slot)
        const model = theme.model ?? DEFAULT_MODEL
        const prompt = buildPrompt(theme, resolved)
        console.log(`Generating ${CANDIDATES_PER_SLOT} candidates for ${slot} with ${model}...`)
        await Promise.all(
            Array.from({ length: CANDIDATES_PER_SLOT }, async (_, i) => {
                const file = candidateFile(slot, i + 1)
                const raw = await generateImage({ prompt, model }, { apiKey: process.env.DEEPINFRA_API_KEY })
                await writeFile(`${dir}/raw/${file}`, raw)
                const processed = await processSprite(raw, { keyColour: resolved.keyColour, size: theme.size })
                await writeFile(`${dir}/food/${file}`, processed)
            }),
        )
    }

    await writeFile(`${dir}/index.html`, renderContactSheet(theme.name, await listCandidates(dir)))
    console.log(`Contact sheet: ${dir}/index.html`)
}

main().catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
})
