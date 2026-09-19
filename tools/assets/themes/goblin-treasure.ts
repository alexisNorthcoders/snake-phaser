import type { Theme } from '../theme.ts'

export const theme: Theme = {
    name: 'goblin-treasure',
    style: 'pixel art, chunky pixels, dark fantasy goblin hoard loot, bold outlines, vibrant colours',
    size: 32,
    food: {
        redApple: 'tarnished copper coin',
        yellowApple: 'small silver ring',
        greenApple: 'mossy green bottle of grog',
        banana: 'gold nugget',
        cherry: { description: 'ruby in a crude setting', keyColour: '#00ff00' },
        strawberry: 'jewelled goblin dagger',
        chili: 'overflowing chest of gold',
    },
}
