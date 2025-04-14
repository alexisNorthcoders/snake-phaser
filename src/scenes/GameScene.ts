import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(data: { username: string }) {
    this.add.text(400, 300, `Welcome ${data.username}!`, {
      fontSize: '32px',
      color: '#fff',
    }).setOrigin(0.5);
  }
}