import { drawSnake } from './SnakeDrawing';
import { feature } from './feature';
import { AMBIENT_CELL, HUD_HEIGHT, STEP_MS, createAmbientSnake, gridFor, type AmbientSnake } from './ambientSnake';

const ALPHA = 0.6;
/** Above the background tile (depth -2), below every lobby UI object (depth 0). */
export const AMBIENCE_DEPTH = -1;
export const BACKGROUND_DEPTH = -2;

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

  constructor(scene: Phaser.Scene) {
    this.snake = createAmbientSnake({ grid: gridFor(scene.scale.width, scene.scale.height), random: Math.random });
    this.bodyGraphics = scene.add.graphics().setDepth(AMBIENCE_DEPTH).setAlpha(ALPHA);
    this.graphics = scene.add.graphics().setDepth(AMBIENCE_DEPTH).setAlpha(ALPHA);
    this.timer = scene.time.addEvent({
      delay: STEP_MS,
      loop: true,
      callback: () => {
        this.snake.step();
        this.draw();
      },
    });
    this.draw();
  }

  destroy(): void {
    this.timer.remove(false);
    this.bodyGraphics.destroy();
    this.graphics.destroy();
  }

  private draw(): void {
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
