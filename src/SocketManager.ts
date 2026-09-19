import { Client, Room } from "colyseus.js";
import { Snake } from "./Snake";
import { GameScene } from "./scenes/GameScene";
import { Food } from "./Food";
import { GameState, tailCells } from "./schemas/Food";
import { drawBackground } from "./utils";
import { scoreboardRows } from "./utils/scoreboardLayout";

class SocketManager {
  private client: Client | null = null;
  private room: Room<GameState> | null = null;
  private pingInterval: number | null = null;
  private lastPingTime: number = 0;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 10;
  private readonly reconnectDelayMs: number = 3000;
  private reconnectTimeoutHandle: number | null = null;
  private intentionalClose: boolean = false;
  private lastConnectArgs: { playerId: string; token: string; scene: GameScene } | null = null;

  // Match the message types with the server
  static messageTypes = {
    MOVE: "move",
    START_GAME: "startGame",
    GAME_STARTED: "gameStarted",
    NEW_PLAYER: "newPlayer",
    GAME_OVER: "gameOver",
    UPDATE_PLAYER: "updatePlayer",
    PING: "ping",
    PONG: "pong"
  };

  async connect(playerId: string, token: string, scene: GameScene) {
    this.lastConnectArgs = { playerId, token, scene };
    this.intentionalClose = false;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      this.client = new Client(`${protocol}//${host}/colyseus`);
      this.room = await this.client.joinOrCreate<GameState>("snake", {
        playerId,
        token,
        name: scene.name,
        colours: scene.snakeColors
      });

      console.log("[SocketManager] Connected to room:", this.room.roomId);

      const wasReconnecting = this.reconnectAttempts > 0;
      this.reconnectAttempts = 0;
      if (wasReconnecting) {
        scene.onReconnected?.();
      }

      this.room.onLeave((code) => this.handleLeave(code));

      // Set up all message handlers during connection
      this.room.onMessage(SocketManager.messageTypes.GAME_STARTED, () => {
        console.log("[SocketManager] Received gameStarted event");
        scene.gameStarted = true;

        // Trigger any additional game start logic in the scene
        if (typeof scene.onGameStarted === 'function') {
          scene.onGameStarted();
        }
      });

      this.room.onMessage(SocketManager.messageTypes.GAME_OVER, (payload) => {
        console.log("[SocketManager] Received gameOver event", payload);
        scene.isGameOver = true;

        if (typeof scene.onGameOver === 'function') {
          scene.onGameOver(payload);
        }
      });

      this.room.onMessage(SocketManager.messageTypes.PONG, () => {
        const latency = Date.now() - this.lastPingTime;
        scene.setPing?.(latency);
      });

      // Handle state changes for snake positions and food
      this.room.onStateChange((state) => {
        if (state.backgroundNumber && scene.bg.texture.key !== String(state.backgroundNumber)) {
          drawBackground(scene, String(state.backgroundNumber));
        }

        if (state.phase === "countdown" || state.phase === "playing") {
          if (!scene.gameStarted || scene.food.length === 0) {
            // Game just started, or a new round began: discard any leftover
            // snake/food graphics from the previous round before rebuilding
            // from this (authoritative) snapshot, so stale tails/positions
            // from a mid-transition state broadcast can't linger on screen.
            scene.snakes.forEach((snake) => snake.destroy());
            scene.snakes.clear();

            scene.gameStarted = true;
            scene.food.forEach((f) => f.destroy());
            scene.food.length = 0;
            state.foodCoordinates.forEach(food => {
              const newFood = new Food(scene, { x: food.x, y: food.y }, food.index, food.type);
              scene.food.push(newFood);
            });
            if (typeof scene.onGameStarted === 'function') {
              scene.onGameStarted();
            }
          }
          else {
            state.foodCoordinates.forEach(food => {
              const localFood = scene.food.find(f => f.id === food.index);
              if (localFood &&
                (localFood.type !== food.type ||
                  localFood.position.x !== food.x * localFood['cellSize'] ||
                  localFood.position.y !== 40 + food.y * localFood['cellSize'])) {
                localFood.updateFood({ x: food.x, y: food.y }, food.type);
              }
            });
          }
        }

        // Drop snakes for players no longer present in the room state
        // (e.g. disconnected mid-round) so their last frame doesn't freeze
        // on screen forever.
        const activePlayerIds = new Set<string>();
        state.players.forEach((player) => activePlayerIds.add(player.id));
        scene.snakes.forEach((snake, id) => {
          if (!activePlayerIds.has(id)) {
            snake.destroy();
            scene.snakes.delete(id);
          }
        });

        this.updateScoreboard(scene, state);

        scene.onPhaseState?.(state.phase, state.countdown);

        state.players.forEach((player) => {
          if (player.snake) {
            const currentSnake = scene.snakes.get(player.id);
            if (currentSnake) {
              // Update existing snake
              if (player.id === this.room?.sessionId) {
                scene.scoreText.setText(`Score: ${player.snake.score}`);
              }

              if (!currentSnake.isDead) {
                currentSnake.food = player.snake.score;
                currentSnake.moveTo({ x: player.snake.x, y: player.snake.y }, tailCells(player.snake));

                // The patch that ends the round (it lands after the gameOver
                // message): show where the survivor finished rather than
                // sliding on under the game-over screen.
                if (state.phase !== "playing") {
                  currentSnake.snap();
                }

                if (player.snake.isDead) {
                  currentSnake.stop(player.id, player.snake.score, false);
                }
              }
            } else {

              const newSnake = new Snake(
                scene,
                player.snake.x,
                player.snake.y,
                player.colours,
                player.snake.size
              );
              scene.snakes.set(player.id, newSnake);
            }
          }
        });
      });

      this.startPingMeasurement(scene);

    } catch (error) {
      console.error("[SocketManager] Could not connect to server:", error);
      this.scheduleReconnect();
    }
  }

  private updateScoreboard(scene: GameScene, state: GameState) {
    const players = Array.from(state.players.values())
      .filter((p) => p.snake)
      .map((p) => ({
        id: p.id,
        name: p.name,
        score: p.snake?.score ?? 0,
        isDead: !!p.snake?.isDead,
        headColour: p.colours.head,
      }));
    scene.scoreboard?.setRows(scoreboardRows(players, this.room?.sessionId));
  }

  private handleLeave(code: number) {
    if (this.intentionalClose) {
      return;
    }

    console.warn("[SocketManager] Room connection lost, code:", code);
    this.stopPingMeasurement();
    // The old room is gone for good (rooms lock once a countdown starts), so rather than resuming a half-drawn
    // round the scene restarts into a fresh lobby, whose create() joins a new room through normal matchmaking.
    // Failed attempts still go through scheduleReconnect's retry/backoff.
    this.room = null;
    this.lastConnectArgs?.scene.onConnectionLost?.();
  }

  private scheduleReconnect() {
    if (this.reconnectTimeoutHandle !== null || !this.lastConnectArgs) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[SocketManager] Maximum reconnect attempts reached, giving up.");
      this.lastConnectArgs.scene.onReconnectFailed?.();
      return;
    }

    this.reconnectAttempts++;
    this.lastConnectArgs.scene.onReconnecting?.();
    console.log(`[SocketManager] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelayMs}ms`);

    this.reconnectTimeoutHandle = window.setTimeout(() => {
      this.reconnectTimeoutHandle = null;
      if (this.lastConnectArgs) {
        const { playerId, token, scene } = this.lastConnectArgs;
        this.connect(playerId, token, scene);
      }
    }, this.reconnectDelayMs);
  }

  send(data: any) {
    if (this.room?.connection.isOpen) {
      this.room.send(data.event, data);
    } else {
      console.warn("[SocketManager] Cannot send message - room not connected");
    }
  }

  getRoom() {
    return this.room;
  }

  close() {
    this.intentionalClose = true;
    if (this.reconnectTimeoutHandle !== null) {
      window.clearTimeout(this.reconnectTimeoutHandle);
      this.reconnectTimeoutHandle = null;
    }
    this.room?.leave();
    this.room = null;
    this.client = null;
  }

  startPingMeasurement(scene: any) {
    if (this.pingInterval) {
      window.clearInterval(this.pingInterval);
    }

    this.pingInterval = window.setInterval(() => {
      if (this.room?.connection.isOpen) {
        this.lastPingTime = Date.now();
        this.room.send("ping");
      }
    }, 5000);
  }

  stopPingMeasurement() {
    if (this.pingInterval) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

const socketManager = new SocketManager();
export default socketManager;