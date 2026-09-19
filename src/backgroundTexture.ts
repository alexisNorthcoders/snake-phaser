/** Texture key for the theme's background tile; one tile per theme, repeated across the board. */
export const BACKGROUND_TEXTURE = 'background'

/** Where a theme keeps its seamless background tile. */
export function backgroundTexturePath(theme: string): string {
    return `assets/images/themes/${theme}/background/tile.png`
}
