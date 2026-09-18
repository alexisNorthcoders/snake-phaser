import type { Cell, Grid } from './ambientSnake'

/** Never more fruit than this on screen at once. */
export const MAX_FRUIT = 4
export const RESPAWN_MIN_MS = 1000
export const RESPAWN_MAX_MS = 3000

export interface AmbientFruit {
    cell: Cell
    /** Index into the caller's list of fruit images. */
    kind: number
}

export interface AmbientFruitOptions {
    grid: Grid
    /** Uniform in [0, 1), injected so placement is reproducible. */
    random: () => number
    /** Whether a cell may hold fruit (the band, clear of lobby UI). */
    allowed: (cell: Cell) => boolean
    /** Cells the snakes currently cover; fruit never lands on them. */
    occupied?: () => readonly Cell[]
    /** How many fruit to keep on the board (capped at MAX_FRUIT). */
    count?: number
    /** Number of fruit images to choose kinds from. */
    kinds?: number
}

export interface AmbientFruitField {
    readonly fruit: readonly AmbientFruit[]
    /** Removes the fruit at the cell, if any, and schedules its replacement. */
    eat(cell: Cell): void
    /** Advances the respawn timers. */
    tick(elapsedMs: number): void
}

/** A few fruit on free band cells; eaten ones come back on another free cell after 1–3 seconds. */
export function createAmbientFruit({
    grid,
    random,
    allowed,
    occupied = () => [],
    count = 3,
    kinds = 1,
}: AmbientFruitOptions): AmbientFruitField {
    const target = Math.min(count, MAX_FRUIT)
    let fruit: AmbientFruit[] = []
    /** Milliseconds left on each pending respawn. */
    let pending: number[] = []

    const spawn = (): boolean => {
        const taken = new Set([...occupied(), ...fruit.map((f) => f.cell)].map((c) => `${c.x},${c.y}`))
        const free: Cell[] = []
        for (let x = 0; x < grid.cols; x++) {
            for (let y = 0; y < grid.rows; y++) {
                if (allowed({ x, y }) && !taken.has(`${x},${y}`)) free.push({ x, y })
            }
        }
        if (free.length === 0) return false
        const cell = free[Math.floor(random() * free.length)]
        fruit = [...fruit, { cell, kind: Math.floor(random() * kinds) }]
        return true
    }

    for (let i = 0; i < target; i++) spawn()

    return {
        get fruit() {
            return fruit
        },
        eat(cell) {
            const before = fruit.length
            fruit = fruit.filter((f) => f.cell.x !== cell.x || f.cell.y !== cell.y)
            if (fruit.length < before) pending.push(RESPAWN_MIN_MS + random() * (RESPAWN_MAX_MS - RESPAWN_MIN_MS))
        },
        tick(elapsedMs) {
            pending = pending.map((ms) => ms - elapsedMs)
            const due = pending.filter((ms) => ms <= 0).length
            pending = pending.filter((ms) => ms > 0)
            // A respawn with no free cell is retried on the next tick.
            for (let i = 0; i < due; i++) if (!spawn()) pending.push(0)
        },
    }
}
