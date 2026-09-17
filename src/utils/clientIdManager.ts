import { v4 as uuidv4 } from 'uuid';

const CLIENT_ID_KEY = 'clientId';

export class ClientIdManager {
  static getOrCreateClientId(): string {
    let clientId = localStorage.getItem(CLIENT_ID_KEY);

    if (!clientId) {
      clientId = uuidv4();
      localStorage.setItem(CLIENT_ID_KEY, clientId);
      console.log(`[ClientIdManager] Generated new client ID: ${clientId}`);
    }

    return clientId;
  }

  static getClientId(): string | null {
    return localStorage.getItem(CLIENT_ID_KEY);
  }
}
