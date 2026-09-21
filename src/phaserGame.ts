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

  const MAX_WIDTH = 800;
  const MAX_HEIGHT = 840;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
console.log(isMobile)
  const width = isMobile ? Math.min(window.innerWidth, MAX_WIDTH) : MAX_WIDTH;
  const height = isMobile ? Math.min(window.innerHeight, MAX_HEIGHT) : MAX_HEIGHT;
  console.log(width)

  const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    pixelArt: true,
    width,
    height: width,
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
     // mode: isMobile ? Phaser.Scale.FIT : Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: width,
      height: width
    }
  };

  new Game(config);

  // Text renders in the monospace fallback until Pixelify Sans arrives, then swaps.
  await loadGameFont();
}
