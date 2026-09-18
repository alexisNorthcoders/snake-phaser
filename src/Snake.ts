import { getRandomColor } from './utils'
import { BodyTween } from './BodyTween'

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
    private gridSize: number

    public type: string
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
        type: string = 'player',
        colors: SnakeColorSet = {},
        size: number = 0
    ) {
        this.scene = scene
        this.type = type
        this.size = size
        this.body.retarget([{ x, y }], performance.now())

        this.gridSize = Math.floor(Math.min(scene.scale.width, scene.scale.height) / BOARD_CELLS);

        this.colors = {
            body: colors.body || getRandomColor(),
            head: colors.head || getRandomColor(),
            eyes: colors.eyes || getRandomColor()
        }

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
        const { graphics, gridSize, colors, transparent } = this

        const [head, ...tail] = this.body.positionsAt(performance.now())
        const headX = head.x * gridSize
        const headY = yOffset + head.y * gridSize

        graphics.clear()

        // Draw tail
        tail.forEach((segment) => {
            const x = segment.x * gridSize
            const y = yOffset + segment.y * gridSize

            const bodyColor = Phaser.Display.Color.HexStringToColor(colors.body).color
            graphics.fillStyle(bodyColor, transparent)
            graphics.fillRect(x, y, gridSize, gridSize)
            graphics.lineStyle(2, 0x000000, transparent)
            graphics.strokeRect(x, y, gridSize, gridSize)
        })

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

    destroy(): void {
        this.graphics.destroy()
    }

    async stop(playerId: string, score: number, isAnonymous: boolean): Promise<void> {
        this.isDead = true
        this.snap()
        this.colors.head = 'black'
        this.colors.eyes = 'gray'
        this.colors.body = 'rgb(139, 0, 0)'

        if (this.type === 'player') {

            await postUserScore(score)
        }
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
