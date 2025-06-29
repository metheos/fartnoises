// Disconnection and reconnection event handlers for the fartnoises game server
import { Socket } from "socket.io";
import { GameState } from "@/types/game";
import {
  SocketContext,
  RECONNECTION_GRACE_PERIOD,
  RECONNECTION_VOTE_TIMEOUT,
} from "../types/socketTypes";
import {
  selectNextJudge,
  broadcastRoomListUpdate,
  removeMainScreen,
} from "../utils/roomManager";
import { clearTimer } from "../utils/timerManager";
import { startDelayedSoundSelectionTimer } from "../utils/gameLogic";

export function setupReconnectionHandlers(
  socket: Socket,
  context: SocketContext
) {
  // Disconnect handler
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    try {
      const roomCode = context.playerRooms.get(socket.id);
      if (roomCode) {
        // Check if this was a main screen and clean up tracking
        // Socket augmentation for custom properties - proper interface extension would require module declaration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((socket as any).isViewer) {
          console.log(
            `[MAIN SCREEN] Main screen ${socket.id} disconnected from room ${roomCode}`
          );
          removeMainScreen(context, roomCode, socket.id);
        } else {
          // Use new disconnection handling for regular players
          handlePlayerDisconnection(context, socket.id, roomCode);
        }
      }
    } catch (error) {
      console.error("Error during disconnect:", error);
    }
  });

  // Reconnect to room handler
  socket.on(
    "reconnectToRoom",
    (roomCode, playerName, originalPlayerId, callback) => {
      try {
        console.log(
          `Reconnection attempt: ${playerName} to room ${roomCode} with original ID ${originalPlayerId}`
        );

        if (!context.rooms.has(roomCode)) {
          callback(false);
          return;
        }

        const success = handlePlayerReconnection(
          context,
          socket,
          roomCode,
          playerName,
          originalPlayerId
        );

        if (success) {
          const room = context.rooms.get(roomCode);
          const player = room?.players.find((p) => p.id === socket.id);
          if (room && player) {
            socket.emit("roomJoined", { room, player });
            callback(true, room);
          } else {
            callback(false);
          }
        } else {
          callback(false);
        }
      } catch (error) {
        console.error("Error during reconnection:", error);
        callback(false);
      }
    }
  );

  // Vote on reconnection handler
  socket.on("voteOnReconnection", (continueWithoutPlayer) => {
    try {
      const roomCode = context.playerRooms.get(socket.id);
      if (!roomCode) return;

      const room = context.rooms.get(roomCode);
      if (!room || !room.pausedForDisconnection) return;

      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;

      // Store the vote
      room.reconnectionVote = {
        voterId: socket.id,
        voterName: player.name,
        continueWithoutPlayer,
        timestamp: Date.now(),
      };

      // Broadcast the vote to all players
      context.io.to(roomCode).emit("reconnectionVoteUpdate", {
        vote: room.reconnectionVote,
      });

      // Get the disconnected player name for the vote result
      const disconnectedPlayerName =
        room.disconnectedPlayers?.[0]?.name || "Unknown Player";

      // Handle the vote result immediately (in a real implementation, you might want to collect multiple votes)
      handleReconnectionVoteResult(
        context,
        roomCode,
        continueWithoutPlayer,
        disconnectedPlayerName,
        GameState.SOUND_SELECTION
      );
    } catch (error) {
      console.error("Error handling reconnection vote:", error);
    }
  });
}

// Disconnection handling utility functions
function handlePlayerDisconnection(
  context: SocketContext,
  socketId: string,
  roomCode: string
) {
  const room = context.rooms.get(roomCode);
  if (!room) return;

  const player = room.players.find((p) => p.id === socketId);
  if (!player) return;

  console.log(`Player ${player.name} disconnected from room ${roomCode}`);

  // If we're in lobby or game over, handle immediately without grace period
  if (
    room.gameState === GameState.LOBBY ||
    room.gameState === GameState.GAME_OVER
  ) {
    removePlayerFromRoom(context, socketId, roomCode);
    return;
  }

  // Initialize disconnected players array if it doesn't exist
  if (!room.disconnectedPlayers) {
    room.disconnectedPlayers = [];
  }

  // Move player to disconnected list
  const disconnectedPlayer = {
    ...player,
    disconnectedAt: Date.now(),
    socketId: socketId,
  };

  room.disconnectedPlayers.push(disconnectedPlayer);
  room.players = room.players.filter((p) => p.id !== socketId);

  // Pause the game and notify players
  const previousGameState = room.gameState;
  room.gameState = GameState.PAUSED_FOR_DISCONNECTION;
  room.pausedForDisconnection = true;
  room.previousGameState = previousGameState;
  room.disconnectionTimestamp = Date.now();

  // Clear any existing game timers
  clearTimer(context, roomCode);

  // Notify all players about the disconnection
  context.io.to(roomCode).emit("playerDisconnected", {
    playerId: socketId,
    playerName: player.name,
    canReconnect: true,
  });

  context.io.to(roomCode).emit("gamePausedForDisconnection", {
    disconnectedPlayerName: player.name,
    timeLeft: RECONNECTION_GRACE_PERIOD / 1000,
  });

  context.io
    .to(roomCode)
    .emit("gameStateChanged", GameState.PAUSED_FOR_DISCONNECTION, {
      previousState: previousGameState,
      disconnectedPlayer: player.name,
    });

  // Start reconnection grace period timer
  startReconnectionTimer(context, roomCode, previousGameState);
}

function startReconnectionTimer(
  context: SocketContext,
  roomCode: string,
  previousGameState: GameState
) {
  // Clear any existing disconnection timer
  if (context.disconnectionTimers.has(roomCode)) {
    clearTimeout(context.disconnectionTimers.get(roomCode)!);
  }

  const timer = setTimeout(() => {
    const room = context.rooms.get(roomCode);
    if (!room || !room.pausedForDisconnection) return;

    // Grace period expired, start voting process
    const disconnectedPlayer = room.disconnectedPlayers?.[0];
    if (!disconnectedPlayer) return;

    const connectedPlayers = room.players.filter((p) => !p.isDisconnected);
    if (connectedPlayers.length === 0) {
      // No connected players left, close room
      context.rooms.delete(roomCode);
      clearTimer(context, roomCode);
      clearDisconnectionTimer(context, roomCode);
      broadcastRoomListUpdate(context);
      return;
    }

    // Select a random connected player to vote
    const randomVoter =
      connectedPlayers[Math.floor(Math.random() * connectedPlayers.length)];

    // Send vote request to the selected player
    context.io.to(randomVoter.id).emit("reconnectionVoteRequest", {
      disconnectedPlayerName: disconnectedPlayer.name,
      timeLeft: RECONNECTION_VOTE_TIMEOUT / 1000,
    });

    // Set vote timeout - default to continuing without the player
    const voteTimer = setTimeout(() => {
      handleReconnectionVoteResult(
        context,
        roomCode,
        true,
        disconnectedPlayer.name,
        previousGameState
      );
    }, RECONNECTION_VOTE_TIMEOUT);

    context.reconnectionVoteTimers.set(roomCode, voteTimer);
  }, RECONNECTION_GRACE_PERIOD);

  context.disconnectionTimers.set(roomCode, timer);
}

function handleReconnectionVoteResult(
  context: SocketContext,
  roomCode: string,
  continueWithoutPlayer: boolean,
  disconnectedPlayerName: string,
  previousGameState: GameState
) {
  const room = context.rooms.get(roomCode);
  if (!room) return;

  // Clear vote timer
  if (context.reconnectionVoteTimers.has(roomCode)) {
    clearTimeout(context.reconnectionVoteTimers.get(roomCode)!);
    context.reconnectionVoteTimers.delete(roomCode);
  }

  // Notify all players of the vote result
  context.io.to(roomCode).emit("reconnectionVoteResult", {
    continueWithoutPlayer,
    disconnectedPlayerName,
  });

  if (continueWithoutPlayer) {
    // Remove disconnected player permanently and resume game
    if (room.disconnectedPlayers) {
      room.disconnectedPlayers = room.disconnectedPlayers.filter(
        (p) => p.name !== disconnectedPlayerName
      );
    }

    resumeGame(context, roomCode, previousGameState);
  } else {
    // Wait longer - restart the reconnection timer
    startReconnectionTimer(context, roomCode, previousGameState);
  }
}

function resumeGame(
  context: SocketContext,
  roomCode: string,
  previousGameState: GameState
) {
  const room = context.rooms.get(roomCode);
  if (!room) return;

  // Clear disconnection state
  room.gameState = previousGameState;
  room.pausedForDisconnection = false;
  room.disconnectionTimestamp = undefined;
  room.previousGameState = undefined;
  room.reconnectionVote = null;

  // Handle judge reassignment if needed
  if (
    room.currentJudge &&
    !room.players.find((p) => p.id === room.currentJudge)
  ) {
    room.currentJudge = selectNextJudge(room);
    context.io.to(roomCode).emit("judgeSelected", room.currentJudge);
  }

  // Notify players that game is resuming
  context.io.to(roomCode).emit("gameResumed");
  context.io.to(roomCode).emit("gameStateChanged", previousGameState);
  context.io.to(roomCode).emit("roomUpdated", room);

  // Restart game timers if needed
  if (previousGameState === GameState.SOUND_SELECTION) {
    // Only restart timer if it was already started before disconnection
    if (room.soundSelectionTimerStarted) {
      startDelayedSoundSelectionTimer(context, roomCode, room);
    }
  }
}

function handlePlayerReconnection(
  context: SocketContext,
  socket: Socket,
  roomCode: string,
  playerName: string,
  originalPlayerId: string
): boolean {
  const room = context.rooms.get(roomCode);
  if (!room || !room.disconnectedPlayers) return false;

  // Find the disconnected player
  const disconnectedPlayerIndex = room.disconnectedPlayers.findIndex(
    (p) => p.name === playerName && p.socketId === originalPlayerId
  );

  if (disconnectedPlayerIndex === -1) {
    console.log(
      `Disconnected player ${playerName} not found in room ${roomCode}`
    );
    return false;
  }

  const disconnectedPlayer = room.disconnectedPlayers[disconnectedPlayerIndex];

  // Remove from disconnected list
  room.disconnectedPlayers.splice(disconnectedPlayerIndex, 1);

  // Create new player object with new socket ID but preserving game state
  const reconnectedPlayer = {
    ...disconnectedPlayer,
    id: socket.id, // New socket ID
  };

  // Remove old socket ID references
  delete (reconnectedPlayer as { disconnectedAt?: number }).disconnectedAt;
  delete (reconnectedPlayer as { socketId?: string }).socketId;

  // Add back to active players
  room.players.push(reconnectedPlayer);

  // Update mappings
  context.playerRooms.set(socket.id, roomCode);
  socket.join(roomCode);

  console.log(
    `Player ${playerName} successfully reconnected to room ${roomCode}`
  );

  // If this was the last disconnected player, resume the game
  if (room.disconnectedPlayers.length === 0 && room.pausedForDisconnection) {
    clearDisconnectionTimer(context, roomCode);
    const gameStateToRestore =
      room.previousGameState || GameState.SOUND_SELECTION;
    console.log(
      `Restoring game state to: ${gameStateToRestore} (was paused at: ${room.previousGameState})`
    );
    resumeGame(context, roomCode, gameStateToRestore);
  }

  // Notify everyone about the reconnection
  context.io.to(roomCode).emit("playerReconnected", {
    playerId: socket.id,
    playerName: playerName,
  });

  context.io.to(roomCode).emit("roomUpdated", room);

  return true;
}

function removePlayerFromRoom(
  context: SocketContext,
  socketId: string,
  roomCode: string
) {
  const room = context.rooms.get(roomCode);
  if (!room) return;

  const player = room.players.find((p) => p.id === socketId);
  room.players = room.players.filter((p) => p.id !== socketId);
  context.playerRooms.delete(socketId);

  if (room.players.length === 0) {
    // Notify any connected main screens that the room is closing
    const roomMainScreens = context.mainScreens.get(roomCode);
    console.log(`[MAIN SCREEN] Removing main screens for room ${roomCode}`);
    console.log(`[MAIN SCREEN] Current main screens:`, roomMainScreens);
    if (roomMainScreens && roomMainScreens.size > 0) {
      console.log(
        `[MAIN SCREEN] Notifying ${roomMainScreens.size} main screen(s) that room ${roomCode} is closing`
      );
      // Send to all main screens in this room
      roomMainScreens.forEach((mainScreenId) => {
        context.io.to(mainScreenId).emit("roomClosed", { roomCode });
      });
      // Clean up main screen tracking
      context.mainScreens.delete(roomCode);
      context.primaryMainScreens.delete(roomCode);
    }

    context.rooms.delete(roomCode);
    clearTimer(context, roomCode);
    clearDisconnectionTimer(context, roomCode);
    console.log(`Room ${roomCode} closed due to no players.`);
    broadcastRoomListUpdate(context);
  } else {
    // Handle VIP or judge changes if necessary
    if (
      player?.isVIP &&
      room.players.length > 0 &&
      room.players.every((p) => !p.isVIP)
    ) {
      room.players[0].isVIP = true; // Assign VIP to the next player
    }
    if (
      room.currentJudge === socketId &&
      room.gameState !== GameState.LOBBY &&
      room.gameState !== GameState.GAME_OVER
    ) {
      room.currentJudge = selectNextJudge(room);
      context.io
        .to(roomCode)
        .emit("judgeSelected", room.currentJudge as string);
    }
    context.io.to(roomCode).emit("roomUpdated", room);
    context.io.to(roomCode).emit("playerLeft", socketId);
    broadcastRoomListUpdate(context);
  }
}

function clearDisconnectionTimer(context: SocketContext, roomCode: string) {
  if (context.disconnectionTimers.has(roomCode)) {
    clearTimeout(context.disconnectionTimers.get(roomCode)!);
    context.disconnectionTimers.delete(roomCode);
  }
  if (context.reconnectionVoteTimers.has(roomCode)) {
    clearTimeout(context.reconnectionVoteTimers.get(roomCode)!);
    context.reconnectionVoteTimers.delete(roomCode);
  }
}
