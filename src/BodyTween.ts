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
    // The tail's cell before its latest retarget, kept apart from `from` since
    // `snap()` collapses `from` onto `to` and would otherwise erase it.
    private tailPreviousCell: GridPosition = { x: 0, y: 0 }
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

        // A grown tail (one more cell than before) has no previous cell of its
        // own yet; otherwise it's wherever the tail was heading before this.
        const oldTail = this.to[this.to.length - 1]
        this.tailPreviousCell =
            cells.length > this.to.length || !oldTail
                ? { x: cells[cells.length - 1].x, y: cells[cells.length - 1].y }
                : { x: oldTail.x, y: oldTail.y }

        this.to = cells.map(({ x, y }) => ({ x, y }))
        this.startedAt = now
    }

    /** Drops the rest of the slide, so the body is drawn on its target from now on. */
    snap(): void {
        this.from = this.to
    }

    /** Where each segment is drawn at `now`, in grid units. */
    positionsAt(now: number): GridPosition[] {
        const t = this.progressAt(now)
        return this.to.map((end, i) => {
            const start = this.from[i] ?? end
            return {
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t,
            }
        })
    }

    /** How far through the current tick's slide `now` falls, from 0 to 1. */
    progressAt(now: number): number {
        return Math.min(1, Math.max(0, (now - this.startedAt) / this.tickMs))
    }

    /** The cells this tick's slide is heading for, head first. */
    get targets(): GridPosition[] {
        return this.to.map(({ x, y }) => ({ x, y }))
    }

    /** The cell the tail segment is sliding away from this tick. */
    get tailPrevious(): GridPosition {
        return { ...this.tailPreviousCell }
    }

    private wraps(a: GridPosition, b: GridPosition): boolean {
        const half = this.boardSize / 2
        return Math.abs(a.x - b.x) > half || Math.abs(a.y - b.y) > half
    }
}

const sameCells = (a: GridPosition[], b: GridPosition[]) =>
    a.length === b.length && a.every((cell, i) => cell.x === b[i].x && cell.y === b[i].y)
