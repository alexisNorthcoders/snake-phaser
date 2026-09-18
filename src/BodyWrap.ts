import type { Point } from './BodyPath'

/**
 * Re-lays a chain of points (head first, cell coordinates) so consecutive
 * points are never more than half the board apart: wherever a hop crosses
 * the board edge, the rest of the chain continues past the edge instead of
 * reappearing on the far side. The first point stays put.
 */
export function unwrapChain(points: Point[], boardCells: number): Point[] {
    const half = boardCells / 2
    const result: Point[] = []
    let shiftX = 0
    let shiftY = 0
    points.forEach((p, i) => {
        if (i > 0) {
            const prev = points[i - 1]
            shiftX += jump(p.x - prev.x, half, boardCells)
            shiftY += jump(p.y - prev.y, half, boardCells)
        }
        result.push({ x: p.x + shiftX, y: p.y + shiftY })
    })
    return result
}

/** The correction that undoes a hop of `delta` if it is longer than half the board. */
function jump(delta: number, half: number, boardCells: number): number {
    if (delta > half) return -boardCells
    if (delta < -half) return boardCells
    return 0
}

/**
 * Splits an unwrapped body poly-line into the pieces to draw on a wrapping
 * board: the body is copied onto each neighbouring board and every copy is cut
 * at half a cell past the board's edge, so a body crossing an edge becomes one
 * piece leaving and another entering, each overhanging by half a cell. The
 * caller clips the overhang to the game area.
 */
export function wrapPieces(path: Point[], boardCells: number): Point[][] {
    const min = -1
    const max = boardCells
    const pieces: Point[][] = []
    for (const dx of [-boardCells, 0, boardCells]) {
        for (const dy of [-boardCells, 0, boardCells]) {
            const shifted = path.map(({ x, y }) => ({ x: x + dx, y: y + dy }))
            pieces.push(...clipPolyline(shifted, min, max))
        }
    }
    return pieces
}

/** The parts of a poly-line inside the square [min, max]², as separate pieces. */
function clipPolyline(points: Point[], min: number, max: number): Point[][] {
    const pieces: Point[][] = []
    let current: Point[] = []
    const flush = () => {
        if (current.length > 0) pieces.push(current)
        current = []
    }

    if (points.length === 1 && inside(points[0], min, max)) return [[points[0]]]

    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i]
        const b = points[i + 1]
        const clipped = clipSegment(a, b, min, max)
        if (!clipped) {
            flush()
            continue
        }
        const [from, to] = clipped
        const last = current[current.length - 1]
        if (last && !samePoint(last, from)) flush()
        if (current.length === 0) current.push(from)
        if (!samePoint(current[current.length - 1], to)) current.push(to)
        if (!samePoint(to, b)) flush()
    }
    flush()
    return pieces.filter((piece) => piece.length > 1)
}

/** Liang–Barsky: the part of segment a→b inside the square, or null. */
function clipSegment(a: Point, b: Point, min: number, max: number): [Point, Point] | null {
    let t0 = 0
    let t1 = 1
    const dx = b.x - a.x
    const dy = b.y - a.y
    const edges: [number, number][] = [
        [-dx, a.x - min],
        [dx, max - a.x],
        [-dy, a.y - min],
        [dy, max - a.y],
    ]
    for (const [p, q] of edges) {
        if (p === 0) {
            if (q < 0) return null
            continue
        }
        const r = q / p
        if (p < 0) {
            if (r > t1) return null
            t0 = Math.max(t0, r)
        } else {
            if (r < t0) return null
            t1 = Math.min(t1, r)
        }
    }
    return [
        { x: a.x + dx * t0, y: a.y + dy * t0 },
        { x: a.x + dx * t1, y: a.y + dy * t1 },
    ]
}

const inside = (p: Point, min: number, max: number) => p.x >= min && p.x <= max && p.y >= min && p.y <= max

const samePoint = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9

/** Wraps a cell coordinate back onto the board, the seam sitting on the board edge. */
export function wrapCell(p: Point, boardCells: number): Point {
    const wrap = (v: number) => ((((v + 0.5) % boardCells) + boardCells) % boardCells) - 0.5
    return { x: wrap(p.x), y: wrap(p.y) }
}
