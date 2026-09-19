export const FOOD_TYPES = ['redApple', 'greenApple', 'yellowApple', 'strawberry', 'cherry', 'chili', 'banana'] as const

export type FoodType = typeof FOOD_TYPES[number]

/** Where a theme keeps the texture for a food type; the texture key is the food type itself. */
export function foodTexturePath(theme: string, type: FoodType): string {
    return `assets/images/themes/${theme}/food/${type}.png`
}
