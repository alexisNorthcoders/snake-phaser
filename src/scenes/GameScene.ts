import { computeGameOverContentLayout, computeGameOverLayout, GAME_OVER_BUTTON, GAME_OVER_RANKING_ROW, GAME_OVER_RATING_LINE_HEIGHT, GAME_OVER_ROW_HEIGHT, rankingName } from '../utils/gameOverLayout';
import { deathText, roundHeadline, type DeathCause, type RoundEndReason } from '../roundSummary';
import socketManager from '../SocketManager';
import { Snake, getHighScores, getLeaderboard, HighScore, postAnonymousScore, postUserScore } from '../Snake';
import { saveRoundScore } from '../roundScore';
import { Food } from '../Food';
import { FOOD_TYPES, foodTexturePath } from '../foodTextures';
import { BACKGROUND_TEXTURE, backgroundTexturePath } from '../backgroundTexture';
import { LocalScoresManager } from '../utils/localScoresManager';
import { ClientIdManager } from '../utils/clientIdManager';
import { ColourPanel } from '../ColourPanel';
import { LobbyAmbience, BACKGROUND_DEPTH, BACKGROUND_DIM_DEPTH } from '../LobbyAmbience';
import { createColourSelection, type ColourSelection } from '../colourSelection';
import { isGuest, sessionName, type StoredUser } from '../userData';
import { createGuestSession, restoreSession, type SessionDeps } from '../session';
import { feature, localStorageOrNothing } from '../feature';
import { BAR_COUNT, HEADER, HEADER_BOTTOM, formatPingReadout, litBars } from '../pingSignal';
import { createFpsMeter, formatFpsReadout } from '../fpsMeter';
import { createAccountAppearanceStore, createAppearanceStore, type AccountAppearanceStore } from '../appearanceStore';
import InputText from 'phaser3-rex-plugins/plugins/inputtext';
import { createNameStore, MAX_NAME_LENGTH, normaliseName } from '../nameStore';
import { createModeStore, GAME_MODES, MODE_BLURBS, MODE_LABELS, modeOf, type GameMode } from '../gameMode';
import { createBotChoiceStore, loadBotRecords, loadRoster, type RosterEntry } from '../roster';
import { RosterPicker } from '../RosterPicker';
import { authModalManager, AuthModalConfig } from '../utils/authModalManager';
import { FONT_FAMILY } from '../font';
import { RATING_LINE_COUNT, ratingLines, searchingText, type RatingUpdate } from '../ranked';
import { PixelButton } from '../PixelButton';
import { HEADER_BUTTON, headerButtonPosition } from '../utils/pixelButtonStyle';
import { FramedPanel } from '../FramedPanel';
import { LeaderboardPanel } from '../LeaderboardPanel';
import { ScoreboardPanel } from '../ScoreboardPanel';
import { countdownLabel, type Phase } from '../countdownOverlay';
import type { HudTimeLeft } from '../timeLeft';
import { LOBBY_PANEL, MODE_ROW, NAME_ROW_HEIGHT, START_BUTTON, TITLE_HEIGHT, computeLobbyPanelLayout } from '../utils/lobbyPanelLayout';

interface SnakeColors {
  head: string;
  body: string;
  eyes: string;
}

/** A snake that died has a `cause`, and `by` the snake it ran into; one alive at the end, or that left, has neither. */
interface RankingEntry {
  id: string;
  name: string;
  score: number;
  cause?: DeathCause;
  by?: string;
}

interface GameOverPayload {
  reason: RoundEndReason;
  winnerId?: string;
  rankings: RankingEntry[];
}

const appearanceStore = createAppearanceStore(localStorageOrNothing());
const nameStore = createNameStore(localStorageOrNothing());
const modeStore = createModeStore(localStorageOrNothing());
const botChoiceStore = createBotChoiceStore(localStorageOrNothing());
/** Space between the header timer or hunger bar and the header button on its right. */
const HEADER_ITEM_GAP = 16;
/**
 * The header hunger bar, in the timer's place beside the header button: endless rounds, which starve, have no timer.
 * Its `label` sits left of the bar.
 */
const HUNGER_BAR = { width: 120, height: 14, labelGap: 8, fillColour: 0xff4444, emptyColour: 0x333333 } as const;

export class GameScene extends Phaser.Scene {
  public startTime: number = 0;
  public scoreText!: Phaser.GameObjects.Text;
  public pingText!: Phaser.GameObjects.Text;
  private pingBars?: Phaser.GameObjects.Graphics;
  private timeLeftText?: Phaser.GameObjects.Text;
  private hungerBar?: Phaser.GameObjects.Graphics;
  private hungerLabel?: Phaser.GameObjects.Text;
  private fpsText?: Phaser.GameObjects.Text;
  private fpsMeter = createFpsMeter();
  public scoreboard?: ScoreboardPanel;
  private headerButton?: PixelButton;
  public scoreboardVisible: boolean = false;
  public isGameOver: boolean = false;
  public gameStarted: boolean = false;
  /** True while playing a private match against the server bot; survives scene restarts so Play Again stays vs-bot. */
  public vsBot: boolean = false;
  private vsBotButton?: PixelButton;
  /** True while queued for or playing a Ranked match; set by the Ranked button, and dropped on any restart that doesn't pass it. */
  public ranked: boolean = false;
  private rankedButton?: PixelButton;
  private rankedNote?: Phaser.GameObjects.Text;
  private searchText?: Phaser.GameObjects.Text;
  private cancelButton?: PixelButton;
  private searchStartedAt = 0;
  /** The `ratingUpdate` for the Ranked match being played, which can arrive before or after the Game Over panel is built. */
  private ratingUpdate?: RatingUpdate;
  private ratingTexts: Phaser.GameObjects.Text[] = [];
  /** Set when a Ranked join was refused over the token: the restarted lobby opens the log-in form. */
  private promptLogin = false;
  /** The roster snake a vs-bot room is created against; remembered on this device and kept across scene restarts. */
  public botId: string = botChoiceStore.load();
  private rosterPicker?: RosterPicker;
  /** The mode rooms are created and matched in; remembered on this device and kept across scene restarts. */
  public mode: GameMode = modeStore.load();
  private modeLabel?: Phaser.GameObjects.Text;
  private modeButtons = new Map<GameMode, PixelButton>();
  private modeBlurb?: Phaser.GameObjects.Text;
  /** The synced mode of the round being played, taken when it starts so game over saves and shows scores for that round. */
  private roundMode?: GameMode;
  public playerId: string = '';
  public gameConfigured: boolean = false
  public snakes: Map<string, Snake> = new Map();
  public food: Array<Food> = [];
  public bg!: Phaser.GameObjects.Image;
  private bgDim!: Phaser.GameObjects.Rectangle;

  public snakeColors: SnakeColors = {
    head: '#00FF00',
    body: '#008000',
    eyes: '#FFFFFF'
  };
  public name: string = '';
  private guest: boolean = false;
  private lobbyPanel?: FramedPanel;
  private lobbyTitle?: Phaser.GameObjects.Text;
  private startButton?: PixelButton;
  private colourPanel?: ColourPanel;
  private lobbyAmbience?: LobbyAmbience;
  private sessionAttempt = 0;
  /** True once the socket has been connected with a session; false while a first-time guest is still only browsing the lobby. */
  private sessionConnected = false;
  private startInFlight = false;
  /** True once a connected lobby has sent startGame; the lobby is left for the countdown, so a mode switch must not restart it. */
  private startSent = false;
  private startError?: Phaser.GameObjects.Text;
  private colourSelection?: ColourSelection;
  private accountAppearance?: AccountAppearanceStore;
  private nameField?: InputText;
  private nameLabel?: Phaser.GameObjects.Text;
  private nameFieldFrame?: Phaser.GameObjects.Graphics;
  private gameOverObjects: { setVisible(visible: boolean): unknown; destroy(): void }[] = [];
  private countdownText?: Phaser.GameObjects.Text;
  private goTimer?: Phaser.Time.TimerEvent;
  private lastPhase?: Phase;
  private reconnectText: Phaser.GameObjects.Text | null = null;
  private leaderboardPanel?: LeaderboardPanel;

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

  private createNameField(rowY: number): void {
    const left = LOBBY_PANEL.x + LOBBY_PANEL.padding;
    const right = LOBBY_PANEL.x + LOBBY_PANEL.width - LOBBY_PANEL.padding;
    this.nameLabel = this.add.text(left, rowY + NAME_ROW_HEIGHT / 2, 'Name', {
      fontFamily: FONT_FAMILY, fontSize: '24px', color: '#ffffff',
    }).setOrigin(0, 0.5);
    const inputX = left + this.nameLabel.width + 16;
    // 4px black outline, #333333 fill and a dark 4px inner top-left edge; the DOM input sits inside them.
    this.nameFieldFrame = this.add.graphics();
    this.nameFieldFrame.fillStyle(0x000000, 1).fillRect(inputX, rowY, right - inputX, NAME_ROW_HEIGHT);
    this.nameFieldFrame.fillStyle(0x333333, 1).fillRect(inputX + 4, rowY + 4, right - inputX - 8, NAME_ROW_HEIGHT - 8);
    this.nameFieldFrame.fillStyle(0x000000, 0.45)
      .fillRect(inputX + 4, rowY + 4, right - inputX - 8, 4)
      .fillRect(inputX + 4, rowY + 4, 4, NAME_ROW_HEIGHT - 8);
    const fieldX = inputX + 8;
    const fieldY = rowY + 8;
    const fieldW = right - 4 - fieldX;
    const fieldH = NAME_ROW_HEIGHT - 12;
    this.nameField = new InputText(this, fieldX + fieldW / 2, fieldY + fieldH / 2, fieldW, fieldH, {
      backgroundColor: '#333',
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: '#fff',
      type: 'text',
      maxLength: MAX_NAME_LENGTH,
      placeholder: 'Guest',
      text: nameStore.saved(),
    });
    this.add.existing(this.nameField);
    this.nameField.on('textchange', () => this.applyNameField());
  }

  /** The Mode row: Timed / Endless toggle buttons, with a few words on the chosen mode below them. */
  private createModeRow(rowY: number): void {
    const left = LOBBY_PANEL.x + LOBBY_PANEL.padding;
    this.modeLabel = this.add.text(left, rowY + MODE_ROW.buttonHeight / 2, 'Mode', {
      fontFamily: FONT_FAMILY, fontSize: '24px', color: '#ffffff',
    }).setOrigin(0, 0.5);
    let x = left + this.modeLabel.width + MODE_ROW.labelGap;
    for (const mode of GAME_MODES) {
      this.modeButtons.set(mode, new PixelButton(this, {
        x,
        y: rowY,
        width: MODE_ROW.buttonWidth,
        height: MODE_ROW.buttonHeight,
        label: MODE_LABELS[mode],
        onClick: () => this.onModeClicked(mode),
      }));
      x += MODE_ROW.buttonWidth + MODE_ROW.buttonGap;
    }
    this.modeBlurb = this.add.text(left, rowY + MODE_ROW.buttonHeight + MODE_ROW.blurbGap + MODE_ROW.blurbHeight / 2, '', {
      fontFamily: FONT_FAMILY, fontSize: '18px', color: '#cccccc',
    }).setOrigin(0, 0.5);
    this.refreshModeRow();
  }

  private refreshModeRow(): void {
    this.modeButtons.forEach((button, mode) => {
      const selected = mode === this.mode;
      button.setFill(selected ? 'button-alt' : 'field').setPressed(selected);
    });
    this.modeBlurb?.setText(MODE_BLURBS[this.mode]);
  }

  private destroyModeRow(): void {
    this.modeLabel?.destroy();
    this.modeLabel = undefined;
    this.modeButtons.forEach((button) => button.destroy());
    this.modeButtons.clear();
    this.modeBlurb?.destroy();
    this.modeBlurb = undefined;
  }

  /** Rooms are created and matched by mode, so a lobby already in a room leaves it and matches again in the new mode. */
  private onModeClicked(mode: GameMode): void {
    if (this.startInFlight || this.startSent || this.gameStarted || mode === this.mode) return;
    this.mode = mode;
    modeStore.save(mode);
    this.refreshModeRow();
    if (!this.sessionConnected) {
      this.leaderboardPanel?.setMode(mode);
      return;
    }
    this.commitName();
    socketManager.close();
    this.scene.restart();
  }

  /** The framed lobby panel: title, divider, Mode row and Start button; the Name row is added for guests. */
  private createLobbyPanel(): void {
    this.destroyLobbyPanel();
    const p = LOBBY_PANEL;
    const layout = computeLobbyPanelLayout(this.guest);
    this.lobbyPanel = new FramedPanel(this, p.x, p.y, p.width, p.height, p.scrimAlpha);
    this.lobbyPanel.addDivider(layout.contentX, layout.dividerY, layout.contentWidth);
    this.lobbyTitle = this.add.text(p.x + p.width / 2, layout.titleY + TITLE_HEIGHT / 2, 'Snake Game', {
      fontFamily: FONT_FAMILY, fontSize: '32px', color: '#ffffff',
    }).setOrigin(0.5).setShadow(4, 4, '#008000', 0, false, true);
    if (layout.nameRowY !== undefined) this.createNameField(layout.nameRowY);
    if (this.ranked) {
      this.createSearching(layout.modeRowY, layout.startY);
      return;
    }
    this.createModeRow(layout.modeRowY);
    this.startButton = new PixelButton(this, {
      x: p.x + (p.width - START_BUTTON.width) / 2,
      y: layout.startY,
      width: START_BUTTON.width,
      height: START_BUTTON.height,
      label: 'Start',
      size: 'large',
      fill: 'action',
      fontSize: 28,
      onClick: () => this.onStartClicked(),
    });
    this.createEntryButtons();
  }

  /** Ranked and "Play vs Computer" entry points side by side below the lobby panel; a Guest's Ranked is disabled with a note. */
  private createEntryButtons(): void {
    if (this.vsBotButton) return;
    const p = LOBBY_PANEL;
    const rankedWidth = 200;
    const botWidth = 260;
    const gap = 16;
    const y = p.y + p.height + 4;
    const left = p.x + (p.width - (rankedWidth + gap + botWidth)) / 2;
    this.rankedButton = new PixelButton(this, {
      x: left,
      y,
      width: rankedWidth,
      height: 34,
      label: 'Ranked',
      fontSize: 18,
      disabled: this.guest,
      onClick: () => this.onRankedClicked(),
    });
    if (this.guest) {
      this.rankedNote = this.add.text(left + rankedWidth / 2, y + 40, 'Create an account to play Ranked', {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: '#cccccc',
      }).setOrigin(0.5, 0);
    }
    this.vsBotButton = new PixelButton(this, {
      x: left + rankedWidth + gap,
      y,
      width: botWidth,
      height: 34,
      label: 'Play vs Computer',
      fontSize: 18,
      onClick: () => this.openRosterPicker(),
    });
  }

  /** The Ranked queue's wait, in place of the Mode row and Start: how long it has lasted, and a way out. */
  private createSearching(textY: number, buttonY: number): void {
    const p = LOBBY_PANEL;
    this.searchStartedAt = this.time.now;
    this.searchText = this.add.text(p.x + p.width / 2, textY + MODE_ROW.buttonHeight / 2, searchingText(0), {
      fontFamily: FONT_FAMILY, fontSize: '24px', color: '#ffffff',
    }).setOrigin(0.5);
    this.cancelButton = new PixelButton(this, {
      x: p.x + (p.width - START_BUTTON.width) / 2,
      y: buttonY,
      width: START_BUTTON.width,
      height: START_BUTTON.height,
      label: 'Cancel',
      size: 'large',
      fill: 'button-alt',
      fontSize: 28,
      onClick: () => this.onRankedCancelled(),
    });
  }

  /** Ranked joins the `ranked` room, so the casual room is left and the scene restarts into the queue. */
  private onRankedClicked(): void {
    if (this.guest || this.startInFlight || this.rosterPicker) return;
    this.socketLeaveForRestart();
    this.scene.restart({ ranked: true });
  }

  /** Cancel leaves the Ranked queue and returns to the casual lobby. */
  private onRankedCancelled(): void {
    this.socketLeaveForRestart();
    this.scene.restart({ ranked: false });
  }

  private socketLeaveForRestart(): void {
    this.destroyLobbyAmbience();
    socketManager.close();
  }

  /** The Ranked room refused the token (it expires after an hour): drop the session and ask for a log-in. */
  onRankedRefused(): void {
    if (!this.sys.isActive()) return;
    localStorage.removeItem('userData');
    this.promptLogin = true;
    this.socketLeaveForRestart();
    this.scene.restart({ ranked: false });
  }

  /** The Rating change for the Ranked match; shown on the Game Over panel now or when it's built. */
  onRatingUpdate(update: RatingUpdate): void {
    this.ratingUpdate = update;
    this.refreshRatingTexts();
  }

  private refreshRatingTexts(): void {
    const lines = ratingLines(this.ratingUpdate, this.playerId);
    this.ratingTexts.forEach((t, i) => t.setText(lines[i] ?? ''));
  }

  /** "Play vs Computer" opens the roster picker; the Name row's DOM input would paint over it, so it's hidden meanwhile. */
  private openRosterPicker(): void {
    if (this.startInFlight || this.rosterPicker) return;
    this.setNameRowVisible(false);
    this.rosterPicker = new RosterPicker(this, {
      roster: loadRoster(),
      records: loadBotRecords(),
      mode: this.mode,
      chosenId: this.botId,
      onChoose: (entry) => this.onBotChosen(entry),
      onClose: () => this.closeRosterPicker(),
    });
  }

  private closeRosterPicker(): void {
    this.rosterPicker?.destroy();
    this.rosterPicker = undefined;
    this.setNameRowVisible(true);
  }

  private onBotChosen(entry: RosterEntry): void {
    this.closeRosterPicker();
    this.botId = entry.id;
    botChoiceStore.save(entry.id);
    this.enterVsBotRoom();
  }

  private onStartClicked(): void {
    console.log("[GameScene] Start button clicked");
    if (this.startInFlight) return;
    if (this.sessionConnected) {
      this.commitName();
      this.startSent = true;
      socketManager.send({ event: 'startGame' });
      return;
    }
    void this.startAsNewGuest(true);
  }

  /** A snake was picked: leave any public room and create a fresh vs-bot one against it, staying in the lobby to press Start. */
  private enterVsBotRoom(): void {
    if (this.startInFlight) return;
    this.vsBot = true;
    this.ranked = false;
    if (this.sessionConnected) {
      this.commitName();
      socketManager.close();
      this.scene.restart({ vsBot: true });
      return;
    }
    void this.startAsNewGuest(false);
  }

  /** First Start for a visitor with no stored session: mint the guest token now, then connect and begin. */
  private async startAsNewGuest(startGame: boolean): Promise<void> {
    this.startInFlight = true;
    this.startError?.destroy();
    this.startError = undefined;
    if (startGame) this.startButton?.setLabel('Starting...');
    let connected = false;
    try {
      const user = await createGuestSession(this.sessionDeps());
      if (!this.sys.isActive()) return;
      if (!user) {
        this.failStart(true);
        return;
      }
      // The name is committed before connecting so the room is joined under the name chosen in the lobby.
      this.commitName();
      this.playerId = String(user.userId);
      this.sessionConnected = true;
      await socketManager.connect(this.playerId, String(user.token), this);
      connected = true;
      if (!this.sys.isActive()) return;
      socketManager.startPingMeasurement(this);
      if (startGame) socketManager.send({ event: 'startGame' });
    } catch (err) {
      console.error('[GameScene] Start failed', err);
      if (this.sys.isActive()) {
        this.sessionConnected = false;
        this.failStart(!connected);
      }
    } finally {
      this.startInFlight = false;
    }
  }

  private failStart(roomMissing: boolean): void {
    this.startButton?.setLabel('Start');
    if (this.vsBot && roomMissing) {
      // The bot room was never created: drop back to the public lobby; the vs-computer button is always shown.
      this.vsBot = false;
    }
    this.showStartError();
  }

  private showStartError(): void {
    const p = LOBBY_PANEL;
    this.startError = this.add.text(p.x + p.width / 2, p.y + p.height + 16, "Can't reach the server \u2014 press Start to try again", {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: '#ff6666',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setDepth(BACKGROUND_DIM_DEPTH + 1);
  }

  private destroyLobbyPanel(): void {
    this.lobbyPanel?.destroy();
    this.lobbyPanel = undefined;
    this.lobbyTitle?.destroy();
    this.lobbyTitle = undefined;
    this.startButton?.destroy();
    this.startButton = undefined;
    this.vsBotButton?.destroy();
    this.vsBotButton = undefined;
    this.rankedButton?.destroy();
    this.rankedButton = undefined;
    this.rankedNote?.destroy();
    this.rankedNote = undefined;
    this.searchText?.destroy();
    this.searchText = undefined;
    this.cancelButton?.destroy();
    this.cancelButton = undefined;
    this.rosterPicker?.destroy();
    this.rosterPicker = undefined;
    this.startError?.destroy();
    this.startError = undefined;
    this.destroyNameField();
    this.destroyModeRow();
  }

  // Sync this.name and the visible name texts from the field's current value.
  private applyNameField(): void {
    if (!this.nameField) return;
    this.name = normaliseName(this.nameField.text);
  }

  // Persist and send the chosen guest name; called once when the game starts.
  private commitName(): void {
    if (!this.guest || !this.nameField) return;
    this.name = nameStore.save(this.nameField.text);
    socketManager.send({ event: 'updatePlayer', name: this.name });
  }

  private setNameRowVisible(visible: boolean): void {
    this.nameField?.setVisible(visible);
    this.nameLabel?.setVisible(visible);
    this.nameFieldFrame?.setVisible(visible);
  }

  private destroyNameField(): void {
    this.nameField?.destroy();
    this.nameField = undefined;
    this.nameLabel?.destroy();
    this.nameLabel = undefined;
    this.nameFieldFrame?.destroy();
    this.nameFieldFrame = undefined;
  }

  private createColourPanel(): void {
    const layout = computeLobbyPanelLayout(this.guest);
    const selection = createColourSelection(this.snakeColors);
    // Share the selection's colours object so the socket and saves always see the committed colours.
    this.snakeColors = selection.colours;
    this.colourSelection = selection;
    this.colourPanel = new ColourPanel(this, layout.contentX, layout.colourSpaceY, selection, () => {
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
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      const key = String(file.key);
      if ((FOOD_TYPES as readonly string[]).includes(key)) {
        console.warn(`[assets] failed to load food texture '${key}' from theme '${feature.assetTheme}' (${file.url})`);
      }
      if (key === BACKGROUND_TEXTURE) {
        console.warn(`[assets] failed to load the background tile of theme '${feature.assetTheme}' (${file.url})`);
      }
    });
    for (const type of FOOD_TYPES) {
      this.load.image(type, foodTexturePath(feature.assetTheme, type));
    }
    this.load.image(BACKGROUND_TEXTURE, backgroundTexturePath(feature.assetTheme));
  }

  create() {

    // One image over the whole canvas, header included: the header strip is translucent black,
    // so it reads as a darkened band of the background rather than a gap above it.
    this.bg = this.add.image(0, 0, BACKGROUND_TEXTURE)
      .setOrigin(0, 0)
      .setDisplaySize(this.scale.width, this.scale.height)
      .setDepth(BACKGROUND_DEPTH);

    // A detailed background competes with the food and snake drawn on it, so it is pushed back
    // behind its own scrim rather than being redrawn: only what is under this depth is dimmed.
    this.bgDim = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, feature.backgroundDim)
      .setOrigin(0, 0)
      .setDepth(BACKGROUND_DIM_DEPTH);

    this.add.rectangle(0, 0, this.scale.width, HEADER.height, 0x000000, 0.6).setOrigin(0);
    this.add.rectangle(0, HEADER.height, this.scale.width, HEADER.ruleHeight, 0x000000, 1).setOrigin(0);

    this.scoreText = this.add.text(HEADER.paddingX, 10, 'Score: 0', {
      fontSize: '20px',
      color: '#ffffff',
    }).setScrollFactor(0);

    this.pingText = this.add.text(200, 10, formatPingReadout(undefined), {
      fontSize: '20px',
      color: '#cccccc',
    }).setScrollFactor(0);
    this.pingBars = this.add.graphics().setScrollFactor(0);
    this.setPing(undefined);

    this.fpsText = undefined;
    this.fpsMeter = createFpsMeter();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroyFpsText();
      this.destroyLobbyAmbience();
      this.resetCountdown();
      this.destroyTimeLeftText();
      this.destroyHungerBar();
    });

    this.scoreboard?.destroy();
    this.scoreboard = new ScoreboardPanel(this);

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

    // First frame is the background and ambient snakes; everything that needs the player waits for the session.
    if (feature.lobbyAmbience) this.lobbyAmbience = new LobbyAmbience(this, () => this.snakeColors);

    // Generate or retrieve client ID on first app load
    ClientIdManager.getOrCreateClientId();

    this.bootSession();
  }

  private sessionDeps(): SessionDeps {
    return { fetch: window.fetch.bind(window), storage: localStorageOrNothing() };
  }

  private bootSession(): void {
    this.destroyLobbyUi();
    // Only the latest attempt may build; an older in-flight one (retry button vs timer) is dropped.
    const attempt = ++this.sessionAttempt;
    const deps = this.sessionDeps();
    restoreSession(deps)
      .then((user) => {
        if (!this.sys.isActive() || attempt !== this.sessionAttempt) return;
        this.buildLobby(user);
      });
  }

  /** Tears down everything buildLobby creates, so a rebuild never stacks on a previous partial state. */
  private destroyLobbyUi(): void {
    this.headerButton?.destroy();
    this.headerButton = undefined;
    this.destroyLobbyPanel();
    this.destroyColourPanel();
    this.destroyLeaderboardPanel();
  }

  /** Builds the lobby. Without a restored session the visitor is a guest browsing locally: no token, no connection until Start. */
  private buildLobby(session?: StoredUser): void {
    this.destroyLobbyUi();
    const userData: StoredUser = session ?? {};
    this.sessionConnected = session !== undefined;
    this.startInFlight = false;
    this.startSent = false;

    this.guest = session ? isGuest(userData) : true;
    // Ranked is for Accounts; a scene restarted as a Guest (logout) comes back to the casual lobby.
    if (this.guest) this.ranked = false;
    // Guests play under the name they picked last time; logged-in players keep their account username.
    this.name = session ? sessionName(userData, nameStore) : nameStore.load();
    this.playerId = session ? String(userData.userId) : '';

    // Guests get Login (opens the auth overlay on the login form); accounts get Logout.
    this.headerButton = new PixelButton(this, {
      ...headerButtonPosition(this.scale.width),
      width: HEADER_BUTTON.width,
      height: HEADER_BUTTON.height,
      label: this.guest ? 'Login' : 'Logout',
      labelColor: this.guest ? '#ffffff' : '#ff4444',
      onClick: () => {
        if (this.guest) {
          this.openLogIn();
        } else {
          this.logout();
        }
      },
    });

    this.createLobbyPanel();

    if (this.guest) {
      this.snakeColors = appearanceStore.load();
      this.createColourPanel();
    } else {
      // The panel is only built once the account's colours (or the random fallback) have arrived, so nothing
      // flashes or can be picked before the load, and the selection starts from the loaded colours.
      this.accountAppearance = createAccountAppearanceStore({
        fetch: (input, init) => fetch(input, init),
        token: userData.token ?? '',
        anonymous: () => appearanceStore.peek(),
      });
      this.accountAppearance.load().then((colours) => {
        if (!this.sys.isActive()) return;
        // Colours are applied even if the lobby was already left, so the game still uses them.
        Object.assign(this.snakeColors, colours);
        if (this.lobbyPanel && !this.colourPanel) this.createColourPanel();
        this.sendColorUpdate();
      });
    }
    this.createLeaderboardPanel();

    if (this.promptLogin) {
      this.promptLogin = false;
      this.openLogIn('Your session expired \u2014 log in again');
    }

    if (!session) return;

    // connect to websockets
    socketManager.connect(String(userData.userId), String(userData.token), this);

    // Start ping measurement after connection
    socketManager.startPingMeasurement(this);
  }

  /** Open the auth overlay on the login form; on success restart so the room is rejoined as the account. */
  private openLogIn(subtitle?: string) {
    // The Name row's DOM input paints above the canvas whatever the Phaser depth, so hide it under the modal.
    this.setNameRowVisible(false);
    const authConfig: AuthModalConfig = {
      initialForm: 'login',
      subtitle,
      onAuthSuccess: () => this.restartAsAccount(),
      onDismiss: () => this.setNameRowVisible(true),
    };
    authModalManager.open(this, authConfig);
  }

  /** Open the auth overlay on Create Account from the Game Over panel; Back leaves the panel as it was. */
  private openSaveScore() {
    this.setGameOverPanelVisible(false);
    authModalManager.open(this, {
      initialForm: 'register',
      title: 'SAVE YOUR SCORE',
      subtitle: 'Create an account to keep your scores',
      onAuthSuccess: () => this.restartAsAccount(),
      onDismiss: () => this.setGameOverPanelVisible(true),
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

        if (!response.ok) {
          console.error('Failed to log out:', response.statusText);
          return;
        }
      } catch (error) {
        console.error('Error during logout:', error);
        return;
      }
    }

    // Clears the session; the restarted scene comes up as a fresh guest.
    localStorage.removeItem('userData');
    this.scene.start('GameScene');
  }

  private createLeaderboardPanel(): void {
    this.destroyLeaderboardPanel();
    this.leaderboardPanel = new LeaderboardPanel(this, {
      fetchGlobal: getLeaderboard,
      loadMine: (mode) => LocalScoresManager.getTopScores(mode, 5),
    }, this.mode);
  }

  private destroyLeaderboardPanel(): void {
    this.leaderboardPanel?.destroy();
    this.leaderboardPanel = undefined;
  }

  startGame() {
    console.log("[GameScene] Requesting game start");
    this.commitName();
    socketManager.send({ event: 'startGame' });
  }

  /** Called on every room state patch: drives the 3-2-1-GO overlay from the server's phase and countdown value. */
  onPhaseState(phase: Phase, countdown: number) {
    const label = countdownLabel(this.lastPhase, phase, countdown);
    this.lastPhase = phase;
    if (label === null) {
      if (phase !== 'playing' || !this.goTimer) this.clearCountdownOverlay();
      return;
    }
    this.goTimer?.remove();
    this.goTimer = undefined;
    if (!this.countdownText) {
      const arenaTop = HEADER_BOTTOM;
      this.countdownText = this.add.text(this.scale.width / 2, arenaTop + (this.scale.height - arenaTop) / 2, '', {
        fontFamily: FONT_FAMILY, fontSize: '160px', color: '#ffffff', stroke: '#000000', strokeThickness: 10,
      }).setOrigin(0.5).setDepth(20);
    }
    this.countdownText.setText(label);
    if (label === 'GO!') this.goTimer = this.time.delayedCall(700, () => this.clearCountdownOverlay());
  }

  /** Single place to drop all countdown state (overlay and phase-transition memory) for a fresh scene or shutdown. */
  private resetCountdown() {
    this.clearCountdownOverlay();
    this.lastPhase = undefined;
  }

  private clearCountdownOverlay() {
    this.goTimer?.remove();
    this.goTimer = undefined;
    this.countdownText?.destroy();
    this.countdownText = undefined;
  }

  onGameStarted() {
    console.log("[GameScene] Game started callback");
    this.gameStarted = true;

    // Remove the lobby panel (title, divider, Name row, Start button)
    this.destroyLobbyPanel();

    this.destroyLobbyAmbience();

    // Remove color customization swatches
    this.destroyColourPanel();

    // Remove the leaderboard panel; a fetch still in flight then draws nothing
    this.destroyLeaderboardPanel();

    // Remove game-over overlay, if a new round is starting from it
    this.clearGameOverOverlay();

    // Initialize game state
    this.isGameOver = false;
    this.ratingUpdate = undefined;
    this.roundMode = modeOf(socketManager.getRoom()?.state.mode ?? this.mode);
  }

  onGameOver(payload: GameOverPayload) {
    console.log("[GameScene] Game over callback", payload);
    this.isGameOver = true;
    this.clearGameOverOverlay();
    const roundMode = this.roundMode ?? modeOf(socketManager.getRoom()?.state.mode ?? this.mode);

    // Saved alongside, not before, the end screen: a slow or failed post never holds it up.
    void saveRoundScore(payload, socketManager.getRoom()?.sessionId, this.guest, roundMode, {
      postUserScore,
      postAnonymousScore: async (score, mode) => {
        const result = await postAnonymousScore(ClientIdManager.getOrCreateClientId(), score, mode);
        if (!result.success) console.warn('[GameScene] Failed to submit score to server:', result.message);
      },
      saveLocalScore: (score, mode) => LocalScoresManager.saveScore(score, mode),
    });

    this.displayGameOverScreen(payload, roundMode);
  }

  /** `mode` is the round's, and picks the top scores shown. */
  private async displayGameOverScreen(payload: GameOverPayload, mode: GameMode) {
    const topScores: HighScore[] = (await getHighScores(mode)).slice(0, 3);
    const rankings = payload?.rankings ?? [];
    const sessionId = socketManager.getRoom()?.sessionId;

    const players = socketManager.getRoom()?.state.players;
    const snakes = rankings.map((entry) => ({
      ...entry,
      isBot: !!players?.find((p) => p.id === entry.id)?.isBot,
    }));

    const { centerX, panelWidth, contentWidth } = computeGameOverLayout(this.scale.width);
    const DEPTH = 20;

    // Made first: it wraps on a narrow panel, and its height places everything under it.
    const headline = this.add
      .text(centerX, 0, roundHeadline(payload.reason, payload.winnerId, snakes, sessionId), {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: contentWidth },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH);

    const c = computeGameOverContentLayout(rankings.length, topScores.length, this.guest, headline.height, this.ranked ? RATING_LINE_COUNT : 0);
    const panelX = centerX - panelWidth / 2;
    const panelY = Math.max(0, (this.scale.height - c.panelHeight) / 2);
    const contentX = panelX + c.padding;
    headline.setY(panelY + c.headlineY);

    const frame = new FramedPanel(this, panelX, panelY, panelWidth, c.panelHeight, 0.8);
    frame.addDivider(contentX, panelY + c.dividerY, contentWidth);
    frame.setDepth(DEPTH);
    this.gameOverObjects.push(frame);

    const addText = (x: number, y: number, text: string, fontSize: number, color: string, originX = 0.5) => {
      const t = this.add
        .text(x, y, text, { fontFamily: FONT_FAMILY, fontSize: `${fontSize}px`, color })
        .setOrigin(originX, 0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH);
      this.gameOverObjects.push(t);
      return t;
    };

    // Hard 4px/4px shadow behind the title
    addText(centerX + 4, panelY + c.titleY + 20 + 4, 'GAME OVER', 32, '#ff4444').setAlpha(0.35);
    addText(centerX, panelY + c.titleY + 20, 'GAME OVER', 32, '#ff4444');
    // Pushed after the frame so it draws above it at the same depth.
    this.gameOverObjects.push(headline);
    this.children.bringToTop(headline);

    // Where a row's name, and a ranking row's cause under it, start: right of the `#1` rank.
    const NAME_X = 56;
    const addRow = (index: number, name: string, score: number, y: number, color: string) => {
      addText(contentX, y, `#${index + 1}`, 20, color, 0);
      addText(contentX + NAME_X, y, name, 20, color, 0);
      addText(contentX + contentWidth, y, String(score), 20, color, 1);
    };

    snakes.forEach((snake, i) => {
      const rowY = panelY + c.roomRowsY + i * GAME_OVER_RANKING_ROW.height;
      addRow(i, rankingName(snake.name, snake.isBot), snake.score, rowY + GAME_OVER_RANKING_ROW.nameY, snake.id === sessionId ? '#ffff00' : '#ffffff');
      const cause = addText(contentX + NAME_X, rowY + GAME_OVER_RANKING_ROW.causeY, deathText(snake, snakes, sessionId), 14, '#aaaaaa', 0);
      // A long name can outrun a narrow panel; shrink the line rather than clip it.
      cause.setScale(Math.min(1, (contentWidth - NAME_X) / Math.max(1, cause.width)));
    });

    if (this.ranked) {
      this.ratingTexts = Array.from({ length: RATING_LINE_COUNT }, (_, i) =>
        addText(centerX, panelY + c.ratingY + GAME_OVER_RATING_LINE_HEIGHT * (i + 0.5) + 8, '', 20, i === 0 ? '#ffff00' : '#aaaaaa'));
      this.refreshRatingTexts();
    }

    addText(centerX, panelY + c.subheadingY + 16, `Top scores — ${MODE_LABELS[mode]}`, 22, '#ff4444');

    if (topScores.length > 0) {
      topScores.forEach((hs, i) => {
        addRow(i, hs.username, hs.score, panelY + c.topRowsY + i * GAME_OVER_ROW_HEIGHT + GAME_OVER_ROW_HEIGHT / 2, '#ffffff');
      });
    } else {
      addText(centerX, panelY + c.topRowsY + GAME_OVER_ROW_HEIGHT / 2, 'No high scores yet', 18, '#aaaaaa');
    }

    const b = GAME_OVER_BUTTON;
    const buttonX = centerX - b.width / 2;
    const playAgain = new PixelButton(this, {
      x: buttonX,
      y: panelY + c.playAgainY,
      width: b.width,
      height: b.height,
      label: 'Play Again',
      size: 'large',
      fill: 'action',
      fontSize: 24,
      onClick: () => {
        // Rounds never restart in place: leave the room and rejoin a fresh lobby so no stale round state survives.
        this.destroyLobbyAmbience();
        socketManager.close();
        // A Ranked match is never re-queued without a click: Play Again lands in the casual lobby.
        this.scene.restart({ vsBot: this.vsBot, ranked: false });
      },
    }).setDepth(DEPTH);
    this.gameOverObjects.push(playAgain);

    if (c.saveScoreY !== undefined) {
      const saveScore = new PixelButton(this, {
        x: buttonX,
        y: panelY + c.saveScoreY,
        width: b.width,
        height: b.height,
        label: 'Save Score',
        size: 'large',
        fill: 'button-alt',
        fontSize: 24,
        onClick: () => this.openSaveScore(),
      }).setDepth(DEPTH);
      this.gameOverObjects.push(saveScore);
    }
  }

  /** Hidden objects receive no pointer input, so the panel is inert while hidden. */
  private setGameOverPanelVisible(visible: boolean) {
    this.gameOverObjects.forEach((obj) => obj.setVisible(visible));
  }

  private clearGameOverOverlay() {
    this.gameOverObjects.forEach((obj) => obj.destroy());
    this.gameOverObjects = [];
  }

  private setScoreboardVisible(visible: boolean) {
    this.scoreboardVisible = visible;
    this.scoreboard?.setVisible(visible);
  }

  private clearScoreboard() {
    this.scoreboard?.destroy();
    this.scoreboard = undefined;
  }

  /** Called on every room state patch: the header's time left in a timed round, right-aligned beside the header button. Null hides it. */
  setTimeLeft(timeLeft: HudTimeLeft | null) {
    if (timeLeft === null) {
      this.destroyTimeLeftText();
      return;
    }
    if (!this.timeLeftText) {
      const { x } = headerButtonPosition(this.scale.width);
      this.timeLeftText = this.add.text(x - HEADER_ITEM_GAP, HEADER.height / 2, '', {
        fontFamily: FONT_FAMILY, fontSize: '28px', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(10);
    }
    this.timeLeftText.setText(timeLeft.label).setColor(timeLeft.urgent ? '#ff4444' : '#ffffff');
  }

  private destroyTimeLeftText() {
    this.timeLeftText?.destroy();
    this.timeLeftText = undefined;
  }

  /** Called on every room state patch: your snake's hunger bar while it starves, from 1 (full) to 0. Null hides it. */
  setHungerFill(fill: number | null) {
    if (fill === null) {
      this.destroyHungerBar();
      return;
    }
    const right = headerButtonPosition(this.scale.width).x - HEADER_ITEM_GAP;
    const left = right - HUNGER_BAR.width;
    const top = (HEADER.height - HUNGER_BAR.height) / 2;
    if (!this.hungerBar) {
      this.hungerBar = this.add.graphics().setScrollFactor(0).setDepth(10);
      this.hungerLabel = this.add.text(left - HUNGER_BAR.labelGap, HEADER.height / 2, 'Starving', {
        fontFamily: FONT_FAMILY, fontSize: '20px', color: '#ff4444', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(10);
    }
    const g = this.hungerBar;
    g.clear();
    g.fillStyle(HUNGER_BAR.emptyColour, 1);
    g.fillRect(left, top, HUNGER_BAR.width, HUNGER_BAR.height);
    g.fillStyle(HUNGER_BAR.fillColour, 1);
    g.fillRect(left, top, Math.round(HUNGER_BAR.width * fill), HUNGER_BAR.height);
    g.lineStyle(2, 0x000000, 1);
    g.strokeRect(left, top, HUNGER_BAR.width, HUNGER_BAR.height);
  }

  private destroyHungerBar() {
    this.hungerBar?.destroy();
    this.hungerBar = undefined;
    this.hungerLabel?.destroy();
    this.hungerLabel = undefined;
  }

  // Update the header ping readout and signal meter; undefined means no ping yet.
  setPing(pingMs: number | undefined) {
    this.pingText.setText(formatPingReadout(pingMs));
    const g = this.pingBars;
    if (!g) return;
    const lit = litBars(pingMs);
    const left = this.pingText.x + this.pingText.width + 8;
    const bottom = HEADER.height - 10;
    g.clear();
    for (let i = 0; i < BAR_COUNT; i++) {
      const h = HEADER.barHeightStep * (i + 1);
      const x = left + i * (HEADER.barWidth + HEADER.barGap);
      g.fillStyle(i < lit ? HEADER.litColour : HEADER.unlitColour, 1);
      g.fillRect(x, bottom - h, HEADER.barWidth, h);
      g.lineStyle(1, 0x000000, 1);
      g.strokeRect(x, bottom - h, HEADER.barWidth, h);
    }
  }

  /** Connection dropped: restart into a fresh lobby (no leftover snakes, food or overlays); create() rejoins a new room. */
  onConnectionLost() {
    this.destroyLobbyAmbience();
    this.scene.restart({ vsBot: this.vsBot, ranked: false });
  }

  onReconnecting() {
    this.reconnectText?.destroy();
    this.reconnectText = this.add.text(HEADER.paddingX, HEADER_BOTTOM + 4, 'Reconnecting...', {
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
    this.reconnectText = this.add.text(HEADER.paddingX, HEADER_BOTTOM + 4, 'Connection lost. Please refresh the page.', {
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
      this.fpsText = this.add.text(HEADER.paddingX, HEADER_BOTTOM + 34, 'FPS: --', {
        fontSize: '20px',
        color: '#ffffff',
      }).setScrollFactor(0).setDepth(10);
    }
    if (report) this.fpsText.setText(formatFpsReadout(report));
  }

  update(_time: number, delta: number): void {
    this.updateFps(delta);
    this.searchText?.setText(searchingText(this.time.now - this.searchStartedAt));
    // Re-read every frame so `feature.backgroundDim = x` in the console lands without a reload.
    if (this.bgDim && this.bgDim.alpha !== feature.backgroundDim) this.bgDim.setAlpha(feature.backgroundDim);
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

  init(data?: { vsBot?: boolean; ranked?: boolean }) {
    // The scene instance survives restarts, so a restart without data keeps the current mode instead of dropping to the public lobby.
    if (data?.vsBot !== undefined) this.vsBot = data.vsBot;
    this.ranked = data?.ranked ?? false;
    this.ratingUpdate = undefined;
    this.ratingTexts = [];
    // Initialize properties here
    this.snakes = new Map();
    this.food = [];
    this.gameStarted = false;
    this.isGameOver = false;
    this.gameConfigured = false;
    this.gameOverObjects = [];
    this.scoreboardVisible = false;
    this.countdownText = undefined;
    this.goTimer = undefined;
    this.lastPhase = undefined;
  }

  shutdown() {
    // Clean up our custom resources
    socketManager.stopPingMeasurement();

    // Clear game objects
    this.clearSnakesAndFood();
    this.clearGameOverOverlay();
    this.clearScoreboard();
    this.destroyLeaderboardPanel();
    authModalManager.close();

    // Remove keyboard listeners
    this.input.keyboard?.removeAllListeners();

    // Remove any remaining text objects
    this.scoreText?.destroy();
    this.pingText?.destroy();
    this.destroyFpsText();
    this.resetCountdown();
    this.pingBars?.destroy();
    this.pingBars = undefined;
    this.destroyTimeLeftText();
    this.destroyHungerBar();
    this.headerButton?.destroy();
    this.headerButton = undefined;
    this.destroyLobbyPanel();
    this.destroyColourPanel();
    this.destroyLobbyAmbience();
    this.reconnectText?.destroy();
    this.reconnectText = null;
  }
}
