import { Server, Socket } from "socket.io";
import { Restaurant } from "../server";
import { User } from "../server";

interface Player {
  id: string;
  username: string;
  score: number;
}

interface QuickDrawGameData {
  players: Player[];
}

const quickDrawGames: { [key: string]: QuickDrawGameData } = {};

export const handleQuickDrawGame = (
  io: Server,
  socket: Socket,
  sessions: any
) => {
  // When the host triggers the start of the Quick Draw game
  socket.on("start-quick-draw", () => {
    const sessionId = Array.from(socket.rooms).find(
      (room) => room !== socket.id
    );

    if (sessionId && sessions[sessionId]) {
      // Only allow the host to start the game
      if (sessions[sessionId].host.id === socket.id) {
        // Notify all users in the session that the game is starting
        io.to(sessionId).emit("quick-draw-started");
      } else {
        socket.emit("error", "Only the host can start the game.");
      }
    }
  });

  //when player finishes the game...
  socket.on("quick-draw-finished", (reactionTime: number) => {
    const sessionId = Array.from(socket.rooms).find(
      (room) => room !== socket.id
    );

    if (sessionId) {
      if (!quickDrawGames[sessionId]) {
        quickDrawGames[sessionId] = { players: [] };
      }
      const session = sessions[sessionId];
      //find the user (host or guest) who is suggesting the restaurant
      const user: User | undefined =
        session.host.id === socket.id
          ? session.host
          : session.guests.find((guest: User) => guest.id === socket.id);
      if (user) {
        let newPlayer: Player = {
          id: user.id,
          username: user.username,
          score: reactionTime,
        };
        quickDrawGames[sessionId].players.push(newPlayer);

        //check if all players have finished playing
        const totalPlayers = sessions[sessionId].guests.length + 1;
        if (
          Object.keys(quickDrawGames[sessionId].players).length === totalPlayers
        ) {
          const currentGameScoresandPlayersArray =
            quickDrawGames[sessionId].players;
          console.log("TEST");
          console.log(currentGameScoresandPlayersArray);
          const sortedScores = currentGameScoresandPlayersArray.sort(
            (a, b) => a.score - b.score
          );
          console.log(sortedScores);
          //find player with fastest reaction time, winner variable will hold [playerId, reactionTime] of the fastest player
          const winner = Object.entries(
            quickDrawGames[sessionId].players
          ).reduce((prev, curr) => (curr[1].score < prev[1].score ? curr : prev));
          console.log("winner: " + winner);
          const [winnerId, winnerScore] = [winner[1].id, winner[1].score];
          const winnerRestaurant = sessions[sessionId].restaurants.find(
            (r: Restaurant) => r.suggestedBy.id === winnerId
          );
          if (winnerRestaurant) {
            io.to(sessionId).emit(
              "quick-draw-winner",
              winnerRestaurant.name,
              winnerRestaurant.suggestedBy.username,
              winnerScore,
              sortedScores
            );
          }
        }
      }
    }
  });

  //clean up when game ends or session is deleted
  socket.on("delete-session", () => {
    const sessionId = Array.from(socket.rooms).find(
      (room) => room !== socket.id
    );
    if (sessionId && quickDrawGames[sessionId]) {
      delete quickDrawGames[sessionId];
    }
  });

  //clean up when player disconnects
  socket.on("disconnect", () => {
    const sessionId = Array.from(socket.rooms).find(
      (room) => room !== socket.id
    );
    if (sessionId && quickDrawGames[sessionId]) {
      const indexOfPlayer = quickDrawGames[sessionId].players.findIndex(
        (player) => player.id === socket.id
      );
      delete quickDrawGames[sessionId].players[indexOfPlayer];
    }
  });
};
