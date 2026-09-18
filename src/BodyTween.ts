import type { GridPosition } from './Snake'

/**
 * Slides a snake's body — head first, then the tail in body order — from where
 * it is drawn to the cells the latest server patch put it on, over one tick.
 * Segment i always heads for the cell segment i - 1 has just left, so lerping
 * every segment by the same fraction keeps the body contiguous.
 *
 * Nothing extrapolates: once a tick's worth of time has passed the body holds
 * on its target, so a late or dropped patch reads as a pause, not an overshoot.
 */
export class BodyTween {
    private from: GridPosition[] = []
    private to: GridPosition[] = []
    private startedAt = 0
    private tickMs: number
    private boardSize: number

    constructor(tickMs: number, boardSize: number) {
        this.tickMs = tickMs
        this.boardSize = boardSize
    }

    /** Starts a new slide towards `cells`, from wherever the body is drawn at `now`. */
    retarget(cells: GridPosition[], now: number): void {
        if (sameCells(cells, this.to)) return

        const drawn = this.positionsAt(now)
        this.from = cells.map((cell, i) => {
            const start = drawn[i]
            // No predecessor (a new snake, or a segment just grown) or a move
            // across the board edge: sliding would sweep over the whole board.
            if (!start || this.wraps(start, cell)) return cell
            return start
        })
        this.to = cells.map(({ x, y }) => ({ x, y }))
        this.startedAt = now
    }

    /** Drops the rest of the slide, so the body is drawn on its target from now on. */
    snap(): void {
        this.from = this.to
    }

    /** Where each segment is drawn at `now`, in grid units. */
    positionsAt(now: number): GridPosition[] {
        const t = Math.min(1, Math.max(0, (now - this.startedAt) / this.tickMs))
        return this.to.map((end, i) => {
            const start = this.from[i] ?? end
            return {
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t,
            }
        })
    }

    private wraps(a: GridPosition, b: GridPosition): boolean {
        const half = this.boardSize / 2
        return Math.abs(a.x - b.x) > half || Math.abs(a.y - b.y) > half
    }
}

const sameCells = (a: GridPosition[], b: GridPosition[]) =>
    a.length === b.length && a.every((cell, i) => cell.x === b[i].x && cell.y === b[i].y)
