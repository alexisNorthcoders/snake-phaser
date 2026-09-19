import { GridPosition } from "./Snake";
import { HEADER } from "./pingSignal";

export { type FoodType } from './foodTextures'
import type { FoodType } from './foodTextures'

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
        this.position = { x: position.x * this.cellSize, y: HEADER.height + position.y * this.cellSize }
        this.type = type
        this.id = id
    }

    updateFood(position: GridPosition, type: FoodType) {
        this.position = { x: position.x * this.cellSize, y: HEADER.height + position.y * this.cellSize }
        this.type = type
        // setTexture resets the frame to the new texture's native size but keeps the old scale,
        // and themed textures differ in native size — re-fit to the cell.
        this.sprite?.setTexture(type).setDisplaySize(this.cellSize, this.cellSize)
    }

    destroy(): void {
        this.sprite?.destroy()
        this.sprite = undefined
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