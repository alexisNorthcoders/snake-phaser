import { mkdir, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { DEFAULT_MODEL, isFoodType, resolveSlot, FOOD_TYPES, type FoodType, type Theme } from './theme.ts'
import { buildPrompt } from './prompt.ts'
import { generateImage } from './deepinfra.ts'
import { processSprite } from './postprocess.ts'

const OUTPUT_ROOT = 'tools/assets/output'

async function loadTheme(name: string): Promise<Theme> {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid theme name "${name}"`)
    try {
        return (await import(`./themes/${name}.ts`)).theme
    } catch (err) {
        throw new Error(`Could not load theme "${name}" from tools/assets/themes/${name}.ts: ${(err as Error).message}`)
    }
}

async function main() {
    const { values } = parseArgs({ options: { theme: { type: 'string' }, only: { type: 'string' } } })
    if (!values.theme) throw new Error('Usage: npm run assets:generate -- --theme <name> [--only <foodType>]')

    try {
        process.loadEnvFile('.env.local')
    } catch {
        // No env file: the key may still come from the environment.
    }

    const theme = await loadTheme(values.theme)
    let slots: readonly FoodType[] = FOOD_TYPES
    if (values.only) {
        if (!isFoodType(values.only)) throw new Error(`Unknown food type "${values.only}"; expected one of ${FOOD_TYPES.join(', ')}`)
        slots = [values.only]
    }

    const dir = `${OUTPUT_ROOT}/${theme.name}`
    await mkdir(`${dir}/raw`, { recursive: true })
    await mkdir(`${dir}/food`, { recursive: true })

    for (const slot of slots) {
        const resolved = resolveSlot(theme, slot)
        const model = theme.model ?? DEFAULT_MODEL
        console.log(`Generating ${slot} with ${model}...`)
        const raw = await generateImage(
            { prompt: buildPrompt(theme, resolved), model },
            { apiKey: process.env.DEEPINFRA_API_KEY },
        )
        await writeFile(`${dir}/raw/${slot}.png`, raw)
        const processed = await processSprite(raw, { keyColour: resolved.keyColour, size: theme.size })
        await writeFile(`${dir}/food/${slot}.png`, processed)
        console.log(`  wrote ${dir}/raw/${slot}.png and ${dir}/food/${slot}.png`)
    }
}

main().catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
})
