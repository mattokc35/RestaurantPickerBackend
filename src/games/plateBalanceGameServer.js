"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePlateBalanceGame = void 0;
const plateBalanceGames = {};
const handlePlateBalanceGame = (io, socket, sessions) => {
    // When the host triggers the start of the Plate Balance game
    socket.on("start-plate-balance", () => {
        const sessionId = Array.from(socket.rooms).find((room) => room !== socket.id);
        if (sessionId && sessions[sessionId]) {
            // Only the host can start the game
            if (sessions[sessionId].host.id === socket.id) {
                io.to(sessionId).emit("plate-balance-started");
            }
            else {
                socket.emit("error", "Only the host can start the game.");
            }
        }
    });
    // When the player finishes the game (falls off)
    socket.on("plate-balance-finished", (timeBalanced) => {
        const sessionId = Array.from(socket.rooms).find((room) => room !== socket.id);
        if (sessionId) {
            if (!plateBalanceGames[sessionId]) {
                plateBalanceGames[sessionId] = { players: [] };
            }
            const session = sessions[sessionId];
            const user = session.host.id === socket.id
                ? session.host
                : session.guests.find((guest) => guest.id === socket.id);
            if (user) {
                // Mark the player's time as finalized when they finish the game
                let player = plateBalanceGames[sessionId].players.find((p) => p.id === user.id);
                if (!player) {
                    player = { id: user.id, username: user.username, timeBalanced };
                    plateBalanceGames[sessionId].players.push(player);
                }
                else {
                    player.timeBalanced = timeBalanced;
                }
                // Check if all players have finished their balancing
                const totalPlayers = sessions[sessionId].guests.length + 1; // Including host
                if (plateBalanceGames[sessionId].players.length === totalPlayers) {
                    const sortedScores = plateBalanceGames[sessionId].players.sort((a, b) => b.timeBalanced - a.timeBalanced // Sort by longest balance time
                    );
                    const winner = sortedScores[0];
                    const winnerRestaurant = sessions[sessionId].restaurants.find((r) => r.suggestedBy.id === winner.id);
                    if (winnerRestaurant) {
                        io.to(sessionId).emit("plate-balance-winner", winnerRestaurant.name, winner.username, (winner.timeBalanced / 1000).toFixed(2), // Send winner's time in seconds
                        sortedScores);
                    }
                }
            }
        }
    });
    // Clean up game data when the session is deleted
    socket.on("delete-session", () => {
        const sessionId = Array.from(socket.rooms).find((room) => room !== socket.id);
        if (sessionId && plateBalanceGames[sessionId]) {
            delete plateBalanceGames[sessionId];
        }
    });
    // Clean up when the player disconnects
    socket.on("disconnect", () => {
        const sessionId = Array.from(socket.rooms).find((room) => room !== socket.id);
        if (sessionId && plateBalanceGames[sessionId]) {
            const indexOfPlayer = plateBalanceGames[sessionId].players.findIndex((player) => player.id === socket.id);
            if (indexOfPlayer > -1) {
                plateBalanceGames[sessionId].players.splice(indexOfPlayer, 1);
            }
        }
    });
};
exports.handlePlateBalanceGame = handlePlateBalanceGame;
