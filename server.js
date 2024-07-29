import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import { EVENTS } from "./Events.js";
import cors from "cors"

const app = express();
const server = http.createServer(app);

app.use(express.static('dist'))
app.use(cors());
app.use(express.json());



const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const port = 5000;
const userSocketMap = {};
const roomCodeMap = {}; // To keep track of the code for each room

app.get( '/', (req,res)=>{
    res.json({success:true, msg:"hello from server"})
})

function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => ({
    socketId,
    username: userSocketMap[socketId],
  }));
}

io.on('connection', (socket) => {
  console.log('Socket connected', socket.id);

  socket.on(EVENTS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);

    // Send the current code to the new user
    const code = roomCodeMap[roomId] || '';
    socket.emit(EVENTS.CODE_CHANGE, { code });

    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(EVENTS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  // Handle code changes and synchronize with all clients
  socket.on(EVENTS.CODE_CHANGE, ({ roomId, code }) => {
    roomCodeMap[roomId] = code; // Update the code for the room
    socket.in(roomId).emit(EVENTS.CODE_CHANGE, { code });
  });

  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(EVENTS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });
    delete userSocketMap[socket.id];
  });
});

server.listen(port, () => {
  console.log(`Server is listening on ${port}`);
});
