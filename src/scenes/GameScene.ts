import socketManager from '../SocketManager';
import { Snake, getHighScores, HighScore } from '../Snake';
import { Food } from '../Food';

interface SnakeColors {
  head: string;
  body: string;
  eyes: string;
}

interface RankingEntry {
  id: string;
  name: string;
  score: number;
}

interface GameOverPayload {
  winnerId?: string;
  rankings: RankingEntry[];
}

export class GameScene extends Phaser.Scene {
  public startTime: number = 0;
  public scoreText!: Phaser.GameObjects.Text;
  public pingText!: Phaser.GameObjects.Text;
  public playerNameText!: Phaser.GameObjects.Text;
  public scoreboardTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  public scoreboardBg!: Phaser.GameObjects.Rectangle;
  public scoreboardHeader!: Phaser.GameObjects.Text;
  public scoreboardVisible: boolean = false;
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
  private startButton?: Phaser.GameObjects.Text;
  private gameOverObjects: Phaser.GameObjects.GameObject[] = [];
  private reconnectText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('GameScene');
  }

  private sendPlayerMovement(direction: 'u' | 'd' | 'l' | 'r'): void {
    socketManager.send({
      event: 'move',
      key: direction
    });
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

    this.add.rectangle(0, 0, this.scale.width, 40, 0x000000, 0.6).setOrigin(0);

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

    const SCOREBOARD_X = 600;
    const SCOREBOARD_Y = 50;
    const SCOREBOARD_WIDTH = 190;
    const SCOREBOARD_HEADER_HEIGHT = 26;

    this.scoreboardBg = this.add.rectangle(SCOREBOARD_X, SCOREBOARD_Y, SCOREBOARD_WIDTH, SCOREBOARD_HEADER_HEIGHT, 0x000000, 0.6)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(10)
      .setVisible(false);

    this.scoreboardHeader = this.add.text(SCOREBOARD_X + 10, SCOREBOARD_Y + 4, 'SCOREBOARD', {
      fontSize: '16px',
      color: '#ff4444',
    }).setScrollFactor(0).setDepth(10).setVisible(false);

    this.input.keyboard?.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault();
      this.setScoreboardVisible(true);
    });
    this.input.keyboard?.on('keyup-TAB', (event: KeyboardEvent) => {
      event.preventDefault();
      this.setScoreboardVisible(false);
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

    this.startButton = this.add.text(400, 400, 'START GAME', {
      fontSize: '28px',
      backgroundColor: '#00AA00',
      color: '#FFFFFF',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();

    this.startButton.on('pointerdown', () => {
      console.log("[GameScene] Start button clicked");
      socketManager.send({ event: 'startGame' });
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

    // Start ping measurement after connection
    socketManager.startPingMeasurement(this);
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

  startGame() {
    console.log("[GameScene] Requesting game start");
    socketManager.send({ event: 'startGame' });
  }

  onGameStarted() {
    console.log("[GameScene] Game started callback");
    this.gameStarted = true;

    // Remove start button
    if (this.startButton) {
      this.startButton.destroy();
      this.startButton = undefined;
    }

    // Remove welcome text if it exists
    if (this.welcomeText) {
      this.welcomeText.destroy();
    }

    // Remove game-over overlay, if a new round is starting from it
    this.clearGameOverOverlay();

    // Initialize game state
    this.isGameOver = false;
  }

  async onGameOver(payload: GameOverPayload) {
    console.log("[GameScene] Game over callback", payload);
    this.isGameOver = true;
    this.clearGameOverOverlay();

    const topScores: HighScore[] = (await getHighScores()).slice(0, 3);

    const PANEL_CENTER_X = 400;
    const TITLE_Y = 170;
    const RANKINGS_START_Y = 220;
    const ROW_HEIGHT = 28;
    const SECTION_GAP = 20;
    const BUTTON_GAP = 30;
    const PANEL_TOP_PADDING = 30;
    const PANEL_BOTTOM_PADDING = 40;
    const PANEL_WIDTH = 360;

    const rankings = payload?.rankings ?? [];
    const rankingsEndY = rankings.length > 0
      ? RANKINGS_START_Y + (rankings.length - 1) * ROW_HEIGHT
      : RANKINGS_START_Y - ROW_HEIGHT;

    const topScoresHeaderY = rankingsEndY + ROW_HEIGHT + SECTION_GAP;
    const topScoresStartY = topScoresHeaderY + ROW_HEIGHT;
    const rowCount = Math.max(topScores.length, 1);
    const topScoresEndY = topScoresStartY + (rowCount - 1) * ROW_HEIGHT;
    const playAgainY = topScoresEndY + ROW_HEIGHT + BUTTON_GAP;

    const panelTopY = TITLE_Y - PANEL_TOP_PADDING;
    const panelBottomY = playAgainY + PANEL_BOTTOM_PADDING;
    const panelCenterY = (panelTopY + panelBottomY) / 2;

    const panel = this.add.rectangle(PANEL_CENTER_X, panelCenterY, PANEL_WIDTH, panelBottomY - panelTopY, 0x000000, 0.8).setOrigin(0.5).setDepth(20);

    const title = this.add.text(PANEL_CENTER_X, TITLE_Y, 'GAME OVER', {
      fontSize: '32px',
      color: '#ff4444',
    }).setOrigin(0.5).setDepth(20);

    this.gameOverObjects.push(panel, title);

    rankings.forEach((entry, index) => {
      const line = this.add.text(PANEL_CENTER_X, RANKINGS_START_Y + index * ROW_HEIGHT, `#${index + 1}: ${entry.name} - ${entry.score}`, {
        fontSize: '20px',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(20);
      this.gameOverObjects.push(line);
    });

    const topScoresHeader = this.add.text(PANEL_CENTER_X, topScoresHeaderY, 'TOP SCORES', {
      fontSize: '22px',
      color: '#ff4444',
    }).setOrigin(0.5).setDepth(20);
    this.gameOverObjects.push(topScoresHeader);

    if (topScores.length > 0) {
      topScores.forEach((hs, index) => {
        const line = this.add.text(PANEL_CENTER_X, topScoresStartY + index * ROW_HEIGHT, `#${index + 1}: ${hs.username} - ${hs.score}`, {
          fontSize: '20px',
          color: '#ffffff',
        }).setOrigin(0.5).setDepth(20);
        this.gameOverObjects.push(line);
      });
    } else {
      const emptyLine = this.add.text(PANEL_CENTER_X, topScoresStartY, 'No high scores yet', {
        fontSize: '18px',
        color: '#aaaaaa',
      }).setOrigin(0.5).setDepth(20);
      this.gameOverObjects.push(emptyLine);
    }

    const playAgainButton = this.add.text(PANEL_CENTER_X, playAgainY, 'PLAY AGAIN', {
      fontSize: '24px',
      backgroundColor: '#00AA00',
      color: '#FFFFFF',
      padding: { x: 10, y: 5 },
    })
      .setOrigin(0.5)
      .setDepth(20)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => playAgainButton.setStyle({ backgroundColor: '#00CC00' }))
      .on('pointerout', () => playAgainButton.setStyle({ backgroundColor: '#00AA00' }))
      .on('pointerdown', () => {
        this.clearGameOverOverlay();
        this.isGameOver = false;
        this.clearSnakesAndFood();
        socketManager.send({ event: 'startGame' });
      });

    this.gameOverObjects.push(playAgainButton);
  }

  private clearGameOverOverlay() {
    this.gameOverObjects.forEach((obj) => obj.destroy());
    this.gameOverObjects = [];
  }

  private setScoreboardVisible(visible: boolean) {
    this.scoreboardVisible = visible;
    this.scoreboardBg?.setVisible(visible);
    this.scoreboardHeader?.setVisible(visible);
    this.scoreboardTexts.forEach((text) => text.setVisible(visible));
  }

  private clearScoreboard() {
    this.scoreboardTexts.forEach((text) => text.destroy());
    this.scoreboardTexts.clear();
  }

  onConnectionLost() {
    this.reconnectText?.destroy();
    this.reconnectText = this.add.text(10, 40, 'Reconnecting...', {
      fontSize: '20px',
      color: '#ff0000',
    }).setScrollFactor(0);
  }

  onReconnected() {
    this.reconnectText?.destroy();
    this.reconnectText = null;
  }

  onReconnectFailed() {
    this.reconnectText?.destroy();
    this.reconnectText = this.add.text(10, 40, 'Connection lost. Please refresh the page.', {
      fontSize: '20px',
      color: '#ff0000',
    }).setScrollFactor(0);
  }

  private clearSnakesAndFood() {
    this.snakes.forEach((snake) => snake.destroy());
    this.snakes.clear();
    this.food.forEach((f) => f.destroy());
    this.food = [];
  }

  update(): void {
    if (!this.gameStarted) {
      return;
    }
    this.food.forEach((f) => f.draw())

    for (const snake of this.snakes.values()) {
      if (!snake.isDead) {
        snake.draw(40);
      }
    }
  }

  init() {
    // Initialize properties here
    this.snakes = new Map();
    this.food = [];
    this.gameStarted = false;
    this.isGameOver = false;
    this.gameConfigured = false;
    this.gameOverObjects = [];
    this.scoreboardTexts = new Map();
    this.scoreboardVisible = false;
  }

  shutdown() {
    // Clean up our custom resources
    socketManager.stopPingMeasurement();

    // Clear game objects
    this.clearSnakesAndFood();
    this.clearGameOverOverlay();
    this.clearScoreboard();

    // Remove keyboard listeners
    this.input.keyboard?.removeAllListeners();

    // Remove any remaining text objects
    this.scoreText?.destroy();
    this.pingText?.destroy();
    this.playerNameText?.destroy();
    this.scoreboardBg?.destroy();
    this.scoreboardHeader?.destroy();
    this.welcomeText?.destroy();
    this.reconnectText?.destroy();
    this.reconnectText = null;
  }
}
