import { DEFAULT_BACKGROUND, FOOD_TYPES, type FoodType, type Theme } from './theme.ts'

/** The item description plus the stated background; the provider's style handles the look, so no style words are added. */
export function buildPrompt(theme: Theme, slot: FoodType): string {
    return `${theme.food[slot]}, on a ${theme.background ?? DEFAULT_BACKGROUND} background`
}

/** One prompt naming every food item, laid out as separate, evenly spaced icons in a grid on the flat background. */
export function buildSheetPrompt(theme: Theme): string {
    const items = FOOD_TYPES.map((slot, i) => `${i + 1}. ${theme.food[slot]}`)
    const columns = Math.ceil(Math.sqrt(items.length))
    const rows = Math.ceil(items.length / columns)
    return (
        `A sheet of ${items.length} separate game item icons in a grid of ${columns} columns and ${rows} rows, ` +
        `each icon a single item, widely and evenly spaced apart so none touch, on a flat ${theme.background ?? DEFAULT_BACKGROUND} background, ` +
        `no shadows, no text, no labels. The items: ${items.join('; ')}`
    )
}
