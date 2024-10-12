"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
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
    // Create a new session (host)
    socket.on("create-session", (sessionId) => {
        if (!sessions[sessionId]) {
            // Create a new session with the socket ID as the host
            sessions[sessionId] = {
                host: socket.id,
                guests: [],
                restaurants: [],
                suggestedBy: [],
            };
        }
        socket.join(sessionId); // Join the room
        sessions[sessionId].guests.push(socket.id); //add the host
        socket.emit("role-assigned", "host"); // Assign the role of 'host' to the user
        socket.emit("current-restaurants", sessions[sessionId].restaurants);
        io.to(sessionId).emit("current-users", {
            count: sessions[sessionId].guests.length, //including the host
        });
        console.log(sessions[sessionId].guests);
    });
    // Join an existing session (guest)
    socket.on("join-session", (sessionId) => {
        if (sessions[sessionId]) {
            if (sessions[sessionId].guests.length >= 10) {
                socket.emit("error", "Room is full. Max 10 users allowed");
            }
            else {
                sessions[sessionId].guests.push(socket.id); // Add the guest
                socket.join(sessionId); // Join the room
                socket.emit("role-assigned", "guest");
                socket.emit("current-restaurants", sessions[sessionId].restaurants);
                io.to(sessionId).emit("current-users", {
                    count: sessions[sessionId].guests.length,
                });
                socket.emit("join-success"); // Emit success if user joined successfully
                console.log(sessions[sessionId].guests);
            }
        }
        else {
            socket.emit("error", "Session does not exist");
        }
    });
    socket.on("suggest-restaurant", (restaurant) => {
        const sessionId = Array.from(socket.rooms).find((room) => room !== socket.id);
        if (sessionId && sessions[sessionId]) {
            // Check if the user has already suggested a restaurant
            if (sessions[sessionId].suggestedBy.includes(socket.id)) {
                socket.emit("error", "You have already suggested a restaurant.");
                return;
            }
            // Add the restaurant and mark the user as having suggested one
            sessions[sessionId].restaurants.push(restaurant);
            sessions[sessionId].suggestedBy.push(socket.id);
            io.to(sessionId).emit("restaurant-suggested", restaurant);
        }
    });
    // Spin the wheel (only the host can trigger this)
    socket.on("spin-wheel", () => {
        const sessionId = Array.from(socket.rooms).find((room) => room !== socket.id);
        if (sessionId && sessions[sessionId] && sessions[sessionId].restaurants.length > 0) {
            const randomIndex = Math.floor(Math.random() * sessions[sessionId].restaurants.length);
            const selectedRestaurant = sessions[sessionId].restaurants[randomIndex];
            io.to(sessionId).emit("spin-wheel", {
                restaurant: selectedRestaurant,
                index: randomIndex,
            });
        }
    });
    // Delete session handler
    socket.on("delete-session", () => {
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
            return sessions[id].host === socket.id || sessions[id].guests.includes(socket.id);
        });
        if (sessionId) {
            // If the user is the host, delete the session
            if (sessions[sessionId].host === socket.id) {
                console.log(`Host disconnected. Deleting session ${sessionId}.`);
                delete sessions[sessionId];
                io.to(sessionId).emit("session-deleted"); // Notify all clients the session is deleted
                io.socketsLeave(sessionId); // Force all clients to leave the session
            }
            else {
                // If the user is a guest, remove them from the session
                sessions[sessionId].guests = sessions[sessionId].guests.filter((guestId) => guestId !== socket.id);
                io.to(sessionId).emit("current-users", {
                    count: sessions[sessionId].guests.length, // Including the host
                });
            }
        }
    });
});
server.listen(4000, () => {
    console.log("Server listening on port 4000");
});
