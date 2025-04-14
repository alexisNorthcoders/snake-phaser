class SocketManager {
  private socket: WebSocket | null = null;

  connect(playerId: string, token: string, onMessage?: (msg: MessageEvent) => void) {
    const url = this.getWebSocketUrl();
    this.socket = new WebSocket(`${url}?player_id=${playerId}&access_token=${token}`);

    this.socket.onopen = () => {
      console.log('[WebSocket] Connected');
    };

    this.socket.onerror = (e) => {
      console.error('[WebSocket] Error:', e);
    };

    this.socket.onmessage = (msg) => {
      console.log('[WebSocket] Message:', msg.data);
      onMessage?.(msg);
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
      this.socket.send(JSON.stringify(data));
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