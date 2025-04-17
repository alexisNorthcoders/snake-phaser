import Phaser from 'phaser';
import socketManager from '../SocketManager';
import { Snake } from '../Snake';

interface SnakeColors {
  head: string;
  body: string;
  eyes: string;
}

export class GameScene extends Phaser.Scene {
  private startTime: number = 0;
  private isGameOver: boolean = false;
  private gameStarted: boolean = false;
  private playerId: string = '';
  private welcomeText?: Phaser.GameObjects.Text;
  private snakes: Map<string, Snake> = new Map();
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

  create() {

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
      socket.onmessage = this.handleSocketMessage.bind(this);
    } else {
      console.warn('[GameScene] Socket not connected!');
    }
  }

  handleSocketMessage(msg: MessageEvent) {
    const data = msg.data;

    if (data === 'p') {
      const latency = Date.now() - this.startTime;
      console.log(`Ping: ${latency}ms`);
      setTimeout(() => this.measurePing(), 5000);
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (e) {
      console.warn('[GameScene] Non-JSON message received:', data);
      return;
    }

    switch (parsed.event) {
      case 'verified':
        console.log('Verified connection. Server is ready.');

        if (!this.gameStarted && !this.isGameOver) {
          socketManager.send({
            event: 'newPlayer',
            player: {
              name: this.name,
              id: this.playerId,
              colours: this.snakeColors
            }
          });

          this.measurePing();
        }
        break;
      case 'waitingRoomStatus': {
        const players = parsed.players;

        players.forEach((player: any) => {
          const snakeData = player.snake;

          const newSnake = new Snake(
            this,
            snakeData.x,
            snakeData.y,
            player.type,
            player.colours,
            snakeData.size
          );

          newSnake.tail = snakeData.tail;
          newSnake.speed = snakeData.speed;
          newSnake.isDead = snakeData.isDead;
          newSnake.food = snakeData.score ?? 0;

          this.snakes.set(player.id, newSnake);

        });

        break;
      }

      case 'snake_update_v2': {
        const snakes = parsed.snakes;

        for (const snakeUpdate of snakes) {
          const currentSnake = this.snakes.get(snakeUpdate.playerId);
          if (!currentSnake) continue;

          if (snakeUpdate.playerId === this.playerId) {
            // update score here
          }

          if (currentSnake.isDead) continue;

          currentSnake.tail = snakeUpdate.tail;
          currentSnake.food = snakeUpdate.score;
          currentSnake.position({ x: snakeUpdate.x, y: snakeUpdate.y });

          if (snakeUpdate.isDead) {
            currentSnake.stop(snakeUpdate.playerId, snakeUpdate.score, false, async () => { });
          }
        }
        break;
      }

      default:
        console.log('[GameScene] Unhandled event:', parsed.event);
    }
  }

  measurePing() {
    if (this.isGameOver) return;

    this.startTime = Date.now();
    socketManager.send('p');
  }

  update(): void {
    if (!this.gameStarted) return;

    for (const snake of this.snakes.values()) {
      if (!snake.isDead) {
        snake.draw();
      }
    }
  }
}
