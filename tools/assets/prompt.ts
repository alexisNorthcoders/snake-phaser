import { DEFAULT_BACKDROP, FOOD_TYPES, type FoodType, type Theme } from './theme.ts'

/** The item description plus the stated backdrop; the provider's style handles the look, so no style words are added. */
export function buildPrompt(theme: Theme, slot: FoodType): string {
    return `${theme.food[slot]}, on a ${theme.backdrop ?? DEFAULT_BACKDROP} background`
}

/** One prompt naming every food item, laid out as separate, evenly spaced icons in a grid on the flat background. */
export function buildSheetPrompt(theme: Theme): string {
    const items = FOOD_TYPES.map((slot, i) => `${i + 1}. ${theme.food[slot]}`)
    const columns = Math.ceil(Math.sqrt(items.length))
    const rows = Math.ceil(items.length / columns)
    return (
        `A sheet of ${items.length} separate game item icons in a grid of ${columns} columns and ${rows} rows, ` +
        `each icon a single item, widely and evenly spaced apart so none touch, on a flat ${theme.backdrop ?? DEFAULT_BACKDROP} background, ` +
        `no shadows, no text, no labels. The items: ${items.join('; ')}`
    )
}

/**
 * The tile description alone: seamlessness comes from the request's tiling flags, not from
 * prompt words, and the style supplies the look — so nothing is added here.
 */
export function buildBackgroundPrompt(theme: Theme): string {
    return theme.background.description
}
