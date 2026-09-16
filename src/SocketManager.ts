import { Client, Room } from "colyseus.js";
import { Snake } from "./Snake";
import { GameScene } from "./scenes/GameScene";
import { Food } from "./Food";
import { GameState } from "./schemas/Food";

class SocketManager {
  private client: Client | null = null;
  private room: Room<GameState> | null = null;
  private pingInterval: number | null = null;
  private lastPingTime: number = 0;

  // Match the message types with the server
  static messageTypes = {
    MOVE: "move",
    START_GAME: "startGame",
    GAME_STARTED: "gameStarted",
    NEW_PLAYER: "newPlayer",
    GAME_OVER: "gameOver",
    PING: "ping",
    PONG: "pong"
  };

  async connect(playerId: string, token: string, scene: GameScene) {
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

      // Set up all message handlers during connection
      this.room.onMessage(SocketManager.messageTypes.GAME_STARTED, () => {
        console.log("[SocketManager] Received gameStarted event");
        scene.gameStarted = true;

        // Trigger any additional game start logic in the scene
        if (typeof scene.onGameStarted === 'function') {
          scene.onGameStarted();
        }
      });

      this.room.onMessage(SocketManager.messageTypes.PONG, () => {
        const latency = Date.now() - this.lastPingTime;
        scene.pingText?.setText(`Ping: ${latency}ms`);
      });

      // Handle state changes for snake positions
      this.room.onStateChange((state) => {

        state.players.forEach((player) => {
          if (player.snake) {
            const currentSnake = scene.snakes.get(player.id);
            if (currentSnake) {
              // Update existing snake
              if (player.id === playerId) {
                scene.scoreText.setText(`Score: ${player.snake.score}`);
              }

              if (!currentSnake.isDead) {
                currentSnake.tail = player.snake.tail;
                currentSnake.food = player.snake.score;
                currentSnake.position({ x: player.snake.x, y: player.snake.y });

                if (player.snake.isDead) {
                  currentSnake.stop(player.id, player.snake.score, false);
                }
              }
            } else {

              const newSnake = new Snake(
                scene,
                player.snake.x,
                player.snake.y,
                player.type,
                player.colours,
                player.snake.size
              );
              scene.snakes.set(player.id, newSnake);
            }
          }
        });
      })

      this.room.onStateChange((state) => {
        if (state.hasGameStarted) {
          if (!scene.gameStarted) {
            // Game just started: initialize food list
            scene.gameStarted = true;
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
                console.log('updating food', food);
                localFood.updateFood({ x: food.x, y: food.y }, food.type);
              }
            });
          }
        }
      });

      this.startPingMeasurement(scene);

    } catch (error) {
      console.error("[SocketManager] Could not connect to server:", error);
    }
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