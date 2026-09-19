import Phaser from 'phaser';
import { FONT_FAMILY } from './font';
import {
  BUTTON_EDGE,
  BUTTON_FILLS,
  computeBevelRects,
  type ButtonFill,
  type ButtonSize,
} from './utils/pixelButtonStyle';

export interface PixelButtonConfig {
  /** Top-left of the button's outer box. */
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  labelColor?: string;
  size?: ButtonSize;
  fill?: ButtonFill;
  fontSize?: number;
  onClick?: () => void;
}

/** Square-cornered bevel button: outline, light/dark inner edges and a drop shadow; owns hover and pressed states. */
export class PixelButton {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly x: number;
  private readonly y: number;
  private readonly width: number;
  private readonly height: number;
  private readonly size: ButtonSize;
  private fill: ButtonFill;
  private hovered = false;
  private pressed = false;

  constructor(scene: Phaser.Scene, config: PixelButtonConfig) {
    this.x = config.x;
    this.y = config.y;
    this.width = config.width;
    this.height = config.height;
    this.size = config.size ?? 'small';
    this.fill = config.fill ?? 'button';

    this.gfx = scene.add.graphics().setScrollFactor(0);
    this.text = scene.add
      .text(0, 0, config.label, {
        fontFamily: FONT_FAMILY,
        fontSize: `${config.fontSize ?? 20}px`,
        color: config.labelColor ?? '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.zone = scene.add
      .zone(this.x + this.width / 2, this.y + this.height / 2, this.width, this.height)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.zone.on('pointerover', () => this.setHovered(true));
    this.zone.on('pointerout', () => this.setHovered(false));
    if (config.onClick) this.zone.on('pointerdown', config.onClick);
    this.redraw();
  }

  setLabel(label: string, color?: string): this {
    this.text.setText(label);
    if (color) this.text.setColor(color);
    return this;
  }

  setPressed(pressed: boolean): this {
    this.pressed = pressed;
    this.redraw();
    return this;
  }

  setFill(fill: ButtonFill): this {
    this.fill = fill;
    this.redraw();
    return this;
  }

  setDepth(depth: number): this {
    this.gfx.setDepth(depth);
    this.text.setDepth(depth);
    this.zone.setDepth(depth);
    return this;
  }

  setVisible(visible: boolean): this {
    this.gfx.setVisible(visible);
    this.text.setVisible(visible);
    if (this.zone.input) this.zone.input.enabled = visible;
    return this;
  }

  destroy(): void {
    this.gfx.destroy();
    this.text.destroy();
    this.zone.destroy();
  }

  private setHovered(hovered: boolean) {
    this.hovered = hovered;
    this.redraw();
  }

  private redraw() {
    const fills = BUTTON_FILLS[this.fill];
    const dy = this.pressed ? BUTTON_EDGE[this.size] : 0;
    this.gfx.clear();
    for (const r of computeBevelRects(this.width, this.height, this.size, this.hovered ? fills.hover : fills.fill, this.pressed)) {
      this.gfx.fillStyle(r.color, r.alpha);
      this.gfx.fillRect(this.x + r.x, this.y + dy + r.y, r.w, r.h);
    }
    this.text.setPosition(this.x + this.width / 2, this.y + dy + this.height / 2);
  }
}
