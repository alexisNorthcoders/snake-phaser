import { FOOD_TYPES, type FoodType } from '../../src/foodTextures.ts'

export { FOOD_TYPES, type FoodType }

export const DEFAULT_PROVIDER: Provider = { kind: 'retro-diffusion', style: 'rd_fast__mc_item' }
export const DEFAULT_BACKGROUND = 'plain white'

export interface Provider {
    kind: 'retro-diffusion'
    /** Retro Diffusion `prompt_style`; the style, not the prompt, supplies the pixel-art look. */
    style: string
}

export interface Theme {
    name: string
    /** Image provider; defaults to DEFAULT_PROVIDER. */
    provider?: Provider
    /** Flat colour stated in every prompt (removed by the provider); defaults to DEFAULT_BACKGROUND. */
    background?: string
    /** Output sprite edge length in pixels. */
    size: 32
    /** Keyed exactly by the food types: a missing or extra slot is a compile error. Values are item descriptions. */
    food: Record<FoodType, string>
}

export function isFoodType(value: string): value is FoodType {
    return (FOOD_TYPES as readonly string[]).includes(value)
}
