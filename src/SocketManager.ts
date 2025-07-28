import { Client, Room } from "colyseus.js";
import { Snake } from "./Snake";

class SocketManager {
  private client: Client | null = null;
  private room: Room | null = null;
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

  async connect(playerId: string, token: string, scene: any) {
    try {
      this.client = new Client("ws://localhost:4002");
      this.room = await this.client.joinOrCreate("snake", {
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

      // Add state change handler specifically for game start
      this.room.onStateChange((state) => {
        if (state.hasGameStarted && !scene.gameStarted) {
          console.log("[SocketManager] Game started from state change");
          scene.gameStarted = true;
          if (typeof scene.onGameStarted === 'function') {
            scene.onGameStarted();
          }
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
                    // Create new snake if it doesn't exist
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
      });

      // Start ping measurement after setting up handlers
      this.startPingMeasurement(scene);

    } catch (error) {
      console.error("[SocketManager] Could not connect to server:", error);
    }
  }

  send(data: any) {
    if (this.room?.connection.isOpen) {
      console.log("[SocketManager] Sending message:", data.event, data);
      // Send the event directly without trying to convert it
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