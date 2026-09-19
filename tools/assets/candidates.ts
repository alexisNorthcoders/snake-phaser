import { FOOD_TYPES, isFoodType, type FoodType } from './theme.ts'

export const CANDIDATES_PER_SLOT = 4

/** Candidate indices are 1-based and fixed: re-rolling a slot rewrites indices 1..4 of that slot only. */
export function candidateFile(slot: FoodType, index: number): string {
    return `${slot}-${index}.png`
}

/** Background candidates are numbered across every run: `background-<n>.png`. */
export function backgroundCandidateFile(index: number): string {
    return `background-${index}.png`
}

/** Sheet candidates are numbered across every sheet generated so far: `sheet-<n>.png`. */
export function sheetCandidateFile(index: number): string {
    return `sheet-${index}.png`
}

export interface Candidate {
    slot: FoodType
    index: number
}

/** Resolves `--only` values (repeated flags or comma lists) to slots; no values means every slot. */
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
export function renderContactSheet(
    themeName: string,
    candidates: readonly Candidate[],
    sheetCandidates: readonly number[] = [],
    backgroundCandidates: readonly number[] = [],
): string {
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
    const sheetCells = [...sheetCandidates]
        .sort((a, b) => a - b)
        .map((index) => {
            const label = `sheet #${index}`
            const img = `food/${sheetCandidateFile(index)}`
            return `<figure><div class="board"><img src="${img}" width="32" height="32" alt="${label} 1x"><img src="${img}" width="128" height="128" alt="${label} 4x"></div><figcaption>${label} · <a href="raw/${sheetCandidateFile(index)}">raw</a></figcaption></figure>`
        })
    // Shown at a quarter of the board so several fit side by side; the link opens the shipped pixels.
    const backgroundCells = [...backgroundCandidates]
        .sort((a, b) => a - b)
        .map((index) => {
            const label = `background #${index}`
            const img = `background/${backgroundCandidateFile(index)}`
            return `<figure><a href="${img}"><img class="bg" src="${img}" width="200" height="200" alt="${label}"></a><figcaption>${label} · <a href="raw/${backgroundCandidateFile(index)}">raw</a></figcaption></figure>`
        })
    const backgroundSection = backgroundCells.length > 0 ? `<section><h2>backgrounds</h2><div class="row">${backgroundCells.join('')}</div></section>` : ''
    const sheetSection = sheetCells.length > 0 ? `<section><h2>sheet candidates</h2><div class="row">${sheetCells.join('')}</div></section>` : ''
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>${themeName} candidates</title>
<style>
body{background:#111;color:#ddd;font-family:sans-serif;margin:1rem}
.row{display:flex;flex-wrap:wrap;gap:1rem}
figure{margin:0}
.board{background:#1b2a1b;padding:8px;display:flex;align-items:flex-end;gap:12px;image-rendering:pixelated}
.board img{image-rendering:pixelated}
.bg{image-rendering:pixelated;display:block}
a{color:#8cf}
</style></head><body>
<h1>${themeName}</h1>
${backgroundSection}
${sheetSection}
${sections}
</body></html>
`
}
