import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { DEFAULT_PROVIDER, DEFAULT_SHEET_MODEL, isFoodType, type FoodType, type Theme } from './theme.ts'
import { loadTheme } from './loadTheme.ts'
import { CANDIDATES_PER_SLOT, candidateFile, renderContactSheet, resolveSlots, sheetCandidateFile, type Candidate } from './candidates.ts'
import { buildPrompt, buildSheetPrompt } from './prompt.ts'
import { renderSheet } from './deepinfra.ts'
import { cutOutObjects } from './cutout.ts'
import { createPixelFixer } from './pixelFixer.ts'
import { estimateCost, generateCandidates, loadPalette } from './retroDiffusion.ts'
import { finishNativeSprite, removeBackground, trimToContent } from './postprocess.ts'

const OUTPUT_ROOT = 'tools/assets/output'

/** Reads the processed candidates already on disk, so re-rolled slots keep the others' candidates in the sheet. */
async function listCandidates(dir: string): Promise<{ candidates: Candidate[]; sheetCandidates: number[] }> {
    const found: Candidate[] = []
    const sheetCandidates: number[] = []
    for (const file of await readdir(`${dir}/food`)) {
        const sheet = /^sheet-(\d+)\.png$/.exec(file)
        if (sheet) sheetCandidates.push(Number(sheet[1]))
        const m = /^(.+)-(\d+)\.png$/.exec(file)
        if (!m || !isFoodType(m[1])) continue
        const index = Number(m[2])
        // Only the fixed 1..N indices count; leftovers from older runs must not appear in the sheet.
        if (index >= 1 && index <= CANDIDATES_PER_SLOT) found.push({ slot: m[1], index })
    }
    return { candidates: found, sheetCandidates }
}

async function generateRetroDiffusion(theme: Theme, style: string, slots: readonly FoodType[], dir: string) {
    const apiKey = process.env.RETRO_DIFFUSION_API_KEY
    // Read the palette first so a bad path fails before the cost check or any paid request.
    const palette = theme.palette ? await loadPalette(theme.palette) : undefined
    const requests = slots.map((slot) => ({ slot, prompt: buildPrompt(theme, slot), style: style, palette }))

    const { cost, remainingBalance } = await estimateCost(requests, { apiKey })
    console.log(`Cost check (free): $${cost.toFixed(3)} for ${requests.length} slot(s); remaining balance $${remainingBalance.toFixed(2)}`)

    // Sequential on purpose: a lost submission is recovered from the newest task, which is only unambiguous one at a time.
    for (const { slot, prompt, style, palette } of requests) {
        console.log(`Generating ${CANDIDATES_PER_SLOT} candidates for ${slot} with ${style}...`)
        const images = await generateCandidates({ prompt, style, palette }, { apiKey })
        if (images.length < CANDIDATES_PER_SLOT) {
            throw new Error(`Expected ${CANDIDATES_PER_SLOT} candidates for ${slot} but got ${images.length}`)
        }
        for (const [i, raw] of images.slice(0, CANDIDATES_PER_SLOT).entries()) {
            const file = candidateFile(slot, i + 1)
            await writeFile(`${dir}/raw/${file}`, raw)
            await writeFile(`${dir}/food/${file}`, await trimToContent(await finishNativeSprite(raw, theme.size)))
        }
    }
}

/** Next unused sheet candidate number, so generating again adds to the earlier sheets' cut-outs. */
async function nextSheetIndex(dir: string): Promise<number> {
    const { sheetCandidates } = await listCandidates(dir)
    return Math.max(0, ...sheetCandidates) + 1
}

async function generateSheet(theme: Theme, model: string, dir: string) {
    const pixelFixer = createPixelFixer({ apiKey: process.env.RETRO_DIFFUSION_API_KEY })
    if (!process.env.RETRO_DIFFUSION_API_KEY?.trim()) {
        throw new Error('RETRO_DIFFUSION_API_KEY is not set; add it to .env.local (the Pixel Fixer needs it).')
    }
    console.log(`Rendering a sheet with ${model}...`)
    const sheet = await renderSheet(buildSheetPrompt(theme), model, { apiKey: process.env.DEEPINFRA_API_KEY })
    const cutouts = await cutOutObjects(sheet)
    if (cutouts.length === 0) throw new Error('No objects found on the rendered sheet; try generating again.')
    console.log(`Found ${cutouts.length} object(s); rebuilding each at ${theme.size}x${theme.size} (Pixel Fixer allows 10 a minute)...`)
    let index = await nextSheetIndex(dir)
    for (const cutout of cutouts) {
        const file = sheetCandidateFile(index)
        const fixed = await pixelFixer(cutout, theme.size)
        await writeFile(`${dir}/raw/${file}`, cutout)
        await writeFile(`${dir}/food/${file}`, await trimToContent(await removeBackground(fixed, theme.size)))
        console.log(`  sheet #${index}`)
        index++
    }
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

    // The contact sheet is rewritten even if a later call fails, so completed candidates are never invisible.
    try {
        const provider = theme.provider ?? DEFAULT_PROVIDER
        if (provider.kind === 'deepinfra-sheet') {
            if (values.only?.length) throw new Error('--only does not apply to deepinfra-sheet themes: a sheet is not tied to food slots.')
            await generateSheet(theme, provider.model ?? DEFAULT_SHEET_MODEL, dir)
        } else {
            await generateRetroDiffusion(theme, provider.style, slots, dir)
        }
    } finally {
        const { candidates, sheetCandidates } = await listCandidates(dir)
        await writeFile(`${dir}/index.html`, renderContactSheet(theme.name, candidates, sheetCandidates))
    }
    console.log(`Contact sheet: ${dir}/index.html`)
}

main().catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
})
