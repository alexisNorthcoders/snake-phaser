import { Game, AUTO } from 'phaser';
import { LoginScene } from './scenes/LoginScene';
import { GameScene } from './scenes/GameScene';
import InputText from 'phaser3-rex-plugins/plugins/inputtext.js';

export function launchGame() {
  const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    pixelArt: true,
    width: 800,
    height: 840,
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
    }
  };

  new Game(config);
}