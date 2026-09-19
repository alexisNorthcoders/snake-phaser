/** Texture key for the theme's background; one image per theme, drawn across the whole board. */
export const BACKGROUND_TEXTURE = 'background'

/** Where a theme keeps its background image. */
export function backgroundTexturePath(theme: string): string {
    return `assets/images/themes/${theme}/background.png`
}
