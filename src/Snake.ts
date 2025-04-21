import { getRandomColor } from './utils'

interface SnakeColorSet {
    body?: string
    head?: string
    eyes?: string
}

export interface GridPosition {
    x: number
    y: number
}

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
    public tail: GridPosition[] = []

    private gridX: number
    private gridY: number
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
        this.gridX = x
        this.gridY = y

        this.gridSize = 40

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

    position(pos: GridPosition): void {
        this.gridX = pos.x
        this.gridY = pos.y
    }

    draw(yOffset: number): void {
        const { graphics, gridSize, tail, colors, transparent } = this

        const headX = this.gridX * gridSize
        const headY = yOffset + this.gridY * gridSize

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

    async stop(playerId: string, score: number, isAnonymous: boolean): Promise<void> {
        this.isDead = true
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

export async function getHighScores(): Promise<void> {
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

        const data = await response.json();
        console.log("✅ High Scores: ", data);
    } catch (error) {
        console.error("❌ Error fetching high scores: ", error);
    }
}
