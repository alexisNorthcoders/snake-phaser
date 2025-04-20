import { GameScene } from "./scenes/GameScene";
import { handleSocketMessage } from "./SocketHandler";

class SocketManager {
  private socket: WebSocket | null = null;

  connect(playerId: string, token: string, scene: GameScene) {
    const url = this.getWebSocketUrl();
    this.socket = new WebSocket(`${url}?player_id=${playerId}&access_token=${token}`);

    this.socket.onopen = () => {
      console.log('[WebSocket] Connected');
    };

    this.socket.onerror = (e) => {
      console.error('[WebSocket] Error:', e);
    };

    this.socket.onmessage = (msg) => {
      handleSocketMessage(scene, msg);
    };
  }

  getSocket() {
    return this.socket;
  }

  getWebSocketUrl() {
    return "wss://snakemp.duckdns.org/ws"
  };

  send(data: any) {

    if (this.socket?.readyState === WebSocket.OPEN) {
      if (data === "p") this.socket.send("p")
      else {
        this.socket.send(JSON.stringify(data));
      }
    } else {
      console.warn('[WebSocket] Not connected');
    }
  }

  close() {
    this.socket?.close();
    this.socket = null;
  }
}

const socketManager = new SocketManager();
export default socketManager;