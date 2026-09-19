import socketManager from '../SocketManager';
import { Snake, getHighScores, getLeaderboard, HighScore, postAnonymousScore } from '../Snake';
import { Food } from '../Food';
import { LocalScoresManager } from '../utils/localScoresManager';
import { ClientIdManager } from '../utils/clientIdManager';
import { ColourPanel } from '../ColourPanel';
import { LobbyAmbience, BACKGROUND_DEPTH } from '../LobbyAmbience';
import { createColourSelection, type ColourSelection } from '../colourSelection';
import { isGuest, sessionName } from '../userData';
import { feature, localStorageOrNothing } from '../feature';
import { createFpsMeter, formatFpsReadout } from '../fpsMeter';
import { createAccountAppearanceStore, createAppearanceStore, type AccountAppearanceStore } from '../appearanceStore';
import InputText from 'phaser3-rex-plugins/plugins/inputtext';
import { createNameStore, MAX_NAME_LENGTH, normaliseName } from '../nameStore';
import { authModalManager, AuthModalConfig } from '../utils/authModalManager';

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

const appearanceStore = createAppearanceStore(localStorageOrNothing());
const nameStore = createNameStore(localStorageOrNothing());

export class GameScene extends Phaser.Scene {
  public startTime: number = 0;
  public scoreText!: Phaser.GameObjects.Text;
  public pingText!: Phaser.GameObjects.Text;
  private fpsText?: Phaser.GameObjects.Text;
  private fpsMeter = createFpsMeter();
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
  private guest: boolean = false;
  private startButton?: Phaser.GameObjects.Text;
  private colourPanel?: ColourPanel;
  private lobbyAmbience?: LobbyAmbience;
  private colourSelection?: ColourSelection;
  private accountAppearance?: AccountAppearanceStore;
  private nameField?: InputText;
  private nameLabel?: Phaser.GameObjects.Text;
  private gameOverObjects: Phaser.GameObjects.GameObject[] = [];
  private reconnectText: Phaser.GameObjects.Text | null = null;
  private leaderboardObjects: Phaser.GameObjects.GameObject[] = [];
  private leaderboardRefreshButton?: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  private sendPlayerMovement(direction: 'u' | 'd' | 'l' | 'r'): void {
    socketManager.send({
      event: 'move',
      key: direction
    });
  }

  private sendColorUpdate(): void {
    socketManager.send({ event: 'updatePlayer', colours: this.snakeColors });
  }

  /** Logged-in players' colours live on their account; only anonymous players use localStorage. */
  private saveColours(): void {
    (this.accountAppearance ?? appearanceStore).save(this.snakeColors);
  }

  private createNameField(): void {
    this.nameLabel = this.add.text(300, 460, 'Name:', { fontSize: '20px', color: '#ffffff' }).setOrigin(1, 0.5);
    this.nameField = new InputText(this, 410, 460, 160, 34, {
      backgroundColor: '#333',
      fontSize: '20px',
      color: '#fff',
      type: 'text',
      maxLength: MAX_NAME_LENGTH,
      placeholder: 'anonymous',
      text: nameStore.saved(),
    });
    this.add.existing(this.nameField);
    this.nameField.on('textchange', () => this.applyNameField());
  }

  // Sync this.name and the visible name texts from the field's current value.
  private applyNameField(): void {
    if (!this.nameField) return;
    this.name = normaliseName(this.nameField.text);
    this.playerNameText.setText(`Player: ${this.name}`);
    this.welcomeText?.setText(`Welcome ${this.name}!`);
  }

  // Persist and send the chosen guest name; called once when the game starts.
  private commitName(): void {
    if (!this.guest || !this.nameField) return;
    this.name = nameStore.save(this.nameField.text);
    this.playerNameText.setText(`Player: ${this.name}`);
    socketManager.send({ event: 'updatePlayer', name: this.name });
  }

  private destroyNameField(): void {
    this.nameField?.destroy();
    this.nameField = undefined;
    this.nameLabel?.destroy();
    this.nameLabel = undefined;
  }

  private createColourPanel(): void {
    const selection = createColourSelection(this.snakeColors);
    // Share the selection's colours object so the socket and saves always see the committed colours.
    this.snakeColors = selection.colours;
    this.colourSelection = selection;
    this.colourPanel = new ColourPanel(this, selection, () => {
      this.saveColours();
      this.sendColorUpdate();
    });
  }

  private destroyColourPanel(): void {
    this.colourPanel?.destroy();
    this.colourPanel = undefined;
    this.colourSelection = undefined;
  }

  private destroyLobbyAmbience(): void {
    this.lobbyAmbience?.destroy();
    this.lobbyAmbience = undefined;
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
    ).setOrigin(0, 0).setDepth(BACKGROUND_DEPTH);

    this.add.rectangle(0, 0, this.scale.width, 40, 0x000000, 0.6).setOrigin(0);

    this.scoreText = this.add.text(10, 10, 'Score: 0', {
      fontSize: '20px',
      color: '#ffffff',
    }).setScrollFactor(0);

    this.pingText = this.add.text(200, 10, 'Ping: --ms', {
      fontSize: '20px',
      color: '#ffffff',
    }).setScrollFactor(0);

    this.fpsText = undefined;
    this.fpsMeter = createFpsMeter();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroyFpsText();
      this.destroyLobbyAmbience();
    });

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    this.guest = isGuest(userData);
    // Guests play under the name they picked last time; logged-in players keep their account username.
    this.name = sessionName(userData, nameStore);
    this.playerId = String(userData.userId);

    this.playerNameText = this.add.text(400, 10, `Player: ${this.name}`, {
      fontSize: '20px',
      color: '#ffffff',
    }).setScrollFactor(0);

    // Guests get Log In (opens the auth overlay on the login form); accounts get Logout.
    const headerButton = this.add.text(700, 20, this.guest ? 'Log In' : 'Logout', {
      fontSize: '20px',
      color: this.guest ? '#00ff00' : '#ff0000',
      backgroundColor: '#222',
      padding: { x: 10, y: 5 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => headerButton.setStyle({ backgroundColor: '#444' }))
      .on('pointerout', () => headerButton.setStyle({ backgroundColor: '#222' }))
      .on('pointerdown', () => {
        if (this.guest) {
          this.openLogIn();
        } else {
          this.logout();
        }
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
      this.commitName();
      socketManager.send({ event: 'startGame' });
    });

    this.welcomeText = this.add.text(400, 110, `Welcome ${this.name}!`, {
      fontSize: '32px',
      color: '#fff',
    }).setOrigin(0.5);

    if (this.guest) {
      this.snakeColors = appearanceStore.load();
      this.createColourPanel();
      this.createNameField();
    } else {
      // The panel is only built once the account's colours (or the random fallback) have arrived, so nothing
      // flashes or can be picked before the load, and the selection starts from the loaded colours.
      this.accountAppearance = createAccountAppearanceStore({
        fetch: (input, init) => fetch(input, init),
        token: userData.token,
        anonymous: () => appearanceStore.peek(),
      });
      this.accountAppearance.load().then((colours) => {
        if (!this.sys.isActive()) return;
        // Colours are applied even if the lobby was already left, so the game still uses them.
        Object.assign(this.snakeColors, colours);
        if (this.welcomeText?.active && !this.colourPanel) this.createColourPanel();
        this.sendColorUpdate();
      });
    }
    this.displayLeaderboard();

    if (feature.lobbyAmbience) this.lobbyAmbience = new LobbyAmbience(this, () => this.snakeColors);

    // connect to websockets
    socketManager.connect(String(userData.userId), userData.token, this);

    // Start ping measurement after connection
    socketManager.startPingMeasurement(this);
  }

  /** Open the auth overlay on the login form; on success restart so the room is rejoined as the account. */
  private openLogIn() {
    const authConfig: AuthModalConfig = {
      initialForm: 'login',
      onAuthSuccess: () => this.restartAsAccount(),
      onDismiss: () => {},
    };
    authModalManager.open(this, authConfig);
  }

  /** Open the auth overlay on Create Account from the Game Over panel; Back leaves the panel as it was. */
  private openSaveScore() {
    authModalManager.open(this, {
      initialForm: 'register',
      title: 'SAVE YOUR SCORE',
      subtitle: 'Create an account to keep your scores',
      onAuthSuccess: () => this.restartAsAccount(),
      onDismiss: () => {},
    });
  }

  private restartAsAccount() {
    // The auth overlay has just stored the account in localStorage; refresh identity before restarting.
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    this.guest = isGuest(userData);
    this.name = sessionName(userData, nameStore);
    this.playerId = String(userData.userId);

    this.destroyLobbyAmbience();
    socketManager.close();
    this.scene.restart();
  }

  async logout() {

    this.destroyLobbyAmbience();

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

  private displayTopLocalScores(): void {
    const topScores = LocalScoresManager.getTopScores(5);

    if (topScores.length > 0) {
      const SCORES_X = 400;
      let SCORES_Y = 495;

      const header = this.add.text(SCORES_X, SCORES_Y, 'YOUR TOP SCORES:', {
        fontSize: '18px',
        color: '#ffff00',
      }).setOrigin(0.5, 0);
      this.leaderboardObjects.push(header);

      SCORES_Y += 25;
      topScores.forEach((score, index) => {
        const date = new Date(score.timestamp).toLocaleDateString();
        const text = this.add.text(SCORES_X, SCORES_Y + index * 20, `#${index + 1}: ${score.score} (${date})`, {
          fontSize: '16px',
          color: '#ffffff',
        }).setOrigin(0.5, 0);
        this.leaderboardObjects.push(text);
      });
    }
  }

  private async displayLeaderboard(): Promise<void> {
    if (this.guest) {
      this.displayTopLocalScores();
      return;
    }

    const leaderboard = await getLeaderboard();
    // The round may have started while the fetch was in flight
    if (this.gameStarted) return;
    const topLeaderboard = leaderboard.slice(0, 10);

    const BOARD_X = 50;
    let BOARD_Y = 310;

    const header = this.add.text(BOARD_X, BOARD_Y, 'GLOBAL LEADERBOARD', {
      fontSize: '18px',
      color: '#ffff00',
    });
    this.leaderboardObjects.push(header);

    BOARD_Y += 28;

    if (topLeaderboard.length > 0) {
      topLeaderboard.forEach((entry, index) => {
        const text = this.add.text(BOARD_X, BOARD_Y + index * 22, `#${index + 1}: ${entry.username} - ${entry.score}`, {
          fontSize: '14px',
          color: '#ffffff',
        });
        this.leaderboardObjects.push(text);
      });
    } else {
      const emptyText = this.add.text(BOARD_X, BOARD_Y, 'No scores yet', {
        fontSize: '14px',
        color: '#aaaaaa',
      });
      this.leaderboardObjects.push(emptyText);
    }

    BOARD_Y += topLeaderboard.length * 22 + 15;
    this.leaderboardRefreshButton = this.add.text(BOARD_X, BOARD_Y, 'Refresh Leaderboard', {
      fontSize: '14px',
      color: '#00ff00',
      backgroundColor: '#222',
      padding: { x: 8, y: 4 },
    })
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.leaderboardRefreshButton?.setStyle({ backgroundColor: '#444' }))
      .on('pointerout', () => this.leaderboardRefreshButton?.setStyle({ backgroundColor: '#222' }))
      .on('pointerdown', () => {
        this.clearLeaderboard();
        this.displayLeaderboard();
      });

    this.leaderboardObjects.push(this.leaderboardRefreshButton);
  }

  private clearLeaderboard(): void {
    this.leaderboardObjects.forEach((obj) => obj.destroy());
    this.leaderboardObjects = [];
    this.leaderboardRefreshButton = undefined;
  }

  startGame() {
    console.log("[GameScene] Requesting game start");
    this.commitName();
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

    this.destroyNameField();

    this.destroyLobbyAmbience();

    // Remove color customization swatches
    this.destroyColourPanel();

    // Remove the scores list (local scores or global leaderboard + Refresh button)
    this.clearLeaderboard();

    // Remove game-over overlay, if a new round is starting from it
    this.clearGameOverOverlay();

    // Initialize game state
    this.isGameOver = false;
  }

  async onGameOver(payload: GameOverPayload) {
    console.log("[GameScene] Game over callback", payload);
    this.isGameOver = true;
    this.clearGameOverOverlay();

    // Save the player's score to local storage
    const sessionId = socketManager.getRoom()?.sessionId;
    const playerRanking = payload.rankings.find(r => r.id === sessionId);
    if (playerRanking) {
      LocalScoresManager.saveScore(playerRanking.score);

      // For anonymous players, also try to submit score to server
      if (this.guest) {
        const clientId = ClientIdManager.getOrCreateClientId();
        const result = await postAnonymousScore(clientId, playerRanking.score);
        if (!result.success) {
          console.warn('[GameScene] Failed to submit score to server:', result.message);
          // Score is saved locally, continue gracefully
        }
      }
    }

    this.displayGameOverScreen(payload);
  }

  private async displayGameOverScreen(payload: GameOverPayload) {
    const topScores: HighScore[] = (await getHighScores()).slice(0, 3);

    const PANEL_CENTER_X = 400;
    const TITLE_Y = 170;
    const RANKINGS_START_Y = 220;
    const ROW_HEIGHT = 28;
    const SECTION_GAP = 20;
    const BUTTON_GAP = 30;
    const SAVE_SCORE_GAP = 50;
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
    const saveScoreY = playAgainY + SAVE_SCORE_GAP;

    const panelTopY = TITLE_Y - PANEL_TOP_PADDING;
    const panelBottomY = (this.guest ? saveScoreY : playAgainY) + PANEL_BOTTOM_PADDING;
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

    if (this.guest) {
      const saveScoreButton = this.add.text(PANEL_CENTER_X, saveScoreY, 'SAVE SCORE', {
        fontSize: '24px',
        backgroundColor: '#555555',
        color: '#FFFFFF',
        padding: { x: 10, y: 5 },
      })
        .setOrigin(0.5)
        .setDepth(20)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => saveScoreButton.setStyle({ backgroundColor: '#777777' }))
        .on('pointerout', () => saveScoreButton.setStyle({ backgroundColor: '#555555' }))
        .on('pointerdown', () => this.openSaveScore());

      this.gameOverObjects.push(saveScoreButton);
    }
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

  private destroyFpsText() {
    this.fpsText?.destroy();
    this.fpsText = undefined;
  }

  private updateFps(deltaMs: number) {
    if (!feature.showFps) {
      this.destroyFpsText();
      return;
    }
    const report = this.fpsMeter.frame(deltaMs);
    if (!this.fpsText) {
      this.fpsText = this.add.text(this.scoreText.x, this.scoreText.y + this.scoreText.height + 4, 'FPS: --', {
        fontSize: '20px',
        color: '#ffffff',
      }).setScrollFactor(0).setDepth(10);
    }
    if (report) this.fpsText.setText(formatFpsReadout(report));
  }

  update(_time: number, delta: number): void {
    this.updateFps(delta);
    if (!this.gameStarted) {
      return;
    }
    this.food.forEach((f) => f.draw())

    // Dead snakes too: they are snapped onto their last cells, and skipping
    // them would leave the frame from mid-slide on screen.
    for (const snake of this.snakes.values()) {
      snake.draw(40);
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
    this.leaderboardObjects = [];
    this.leaderboardRefreshButton = undefined;
  }

  shutdown() {
    // Clean up our custom resources
    socketManager.stopPingMeasurement();

    // Clear game objects
    this.clearSnakesAndFood();
    this.clearGameOverOverlay();
    this.clearScoreboard();
    this.clearLeaderboard();
    authModalManager.close();

    // Remove keyboard listeners
    this.input.keyboard?.removeAllListeners();

    // Remove any remaining text objects
    this.scoreText?.destroy();
    this.pingText?.destroy();
    this.destroyFpsText();
    this.playerNameText?.destroy();
    this.scoreboardBg?.destroy();
    this.scoreboardHeader?.destroy();
    this.welcomeText?.destroy();
    this.destroyNameField();
    this.destroyColourPanel();
    this.destroyLobbyAmbience();
    this.reconnectText?.destroy();
    this.reconnectText = null;
  }
}
