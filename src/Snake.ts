import { getRandomColor } from './utils'
import { BodyTween } from './BodyTween'
import { arcBodyPath } from './BodyPath'
import { unwrapChain, wrapPieces, wrapCell } from './BodyWrap'
import { feature } from './feature'

interface SnakeColorSet {
    body?: string
    head?: string
    eyes?: string
}

export interface GridPosition {
    x: number
    y: number
}

// The server's gameConfig: 8 ticks a second on a 20-cell board.
const TICK_MS = 1000 / 8
const BOARD_CELLS = 20

export class Snake {
    private scene: Phaser.Scene
    private graphics: Phaser.GameObjects.Graphics
    // The continuous bodies, masked to the game area so a body crossing the
    // board edge can overhang it without drawing over the header.
    private bodyGraphics: Phaser.GameObjects.Graphics
    private bodyMask: Phaser.GameObjects.Graphics
    private gridSize: number

    public isDead: boolean = false
    public food: number = 0
    public glow: boolean = false
    public transparent: number = 1
    public speed: GridPosition = { x: 1, y: 0 }

    public colors: Required<SnakeColorSet>

    // Head first, then the tail in body order.
    private body = new BodyTween(TICK_MS, BOARD_CELLS)
    private size: number

    constructor(
        scene: Phaser.Scene,
        x: number = 2,
        y: number = 4,
        colors: SnakeColorSet = {},
        size: number = 0
    ) {
        this.scene = scene
        this.size = size
        this.body.retarget([{ x, y }], performance.now())

        this.gridSize = Math.floor(Math.min(scene.scale.width, scene.scale.height) / BOARD_CELLS);

        this.colors = {
            body: colors.body || getRandomColor(),
            head: colors.head || getRandomColor(),
            eyes: colors.eyes || getRandomColor()
        }

        this.bodyGraphics = this.scene.add.graphics()
        this.bodyGraphics.setDepth(9)
        this.bodyMask = this.scene.make.graphics({}, false)
        this.bodyGraphics.setMask(this.bodyMask.createGeometryMask())

        this.graphics = this.scene.add.graphics()
        this.graphics.setDepth(10)
    }

    direction(x: number, y: number): void {
        this.speed = { x, y }
    }

    /** Slides the snake onto the cells from the latest patch, tail given newest first. */
    moveTo(head: GridPosition, tail: GridPosition[]): void {
        this.body.retarget([head, ...tail], performance.now())
    }

    /** Stops sliding and draws the snake on its latest cells from now on. */
    snap(): void {
        this.body.snap()
    }

    draw(yOffset: number): void {
        const { graphics, gridSize, colors } = this

        const now = performance.now()
        const segments = this.body.positionsAt(now)

        graphics.clear()
        this.bodyGraphics.clear()
        this.bodyMask.clear()
        this.bodyMask.fillStyle(0xffffff, 1)
        this.bodyMask.fillRect(0, yOffset, BOARD_CELLS * gridSize, BOARD_CELLS * gridSize)

        let headCell: GridPosition = segments[0]

        if (feature.snakeBody === 'blocks') {
            this.drawBlocks(segments.slice(1), yOffset)
        } else if (feature.snakeBody === 'arcs') {
            const chain = unwrapChain([...this.body.targets, this.body.tailPrevious], BOARD_CELLS)
            const path = arcBodyPath(chain.slice(0, -1), chain[chain.length - 1], this.body.progressAt(now))
            this.drawPath(path, yOffset)
            if (feature.snakeHeadFollowsArc && path.length > 0) headCell = wrapCell(path[0], BOARD_CELLS)
        } else {
            this.drawJoints(segments, yOffset)
        }

        const headX = headCell.x * gridSize
        const headY = yOffset + headCell.y * gridSize

        // Draw head
        const headColor = Phaser.Display.Color.HexStringToColor(colors.head).color
        graphics.fillStyle(headColor, 1)
        graphics.fillCircle(headX + gridSize / 2, headY + gridSize / 2, gridSize / 2)
        graphics.lineStyle(2, 0x000000, 1)
        graphics.strokeCircle(headX + gridSize / 2, headY + gridSize / 2, gridSize / 2)

        // Draw eyes
        const eyeSize = gridSize / 5
        const eyeX1 = headX + gridSize / 5
        const eyeX2 = headX + (3 * gridSize) / 5
        const eyeY = headY

        const eyesColor = Phaser.Display.Color.HexStringToColor(colors.eyes).color
        graphics.fillStyle(eyesColor, 1)
        graphics.fillRect(eyeX1, eyeY, eyeSize, eyeSize)
        graphics.fillRect(eyeX2, eyeY, eyeSize, eyeSize)
        graphics.lineStyle(1, 0xffff00, 1)
        graphics.strokeRect(eyeX1, eyeY, eyeSize, eyeSize)
        graphics.strokeRect(eyeX2, eyeY, eyeSize, eyeSize)
    }

    /** One outlined square per tail cell. */
    private drawBlocks(tail: GridPosition[], yOffset: number): void {
        const { graphics, gridSize, colors, transparent } = this
        const bodyColor = Phaser.Display.Color.HexStringToColor(colors.body).color

        tail.forEach((segment) => {
            const x = segment.x * gridSize
            const y = yOffset + segment.y * gridSize

            graphics.fillStyle(bodyColor, transparent)
            graphics.fillRect(x, y, gridSize, gridSize)
            graphics.lineStyle(2, 0x000000, transparent)
            graphics.strokeRect(x, y, gridSize, gridSize)
        })
    }

    /**
     * One continuous body through the segment centres, head included: a thick
     * line with a circle on every joint to round it.
     */
    private drawJoints(segments: GridPosition[], yOffset: number): void {
        const pieces = wrapPieces(unwrapChain(segments, BOARD_CELLS), BOARD_CELLS)
        for (const piece of pieces) {
            this.strokeDoubleLine(piece.map(({ x, y }) => this.toPixels(x, y, yOffset)), { roundJoints: true })
        }
    }

    /**
     * The 'arcs' body: `path` is already a smooth poly-line (corners rounded
     * into quarter-arcs), so it needs no per-point circles — those would blob
     * a curve that's already round.
     */
    private drawPath(path: GridPosition[], yOffset: number): void {
        for (const piece of wrapPieces(path, BOARD_CELLS)) {
            this.strokeDoubleLine(piece.map(({ x, y }) => this.toPixels(x, y, yOffset)), { roundJoints: false })
        }
    }

    private toPixels(x: number, y: number, yOffset: number): { x: number; y: number } {
        const { gridSize } = this
        return { x: (x + 0.5) * gridSize, y: yOffset + (y + 0.5) * gridSize }
    }

    /**
     * A black pass 2px wider than `snakeBodyWidth` under a body-coloured pass
     * 2px narrower, leaving a single 2px silhouette. `roundJoints` fills a
     * circle at every point, for a polyline whose corners are square.
     */
    private strokeDoubleLine(points: { x: number; y: number }[], { roundJoints }: { roundJoints: boolean }): void {
        const { bodyGraphics: graphics, gridSize, colors, transparent } = this
        const width = feature.snakeBodyWidth * gridSize
        if (points.length < 2) return

        const pass = (color: number, thickness: number) => {
            graphics.lineStyle(thickness, color, transparent)
            graphics.strokePoints(points)
            if (roundJoints) {
                graphics.fillStyle(color, transparent)
                points.forEach(({ x, y }) => graphics.fillCircle(x, y, thickness / 2))
            }
        }

        pass(0x000000, width + 2)
        pass(Phaser.Display.Color.HexStringToColor(colors.body).color, width - 2)
    }

    destroy(): void {
        this.graphics.destroy()
        this.bodyGraphics.clearMask(true)
        this.bodyGraphics.destroy()
        this.bodyMask.destroy()
    }

    async stop(playerId: string, score: number, isAnonymous: boolean): Promise<void> {
        this.isDead = true
        this.snap()
        this.colors.head = 'black'
        this.colors.eyes = 'gray'
        this.colors.body = 'rgb(139, 0, 0)'

        await postUserScore(score)
    }
}

async function postUserScore(score: number): Promise<void> {

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    try {
        const response = await fetch("/api/add-score", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${userData.token}`,
            },
            body: JSON.stringify({ score }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Failed to post score: ${response.status} ${err}`);
        }

        const data = await response.json();
        console.log("✅ Score posted:", data.message);
    } catch (error) {
        console.error("❌ Error posting score:", error);
    }
}

export async function postAnonymousScore(clientId: string, score: number): Promise<{ success: boolean; message: string }> {
    try {
        const response = await fetch("/api/scores/anonymous", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ clientId, score }),
        });

        if (response.status === 429) {
            return {
                success: false,
                message: "Too many submissions. Please wait a minute before submitting another score.",
            };
        }

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Failed to post anonymous score: ${response.status} ${err}`);
        }

        const data = await response.json();
        console.log("✅ Anonymous score posted:", data.message);
        return { success: true, message: data.message };
    } catch (error) {
        console.error("❌ Error posting anonymous score:", error);
        return {
            success: false,
            message: "Failed to submit score. Score saved locally.",
        };
    }
}

export interface HighScore {
    username: string;
    score: number;
    timestamp: string;
}

export async function getHighScores(): Promise<HighScore[]> {
    try {
        const response = await fetch("/api/high-scores", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Failed to get high scores: ${response.status} ${err}`);
        }

        const data: HighScore[] | null = await response.json();
        console.log("✅ High Scores: ", data);
        return data ?? [];
    } catch (error) {
        console.error("❌ Error fetching high scores: ", error);
        return [];
    }
}

export async function getLeaderboard(): Promise<HighScore[]> {
    try {
        const response = await fetch("/api/leaderboard", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Failed to get leaderboard: ${response.status} ${err}`);
        }

        const data: HighScore[] | null = await response.json();
        console.log("✅ Leaderboard: ", data);
        return data ?? [];
    } catch (error) {
        console.error("❌ Error fetching leaderboard: ", error);
        return [];
    }
}
