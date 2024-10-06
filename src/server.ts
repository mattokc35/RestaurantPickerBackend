import express from "express";
import http from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Your React app
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Sessions interface
interface Sessions {
  [key: string]: string[];
}

const sessions: Sessions = {};

io.on("connection", (socket: Socket) => {
  console.log("A user connected");

  socket.on("join-session", (sessionId: string) => {
    if (!sessions[sessionId]) {
      sessions[sessionId] = [];
    }
    socket.join(sessionId);
    socket.emit("current-restaurants", sessions[sessionId]);
  });

  socket.on("suggest-restaurant", (restaurant: string) => {
    const sessionId = Array.from(socket.rooms).find(
      (room) => room !== socket.id
    );
    if (sessionId && sessions[sessionId]) {
      sessions[sessionId].push(restaurant);
      io.to(sessionId).emit("restaurant-suggested", restaurant);
    }
  });

  socket.on("spin-wheel", () => {
    const sessionId = Array.from(socket.rooms).find(
      (room) => room !== socket.id
    );
    if (sessionId && sessions[sessionId] && sessions[sessionId].length > 0) {
      const randomIndex = Math.floor(
        Math.random() * sessions[sessionId].length
      );
      const selectedRestaurant = sessions[sessionId][randomIndex];

      io.to(sessionId).emit("spin-wheel", {
        restaurant: selectedRestaurant,
        index: randomIndex,
      });
    }
  });

  // Delete session handler
  socket.on("delete-session", () => {
    const sessionId = Array.from(socket.rooms).find(
      (room) => room !== socket.id
    );
    if (sessionId) {
      delete sessions[sessionId]; // Remove the session from the sessions object
      io.to(sessionId).emit("session-deleted"); // Notify all clients the session is deleted
      socket.leave(sessionId);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

server.listen(4000, () => {
  console.log("Server listening on port 4000");
});
