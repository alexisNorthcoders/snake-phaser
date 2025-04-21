import socketManager from '../SocketManager';
import { Snake } from '../Snake';
import { Food } from '../Food';

interface SnakeColors {
  head: string;
  body: string;
  eyes: string;
}

export class GameScene extends Phaser.Scene {
  public startTime: number = 0;
  public scoreText!: Phaser.GameObjects.Text;
  public pingText!: Phaser.GameObjects.Text;
  public playerNameText!: Phaser.GameObjects.Text;
  public isGameOver: boolean = false;
  public gameStarted: boolean = false;
  public playerId: string = '';
  public gameConfigured: boolean = false
  public welcomeText?: Phaser.GameObjects.Text;
  public snakes: Map<string, Snake> = new Map();
  public food: Array<Food> = [];
  public bg!: Phaser.GameObjects.TileSprite;

  public snakeColors: SnakeColors = {
    head: '#00FF00',
    body: '#008000',
    eyes: '#FFFFFF'
  };
  public name: string = '';

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
    for (let i = 1; i <= 91; i++) {
      this.load.image(`${i}`, `assets/images/backgrounds/color_background_${i}.png`);
    }
  }

  create() {

    this.bg = this.add.tileSprite(
      0,
      40,
      this.scale.width,
      this.scale.height - 40,
      '1'
    ).setOrigin(0, 0);

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

    // Logout button
    const logoutButton = this.add.text(700, 10, 'Logout', {
      fontSize: '20px',
      color: '#ff0000',
      backgroundColor: '#222',
      padding: { x: 10, y: 5 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => logoutButton.setStyle({ backgroundColor: '#444' }))
      .on('pointerout', () => logoutButton.setStyle({ backgroundColor: '#222' }))
      .on('pointerdown', () => {
        this.logout();
      });

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

    // connect to websockets
    socketManager.connect(String(userData.userId), userData.token, this);

  }

  async logout() {

    socketManager.close();

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    if (userData.token) {
      try {

        const response = await fetch(`/api/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userData.token}`,
          },
        });

        if (response.ok) {

          localStorage.removeItem('userData');
          this.scene.start('LoginScene');
        } else {

          console.error('Failed to log out:', response.statusText);
        }
      } catch (error) {
        console.error('Error during logout:', error);

      }
    } else {

      localStorage.removeItem('userData');
      this.scene.stop('GameScene');
      this.scene.start('LoginScene');
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
