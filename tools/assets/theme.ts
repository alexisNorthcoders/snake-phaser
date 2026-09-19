import { FOOD_TYPES, type FoodType } from '../../src/foodTextures.ts'

export { FOOD_TYPES, type FoodType }

export const DEFAULT_MODEL = 'black-forest-labs/FLUX-1-schnell'
export const DEFAULT_KEY_COLOUR = '#ff00ff'

/** A food slot is either a bare description or one with its own key colour (for items that clash with the theme's). */
export type FoodSlot = string | { description: string; keyColour: string }

export interface Theme {
    name: string
    /** DeepInfra model id; falls back to DEFAULT_MODEL. */
    model?: string
    /** Style phrase shared by every prompt in the theme. */
    style: string
    /** Output sprite edge length in pixels. */
    size: 32
    /** Background colour rendered behind items and then removed; defaults to DEFAULT_KEY_COLOUR. */
    keyColour?: string
    palette?: string[]
    /** Keyed exactly by the food types: a missing or extra slot is a compile error. */
    food: Record<FoodType, FoodSlot>
}

export interface ResolvedSlot {
    description: string
    keyColour: string
}

export function resolveSlot(theme: Theme, slot: FoodType): ResolvedSlot {
    const entry = theme.food[slot]
    if (typeof entry === 'string') {
        return { description: entry, keyColour: theme.keyColour ?? DEFAULT_KEY_COLOUR }
    }
    return entry
}

export function isFoodType(value: string): value is FoodType {
    return (FOOD_TYPES as readonly string[]).includes(value)
}
