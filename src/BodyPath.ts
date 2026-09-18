import type { GridPosition } from './Snake'

export interface Point {
    x: number
    y: number
}

const RADIUS = 0.5
const ARC_STEPS = 8

type Segment =
    | { kind: 'line'; from: Point; to: Point; length: number }
    | { kind: 'arc'; center: Point; radius: number; startAngle: number; endAngle: number; length: number }

/**
 * Builds the rounded 'arcs' spine for a body and returns the visible
 * poly-line: the target cell centres (head first) plus the tail's previous
 * cell, corners rounded into quarter-arcs of radius ½ cell, trimmed by
 * `1 - t` cells from the head end and `t` cells from the tail end.
 *
 * Every hop between input points counts as exactly 1 unit of path length
 * whether it ends up straight or rounded, so the pre-trim path always
 * measures `targets.length` cells and the visible part always measures
 * `targets.length - 1` — a corner cuts distance, not length. A hop with no
 * length (a segment just grown onto its predecessor's cell) contributes
 * nothing and rounds no corner.
 */
export function arcBodyPath(targets: GridPosition[], tailPrevious: GridPosition, t: number): Point[] {
    const segments = buildSegments([...targets, tailPrevious])
    return trimmedPolyline(segments, 1 - t, t)
}

/** The pre-trim path length in cells, for tests. */
export function arcBodyLength(targets: GridPosition[], tailPrevious: GridPosition): number {
    return buildSegments([...targets, tailPrevious]).reduce((sum, seg) => sum + seg.length, 0)
}

function buildSegments(points: Point[]): Segment[] {
    const dirs: (Point | null)[] = []
    for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i + 1].x - points[i].x
        const dy = points[i + 1].y - points[i].y
        const len = Math.hypot(dx, dy)
        dirs.push(len === 0 ? null : { x: dx / len, y: dy / len })
    }

    const isCorner = (k: number): boolean => {
        const a = dirs[k - 1]
        const b = dirs[k]
        if (!a || !b) return false
        return a.x !== b.x || a.y !== b.y
    }

    const segments: Segment[] = []
    for (let hop = 0; hop < points.length - 1; hop++) {
        const dir = dirs[hop]
        if (!dir) continue

        const startsWithCorner = hop > 0 && isCorner(hop)
        const endsWithCorner = hop + 1 < points.length - 1 && isCorner(hop + 1)

        if (startsWithCorner) {
            segments.push(makeArc(points[hop], dirs[hop - 1]!, dir))
        }

        const from = startsWithCorner ? addScaled(points[hop], dir, RADIUS) : points[hop]
        const to = endsWithCorner ? addScaled(points[hop + 1], dir, -RADIUS) : points[hop + 1]
        const length = Math.hypot(to.x - from.x, to.y - from.y)
        if (length > 1e-9) segments.push({ kind: 'line', from, to, length })
    }
    return segments
}

function makeArc(corner: Point, dirIn: Point, dirOut: Point): Segment {
    const center = {
        x: corner.x + RADIUS * (dirOut.x - dirIn.x),
        y: corner.y + RADIUS * (dirOut.y - dirIn.y),
    }
    const tangentIn = addScaled(corner, dirIn, -RADIUS)
    const startAngle = Math.atan2(tangentIn.y - center.y, tangentIn.x - center.x)
    const cross = dirIn.x * dirOut.y - dirIn.y * dirOut.x
    const endAngle = startAngle + (cross > 0 ? Math.PI / 2 : -Math.PI / 2)
    return { kind: 'arc', center, radius: RADIUS, startAngle, endAngle, length: 1 }
}

function trimmedPolyline(segments: Segment[], headTrim: number, tailTrim: number): Point[] {
    const total = segments.reduce((sum, seg) => sum + seg.length, 0)
    const start = clamp(headTrim, 0, total)
    const end = clamp(total - tailTrim, start, total)

    const points: Point[] = []
    let cursor = 0
    for (const seg of segments) {
        const segStart = cursor
        const segEnd = cursor + seg.length
        cursor = segEnd
        if (segEnd <= start || segStart >= end) continue

        const from = Math.max(start, segStart)
        const to = Math.min(end, segEnd)
        const f0 = (from - segStart) / seg.length
        const f1 = (to - segStart) / seg.length

        if (seg.kind === 'line') {
            pushPoint(points, lerp(seg.from, seg.to, f0))
            if (f1 > f0) pushPoint(points, lerp(seg.from, seg.to, f1))
        } else {
            const steps = Math.max(1, Math.round(ARC_STEPS * (f1 - f0)))
            for (let s = 0; s <= steps; s++) {
                const f = f0 + (f1 - f0) * (s / steps)
                pushPoint(points, pointOnArc(seg, f))
            }
        }
    }
    return points
}

function pointOnArc(seg: Extract<Segment, { kind: 'arc' }>, f: number): Point {
    const angle = seg.startAngle + (seg.endAngle - seg.startAngle) * f
    return {
        x: seg.center.x + seg.radius * Math.cos(angle),
        y: seg.center.y + seg.radius * Math.sin(angle),
    }
}

function pushPoint(points: Point[], p: Point): void {
    const last = points[points.length - 1]
    if (last && Math.abs(last.x - p.x) < 1e-9 && Math.abs(last.y - p.y) < 1e-9) return
    points.push(p)
}

function addScaled(p: Point, dir: Point, amount: number): Point {
    return { x: p.x + dir.x * amount, y: p.y + dir.y * amount }
}

function lerp(a: Point, b: Point, f: number): Point {
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

/**
 * Where a round cap goes on the tail end of `path`: the last point, and the
 * angle (radians) the tail points away from the body, taken from the last two
 * distinct points. Null when the path has no direction yet.
 */
export function tailCap(path: Point[]): { centre: Point; angle: number } | null {
    if (path.length === 0) return null
    const centre = path[path.length - 1]
    const before = [...path].reverse().find(({ x, y }) => x !== centre.x || y !== centre.y)
    if (!before) return null
    return { centre, angle: Math.atan2(centre.y - before.y, centre.x - before.x) }
}
