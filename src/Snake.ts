import Phaser from 'phaser'
import { getRandomColor } from './utils'

interface SnakeColorSet {
    body?: string
    head?: string
    eyes?: string
}

interface GridPosition {
    x: number
    y: number
}

export class Snake {
    private scene: Phaser.Scene
    private graphics: Phaser.GameObjects.Graphics
    private scale: number
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

        this.scale = 50
        this.gridSize = 20

        this.colors = {
            body: colors.body || getRandomColor(),
            head: colors.head || getRandomColor(),
            eyes: colors.eyes || getRandomColor()
        }

        this.graphics = this.scene.add.graphics()
    }

    direction(x: number, y: number): void {
        this.speed = { x, y }
    }

    position(pos: GridPosition): void {
        this.gridX = pos.x
        this.gridY = pos.y
    }

    draw(): void {
        const { graphics, scale, gridSize, tail, colors, transparent } = this

        const headX = this.gridX * gridSize
        const headY = this.gridY * gridSize

        graphics.clear()

        // Draw tail
        tail.forEach((segment) => {
            const x = segment.x * gridSize
            const y = segment.y * gridSize

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

    async stop(playerId: string, score: number, isAnonymous: boolean, postUserScore: (id: string) => Promise<void>): Promise<void> {
        this.isDead = true
        this.colors.head = 'black'
        this.colors.eyes = 'gray'
        this.colors.body = 'rgb(139, 0, 0)'

        if (this.type === 'player') {
            const idToUse = isAnonymous ? 'anon' : playerId
            await postUserScore(idToUse)
            console.log(`Posted score of ${score} for PlayerId: ${idToUse}`)
        }
    }
}
