import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { BACKGROUND_SIZE, DEFAULT_BACKGROUND_STYLE, DEFAULT_PROVIDER, DEFAULT_SHEET_MODEL, isFoodType, type FoodType, type Theme } from './theme.ts'
import { loadTheme } from './loadTheme.ts'
import { CANDIDATES_PER_SLOT, backgroundCandidateFile, candidateFile, renderContactSheet, resolveSlots, sheetCandidateFile, type Candidate } from './candidates.ts'
import { buildBackgroundPrompt, buildPrompt, buildSheetPrompt } from './prompt.ts'
import { renderSheet } from './deepinfra.ts'
import { cutOutObjects } from './cutout.ts'
import { createPixelFixer } from './pixelFixer.ts'
import { estimateCost, generateCandidates, loadPalette } from './retroDiffusion.ts'
import { finishNativeSprite, finishTile, removeBackground, trimToContent } from './postprocess.ts'

const OUTPUT_ROOT = 'tools/assets/output'

/** Reads the processed candidates already on disk, so re-rolled slots keep the others' candidates in the sheet. */
async function listCandidates(dir: string): Promise<{ candidates: Candidate[]; sheetCandidates: number[]; backgroundCandidates: number[] }> {
    const found: Candidate[] = []
    const sheetCandidates: number[] = []
    const backgroundCandidates: number[] = []
    for (const file of await readdir(`${dir}/background`)) {
        const tile = /^tile-(\d+)\.png$/.exec(file)
        if (tile) backgroundCandidates.push(Number(tile[1]))
    }
    for (const file of await readdir(`${dir}/food`)) {
        const sheet = /^sheet-(\d+)\.png$/.exec(file)
        if (sheet) sheetCandidates.push(Number(sheet[1]))
        const m = /^(.+)-(\d+)\.png$/.exec(file)
        if (!m || !isFoodType(m[1])) continue
        const index = Number(m[2])
        // Only the fixed 1..N indices count; leftovers from older runs must not appear in the sheet.
        if (index >= 1 && index <= CANDIDATES_PER_SLOT) found.push({ slot: m[1], index })
    }
    return { candidates: found, sheetCandidates, backgroundCandidates }
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

/** Next unused tile number, so re-rolling a background keeps the earlier tiles to compare against. */
async function nextBackgroundIndex(dir: string): Promise<number> {
    const { backgroundCandidates } = await listCandidates(dir)
    return Math.max(0, ...backgroundCandidates) + 1
}

/** Seamless background tiles: one paid request, `tile_x`/`tile_y` on, background removal off. */
async function generateBackground(theme: Theme, dir: string) {
    const apiKey = process.env.RETRO_DIFFUSION_API_KEY
    const palette = theme.palette ? await loadPalette(theme.palette) : undefined
    const style = theme.background.style ?? DEFAULT_BACKGROUND_STYLE
    // `rd_tile__*` styles render one image per request; everything else takes the usual batch.
    const numImages = style.startsWith('rd_tile__') ? 1 : undefined
    const request = { prompt: buildBackgroundPrompt(theme), style, palette, size: BACKGROUND_SIZE, tiling: true, numImages }

    const { cost, remainingBalance } = await estimateCost([request], { apiKey })
    console.log(`Cost check (free): $${cost.toFixed(3)} for 1 background request; remaining balance $${remainingBalance.toFixed(2)}`)

    console.log(`Generating seamless ${BACKGROUND_SIZE}x${BACKGROUND_SIZE} background tiles with ${style}...`)
    const images = await generateCandidates(request, { apiKey })
    let index = await nextBackgroundIndex(dir)
    for (const raw of images) {
        const file = backgroundCandidateFile(index)
        await writeFile(`${dir}/raw/${file}`, raw)
        await writeFile(`${dir}/background/${file}`, await finishTile(raw, BACKGROUND_SIZE))
        console.log(`  tile #${index}`)
        index++
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
        options: { theme: { type: 'string' }, only: { type: 'string', multiple: true }, background: { type: 'boolean' } },
        allowPositionals: true,
    })
    if (!values.theme) throw new Error('Usage: npm run assets:generate -- --theme <name> [--background | [--only <foodType>[,<foodType>...]]...] (repeat --only or comma-separate)')
    if (values.background && values.only?.length) {
        throw new Error('--background generates the theme background tile, so it cannot be combined with --only.')
    }
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
    await mkdir(`${dir}/background`, { recursive: true })

    // The contact sheet is rewritten even if a later call fails, so completed candidates are never invisible.
    try {
        const provider = theme.provider ?? DEFAULT_PROVIDER
        if (values.background) {
            await generateBackground(theme, dir)
        } else if (provider.kind === 'deepinfra-sheet') {
            if (values.only?.length) throw new Error('--only does not apply to deepinfra-sheet themes: a sheet is not tied to food slots.')
            await generateSheet(theme, provider.model ?? DEFAULT_SHEET_MODEL, dir)
        } else {
            await generateRetroDiffusion(theme, provider.style, slots, dir)
        }
    } finally {
        const { candidates, sheetCandidates, backgroundCandidates } = await listCandidates(dir)
        await writeFile(`${dir}/index.html`, renderContactSheet(theme.name, candidates, sheetCandidates, backgroundCandidates))
    }
    console.log(`Contact sheet: ${dir}/index.html`)
}

main().catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
})
