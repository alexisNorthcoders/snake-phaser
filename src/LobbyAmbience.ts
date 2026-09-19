import { drawSnake } from './SnakeDrawing';
import { feature } from './feature';
import { AMBIENT_CELL, HUD_HEIGHT, STEP_MS, gridFor, inBand } from './ambientSnake';
import { createAmbientFruit, type AmbientFruitField } from './ambientFruit';
import { createAmbience, type Ambience } from './ambience';
import type { Appearance } from './appearanceStore';

const ALPHA = 0.6;
/** Above the background (depth -2) and its dimming (-1.5), below every lobby UI object (depth 0). */
export const AMBIENCE_DEPTH = -1;
export const BACKGROUND_DEPTH = -2;
/** Between the background and everything drawn on it, so only the background is dimmed. */
export const BACKGROUND_DIM_DEPTH = -1.5;

const FRUIT_KEYS = ['redApple', 'greenApple', 'yellowApple', 'cherry', 'banana'];

const EYES = '#ffffff';

/**
 * The lobby's decorative snakes round the screen edge. Purely client-side: it owns every object it
 * creates and removes them, and its timer, in destroy().
 */
export class LobbyAmbience {
  private readonly layers: { bodyGraphics: Phaser.GameObjects.Graphics; graphics: Phaser.GameObjects.Graphics }[];
  private readonly timer: Phaser.Time.TimerEvent;
  private readonly world: Ambience;
  private readonly fruitField: AmbientFruitField;
  private readonly fruitImages: Phaser.GameObjects.Image[] = [];
  private readonly scene: Phaser.Scene;

  /** `playerColours` is read every step, so ambient snakes never wear what the player's snake wears. */
  constructor(scene: Phaser.Scene, playerColours: () => Appearance | undefined) {
    this.scene = scene;
    const grid = gridFor(scene.scale.width, scene.scale.height);
    this.world = createAmbience({
      grid,
      random: Math.random,
      playerColours,
      fruit: () => this.fruitField.fruit.map((f) => f.cell),
      onEat: (cell) => this.fruitField.eat(cell),
    });
    // The snakes read the field lazily, so the field can be built once the snakes exist.
    this.fruitField = createAmbientFruit({
      grid,
      random: Math.random,
      allowed: (cell) => inBand(grid, cell),
      occupied: () => this.world.snakes.flatMap((snake) => snake.cells),
      kinds: FRUIT_KEYS.length,
    });
    // One pair per snake, so each can fade on its own.
    this.layers = this.world.snakes.map(() => ({
      bodyGraphics: scene.add.graphics().setDepth(AMBIENCE_DEPTH),
      graphics: scene.add.graphics().setDepth(AMBIENCE_DEPTH),
    }));
    this.timer = scene.time.addEvent({
      delay: STEP_MS,
      loop: true,
      callback: () => {
        this.world.step(STEP_MS);
        this.fruitField.tick(STEP_MS);
        this.draw();
      },
    });
    this.draw();
  }

  destroy(): void {
    this.timer.remove(false);
    this.layers.forEach(({ bodyGraphics, graphics }) => {
      bodyGraphics.destroy();
      graphics.destroy();
    });
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
    this.world.snakes.forEach((snake, i) => {
      const { bodyGraphics, graphics } = this.layers[i];
      bodyGraphics.clear().setAlpha(ALPHA * snake.opacity);
      graphics.clear().setAlpha(ALPHA * snake.opacity);
      if (snake.opacity === 0) return;
      drawSnake({ graphics, bodyGraphics }, {
        cells: [...snake.cells],
        colors: { ...snake.colours, eyes: EYES },
        cellSize: AMBIENT_CELL,
        origin: { x: 0, y: HUD_HEIGHT },
        bodyStyle: feature.snakeBody === 'blocks' ? 'blocks' : 'joints',
        bodyWidth: feature.snakeBodyWidth,
        isDead: snake.dead,
        bodyAlpha: 1,
      });
    });
  }
}
