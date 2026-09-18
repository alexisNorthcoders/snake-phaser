import { drawSnake } from './SnakeDrawing';
import { feature } from './feature';
import { AMBIENT_CELL, HUD_HEIGHT, STEP_MS, createAmbientSnake, gridFor, inBand, type AmbientSnake } from './ambientSnake';
import { createAmbientFruit, type AmbientFruitField } from './ambientFruit';

const ALPHA = 0.6;
/** Above the background tile (depth -2), below every lobby UI object (depth 0). */
export const AMBIENCE_DEPTH = -1;
export const BACKGROUND_DEPTH = -2;

const FRUIT_KEYS = ['redApple', 'greenApple', 'yellowApple', 'cherry', 'banana'];

const COLOURS = { body: '#2a9d3f', head: '#e63946', eyes: '#ffffff' };

/**
 * The lobby's decorative snake round the screen edge. Purely client-side: it owns every object it
 * creates and removes them, and its timer, in destroy().
 */
export class LobbyAmbience {
  private readonly bodyGraphics: Phaser.GameObjects.Graphics;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly timer: Phaser.Time.TimerEvent;
  private readonly snake: AmbientSnake;
  private readonly fruitField: AmbientFruitField;
  private readonly fruitImages: Phaser.GameObjects.Image[] = [];
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const grid = gridFor(scene.scale.width, scene.scale.height);
    this.fruitField = createAmbientFruit({
      grid,
      random: Math.random,
      allowed: (cell) => inBand(grid, cell),
      occupied: () => this.snake.cells,
      kinds: FRUIT_KEYS.length,
    });
    this.snake = createAmbientSnake({
      grid,
      random: Math.random,
      fruit: () => this.fruitField.fruit.map((f) => f.cell),
      onEat: (cell) => this.fruitField.eat(cell),
    });
    this.bodyGraphics = scene.add.graphics().setDepth(AMBIENCE_DEPTH).setAlpha(ALPHA);
    this.graphics = scene.add.graphics().setDepth(AMBIENCE_DEPTH).setAlpha(ALPHA);
    this.timer = scene.time.addEvent({
      delay: STEP_MS,
      loop: true,
      callback: () => {
        this.snake.step();
        this.fruitField.tick(STEP_MS);
        this.draw();
      },
    });
    this.draw();
  }

  destroy(): void {
    this.timer.remove(false);
    this.bodyGraphics.destroy();
    this.graphics.destroy();
    this.fruitImages.forEach((image) => image.destroy());
  }

  private drawFruit(): void {
    const fruit = this.fruitField.fruit;
    while (this.fruitImages.length < fruit.length) {
      this.fruitImages.push(this.scene.add.image(0, 0, FRUIT_KEYS[0]).setDepth(AMBIENCE_DEPTH).setAlpha(ALPHA));
    }
    this.fruitImages.forEach((image, i) => {
      const f = fruit[i];
      image.setVisible(!!f);
      if (!f) return;
      image
        .setTexture(FRUIT_KEYS[f.kind])
        .setDisplaySize(AMBIENT_CELL, AMBIENT_CELL)
        .setPosition(f.cell.x * AMBIENT_CELL + AMBIENT_CELL / 2, HUD_HEIGHT + f.cell.y * AMBIENT_CELL + AMBIENT_CELL / 2);
    });
  }

  private draw(): void {
    this.drawFruit();
    this.bodyGraphics.clear();
    this.graphics.clear();
    drawSnake({ graphics: this.graphics, bodyGraphics: this.bodyGraphics }, {
      cells: [...this.snake.cells],
      colors: COLOURS,
      cellSize: AMBIENT_CELL,
      origin: { x: 0, y: HUD_HEIGHT },
      bodyStyle: feature.snakeBody === 'blocks' ? 'blocks' : 'joints',
      bodyWidth: feature.snakeBodyWidth,
      isDead: false,
      bodyAlpha: 1,
    });
  }
}
