import { FOOD_TYPES, type FoodType } from '../../src/foodTextures.ts'

export { FOOD_TYPES, type FoodType }

export const DEFAULT_PROVIDER: RetroDiffusionProvider = { kind: 'retro-diffusion', style: 'rd_fast__mc_item' }
export const DEFAULT_BACKGROUND = 'plain white'

export const DEFAULT_SHEET_MODEL = 'black-forest-labs/FLUX-1-schnell'

export interface RetroDiffusionProvider {
    kind: 'retro-diffusion'
    /** Retro Diffusion `prompt_style`; the style, not the prompt, supplies the pixel-art look. */
    style: string
}

/** Free route: one DeepInfra sheet of every food item, cut apart and rebuilt at 32x32 by the Pixel Fixer. */
export interface DeepInfraSheetProvider {
    kind: 'deepinfra-sheet'
    /** DeepInfra image model; defaults to DEFAULT_SHEET_MODEL. */
    model?: string
}

export type Provider = RetroDiffusionProvider | DeepInfraSheetProvider

/** The model or style name recorded in the promote manifest. */
export function providerModel(provider: Provider): string {
    return provider.kind === 'retro-diffusion' ? provider.style : (provider.model ?? DEFAULT_SHEET_MODEL)
}

export interface Theme {
    name: string
    /** Image provider; defaults to DEFAULT_PROVIDER. */
    provider?: Provider
    /** Flat colour stated in every prompt (removed by the provider); defaults to DEFAULT_BACKGROUND. */
    background?: string
    /** Optional palette image (path from the repo root, committed with the theme) shared by every sprite so they look like one set. */
    palette?: string
    /** Output sprite edge length in pixels. */
    size: 32
    /** Keyed exactly by the food types: a missing or extra slot is a compile error. Values are item descriptions. */
    food: Record<FoodType, string>
}

export function isFoodType(value: string): value is FoodType {
    return (FOOD_TYPES as readonly string[]).includes(value)
}
