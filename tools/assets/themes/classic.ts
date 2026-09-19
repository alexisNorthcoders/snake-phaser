import type { Theme } from '../theme.ts'

/**
 * The original look: plain fruit on a light-green lawn. The food sprites shipped with the game
 * (16x16, hand-drawn) and are not generated; the descriptions record what they show, so a re-roll
 * of the theme stays recognisably classic.
 */
export const theme: Theme = {
    name: 'classic',
    background: {
        description: 'a flat light green grass lawn of short even blades, soft pastel green with a subtle two-tone checker pattern and no objects on it',
    },
    size: 32,
    food: {
        redApple: 'a single bright red apple with a short brown stem and one small green leaf',
        yellowApple: 'a single golden yellow apple with a short brown stem and one small green leaf',
        greenApple: 'a single bright green apple with a short brown stem and one small green leaf',
        banana: 'a single ripe yellow banana, curved, with a small brown tip',
        cherry: 'a pair of round red cherries joined by a green stem',
        strawberry: 'a single red strawberry with tiny yellow seeds and a green leafy top',
        chili: 'a single curved red chili pepper with a short green stem',
    },
}
