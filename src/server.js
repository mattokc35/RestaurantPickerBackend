"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const quickDrawGameServer_1 = require("./games/quickDrawGameServer");
const helperFunctions_1 = require("./helpers/helperFunctions");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: [
            "https://foodiepicker.netlify.app",
            "http://localhost:5173",
            "http://localhost:5174",
        ], // Your React app
        methods: ["GET", "POST"],
    },
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const sessions = {};
io.on("connection", (socket) => {
    console.log("A user connected");
    (0, quickDrawGameServer_1.handleQuickDrawGame)(io, socket, sessions);
    // Create a new session (host)
    socket.on("create-session", (sessionId) => {
        console.log(`host created joined ${sessionId}`);
        const hostUsername = (0, helperFunctions_1.generateUsername)(socket.id);
        if (!sessions[sessionId]) {
            // Create a new session with the socket ID as the host
            sessions[sessionId] = {
                host: { id: socket.id, username: hostUsername },
                guests: [],
                restaurants: [],
            };
        }
        socket.join(sessionId); // Join the room
        socket.emit("user-details", { id: socket.id, username: hostUsername });
        socket.emit("role-assigned", "host"); // Assign the role of 'host' to the user
        socket.emit("current-restaurants", sessions[sessionId].restaurants);
        io.to(sessionId).emit("current-users", {
            count: sessions[sessionId].guests.length + 1, //including the host
        });
        console.log(sessions[sessionId].guests);
        console.log(sessions);
    });
    //check if a session is able to join
    socket.on("check-session", (sessionId) => {
        if (sessions[sessionId]) {
            if (sessions[sessionId].guests.length >= 10) {
                socket.emit("room-full");
            }
            else {
                //room exists and is not full
                socket.emit("session-exists");
            }
        }
        else {
            //session does not exist
            socket.emit("session-not-found");
        }
    });
    socket.on("leave-session", (sessionId) => {
        const session = sessions[sessionId];
        if (session) {
            // If the user is the host, delete the session
            if (session.host.id === socket.id) {
                console.log(`Host left. Deleting session ${sessionId}.`);
                // Notify all clients that the session is deleted
                io.to(sessionId).emit("session-deleted");
                // Delete the session and remove all users from the room
                delete sessions[sessionId];
                io.socketsLeave(sessionId); // Force all clients to leave the session
            }
            else {
                // If the user is a guest, remove them from the session
                session.guests = session.guests.filter((guest) => guest.id !== socket.id);
                // Remove the guest's restaurant(s) from the session
                session.restaurants = session.restaurants.filter((restaurant) => restaurant.suggestedBy.id !== socket.id);
                console.log(`Guest left session ${sessionId}. Updated guests: ${session.guests}`);
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
    socket.on("join-session", (sessionId) => {
        console.log(`user joined ${sessionId}`);
        if (sessions[sessionId]) {
            if (sessions[sessionId].guests.length >= 10) {
                socket.emit("error", "Room is full. Max 10 users allowed");
            }
            else {
                socket.join(sessionId); // Join the room
                const randomGuestUsername = (0, helperFunctions_1.generateUsername)(socket.id);
                const guestObject = { id: socket.id, username: randomGuestUsername };
                // Now ensure the user has joined the room and add them as a guest
                sessions[sessionId].guests.push(guestObject); // Add the guest
                socket.emit("user-details", {
                    id: socket.id,
                    username: randomGuestUsername,
                });
                socket.emit("role-assigned", "guest");
                socket.emit("current-restaurants", sessions[sessionId].restaurants);
                socket.emit("join-success"); // Emit success if user joined successfully
                // Emit the updated user count after adding the guest
                io.to(sessionId).emit("current-users", {
                    count: sessions[sessionId].guests.length + 1,
                });
                console.log(`Updated user count for session ${sessionId}: ${sessions[sessionId].guests.length}`);
                console.log(sessions);
                console.log(sessions[sessionId].guests);
            }
        }
        else {
            socket.emit("error", "Session does not exist");
        }
    });
    socket.on("suggest-restaurant", (sessionId, restaurant) => {
        const session = sessions[sessionId];
        if (session) {
            // Check if the user has already suggested a restaurant
            const alreadySuggested = session.restaurants.some((r) => r.suggestedBy.id === socket.id);
            if (alreadySuggested) {
                socket.emit("error", "You have already suggested a restaurant");
            }
            //find the user (host or guest) who is suggesting the restaurant
            const user = session.host.id === socket.id
                ? session.host
                : session.guests.find((guest) => guest.id === socket.id);
            // Add the restaurant and mark the user as having suggested one
            if (user) {
                session.restaurants.push({ name: restaurant, suggestedBy: user });
                io.to(sessionId).emit("restaurant-suggested", {
                    name: restaurant,
                    suggestedBy: user,
                });
                console.log(session);
            }
            else {
                socket.emit("error", "User not found in session");
            }
        }
    });
    // Spin the wheel (only the host can trigger this)
    socket.on("spin-wheel", () => {
        const sessionId = Array.from(socket.rooms).find((room) => room !== socket.id);
        if (sessionId &&
            sessions[sessionId] &&
            sessions[sessionId].restaurants.length > 0) {
            const randomIndex = Math.floor(Math.random() * sessions[sessionId].restaurants.length);
            const selectedRestaurant = sessions[sessionId].restaurants[randomIndex];
            io.to(sessionId).emit("spin-wheel", {
                restaurant: selectedRestaurant.name,
                suggestedBy: selectedRestaurant.suggestedBy,
                index: randomIndex,
            });
        }
    });
    //handle game option change
    socket.on("game-option-changed", ({ sessionId, gameOption }) => {
        const session = sessions[sessionId];
        if (session) {
            io.to(sessionId).emit("game-option-updated", gameOption);
        }
    });
    // Delete session handler
    socket.on("delete-session", () => {
        console.log("delete session");
        const sessionId = Array.from(socket.rooms).find((room) => room !== socket.id);
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
            return (sessions[id].host.id === socket.id ||
                sessions[id].guests.some((guest) => guest.id === socket.id));
        });
        if (sessionId) {
            // If the user is the host, delete the session
            if (sessions[sessionId].host.id === socket.id) {
                console.log(`Host disconnected. Deleting session ${sessionId}.`);
                delete sessions[sessionId];
                io.to(sessionId).emit("session-deleted"); // Notify all clients the session is deleted
                io.socketsLeave(sessionId); // Force all clients to leave the session
            }
            else {
                // If the user is a guest, remove them from the session
                sessions[sessionId].guests = sessions[sessionId].guests.filter((guest) => guest.id !== socket.id);
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
