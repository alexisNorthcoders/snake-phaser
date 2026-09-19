import { DEFAULT_BACKGROUND, type FoodType, type Theme } from './theme.ts'

/** The item description plus the stated background; the provider's style handles the look, so no style words are added. */
export function buildPrompt(theme: Theme, slot: FoodType): string {
    return `${theme.food[slot]}, on a ${theme.background ?? DEFAULT_BACKGROUND} background`
}
