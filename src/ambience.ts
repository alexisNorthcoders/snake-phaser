import { PALETTE, type Appearance } from './appearanceStore.ts'
import { STEP_MS, createAmbientSnake, inBand, type AmbientSnake, type Cell, type Grid } from './ambientSnake.ts'

/** How long a dead snake takes to fade out. */
export const FADE_MS = 1000
/** Time from a snake's death to its respawn (counted from the death, so this includes the fade). */
export const RESPAWN_MS = 2000
export const SPAWN_LENGTH = 8
export const RESPAWN_LENGTH = 3
export const AMBIENT_COUNT = 3
/** Higher than a lone snake's: crossing lanes is what brings snakes into each other's way (a death every 45s or so). */
const LANE_SWITCH_CHANCE = 0.25


export interface AmbientColours {
    head: string
    body: string
}

export interface AmbientEntity {
    /** Head first. */
    readonly cells: readonly Cell[]
    readonly colours: AmbientColours
    /** Trapped, so drawn with the dead-snake look while it fades and waits to respawn. */
    readonly dead: boolean
    /** 1 while alive, fading to 0 over FADE_MS once dead. */
    readonly opacity: number
}

export interface Ambience {
    readonly snakes: readonly AmbientEntity[]
    /** Advances the world by `ms`: live snakes move one cell, dead ones fade and respawn. */
    step(ms?: number): void
}

export interface AmbienceOptions {
    grid: Grid
    /** Uniform in [0, 1), injected so the world is reproducible. */
    random: () => number
    /** The player's current colours, read every step: they load late for logged-in players and change in the panel. */
    playerColours?: () => Appearance | undefined
    count?: number
    length?: number
    /** Fruit on the board, handed to every snake (including respawned ones) to seek and eat. */
    fruit?: () => readonly Cell[]
    /** Called when any snake's head lands on a fruit cell. */
    onEat?: (cell: Cell) => void
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const key = ({ x, y }: Cell) => `${x},${y}`

/** A head/body pair from the palette: different from each other and from the player's head and body colours. */
export function pickAmbientColours(random: () => number, player?: Appearance): AmbientColours {
    const pick = (pool: readonly string[]) => pool[Math.floor(random() * pool.length)]
    const pool = PALETTE.filter((c) => !player || (!same(c, player.head) && !same(c, player.body)))
    const head = pick(pool)
    return { head, body: pick(pool.filter((c) => c !== head)) }
}

const clashes = (colours: AmbientColours, player?: Appearance) =>
    !!player && [colours.head, colours.body].some((c) => same(c, player.head) || same(c, player.body))

/** The outermost lane as a loop, clockwise from the top-left cell. */
function ring({ cols, rows }: Grid): Cell[] {
    const cells: Cell[] = []
    for (let x = 0; x < cols; x++) cells.push({ x, y: 0 })
    for (let y = 1; y < rows; y++) cells.push({ x: cols - 1, y })
    for (let x = cols - 2; x >= 0; x--) cells.push({ x, y: rows - 1 })
    for (let y = rows - 2; y >= 1; y--) cells.push({ x: 0, y })
    return cells
}

interface Entity extends AmbientEntity {
    snake: AmbientSnake
    colours: AmbientColours
    deadMs: number
}

/**
 * Several snakes sharing the band: none takes a taken cell, and one dies only when trapped, i.e. has no free
 * cell ahead or to the side (they don't back out tail-first, which is what makes deaths an occasional event).
 */
export function createAmbience({
    grid, random, playerColours = () => undefined, count = AMBIENT_COUNT, length = SPAWN_LENGTH, fruit, onEat,
}: AmbienceOptions): Ambience {
    const entities: Entity[] = []
    // Bodies still on screen; a fully faded corpse no longer blocks anyone.
    const visible = (e: Entity) => e.deadMs < FADE_MS
    const occupiedBy = (self: Entity) => {
        const taken = new Set<string>()
        for (const other of entities) {
            if (other !== self && visible(other)) other.snake.cells.forEach((c) => taken.add(key(c)))
        }
        return taken
    }
    const blockedFor = (self: Entity) => (cell: Cell) => occupiedBy(self).has(key(cell))

    // Initial snakes and respawns share the same movement rules, so a respawned snake also dies only when trapped.
    const spawnSnake = (entity: Entity, start: { cells: Cell[]; heading: Cell }, len: number) =>
        createAmbientSnake({
            grid, random, length: len, start, blocked: blockedFor(entity), reverses: false, laneSwitchChance: LANE_SWITCH_CHANCE, fruit, onEat,
        })

    const makeEntity = (colours: AmbientColours, start: { cells: Cell[]; heading: Cell }, len: number): Entity => {
        const entity: Entity = {
            colours,
            deadMs: -1,
            snake: undefined as unknown as AmbientSnake,
            get cells() { return entity.snake.cells },
            get dead() { return entity.deadMs >= 0 },
            get opacity() { return entity.deadMs < 0 ? 1 : Math.max(0, 1 - entity.deadMs / FADE_MS) },
        }
        entity.snake = spawnSnake(entity, start, len)
        return entity
    }

    // Evenly spaced round the ring, alternating the way round they face.
    const loop = ring(grid)
    for (let i = 0; i < count; i++) {
        const base = Math.floor((i * loop.length) / count)
        const clockwise = i % 2 === 0
        const run = Array.from({ length }, (_, j) => loop[(base + j) % loop.length])
        // Clockwise the head leads at the far end of the run; anticlockwise at the near end.
        const cells = clockwise ? [...run].reverse() : run
        const ahead = loop[(clockwise ? base + length : base - 1 + loop.length) % loop.length]
        const heading = { x: ahead.x - cells[0].x, y: ahead.y - cells[0].y }
        entities.push(makeEntity(pickAmbientColours(random, playerColours()), { cells, heading }, length))
    }

    const respawn = (entity: Entity): boolean => {
        const taken = occupiedBy(entity)
        const free = (c: Cell) => inBand(grid, c) && !taken.has(key(c))
        const options: { cells: Cell[]; heading: Cell }[] = []
        for (let x = 0; x < grid.cols; x++) {
            for (let y = 0; y < grid.rows; y++) {
                for (const heading of [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]) {
                    const cells = Array.from({ length: RESPAWN_LENGTH }, (_, i) => ({ x: x - i * heading.x, y: y - i * heading.y }))
                    if (cells.every(free) && free({ x: x + heading.x, y: y + heading.y })) options.push({ cells, heading })
                }
            }
        }
        if (options.length === 0) return false
        const start = options[Math.floor(random() * options.length)]
        entity.snake = spawnSnake(entity, start, RESPAWN_LENGTH)
        entity.deadMs = -1
        return true
    }

    return {
        snakes: entities,
        step(ms = STEP_MS) {
            const player = playerColours()
            for (const entity of entities) {
                if (clashes(entity.colours, player)) entity.colours = pickAmbientColours(random, player)
                if (!entity.dead) {
                    if (!entity.snake.step()) entity.deadMs = 0
                    continue
                }
                entity.deadMs += ms
                if (entity.deadMs >= RESPAWN_MS) respawn(entity)
            }
        },
    }
}

