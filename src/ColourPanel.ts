import { PALETTE } from './appearanceStore';
import type { ColourSelection, Part } from './colourSelection';
import { drawSnake } from './SnakeDrawing';
import { feature } from './feature';

const CELL = 44;
const PREVIEW_ORIGIN = { x: 400 - CELL * 1.5, y: 160 };
const BUTTONS_Y = 245;
const SWATCH = 28;
const GAP = 6;
const COLS = 6;
const PALETTE_TOP = 272;

const PART_BUTTONS: [Part, string][] = [['head', 'Head'], ['body', 'Body'], ['eyes', 'Eyes']];

/**
 * The lobby's colour panel: preview snake, Head/Body/Eyes buttons and the palette, all visible at once.
 * The scene only listens for picks; the panel owns every object it creates and removes them in destroy().
 */
export class ColourPanel {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly buttons = new Map<Part, Phaser.GameObjects.Text>();
  private readonly swatches: { colour: string; rect: Phaser.GameObjects.Rectangle }[] = [];
  private readonly bodyGraphics: Phaser.GameObjects.Graphics;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly highlight: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly selection: ColourSelection,
    private readonly onPick: () => void
  ) {
    this.bodyGraphics = scene.add.graphics();
    this.graphics = scene.add.graphics();
    this.highlight = scene.add.graphics();
    this.objects.push(this.bodyGraphics, this.graphics, this.highlight);

    this.createPreviewZones(scene);
    this.createPartButtons(scene);
    this.createSwatches(scene);
    this.refresh();
  }

  setVisible(visible: boolean): void {
    this.objects.forEach((obj) => (obj as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible).setVisible(visible));
  }

  /** Redraws everything that depends on the selection or the colours. */
  refresh(): void {
    this.drawPreview();
    this.buttons.forEach((button, part) =>
      button.setStyle({ backgroundColor: part === this.selection.selectedPart ? '#555555' : '#333333' }));
    const outlined = this.selection.outlinedColour().toLowerCase();
    this.swatches.forEach(({ colour, rect }) => rect.setStrokeStyle(colour.toLowerCase() === outlined ? 4 : 2, 0xffffff));
  }

  destroy(): void {
    this.objects.forEach((obj) => obj.destroy());
    this.objects.length = 0;
    this.buttons.clear();
    this.swatches.length = 0;
  }

  private select(part: Part): void {
    this.selection.select(part);
    this.refresh();
  }

  private drawPreview(): void {
    this.bodyGraphics.clear();
    this.graphics.clear();
    drawSnake({ graphics: this.graphics, bodyGraphics: this.bodyGraphics }, {
      // Facing right: head first, then the body cell, then the tail cell.
      cells: [{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }],
      colors: this.selection.colours,
      cellSize: CELL,
      origin: PREVIEW_ORIGIN,
      bodyStyle: feature.snakeBody === 'blocks' ? 'blocks' : 'joints',
      bodyWidth: feature.snakeBodyWidth,
      isDead: false,
      bodyAlpha: 1,
    });
  }

  private createPreviewZones(scene: Phaser.Scene): void {
    const { x: ox, y: oy } = PREVIEW_ORIGIN;
    const zone = (part: Part, x: number, y: number, width: number, height: number) => {
      const area = scene.add.zone(x, y, width, height).setOrigin(0).setInteractive({ useHandCursor: true });
      area.on('pointerover', () => {
        this.highlight.clear();
        this.highlight.lineStyle(3, 0xffffff, 1);
        this.highlight.strokeRect(x, y, width, height);
      });
      area.on('pointerout', () => this.highlight.clear());
      area.on('pointerdown', () => this.select(part));
      this.objects.push(area);
    };

    // Later zones sit on top, so the eyes win over the head they are drawn on.
    zone('body', ox, oy, CELL * 2, CELL);
    zone('head', ox + CELL * 2, oy, CELL, CELL);
    zone('eyes', ox + CELL * 2 + CELL / 5 - 3, oy - 3, CELL * 0.6 + 6, CELL / 5 + 6);
  }

  private createPartButtons(scene: Phaser.Scene): void {
    PART_BUTTONS.forEach(([part, label], i) => {
      const button = scene.add.text(400 + (i - 1) * 90, BUTTONS_Y, label, {
        fontSize: '20px', color: '#ffffff', padding: { x: 10, y: 5 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      button.on('pointerdown', () => this.select(part));
      this.buttons.set(part, button);
      this.objects.push(button);
    });
  }

  private createSwatches(scene: Phaser.Scene): void {
    const left = 400 - (COLS * SWATCH + (COLS - 1) * GAP) / 2;
    PALETTE.forEach((colour, i) => {
      const x = left + (i % COLS) * (SWATCH + GAP);
      const y = PALETTE_TOP + Math.floor(i / COLS) * (SWATCH + GAP);
      const rect = scene.add.rectangle(x, y, SWATCH, SWATCH, Phaser.Display.Color.HexStringToColor(colour).color)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      rect.on('pointerdown', () => {
        this.selection.pick(colour);
        this.refresh();
        this.onPick();
      });
      this.swatches.push({ colour, rect });
      this.objects.push(rect);
    });
  }
}
