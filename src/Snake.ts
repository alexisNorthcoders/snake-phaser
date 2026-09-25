import { getRandomColor } from './utils'
import { BodyTween } from './BodyTween'
import { arcBodyPath } from './BodyPath'
import { unwrapChain, wrapCell } from './BodyWrap'
import { drawSnake, type SnakeDrawing } from './SnakeDrawing'
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

// Used until the room's synced state (state.tickMs) arrives, and matches the server's default of 8 ticks a second.
const DEFAULT_TICK_MS = 125
const BOARD_CELLS = 20
const STARVING_COLOUR = 0xff4444
/** One full pulse of the starving hint. */
const STARVING_PULSE_MS = 700

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
    /** Score the snake's hunger drain began from, or would begin from while it is fed; see `trackHunger`. */
    public hungerStartScore?: number
    /** An opponent that is starving: a pulsing ring round its head shows it's in trouble. */
    public starving: boolean = false

    public colors: Required<SnakeColorSet>

    // Head first, then the tail in body order.
    private body: BodyTween
    private size: number

    constructor(
        scene: Phaser.Scene,
        x: number = 2,
        y: number = 4,
        colors: SnakeColorSet = {},
        size: number = 0,
        tickMs: number = DEFAULT_TICK_MS
    ) {
        this.scene = scene
        this.size = size
        this.body = new BodyTween(tickMs > 0 ? tickMs : DEFAULT_TICK_MS, BOARD_CELLS)
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
        const { graphics, gridSize } = this

        const now = performance.now()
        const segments = this.body.positionsAt(now)

        graphics.clear()
        this.bodyGraphics.clear()
        this.bodyMask.clear()
        this.bodyMask.fillStyle(0xffffff, 1)
        this.bodyMask.fillRect(0, yOffset, BOARD_CELLS * gridSize, BOARD_CELLS * gridSize)

        const drawing: SnakeDrawing = {
            cells: segments,
            colors: this.colors,
            cellSize: gridSize,
            origin: { x: 0, y: yOffset },
            bodyStyle: feature.snakeBody === 'blocks' ? 'blocks' : 'joints',
            bodyWidth: feature.snakeBodyWidth,
            wrapCells: BOARD_CELLS,
            isDead: this.isDead,
            bodyAlpha: this.transparent,
        }

        if (feature.snakeBody === 'arcs') {
            const chain = unwrapChain([...this.body.targets, this.body.tailPrevious], BOARD_CELLS)
            const path = arcBodyPath(chain.slice(0, -1), chain[chain.length - 1], this.body.progressAt(now))
            drawing.bodyStyle = 'path'
            drawing.path = path
            if (feature.snakeHeadFollowsArc && path.length > 0) drawing.headCell = wrapCell(path[0], BOARD_CELLS)
        }

        drawSnake({ graphics, bodyGraphics: this.bodyGraphics }, drawing)
        if (this.starving && !this.isDead) this.drawStarvingHint(drawing.headCell ?? segments[0], yOffset, now)
    }

    /** A red ring round the head, pulsing: clearly visible, but thin enough to leave the head and board readable. */
    private drawStarvingHint(head: GridPosition, yOffset: number, now: number): void {
        const { gridSize } = this
        const pulse = (Math.sin(now / STARVING_PULSE_MS * Math.PI * 2) + 1) / 2
        this.graphics.lineStyle(2, STARVING_COLOUR, 0.35 + 0.55 * pulse)
        this.graphics.strokeCircle(
            (head.x + 0.5) * gridSize,
            yOffset + (head.y + 0.5) * gridSize,
            gridSize * (0.75 + 0.15 * pulse)
        )
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
