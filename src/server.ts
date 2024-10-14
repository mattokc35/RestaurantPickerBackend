import express from "express";
import http from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "https://foodiepicker.netlify.app",
      "http://localhost:5173",
      "http://localhost:5174",
    ], // Your React app
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Sessions interface
interface Sessions {
  [key: string]: {
    host: string;
    guests: string[];
    restaurants: { name: string; suggestedBy: string }[];
  };
}

const sessions: Sessions = {};

io.on("connection", (socket: Socket) => {
  console.log("A user connected");

  // Create a new session (host)
  socket.on("create-session", (sessionId: string) => {
    console.log(`host created joined ${sessionId}`);

    if (!sessions[sessionId]) {
      // Create a new session with the socket ID as the host
      sessions[sessionId] = {
        host: socket.id,
        guests: [],
        restaurants: [],
      };
    }
    socket.join(sessionId); // Join the room
    socket.emit("role-assigned", "host"); // Assign the role of 'host' to the user
    socket.emit("current-restaurants", sessions[sessionId].restaurants);
    io.to(sessionId).emit("current-users", {
      count: sessions[sessionId].guests.length + 1, //including the host
    });
    console.log(sessions[sessionId].guests);
    console.log(sessions);
  });

  //check if a session is able to join
  socket.on("check-session", (sessionId: string) => {
    if (sessions[sessionId]) {
      if (sessions[sessionId].guests.length >= 10) {
        socket.emit("room-full");
      } else {
        //room exists and is not full
        socket.emit("session-exists");
      }
    } else {
      //session does not exist
      socket.emit("session-not-found");
    }
  });

  socket.on("leave-session", (sessionId: string) => {
    const session = sessions[sessionId];
    if (session) {
      // If the user is the host, delete the session
      if (session.host === socket.id) {
        console.log(`Host left. Deleting session ${sessionId}.`);

        // Notify all clients that the session is deleted
        io.to(sessionId).emit("session-deleted");

        // Delete the session and remove all users from the room
        delete sessions[sessionId];
        io.socketsLeave(sessionId); // Force all clients to leave the session
      } else {
        // If the user is a guest, remove them from the session
        session.guests = session.guests.filter(
          (guestId) => guestId !== socket.id
        );

        // Remove the guest's restaurant(s) from the session
        session.restaurants = session.restaurants.filter(
          (restaurant) => restaurant.suggestedBy !== socket.id
        );

        console.log(
          `Guest left session ${sessionId}. Updated guests: ${session.guests}`
        );

        // Notify other users about the updated restaurant list and user count
        io.to(sessionId).emit("current-users", {
          count: session.guests.length + 1, // Including the host
        });

        // Emit the updated list of restaurants to the remaining users
        io.to(sessionId).emit("current-restaurants", session.restaurants);

        socket.leave(sessionId); // Ensure the guest leaves the room
      }
    }
  });

  // Join an existing session (guest)
  socket.on("join-session", (sessionId: string) => {
    console.log(`user joined ${sessionId}`);
    if (sessions[sessionId]) {
      if (sessions[sessionId].guests.length >= 10) {
        socket.emit("error", "Room is full. Max 10 users allowed");
      } else {
        socket.join(sessionId); // Join the room

        // Now ensure the user has joined the room and add them as a guest
        sessions[sessionId].guests.push(socket.id); // Add the guest
        socket.emit("role-assigned", "guest");
        socket.emit("current-restaurants", sessions[sessionId].restaurants);
        socket.emit("join-success"); // Emit success if user joined successfully

        // Emit the updated user count after adding the guest
        io.to(sessionId).emit("current-users", {
          count: sessions[sessionId].guests.length + 1,
        });
        console.log(
          `Updated user count for session ${sessionId}: ${sessions[sessionId].guests.length}`
        );
        console.log(sessions);
        console.log(sessions[sessionId].guests);
      }
    } else {
      socket.emit("error", "Session does not exist");
    }
  });

  socket.on("suggest-restaurant", (sessionId: string, restaurant: string) => {
    const session = sessions[sessionId];
    if (session) {
      // Check if the user has already suggested a restaurant
      const alreadySuggested = session.restaurants.some(
        (r) => r.suggestedBy === socket.id
      );

      if (alreadySuggested) {
        socket.emit("error", "You have already suggested a restaurant");
      }
      // Add the restaurant and mark the user as having suggested one
      session.restaurants.push({ name: restaurant, suggestedBy: socket.id });
      io.to(sessionId).emit("restaurant-suggested", {
        name: restaurant,
        suggestedBy: socket.id,
      });
      console.log(session);
    }
  });

  // Spin the wheel (only the host can trigger this)
  socket.on("spin-wheel", () => {
    const sessionId = Array.from(socket.rooms).find(
      (room) => room !== socket.id
    );
    if (
      sessionId &&
      sessions[sessionId] &&
      sessions[sessionId].restaurants.length > 0
    ) {
      const randomIndex = Math.floor(
        Math.random() * sessions[sessionId].restaurants.length
      );
      const selectedRestaurant = sessions[sessionId].restaurants[randomIndex];
      io.to(sessionId).emit("spin-wheel", {
        restaurant: selectedRestaurant.name,
        suggestedBy: selectedRestaurant.suggestedBy,
        index: randomIndex,
      });
    }
  });

  // Delete session handler
  socket.on("delete-session", () => {
    const sessionId = Array.from(socket.rooms).find(
      (room) => room !== socket.id
    );
    if (sessionId && sessions[sessionId]) {
      delete sessions[sessionId]; // Remove the session
      io.to(sessionId).emit("session-deleted"); // Notify all clients
      socket.leave(sessionId);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("A user disconnected");

    // Find the session the user was in
    const sessionId = Object.keys(sessions).find((id) => {
      return (
        sessions[id].host === socket.id ||
        sessions[id].guests.includes(socket.id)
      );
    });

    if (sessionId) {
      // If the user is the host, delete the session
      if (sessions[sessionId].host === socket.id) {
        console.log(`Host disconnected. Deleting session ${sessionId}.`);
        delete sessions[sessionId];
        io.to(sessionId).emit("session-deleted"); // Notify all clients the session is deleted
        io.socketsLeave(sessionId); // Force all clients to leave the session
      } else {
        // If the user is a guest, remove them from the session
        sessions[sessionId].guests = sessions[sessionId].guests.filter(
          (guestId) => guestId !== socket.id
        );
        io.to(sessionId).emit("current-users", {
          count: sessions[sessionId].guests.length + 1, // Including the host
        });
      }
    }
  });
});

server.listen(4000, () => {
  console.log("Server listening on port 4000");
});
