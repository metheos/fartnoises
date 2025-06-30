// Disconnection and reconnection event handlers for the fartnoises game server
import { Socket } from "socket.io";
import { GameState } from "@/types/game";
import {
  SocketContext,
  INITIAL_GRACE_PERIOD,
  RECONNECTION_GRACE_PERIOD,
  RECONNECTION_VOTE_TIMEOUT,
} from "../types/socketTypes";
import {
  selectNextJudge,
  broadcastRoomListUpdate,
  removeMainScreen,
} from "../utils/roomManager";
import { clearTimer, startTimer } from "../utils/timerManager";
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

  // If we're in lobby, handle immediately without grace period
  // During game over, preserve players for final scoring display
  if (room.gameState === GameState.LOBBY) {
    removePlayerFromRoom(context, socketId, roomCode);
    return;
  }

  // During game over, keep disconnected players visible but don't start reconnection process
  if (room.gameState === GameState.GAME_OVER) {
    console.log(
      `Player ${player.name} disconnected during game over - keeping visible in final results`
    );
    // Just remove from socket tracking but keep in players list for display
    context.playerRooms.delete(socketId);
    // Notify about disconnection but don't remove from room
    context.io.to(roomCode).emit("playerDisconnected", {
      playerId: socketId,
      playerName: player.name,
      canReconnect: false, // No reconnection during game over
    });
    return;
  }

  // Initialize disconnected players array if it doesn't exist
  if (!room.disconnectedPlayers) {
    room.disconnectedPlayers = [];
  }

  // Move player to disconnected list but don't pause game yet
  const disconnectedPlayer = {
    ...player,
    disconnectedAt: Date.now(),
    socketId: socketId,
  };

  room.disconnectedPlayers.push(disconnectedPlayer);
  room.players = room.players.filter((p) => p.id !== socketId);

  // Notify other players about the disconnection (but game continues)
  context.io.to(roomCode).emit("playerDisconnected", {
    playerId: socketId,
    playerName: player.name,
    canReconnect: true,
  });

  console.log(
    `Starting ${INITIAL_GRACE_PERIOD / 1000}s grace period for ${
      player.name
    } to reconnect without disrupting the game`
  );

  // Start grace period timer - only pause game if they don't reconnect in time
  const gracePeriodTimer = setTimeout(() => {
    console.log(
      `Grace period expired for ${player.name}. Pausing game for everyone.`
    );
    pauseGameForDisconnection(context, roomCode, player.name);
  }, INITIAL_GRACE_PERIOD);

  context.gracePeriodTimers.set(roomCode, gracePeriodTimer);
}

// New function to pause the game after grace period expires
function pauseGameForDisconnection(
  context: SocketContext,
  roomCode: string,
  disconnectedPlayerName: string
) {
  const room = context.rooms.get(roomCode);
  if (!room) return;

  // Check if player already reconnected during grace period
  if (
    !room.disconnectedPlayers?.some((p) => p.name === disconnectedPlayerName)
  ) {
    console.log(
      `Player ${disconnectedPlayerName} already reconnected during grace period. No need to pause game.`
    );
    return;
  }

  console.log(`Pausing game for disconnection of ${disconnectedPlayerName}`);

  // Now actually pause the game
  const previousGameState = room.gameState;
  room.gameState = GameState.PAUSED_FOR_DISCONNECTION;
  room.pausedForDisconnection = true;
  room.previousGameState = previousGameState;
  room.disconnectionTimestamp = Date.now();

  // Clear any existing game timers
  clearTimer(context, roomCode);

  // Notify all players that the game is now paused
  context.io.to(roomCode).emit("gamePausedForDisconnection", {
    disconnectedPlayerName: disconnectedPlayerName,
    timeLeft: RECONNECTION_GRACE_PERIOD / 1000,
  });

  context.io
    .to(roomCode)
    .emit("gameStateChanged", GameState.PAUSED_FOR_DISCONNECTION, {
      previousState: previousGameState,
      disconnectedPlayer: disconnectedPlayerName,
    });

  // Send updated room data to main screens
  const roomMainScreens = context.mainScreens.get(roomCode);
  if (roomMainScreens) {
    roomMainScreens.forEach((mainScreenId) => {
      context.io.to(mainScreenId).emit("roomUpdated", room);
    });
  }

  // Start the main reconnection timer (30 seconds)
  startReconnectionTimer(context, roomCode, previousGameState);
}

function startReconnectionTimer(
  context: SocketContext,
  roomCode: string,
  previousGameState: GameState
) {
  const room = context.rooms.get(roomCode);
  if (!room) return;

  console.log(
    `[RECONNECTION] Starting ${
      RECONNECTION_GRACE_PERIOD / 1000
    }s reconnection timer for room ${roomCode}`
  );

  // Use the proper timer system that sends updates to clients
  startTimer(
    context,
    roomCode,
    RECONNECTION_GRACE_PERIOD / 1000,
    () => {
      // Timer completed - start voting process
      const room = context.rooms.get(roomCode);
      if (!room || !room.pausedForDisconnection) return;

      const disconnectedPlayer = room.disconnectedPlayers?.[0];
      if (!disconnectedPlayer) {
        console.log(
          `[RECONNECTION] No disconnected players found in room ${roomCode}`
        );
        return;
      }

      // room.players should only contain connected players since disconnected ones are moved to disconnectedPlayers
      const connectedPlayers = room.players;
      console.log(
        `[RECONNECTION] Total players in room: ${
          room.players.length
        }, Disconnected players: ${room.disconnectedPlayers?.length || 0}`
      );

      if (connectedPlayers.length === 0) {
        console.log(
          `[RECONNECTION] No connected players left in room ${roomCode}, closing room`
        );
        // No connected players left, close room
        context.rooms.delete(roomCode);
        clearTimer(context, roomCode);
        clearDisconnectionTimer(context, roomCode);
        broadcastRoomListUpdate(context);
        return;
      }

      console.log(
        `[RECONNECTION] Reconnection timer expired for ${disconnectedPlayer.name}. Starting voting process.`
      );

      console.log(
        `[RECONNECTION] Connected players available for voting:`,
        connectedPlayers.map((p) => `${p.name} (${p.id})`)
      );

      // Select a random connected player to vote
      const randomVoter =
        connectedPlayers[Math.floor(Math.random() * connectedPlayers.length)];

      console.log(
        `[RECONNECTION] Selected voter: ${randomVoter.name} (${randomVoter.id})`
      );

      // Send vote request to the selected player
      context.io.to(randomVoter.id).emit("reconnectionVoteRequest", {
        disconnectedPlayerName: disconnectedPlayer.name,
        timeLeft: RECONNECTION_VOTE_TIMEOUT / 1000,
      });

      console.log(
        `[RECONNECTION] Sent reconnectionVoteRequest to ${
          randomVoter.name
        } for ${disconnectedPlayer.name}, timeout: ${
          RECONNECTION_VOTE_TIMEOUT / 1000
        }s`
      );

      // Set vote timeout - default to continuing without the player
      const voteTimer = setTimeout(() => {
        console.log(
          `[RECONNECTION] Vote timeout expired, continuing without ${disconnectedPlayer.name}`
        );
        handleReconnectionVoteResult(
          context,
          roomCode,
          true,
          disconnectedPlayer.name,
          previousGameState
        );
      }, RECONNECTION_VOTE_TIMEOUT);

      context.reconnectionVoteTimers.set(roomCode, voteTimer);
    },
    (timeLeft) => {
      // Send timer updates to all clients including main screens
      console.log(
        `[RECONNECTION] Timer update: ${timeLeft}s remaining for room ${roomCode}`
      );

      const room = context.rooms.get(roomCode);
      const disconnectedPlayer = room?.disconnectedPlayers?.[0];
      const disconnectedPlayerName =
        disconnectedPlayer?.name || "Unknown Player";

      // Send to all players in the room
      context.io.to(roomCode).emit("reconnectionTimeUpdate", {
        timeLeft,
        phase: "waiting_for_reconnection",
        disconnectedPlayerName,
      });

      // Also send to main screens
      const roomMainScreens = context.mainScreens.get(roomCode);
      if (roomMainScreens) {
        roomMainScreens.forEach((mainScreenId) => {
          context.io.to(mainScreenId).emit("reconnectionTimeUpdate", {
            timeLeft,
            phase: "waiting_for_reconnection",
            disconnectedPlayerName,
          });
        });
      }
    }
  );
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
    // Check if the disconnected player was the judge before removing them
    const disconnectedPlayer = room.disconnectedPlayers?.find(
      (p) => p.name === disconnectedPlayerName
    );
    const wasJudge =
      disconnectedPlayer && room.currentJudge === disconnectedPlayer.socketId;

    // Remove disconnected player permanently and resume game
    if (room.disconnectedPlayers) {
      room.disconnectedPlayers = room.disconnectedPlayers.filter(
        (p) => p.name !== disconnectedPlayerName
      );
    }

    console.log(
      `Players voted to continue without ${disconnectedPlayerName}. Stopping reconnection timer.`
    );
    clearTimer(context, roomCode); // Stop the reconnection timer
    resumeGame(context, roomCode, previousGameState, wasJudge);
  } else {
    // Wait longer - restart the reconnection timer
    console.log(
      `Players voted to wait longer for ${disconnectedPlayerName}. Restarting reconnection timer.`
    );
    clearTimer(context, roomCode); // Clear the old timer first
    // Don't reassign judge role yet, preserve it for potential reconnection
    startReconnectionTimer(context, roomCode, previousGameState);
  }
}

function resumeGame(
  context: SocketContext,
  roomCode: string,
  previousGameState: GameState,
  shouldReassignJudge: boolean = false
) {
  const room = context.rooms.get(roomCode);
  if (!room) return;

  // Clear disconnection state
  room.gameState = previousGameState;
  room.pausedForDisconnection = false;
  room.disconnectionTimestamp = undefined;
  room.previousGameState = undefined;
  room.reconnectionVote = null;

  // Handle judge reassignment only if explicitly requested (when voting to continue without judge)
  if (
    shouldReassignJudge &&
    room.currentJudge &&
    !room.players.find((p) => p.id === room.currentJudge)
  ) {
    console.log(
      `Reassigning judge role because players voted to continue without the disconnected judge`
    );
    room.currentJudge = selectNextJudge(room);
    context.io.to(roomCode).emit("judgeSelected", room.currentJudge);
  } else if (
    room.currentJudge &&
    !room.players.find((p) => p.id === room.currentJudge)
  ) {
    // Judge is disconnected but we're waiting for them - preserve their role
    console.log(
      `Preserving judge role for disconnected judge: ${room.currentJudge}`
    );
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

  // Check if we're still in grace period (game not paused yet)
  const isInGracePeriod =
    !room.pausedForDisconnection && context.gracePeriodTimers.has(roomCode);

  if (isInGracePeriod) {
    console.log(
      `${playerName} reconnected during grace period. Canceling grace period timer and restoring seamlessly.`
    );
    // Cancel the grace period timer
    clearTimeout(context.gracePeriodTimers.get(roomCode)!);
    context.gracePeriodTimers.delete(roomCode);
  }

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

  // Update judge role if this player was the judge
  if (room.currentJudge === disconnectedPlayer.socketId) {
    console.log(
      `Updating judge role from old socket ID ${disconnectedPlayer.socketId} to new socket ID ${socket.id}`
    );
    room.currentJudge = socket.id;
    // Notify all players that the judge has been updated (but it's the same person)
    context.io.to(roomCode).emit("judgeSelected", socket.id);
  }

  // Update mappings
  context.playerRooms.set(socket.id, roomCode);
  socket.join(roomCode);

  console.log(
    `Player ${playerName} successfully reconnected to room ${roomCode}`
  );

  if (isInGracePeriod) {
    // Grace period reconnection - seamless restore
    console.log(`Seamless reconnection during grace period for ${playerName}`);

    // Notify everyone about the reconnection
    context.io.to(roomCode).emit("playerReconnected", {
      playerId: socket.id,
      playerName: playerName,
    });

    context.io.to(roomCode).emit("roomUpdated", room);
  } else {
    // Game was already paused - handle normal reconnection flow

    // If this was the last disconnected player, resume the game
    if (room.disconnectedPlayers.length === 0 && room.pausedForDisconnection) {
      console.log(
        `All players reconnected. Stopping reconnection timer and resuming game.`
      );
      clearDisconnectionTimer(context, roomCode);
      clearTimer(context, roomCode); // Stop the reconnection timer
      const gameStateToRestore =
        room.previousGameState || GameState.SOUND_SELECTION;
      console.log(
        `Restoring game state to: ${gameStateToRestore} (was paused at: ${room.previousGameState})`
      );
      // Don't reassign judge when all players reconnect successfully
      resumeGame(context, roomCode, gameStateToRestore, false);
    }

    // Notify everyone about the reconnection
    context.io.to(roomCode).emit("playerReconnected", {
      playerId: socket.id,
      playerName: playerName,
    });

    context.io.to(roomCode).emit("roomUpdated", room);
  }

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
  if (context.gracePeriodTimers.has(roomCode)) {
    clearTimeout(context.gracePeriodTimers.get(roomCode)!);
    context.gracePeriodTimers.delete(roomCode);
  }
  if (context.disconnectionTimers.has(roomCode)) {
    clearTimeout(context.disconnectionTimers.get(roomCode)!);
    context.disconnectionTimers.delete(roomCode);
  }
  if (context.reconnectionVoteTimers.has(roomCode)) {
    clearTimeout(context.reconnectionVoteTimers.get(roomCode)!);
    context.reconnectionVoteTimers.delete(roomCode);
  }
}
