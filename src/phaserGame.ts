import Phaser from 'phaser';
import { LoginScene } from './scenes/LoginScene';
import { GameScene } from './scenes/GameScene';

export function launchGame() {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    pixelArt: true,
    width: 800,
    height: 840,
    parent: 'game-container',
    backgroundColor: '#1d1d1d',
    scene: [LoginScene, GameScene],
  };

  new Phaser.Game(config);
}
