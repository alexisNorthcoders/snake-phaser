import { PALETTE } from './appearanceStore';
import type { ColourSelection, Part } from './colourSelection';
import { drawSnake } from './SnakeDrawing';
import { feature } from './feature';
import { PixelButton } from './PixelButton';
import {
  PART_BUTTON, PART_BUTTON_HEIGHT, PREVIEW_CELL as CELL, SWATCH,
  computeColourRowLayout, computePreviewBoxRects, computeSwatchEdgeRects, swatchPosition,
  type BoxRect, type ColourRowLayout,
} from './utils/colourRowLayout';

const PART_BUTTONS: [Part, string][] = [['head', 'Head'], ['body', 'Body'], ['eyes', 'Eyes']];

/**
 * The lobby's colour row: preview box with the snake, Head/Body/Eyes buttons and the palette, all visible at once.
 * Laid out from the row's top-left corner inside the lobby panel.
 * The scene only listens for picks; the panel owns every object it creates and removes them in destroy().
 */
export class ColourPanel {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly buttons = new Map<Part, PixelButton>();
  private readonly swatches: { colour: string; rect: Phaser.GameObjects.Rectangle }[] = [];
  private readonly layout: ColourRowLayout;
  private readonly bodyGraphics: Phaser.GameObjects.Graphics;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly highlight: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly selection: ColourSelection,
    private readonly onPick: () => void
  ) {
    this.layout = computeColourRowLayout(x, y);
    this.createPreviewBox(scene);
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
    this.buttons.forEach((button) => button.setVisible(visible));
  }

  /** Redraws everything that depends on the selection or the colours. */
  refresh(): void {
    this.drawPreview();
    this.buttons.forEach((button, part) => {
      const selected = part === this.selection.selectedPart;
      button.setFill(selected ? 'button-alt' : 'field').setPressed(selected);
    });
    const outlined = this.selection.outlinedColour().toLowerCase();
    this.swatches.forEach(({ colour, rect }) => rect.setStrokeStyle(colour.toLowerCase() === outlined ? 4 : 2, 0xffffff));
  }

  destroy(): void {
    this.objects.forEach((obj) => obj.destroy());
    this.objects.length = 0;
    this.buttons.forEach((button) => button.destroy());
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
      colors: this.selection.displayedColours(),
      cellSize: CELL,
      origin: this.layout.snakeOrigin,
      bodyStyle: feature.snakeBody === 'blocks' ? 'blocks' : 'joints',
      bodyWidth: feature.snakeBodyWidth,
      isDead: false,
      bodyAlpha: 1,
    });
  }

  private createPreviewZones(scene: Phaser.Scene): void {
    const { x: ox, y: oy } = this.layout.snakeOrigin;
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

  private createPreviewBox(scene: Phaser.Scene): void {
    const gfx = scene.add.graphics().setScrollFactor(0);
    this.fillRects(gfx, computePreviewBoxRects(), this.layout.box.x, this.layout.box.y);
    this.objects.push(gfx);
  }

  private fillRects(gfx: Phaser.GameObjects.Graphics, rects: BoxRect[], ox: number, oy: number): void {
    for (const r of rects) {
      gfx.fillStyle(r.color, r.alpha);
      gfx.fillRect(ox + r.x, oy + r.y, r.w, r.h);
    }
  }

  private createPartButtons(scene: Phaser.Scene): void {
    PART_BUTTONS.forEach(([part, label], i) => {
      this.buttons.set(part, new PixelButton(scene, {
        ...this.layout.partButtons[i],
        width: PART_BUTTON.width,
        height: PART_BUTTON_HEIGHT,
        label,
        size: 'small',
        fill: 'field',
        onClick: () => this.select(part),
      }));
    });
  }

  private createSwatches(scene: Phaser.Scene): void {
    PALETTE.forEach((colour, i) => {
      const { x, y } = swatchPosition(this.layout, i);
      const rect = scene.add.rectangle(x, y, SWATCH.size, SWATCH.size, Phaser.Display.Color.HexStringToColor(colour).color)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => {
        this.selection.hover(colour);
        this.refresh();
      });
      rect.on('pointerout', () => {
        this.selection.unhover();
        this.refresh();
      });
      rect.on('pointerdown', () => {
        this.selection.pick(colour);
        this.refresh();
        this.onPick();
      });
      this.swatches.push({ colour, rect });
      this.objects.push(rect);
      const edges = scene.add.graphics().setScrollFactor(0);
      this.fillRects(edges, computeSwatchEdgeRects(), x, y);
      this.objects.push(edges);
    });
  }
}
