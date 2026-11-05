import { Game, AUTO } from 'phaser';
import { GameScene } from './scenes/GameScene';
import { loadGameFont, withDefaultFont } from './font';
import { THEME_BACKGROUND } from './theme';
import InputText from 'phaser3-rex-plugins/plugins/inputtext.js';

// Phaser has no global text-style default (it hardcodes Courier), so default it at the factory.
function applyDefaultFont() {
  const factory = Phaser.GameObjects.GameObjectFactory.prototype;
  const text = factory.text;
  factory.text = function (this: Phaser.GameObjects.GameObjectFactory, x, y, str, style) {
    return text.call(this, x, y, str, withDefaultFont(style));
  };
}

export async function launchGame() {
  applyDefaultFont();

  // Logical size is fixed; FIT scales the canvas down to the container, never up past this.
  const SIZE = 800;

  const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    pixelArt: true,
    parent: 'game-container',
    dom: {
      createContainer: true
    },
    backgroundColor: THEME_BACKGROUND,
    scene: [GameScene],
    plugins: {
      scene: [{
        key: 'rexInputTextPlugin',
        plugin: InputText,
        start: true
      }]
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: SIZE,
      height: SIZE,
      max: { width: SIZE, height: SIZE }
    }
  };

  new Game(config);

  // Text renders in the monospace fallback until Pixelify Sans arrives, then swaps.
  await loadGameFont();
}
