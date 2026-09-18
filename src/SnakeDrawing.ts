import { tailCap } from './BodyPath'
import { unwrapChain, wrapPieces } from './BodyWrap'

export interface Cell {
    x: number
    y: number
}

export const DEAD_ALPHA = 0.35

/** How the tail is drawn: a square per cell, one jointed line, or a ready-made smooth path. */
export type BodyStyle = 'blocks' | 'joints' | 'path'

export interface SnakeDrawing {
    /** Head first, then the tail in body order. Cells may be fractional while sliding. */
    cells: Cell[]
    colors: { body: string; head: string; eyes: string }
    /** Pixel size of one cell. */
    cellSize: number
    /** Pixel position of the top-left of cell (0, 0). */
    origin: Cell
    bodyStyle: BodyStyle
    /** Width of the body line as a fraction of a cell; used by 'joints' and 'path'. */
    bodyWidth: number
    /** The poly-line (in cells) drawn for the 'path' style. */
    path?: Cell[]
    /** Where the head is drawn, when not on `cells[0]`. */
    headCell?: Cell
    /** Board size in cells: bodies wrap across its edges. Omit to draw without wrapping. */
    wrapCells?: number
    isDead: boolean
    /** Opacity of a live body. */
    bodyAlpha: number
}

interface Targets {
    /** Head and eyes, drawn over the body. */
    graphics: Phaser.GameObjects.Graphics
    /** The continuous bodies. */
    bodyGraphics: Phaser.GameObjects.Graphics
}

const hex = (color: string): number => Phaser.Display.Color.HexStringToColor(color).color

/** Draws a snake from explicit cells, colours, cell size and origin. Clears nothing. */
export function drawSnake({ graphics, bodyGraphics }: Targets, snake: SnakeDrawing): void {
    const { cells, colors, cellSize, origin, isDead } = snake
    const bodyAlpha = isDead ? DEAD_ALPHA : snake.bodyAlpha
    const toPixels = ({ x, y }: Cell): Cell => ({
        x: origin.x + (x + 0.5) * cellSize,
        y: origin.y + (y + 0.5) * cellSize,
    })
    const pieces = (points: Cell[]): Cell[][] =>
        snake.wrapCells === undefined ? [points] : wrapPieces(points, snake.wrapCells)

    const strokeLine = (points: Cell[], roundJoints: boolean) =>
        strokeDoubleLine(bodyGraphics, points, colors.body, snake.bodyWidth * cellSize, bodyAlpha, roundJoints)

    let headCell: Cell = cells[0]

    if (snake.bodyStyle === 'blocks') {
        const bodyColor = hex(colors.body)
        cells.slice(1).forEach((segment) => {
            const x = origin.x + segment.x * cellSize
            const y = origin.y + segment.y * cellSize

            graphics.fillStyle(bodyColor, bodyAlpha)
            graphics.fillRect(x, y, cellSize, cellSize)
            graphics.lineStyle(2, 0x000000, bodyAlpha)
            graphics.strokeRect(x, y, cellSize, cellSize)
        })
    } else if (snake.bodyStyle === 'path') {
        // Already a smooth poly-line, so no circles on the joints: they'd blob a curve that's already round.
        const path = snake.path ?? []
        for (const piece of pieces(path)) strokeLine(piece.map(toPixels), false)
        drawTailCap(bodyGraphics, path, toPixels, snake, bodyAlpha)
        if (snake.headCell) headCell = snake.headCell
    } else {
        const chain = snake.wrapCells === undefined ? cells : unwrapChain(cells, snake.wrapCells)
        for (const piece of pieces(chain)) strokeLine(piece.map(toPixels), true)
    }

    const headX = origin.x + headCell.x * cellSize
    const headY = origin.y + headCell.y * cellSize

    // Draw head
    const headAlpha = isDead ? DEAD_ALPHA : 1
    graphics.fillStyle(hex(colors.head), headAlpha)
    graphics.fillCircle(headX + cellSize / 2, headY + cellSize / 2, cellSize / 2)
    graphics.lineStyle(2, 0x000000, headAlpha)
    graphics.strokeCircle(headX + cellSize / 2, headY + cellSize / 2, cellSize / 2)

    // Draw eyes
    const eyeSize = cellSize / 5
    const eyeX1 = headX + cellSize / 5
    const eyeX2 = headX + (3 * cellSize) / 5
    const eyeY = headY
    const eyesColor = hex(colors.eyes)

    if (isDead) {
        // Full opacity: a black X under an eye-coloured one stays readable on any colour.
        drawXEye(graphics, eyeX1, eyeY, eyeSize, eyesColor)
        drawXEye(graphics, eyeX2, eyeY, eyeSize, eyesColor)
        return
    }

    graphics.fillStyle(eyesColor, 1)
    graphics.fillRect(eyeX1, eyeY, eyeSize, eyeSize)
    graphics.fillRect(eyeX2, eyeY, eyeSize, eyeSize)
    graphics.lineStyle(1, 0xffff00, 1)
    graphics.strokeRect(eyeX1, eyeY, eyeSize, eyeSize)
    graphics.strokeRect(eyeX2, eyeY, eyeSize, eyeSize)
}

function drawXEye(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color: number): void {
    const cross = (thickness: number, lineColor: number) => {
        graphics.lineStyle(thickness, lineColor, 1)
        graphics.lineBetween(x, y, x + size, y + size)
        graphics.lineBetween(x + size, y, x, y + size)
    }
    cross(5, 0x000000)
    cross(3, color)
}

/**
 * A black pass 2px wider than `width` under a body-coloured pass 2px narrower,
 * leaving a single 2px silhouette. `roundJoints` fills a circle at every
 * point, for a polyline whose corners are square.
 */
function strokeDoubleLine(
    graphics: Phaser.GameObjects.Graphics,
    points: Cell[],
    bodyColor: string,
    width: number,
    alpha: number,
    roundJoints: boolean
): void {
    if (points.length < 2) return

    const pass = (color: number, thickness: number) => {
        graphics.lineStyle(thickness, color, alpha)
        graphics.strokePoints(points)
        if (roundJoints) {
            graphics.fillStyle(color, alpha)
            points.forEach(({ x, y }) => graphics.fillCircle(x, y, thickness / 2))
        }
    }

    pass(0x000000, width + 2)
    pass(hex(bodyColor), width - 2)
}

/**
 * A bordered half-disc closing the tail end, drawn in the same two passes as the
 * line. Half rather than whole, so a translucent body shows no darker overlap.
 * Repeated per board copy, like `wrapPieces`; the body mask clips the overhang.
 */
function drawTailCap(
    graphics: Phaser.GameObjects.Graphics,
    path: Cell[],
    toPixels: (cell: Cell) => Cell,
    { colors, cellSize, bodyWidth, wrapCells }: SnakeDrawing,
    alpha: number
): void {
    const cap = tailCap(path)
    if (!cap) return

    const centre = toPixels(cap.centre)
    const board = wrapCells === undefined ? 0 : wrapCells * cellSize
    const shifts = board === 0 ? [0] : [-board, 0, board]
    const width = bodyWidth * cellSize

    const pass = (color: number, radius: number) => {
        graphics.fillStyle(color, alpha)
        for (const dx of shifts) {
            for (const dy of shifts) {
                graphics.beginPath()
                graphics.arc(centre.x + dx, centre.y + dy, radius, cap.angle - Math.PI / 2, cap.angle + Math.PI / 2)
                graphics.fillPath()
            }
        }
    }

    pass(0x000000, (width + 2) / 2)
    pass(hex(colors.body), (width - 2) / 2)
}
