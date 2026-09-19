import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { CANDIDATES_PER_SLOT, candidateFile } from './candidates.ts'
import { loadTheme } from './loadTheme.ts'
import { buildPrompt } from './prompt.ts'
import { DEFAULT_MODEL, FOOD_TYPES, isFoodType, resolveSlot, type FoodType, type Theme } from './theme.ts'
import { foodTexturePath } from '../../src/foodTextures.ts'

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
}

/** Parses `<slot>=<index>` arguments; every problem is reported, not just the first. */
export function parsePicks(args: readonly string[]): { picks: Partial<Record<FoodType, number>>; errors: string[] } {
    const picks: Partial<Record<FoodType, number>> = {}
    const errors: string[] = []
    for (const arg of args) {
        const m = /^([^=]+)=(.*)$/.exec(arg)
        if (!m) {
            errors.push(`Malformed pick "${arg}"; expected <slot>=<index>`)
            continue
        }
        const [, slot, raw] = m
        if (!isFoodType(slot)) {
            errors.push(`Unknown slot "${slot}"; expected one of ${FOOD_TYPES.join(', ')}`)
            continue
        }
        const index = Number(raw)
        if (!/^\d+$/.test(raw) || index < 1 || index > CANDIDATES_PER_SLOT) {
            errors.push(`Invalid pick for ${slot}: "${raw}" (expected 1..${CANDIDATES_PER_SLOT})`)
            continue
        }
        if (slot in picks) {
            errors.push(`Duplicate pick for ${slot}`)
            continue
        }
        picks[slot] = index
    }
    return { picks, errors }
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
    picks: Partial<Record<FoodType, number>>
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
export async function promote({ theme, picks, outputDir, publicDir, now = new Date() }: PromoteOptions): Promise<Manifest> {
    const foodDir = `${publicDir}/assets/images/themes/${theme.name}/food`
    const manifestPath = `${foodDir}/manifest.json` // beside the sprites
    const problems: string[] = []
    for (const slot of FOOD_TYPES) {
        const index = picks[slot]
        if (index !== undefined) {
            if (!(await isPng(`${outputDir}/food/${candidateFile(slot, index)}`))) {
                problems.push(`${slot}: candidate ${index} is missing or not a valid PNG in ${outputDir}/food`)
            }
        } else if (!(await isPng(`${publicDir}/${foodTexturePath(theme.name, slot)}`))) {
            problems.push(`${slot}: no pick given and no valid existing sprite in the theme folder`)
        }
    }
    if (problems.length > 0) throw new Error(`Cannot promote theme "${theme.name}":\n  ${problems.join('\n  ')}`)

    let existing: Manifest['slots'] = {}
    try {
        existing = JSON.parse(await readFile(manifestPath, 'utf8')).slots ?? {}
    } catch {
        // No previous manifest: only the picked slots get entries.
    }

    await mkdir(foodDir, { recursive: true })
    const manifest: Manifest = { theme: theme.name, slots: {} }
    for (const slot of FOOD_TYPES) {
        const index = picks[slot]
        if (index === undefined) {
            if (existing[slot]) manifest.slots[slot] = existing[slot]
            continue
        }
        const dest = `${publicDir}/${foodTexturePath(theme.name, slot)}`
        await copyFile(`${outputDir}/food/${candidateFile(slot, index)}`, dest)
        manifest.slots[slot] = {
            model: theme.model ?? DEFAULT_MODEL,
            prompt: buildPrompt(theme, resolveSlot(theme, slot)),
            timestamp: now.toISOString(),
        }
    }
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
    return manifest
}

async function main() {
    const { values, positionals } = parseArgs({ options: { theme: { type: 'string' } }, allowPositionals: true })
    if (!values.theme) throw new Error('Usage: npm run assets:promote -- --theme <name> <slot>=<index> ...')
    const { picks, errors } = parsePicks(positionals)
    if (errors.length > 0) throw new Error(errors.join('\n'))
    const theme = await loadTheme(values.theme)
    await promote({ theme, picks, outputDir: `${OUTPUT_ROOT}/${theme.name}`, publicDir: PUBLIC_ROOT })
    console.log(`Promoted ${Object.keys(picks).length} slot(s) into ${PUBLIC_ROOT}/assets/images/themes/${theme.name}/food`)
}

if (import.meta.main) {
    main().catch((err) => {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
    })
}
