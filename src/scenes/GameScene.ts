import Phaser from 'phaser';
import socketManager from '../SocketManager';
import { Snake } from '../Snake';
import { Food } from '../Food';
import { handleSocketMessage } from '../SocketHandler';

interface SnakeColors {
  head: string;
  body: string;
  eyes: string;
}

export class GameScene extends Phaser.Scene {
  private startTime: number = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private pingText!: Phaser.GameObjects.Text;
  private playerNameText!: Phaser.GameObjects.Text;
  private isGameOver: boolean = false;
  private gameStarted: boolean = false;
  private playerId: string = '';
  private gameConfigured: boolean = false
  private welcomeText?: Phaser.GameObjects.Text;
  private snakes: Map<string, Snake> = new Map();
  private food: Array<Food> = []
  private snakeColors: SnakeColors = {
    head: '#00FF00',
    body: '#008000',
    eyes: '#FFFFFF'
  };
  private name: string = '';

  constructor() {
    super('GameScene');
  }

  private sendPlayerMovement(direction: 'u' | 'd' | 'l' | 'r'): void {
    const socket = socketManager.getSocket();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(`m:${this.playerId}:${direction}`);
    }
  }

  preload() {
    this.load.image('redApple', 'assets/images/food/tile000.png');
    this.load.image('greenApple', 'assets/images/food/tile001.png');
    this.load.image('yellowApple', 'assets/images/food/tile002.png');
    this.load.image('strawberry', 'assets/images/food/tile027.png');
    this.load.image('cherry', 'assets/images/food/tile204.png');
    this.load.image('chili', 'assets/images/food/tile068.png');
    this.load.image('banana', 'assets/images/food/tile045.png');
  }

  create() {

    this.add.rectangle(0, 0, 800, 40, 0x000000, 0.6).setOrigin(0);

    this.scoreText = this.add.text(10, 10, 'Score: 0', {
      fontSize: '20px',
      color: '#ffffff',
    }).setScrollFactor(0);

    this.pingText = this.add.text(200, 10, 'Ping: --ms', {
      fontSize: '20px',
      color: '#ffffff',
    }).setScrollFactor(0);

    this.playerNameText = this.add.text(400, 10, `Player: ${this.name}`, {
      fontSize: '20px',
      color: '#ffffff',
    }).setScrollFactor(0);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (!this.gameStarted || this.isGameOver) return;

      const key = event.key.toLowerCase();
      let direction: 'u' | 'd' | 'l' | 'r' | null = null;

      switch (key) {
        case 'arrowup':
        case 'w':
          direction = 'u';
          break;
        case 'arrowdown':
        case 's':
          direction = 'd';
          break;
        case 'arrowleft':
        case 'a':
          direction = 'l';
          break;
        case 'arrowright':
        case 'd':
          direction = 'r';
          break;
      }

      if (direction) {
        this.sendPlayerMovement(direction);
      }
    });

    const startButton = this.add.text(400, 400, 'START GAME', {
      fontSize: '28px',
      backgroundColor: '#00AA00',
      color: '#FFFFFF',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();

    startButton.on('pointerdown', () => {
      socketManager.send({ event: 'startGame' });
      startButton.setVisible(false);
      this.gameStarted = true;

      this.welcomeText?.destroy();
    });

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    this.name = userData.username;
    this.playerId = String(userData.userId);

    this.welcomeText = this.add.text(400, 300, `Welcome ${this.name}!`, {
      fontSize: '32px',
      color: '#fff',
    }).setOrigin(0.5);

    const socket = socketManager.getSocket();
    if (socket) {
      socket.onmessage = (msg) => handleSocketMessage(this, msg);

    } else {
      console.warn('[GameScene] Socket not connected!');
    }
  }

  update(): void {
    if (!this.gameStarted) return;

    this.food.forEach((f) => f.draw())

    for (const snake of this.snakes.values()) {
      if (!snake.isDead) {
        snake.draw(40);
      }
    }
  }
}
