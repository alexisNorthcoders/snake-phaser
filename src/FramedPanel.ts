import Phaser from 'phaser';
import { computeDividerRects, computeFrameRects, type PanelRect } from './utils/framedPanelStyle';

/** Square box with a scrim fill, inner border, outline and drop shadow; owns everything it draws. */
export class FramedPanel {
  private readonly objects: Phaser.GameObjects.Graphics[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    width: number,
    height: number,
    scrimAlpha: number,
  ) {
    this.draw(computeFrameRects(width, height, scrimAlpha), x, y);
  }

  /** Dashed divider with its top-left at (x, y) in canvas coordinates. */
  addDivider(x: number, y: number, width: number): void {
    this.draw(computeDividerRects(width), x, y);
  }

  destroy(): void {
    this.objects.forEach((obj) => obj.destroy());
    this.objects.length = 0;
  }

  private draw(rects: PanelRect[], ox: number, oy: number): void {
    const gfx = this.scene.add.graphics().setScrollFactor(0);
    for (const r of rects) {
      gfx.fillStyle(r.color, r.alpha);
      gfx.fillRect(ox + r.x, oy + r.y, r.w, r.h);
    }
    this.objects.push(gfx);
  }
}
