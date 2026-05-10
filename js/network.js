export class NetworkManager {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.isHost = false;
    this.roomCode = null;

    this.onRoomCreated = null;
    this.onRoomJoined = null;
    this.onPeerConnected = null;
    this.onPeerDisconnected = null;
    this.onGameState = null;
    this.onPlayerInput = null;
    this.onGameStart = null;
    this.onError = null;
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
      } catch (e) {
        reject(new Error('无法连接: ' + e.message));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('连接超时'));
      }, 5000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.connected = true;
        resolve();
      };

      this.ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        this._handleMessage(msg);
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.isHost = false;
        // Only notify if we were connected (not a timeout)
        if (this.onPeerDisconnected && this.roomCode) {
          this.onPeerDisconnected();
        }
      };

      this.ws.onerror = () => {
        clearTimeout(timeout);
        if (!this.connected) {
          reject(new Error('连接失败'));
        }
      };
    });
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'room_created':
        this.isHost = true;
        this.roomCode = msg.code;
        if (this.onRoomCreated) this.onRoomCreated(msg.code);
        break;
      case 'room_joined':
        this.isHost = false;
        this.roomCode = msg.code;
        if (this.onRoomJoined) this.onRoomJoined(msg.code);
        break;
      case 'peer_connected':
        if (this.onPeerConnected) this.onPeerConnected();
        break;
      case 'peer_disconnected':
        this.roomCode = null;
        if (this.onPeerDisconnected) this.onPeerDisconnected();
        break;
      case 'game_state':
        if (this.onGameState) this.onGameState(msg);
        break;
      case 'player_input':
        if (this.onPlayerInput) this.onPlayerInput(msg);
        break;
      case 'start_game':
        if (this.onGameStart) this.onGameStart();
        break;
      case 'error':
        if (this.onError) this.onError(msg.message);
        break;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  createRoom() {
    this.send({ type: 'create_room' });
  }

  joinRoom(code) {
    this.send({ type: 'join_room', code: code.toUpperCase() });
  }

  startGame() {
    this.send({ type: 'start_game' });
  }

  sendGameState(state) {
    this.send({ type: 'game_state', ...state });
  }

  sendPlayerInput(input) {
    this.send({ type: 'player_input', keys: input });
  }

  leaveRoom() {
    this.send({ type: 'leave_room' });
  }

  close() {
    if (this.ws) {
      this.ws.onclose = null; // Prevent disconnect handler
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.isHost = false;
    this.roomCode = null;
  }
}
