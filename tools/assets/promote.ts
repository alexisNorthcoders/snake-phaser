import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { CANDIDATES_PER_SLOT, backgroundCandidateFile, candidateFile, sheetCandidateFile } from './candidates.ts'
import { loadTheme } from './loadTheme.ts'
import { buildBackgroundPrompt, buildPrompt, buildSheetPrompt } from './prompt.ts'
import { DEFAULT_BACKGROUND_STYLE, DEFAULT_PROVIDER, FOOD_TYPES, isFoodType, providerModel, type FoodType, type Theme } from './theme.ts'
import { foodTexturePath } from '../../src/foodTextures.ts'
import { backgroundTexturePath } from '../../src/backgroundTexture.ts'

const OUTPUT_ROOT = 'tools/assets/output'
const PUBLIC_ROOT = 'public'

export interface ManifestEntry {
    model: string
    prompt: string
    timestamp: string
}

export interface Manifest {
    theme: string
    slots: Partial<Record<FoodType, ManifestEntry>>
    background?: ManifestEntry
}

/** The pick name for a theme's background tile, which is not a food slot. */
export const BACKGROUND_PICK = 'background'

/** A slot's candidate (`<slot>-<n>.png`, a number) or any numbered sheet candidate (`sheet-<n>.png`). */
export type Pick = number | { sheet: number }
export type Picks = Partial<Record<FoodType, Pick>>

function pickFile(slot: FoodType, pick: Pick): string {
    return typeof pick === 'number' ? candidateFile(slot, pick) : sheetCandidateFile(pick.sheet)
}

/**
 * Parses `<slot>=<index>` (slot candidate), `<slot>=s<index>` (sheet candidate) or
 * `background=<index>` (background tile); every problem is reported, not just the first.
 */
export function parsePicks(args: readonly string[]): { picks: Picks; background?: number; errors: string[] } {
    const picks: Picks = {}
    let background: number | undefined
    const errors: string[] = []
    for (const arg of args) {
        const m = /^([^=]+)=(.*)$/.exec(arg)
        if (!m) {
            errors.push(`Malformed pick "${arg}"; expected <slot>=<index> or <slot>=s<index>`)
            continue
        }
        const [, slot, raw] = m
        if (slot === BACKGROUND_PICK) {
            const index = Number(raw)
            if (!/^\d+$/.test(raw) || index < 1) errors.push(`Invalid pick for background: "${raw}" (tile numbers start at 1)`)
            else if (background !== undefined) errors.push('Duplicate pick for background')
            else background = index
            continue
        }
        if (!isFoodType(slot)) {
            errors.push(`Unknown slot "${slot}"; expected ${BACKGROUND_PICK} or one of ${FOOD_TYPES.join(', ')}`)
            continue
        }
        const sheet = /^s(\d+)$/.exec(raw)
        if (sheet) {
            if (Number(sheet[1]) < 1) errors.push(`Invalid pick for ${slot}: "${raw}" (sheet candidates start at s1)`)
            else if (slot in picks) errors.push(`Duplicate pick for ${slot}`)
            else picks[slot] = { sheet: Number(sheet[1]) }
            continue
        }
        const index = Number(raw)
        if (!/^\d+$/.test(raw) || index < 1 || index > CANDIDATES_PER_SLOT) {
            errors.push(`Invalid pick for ${slot}: "${raw}" (expected 1..${CANDIDATES_PER_SLOT} or s<sheet number>)`)
            continue
        }
        if (slot in picks) {
            errors.push(`Duplicate pick for ${slot}`)
            continue
        }
        picks[slot] = index
    }
    return { picks, background, errors }
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** True when the file exists and starts with the PNG signature. */
async function isPng(path: string): Promise<boolean> {
    try {
        return (await readFile(path)).subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
    } catch {
        return false
    }
}

export interface PromoteOptions {
    theme: Theme
    picks: Picks
    /** Background tile candidate number (`background/tile-<n>.png`); omitted keeps the tile already in the theme. */
    background?: number
    /** Folder holding the processed candidates (`<outputDir>/food/<slot>-<n>.png`). */
    outputDir: string
    /** Root the game serves assets from; sprites land at foodTexturePath(theme, slot) beneath it. */
    publicDir: string
    now?: Date
}

/**
 * Validates first and writes nothing unless every slot is covered: by a pick whose
 * candidate is a valid PNG, or by a valid sprite already present in the theme folder.
 */
export async function promote({ theme, picks, background, outputDir, publicDir, now = new Date() }: PromoteOptions): Promise<Manifest> {
    const themeDir = `${publicDir}/assets/images/themes/${theme.name}`
    const foodDir = `${themeDir}/food`
    const manifestPath = `${themeDir}/manifest.json` // beside the sprites and the tile
    const problems: string[] = []
    if (background !== undefined) {
        if (!(await isPng(`${outputDir}/background/${backgroundCandidateFile(background)}`))) {
            problems.push(`background: tile ${background} is missing or not a valid PNG in ${outputDir}/background`)
        }
    } else if (!(await isPng(`${publicDir}/${backgroundTexturePath(theme.name)}`))) {
        problems.push('background: no pick given and no valid existing tile in the theme folder')
    }
    for (const slot of FOOD_TYPES) {
        const index = picks[slot]
        if (index !== undefined) {
            if (!(await isPng(`${outputDir}/food/${pickFile(slot, index)}`))) {
                problems.push(`${slot}: candidate ${typeof index === 'number' ? index : `s${index.sheet}`} is missing or not a valid PNG in ${outputDir}/food`)
            }
        } else if (!(await isPng(`${publicDir}/${foodTexturePath(theme.name, slot)}`))) {
            problems.push(`${slot}: no pick given and no valid existing sprite in the theme folder`)
        }
    }
    if (problems.length > 0) throw new Error(`Cannot promote theme "${theme.name}":\n  ${problems.join('\n  ')}`)

    let existingManifest: Partial<Manifest> = {}
    try {
        existingManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    } catch {
        // No previous manifest: only what is picked now gets an entry.
    }
    const existing = existingManifest.slots ?? {}

    await mkdir(foodDir, { recursive: true })
    const manifest: Manifest = { theme: theme.name, slots: {} }
    if (background === undefined) {
        if (existingManifest.background) manifest.background = existingManifest.background
    } else {
        const dest = `${publicDir}/${backgroundTexturePath(theme.name)}`
        await mkdir(dirname(dest), { recursive: true })
        await copyFile(`${outputDir}/background/${backgroundCandidateFile(background)}`, dest)
        manifest.background = {
            model: theme.background.style ?? DEFAULT_BACKGROUND_STYLE,
            prompt: buildBackgroundPrompt(theme),
            timestamp: now.toISOString(),
        }
    }
    for (const slot of FOOD_TYPES) {
        const index = picks[slot]
        if (index === undefined) {
            if (existing[slot]) manifest.slots[slot] = existing[slot]
            continue
        }
        const dest = `${publicDir}/${foodTexturePath(theme.name, slot)}`
        await copyFile(`${outputDir}/food/${pickFile(slot, index)}`, dest)
        manifest.slots[slot] = {
            model: providerModel(theme.provider ?? DEFAULT_PROVIDER),
            prompt: typeof index === 'number' ? buildPrompt(theme, slot) : buildSheetPrompt(theme),
            timestamp: now.toISOString(),
        }
    }
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
    return manifest
}

async function main() {
    const { values, positionals } = parseArgs({ options: { theme: { type: 'string' } }, allowPositionals: true })
    if (!values.theme) throw new Error('Usage: npm run assets:promote -- --theme <name> [<slot>=<index>] [background=<index>] ...')
    const { picks, background, errors } = parsePicks(positionals)
    if (errors.length > 0) throw new Error(errors.join('\n'))
    const theme = await loadTheme(values.theme)
    await promote({ theme, picks, background, outputDir: `${OUTPUT_ROOT}/${theme.name}`, publicDir: PUBLIC_ROOT })
    const promoted = [`${Object.keys(picks).length} slot(s)`, ...(background === undefined ? [] : [`background tile ${background}`])]
    console.log(`Promoted ${promoted.join(' and ')} into ${PUBLIC_ROOT}/assets/images/themes/${theme.name}`)
}

if (import.meta.main) {
    main().catch((err) => {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
    })
}
