import { GridPosition } from "./Snake";

export type FoodType = 'redApple' | 'greenApple' | 'yellowApple' | 'strawberry' | 'cherry' | 'chili' | 'banana'

export class Food {
    public position: GridPosition
    public type: FoodType
    public id: number
    private scene: Phaser.Scene;
    private sprite?: Phaser.GameObjects.Image;

    constructor(scene: Phaser.Scene, position: GridPosition, id: number, type: FoodType) {
        this.scene = scene;
        this.position = { x: position.x * 40, y: 40 + position.y * 40 }
        this.type = type
        this.id = id
    }

    updateFood(position: GridPosition, type: FoodType) {
        this.position = { x: position.x * 40, y: 40 + position.y * 40 }
        this.sprite?.setTexture(type)
    }

    public draw(): void {
        if (!this.sprite) {

            this.sprite = this.scene.add.image(this.position.x, this.position.y, this.type);
            this.sprite.setOrigin(0, 0);
            this.sprite.displayWidth = 40;
            this.sprite.displayHeight = 40;
        } else {

            this.sprite.setPosition(this.position.x, this.position.y);
        }
    }

}