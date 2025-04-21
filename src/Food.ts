import { GridPosition } from "./Snake";

export type FoodType = 'redApple' | 'greenApple' | 'yellowApple' | 'strawberry' | 'cherry' | 'chili' | 'banana'

export class Food {
    public position: GridPosition
    public type: FoodType
    public id: number
    private scene: Phaser.Scene;
    private sprite?: Phaser.GameObjects.Image;
    private cellSize: number;

    constructor(scene: Phaser.Scene, position: GridPosition, id: number, type: FoodType) {
        this.scene = scene;
        this.cellSize = Math.floor(Math.min(scene.scale.width, scene.scale.height) / 20);
        this.position = { x: position.x * this.cellSize, y: 40 + position.y * this.cellSize }
        this.type = type
        this.id = id
    }

    updateFood(position: GridPosition, type: FoodType) {
        this.position = { x: position.x * this.cellSize, y: this.cellSize + position.y * this.cellSize }
        this.sprite?.setTexture(type)
    }

    public draw(): void {
        if (!this.sprite) {

            this.sprite = this.scene.add.image(this.position.x, this.position.y, this.type);
            this.sprite.setOrigin(0, 0);
            this.sprite.displayWidth = this.cellSize;
            this.sprite.displayHeight = this.cellSize;
        } else {

            this.sprite.setPosition(this.position.x, this.position.y);
        }
    }

}