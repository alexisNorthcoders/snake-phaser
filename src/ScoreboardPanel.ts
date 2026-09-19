import Phaser from 'phaser';
import { FONT_FAMILY } from './font';
import { FramedPanel } from './FramedPanel';
import {
  SCOREBOARD_PANEL,
  SCOREBOARD_SWATCH_OUTLINE,
  SCOREBOARD_SWATCH_SIZE,
  computeScoreboardLayout,
  type ScoreboardRow,
} from './utils/scoreboardLayout';

const DEPTH = 10;
const DEAD_COLOUR = '#888888';

/** Framed in-game scoreboard, hidden until shown; rebuilds only when its rows change. */
export class ScoreboardPanel {
  private frame?: FramedPanel;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private rows: ScoreboardRow[] = [];
  private visible = false;
  private signature = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.rebuild();
  }

  setRows(rows: ScoreboardRow[]): void {
    const signature = JSON.stringify(rows);
    if (signature === this.signature) return;
    this.rows = rows;
    this.rebuild();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.frame?.setVisible(visible);
    this.objects.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(visible));
  }

  destroy(): void {
    this.clear();
  }

  private clear(): void {
    this.frame?.destroy();
    this.frame = undefined;
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
  }

  private rebuild(): void {
    this.clear();
    this.signature = JSON.stringify(this.rows);
    const l = computeScoreboardLayout(this.rows.length);
    const p = SCOREBOARD_PANEL;
    this.frame = new FramedPanel(this.scene, p.x, p.y, p.width, l.height, p.scrimAlpha).setDepth(DEPTH);

    const text = (x: number, y: number, content: string, size: string, color: string, originX = 0) =>
      this.scene.add
        .text(x, y, content, { fontFamily: FONT_FAMILY, fontSize: size, color })
        .setOrigin(originX, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH + 1);

    this.objects.push(text(l.contentX, l.headingY, 'Scoreboard', '18px', '#ffff00'));

    this.rows.forEach((row, i) => {
      const y = l.rowY(i);
      const color = row.isDead ? DEAD_COLOUR : '#ffffff';
      const o = SCOREBOARD_SWATCH_OUTLINE;
      const swatch = this.scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
      swatch.fillStyle(0x000000, 1);
      swatch.fillRect(l.swatchX, y, SCOREBOARD_SWATCH_SIZE + 2 * o, SCOREBOARD_SWATCH_SIZE + 2 * o);
      swatch.fillStyle(row.headColour, 1);
      swatch.fillRect(l.swatchX + o, y + o, SCOREBOARD_SWATCH_SIZE, SCOREBOARD_SWATCH_SIZE);
      this.objects.push(swatch, text(l.nameX, y, row.label, '16px', color), text(l.scoreRight, y, String(row.score), '16px', color, 1));
    });

    this.setVisible(this.visible);
  }
}
