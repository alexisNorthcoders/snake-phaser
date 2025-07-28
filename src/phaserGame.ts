import { Game, AUTO } from 'phaser';
import { LoginScene } from './scenes/LoginScene';
import { GameScene } from './scenes/GameScene';
import InputText from 'phaser3-rex-plugins/plugins/inputtext.js';

export function launchGame() {
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
    backgroundColor: '#1d1d1d',
    scene: [LoginScene, GameScene],
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
}
