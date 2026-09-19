import type { Theme } from '../theme.ts'

export const theme: Theme = {
    name: 'goblin-treasure',
    provider: { kind: 'retro-diffusion', style: 'rd_fast__mc_item' },
    background: 'plain white',
    palette: 'tools/assets/themes/goblin-treasure.palette.png',
    size: 32,
    food: {
        redApple: 'a single tarnished copper coin, thick round disc with a crude goblin face stamped on it, worn dull orange-brown metal with a bright highlight on the upper-left rim',
        yellowApple: 'a small silver ring, plain thick band with a tiny chip of blue glass set on top, shiny cool grey metal with a white highlight',
        greenApple: 'a squat round glass bottle of goblin grog, murky green liquid, cork stopper, patches of moss on the glass, bright highlight on the upper-left',
        banana: 'a round shiny gold nugget, a chunky ball of bright yellow gold with a slightly bumpy surface, orange shading on the lower-right and white sparkle highlights on the upper-left',
        cherry: 'a single large loose red ruby, cut into a faceted gem shape with a flat top and pointed bottom, deep crimson facets with bright pink edges and a white glint on the upper-left',
        strawberry: 'a crude lopsided gold crown with jagged uneven points, set with mismatched red and green gems, bright yellow gold with orange shading and a white highlight on the upper-left',
        chili: 'a small wooden treasure chest with iron bands, lid thrown wide open, heaped high with gold coins spilling over the edges',
    },
}
