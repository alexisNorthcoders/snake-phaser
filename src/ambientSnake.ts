export interface Cell {
    x: number
    y: number
}

export interface Rect {
    x: number
    y: number
    width: number
    height: number
}

/** Pixel size of one ambience cell: half the real game's 40px cell. */
export const AMBIENT_CELL = 20
/** Lanes in the perimeter band. */
export const BAND_LANES = 2
/** The HUD bar the band sits just below. */
export const HUD_HEIGHT = 40
export const STEP_MS = 175

/**
 * Where the lobby's UI sits, in screen pixels on the 800px layout. The band must stay clear of all of it;
 * keep in step with GameScene and ColourPanel when the lobby is re-laid out.
 */
export const LOBBY_UI_RECTS: Record<string, Rect> = {
    welcome: { x: 200, y: 90, width: 400, height: 40 },
    colourPanel: { x: 200, y: 150, width: 400, height: 230 },
    startButton: { x: 290, y: 380, width: 220, height: 40 },
    nameField: { x: 200, y: 440, width: 300, height: 40 },
    topScores: { x: 250, y: 490, width: 300, height: 150 },
    globalLeaderboard: { x: 50, y: 305, width: 250, height: 340 },
}

export interface Grid {
    cols: number
    rows: number
}

/** The grid of ambience cells covering the screen below the HUD bar. */
export function gridFor(screenWidth: number, screenHeight: number): Grid {
    return {
        cols: Math.floor(screenWidth / AMBIENT_CELL),
        rows: Math.floor((screenHeight - HUD_HEIGHT) / AMBIENT_CELL),
    }
}

export function inBand({ cols, rows }: Grid, { x, y }: Cell): boolean {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return false
    return x < BAND_LANES || y < BAND_LANES || x >= cols - BAND_LANES || y >= rows - BAND_LANES
}

/** The screen rectangle a cell covers. */
export function cellRect({ x, y }: Cell): Rect {
    return { x: x * AMBIENT_CELL, y: HUD_HEIGHT + y * AMBIENT_CELL, width: AMBIENT_CELL, height: AMBIENT_CELL }
}

export interface AmbientSnakeOptions {
    grid: Grid
    /** Uniform in [0, 1), injected so the walk is reproducible. */
    random: () => number
    length?: number
    /** Extra cells the snake must not step onto, besides its own body. */
    blocked?: (cell: Cell) => boolean
    /** Chance per step of sliding into the other lane instead of going straight. */
    laneSwitchChance?: number
}

export interface AmbientSnake {
    /** Head first. */
    readonly cells: readonly Cell[]
    /** Moves one cell; stays put when every move is blocked. */
    step(): void
}

const DIRECTIONS: Cell[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]

/** A snake wandering the band: mostly straight, sometimes changing lane, turning at the corners. */
export function createAmbientSnake({
    grid,
    random,
    length = 8,
    blocked = () => false,
    laneSwitchChance = 0.08,
}: AmbientSnakeOptions): AmbientSnake {
    let heading = DIRECTIONS[0]
    let cells: Cell[] = Array.from({ length }, (_, i) => ({ x: length - 1 - i, y: 0 }))

    const free = (cell: Cell, body: Cell[]) =>
        inBand(grid, cell) && !blocked(cell) && !body.some((c) => c.x === cell.x && c.y === cell.y)

    const pick = (options: Cell[]) => options[Math.floor(random() * options.length)]

    return {
        get cells() {
            return cells
        },
        step() {
            const head = cells[0]
            // The tail cell is vacated by this move, so it is not an obstacle.
            const body = cells.slice(0, -1)
            const at = (d: Cell): Cell => ({ x: head.x + d.x, y: head.y + d.y })
            const sideways = DIRECTIONS.filter((d) => d.x * heading.x + d.y * heading.y === 0)
            const freeSideways = sideways.filter((d) => free(at(d), body))
            const forwardFree = free(at(heading), body)

            let next: Cell | undefined
            if (forwardFree && freeSideways.length > 0 && random() < laneSwitchChance) {
                next = at(pick(freeSideways))
            } else if (forwardFree) {
                next = at(heading)
            } else if (freeSideways.length > 0) {
                const turn = pick(freeSideways)
                heading = turn
                next = at(turn)
            }
            if (next) cells = [next, ...cells.slice(0, -1)]
        },
    }
}
