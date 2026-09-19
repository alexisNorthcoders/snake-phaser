import type { Theme } from '../theme.ts'

export const theme: Theme = {
    name: 'goblin-treasure',
    provider: { kind: 'retro-diffusion', style: 'rd_fast__mc_item' },
    background: 'plain white',
    size: 32,
    food: {
        redApple: 'a single tarnished copper coin, thick round disc with a crude goblin face stamped on it, worn dull orange-brown metal with a bright highlight on the upper-left rim',
        yellowApple: 'a small silver ring, plain thick band with a tiny chip of blue glass set on top, shiny cool grey metal with a white highlight',
        greenApple: 'a squat round glass bottle of goblin grog, murky green liquid, cork stopper, patches of moss on the glass, bright highlight on the upper-left',
        banana: 'an irregular shiny gold nugget, lumpy rounded rock of bright yellow gold with orange shading and white sparkle highlights',
        cherry: 'a large faceted red ruby held in a crude black iron claw setting, glowing crimson with a white glint',
        strawberry: 'a jewelled goblin dagger, short jagged steel blade, leather-wrapped hilt with a green emerald in the pommel, pointing diagonally up-right',
        chili: 'a small wooden treasure chest with iron bands, lid thrown wide open, heaped high with gold coins spilling over the edges',
    },
}
