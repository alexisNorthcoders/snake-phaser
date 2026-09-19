import { FOOD_TYPES, isFoodType, type FoodType } from './theme.ts'

export const CANDIDATES_PER_SLOT = 4

/** Candidate indices are 1-based and fixed: re-rolling a slot rewrites indices 1..4 of that slot only. */
export function candidateFile(slot: FoodType, index: number): string {
    return `${slot}-${index}.png`
}

export interface Candidate {
    slot: FoodType
    index: number
}

/** Resolves `--only` values (repeated flags, comma lists or trailing positionals) to slots; no values means every slot. */
export function resolveSlots(only: readonly string[]): readonly FoodType[] {
    const names = only.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)
    if (names.length === 0) return FOOD_TYPES
    const slots: FoodType[] = []
    for (const name of names) {
        if (!isFoodType(name)) throw new Error(`Unknown food type "${name}"; expected one of ${FOOD_TYPES.join(', ')}`)
        if (!slots.includes(name)) slots.push(name)
    }
    return slots
}

/** Self-contained contact sheet; paths are relative to the theme output folder. */
export function renderContactSheet(themeName: string, candidates: readonly Candidate[]): string {
    const sections = FOOD_TYPES.map((slot) => {
        const cells = candidates
            .filter((c) => c.slot === slot)
            .sort((a, b) => a.index - b.index)
            .map(({ index }) => {
                const label = `${slot} #${index}`
                const img = `food/${candidateFile(slot, index)}`
                return `<figure><div class="board"><img src="${img}" width="32" height="32" alt="${label} 1x"><img src="${img}" width="128" height="128" alt="${label} 4x"></div><figcaption>${label} · <a href="raw/${candidateFile(slot, index)}">raw</a></figcaption></figure>`
            })
        if (cells.length === 0) return ''
        return `<section><h2>${slot}</h2><div class="row">${cells.join('')}</div></section>`
    }).join('\n')
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>${themeName} candidates</title>
<style>
body{background:#111;color:#ddd;font-family:sans-serif;margin:1rem}
.row{display:flex;flex-wrap:wrap;gap:1rem}
figure{margin:0}
.board{background:#1b2a1b;padding:8px;display:flex;align-items:flex-end;gap:12px;image-rendering:pixelated}
.board img{image-rendering:pixelated}
a{color:#8cf}
</style></head><body>
<h1>${themeName}</h1>
${sections}
</body></html>
`
}
