const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 8888;

const wss = new WebSocketServer({ port: PORT });
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function findRoomByClient(ws) {
  for (const [code, room] of rooms) {
    if (room.host === ws || room.peer === ws) return { code, room };
  }
  return null;
}

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'create_room': {
        let code = generateRoomCode();
        while (rooms.has(code)) code = generateRoomCode();
        rooms.set(code, { host: ws, peer: null });
        ws.send(JSON.stringify({ type: 'room_created', code }));
        console.log(`Room created: ${code}`);
        break;
      }

      case 'join_room': {
        const room = rooms.get(msg.code);
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: '房间不存在' }));
          return;
        }
        if (room.peer) {
          ws.send(JSON.stringify({ type: 'error', message: '房间已满' }));
          return;
        }
        room.peer = ws;
        ws.send(JSON.stringify({ type: 'room_joined', code: msg.code }));
        room.host.send(JSON.stringify({ type: 'peer_connected' }));
        console.log(`Peer joined room: ${msg.code}`);
        break;
      }

      case 'leave_room': {
        const entry = findRoomByClient(ws);
        if (entry) {
          const { code, room } = entry;
          const other = room.host === ws ? room.peer : room.host;
          if (other) other.send(JSON.stringify({ type: 'peer_disconnected' }));
          rooms.delete(code);
          console.log(`Room ${code} closed`);
        }
        break;
      }

      case 'game_state': {
        const entry = findRoomByClient(ws);
        if (entry && entry.room.host === ws && entry.room.peer) {
          entry.room.peer.send(data.toString());
        }
        break;
      }

      case 'player_input': {
        const entry = findRoomByClient(ws);
        if (entry && entry.room.peer === ws && entry.room.host) {
          entry.room.host.send(data.toString());
        }
        break;
      }

      case 'start_game': {
        const entry = findRoomByClient(ws);
        if (entry && entry.room.host === ws && entry.room.peer) {
          entry.room.peer.send(data.toString());
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    const entry = findRoomByClient(ws);
    if (entry) {
      const { code, room } = entry;
      const other = room.host === ws ? room.peer : room.host;
      if (other) {
        other.send(JSON.stringify({ type: 'peer_disconnected' }));
        // Close the other connection too
        try { other.close(); } catch {}
      }
      rooms.delete(code);
      console.log(`Room ${code} closed (client disconnect)`);
    }
    console.log('Client disconnected');
  });

  ws.on('error', () => {});
});

console.log(`Tank Battle server running on port ${PORT}`);
