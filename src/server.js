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
        origin: "https://foodiepicker.netlify.app", // Your React app
        methods: ["GET", "POST"],
    },
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const sessions = {};
io.on("connection", (socket) => {
    console.log("A user connected");
    socket.on("join-session", (sessionId) => {
        if (!sessions[sessionId]) {
            sessions[sessionId] = [];
        }
        socket.join(sessionId);
        socket.emit("current-restaurants", sessions[sessionId]);
    });
    socket.on("suggest-restaurant", (restaurant) => {
        const sessionId = Array.from(socket.rooms).find((room) => room !== socket.id);
        if (sessionId && sessions[sessionId]) {
            sessions[sessionId].push(restaurant);
            io.to(sessionId).emit("restaurant-suggested", restaurant);
        }
    });
    socket.on("spin-wheel", () => {
        const sessionId = Array.from(socket.rooms).find((room) => room !== socket.id);
        if (sessionId && sessions[sessionId] && sessions[sessionId].length > 0) {
            const randomIndex = Math.floor(Math.random() * sessions[sessionId].length);
            const selectedRestaurant = sessions[sessionId][randomIndex];
            io.to(sessionId).emit("spin-wheel", {
                restaurant: selectedRestaurant,
                index: randomIndex,
            });
        }
    });
    // Delete session handler
    socket.on("delete-session", () => {
        const sessionId = Array.from(socket.rooms).find((room) => room !== socket.id);
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
