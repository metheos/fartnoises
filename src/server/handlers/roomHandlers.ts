// Room management event handlers for the fartnoises game server
import { Socket } from "socket.io";
import { Room, Player, GameState } from "@/types/game";
import { GAME_CONFIG } from "@/data/gameData";
import { SocketContext } from "../types/socketTypes";
import {
  generateRoomCode,
  getRandomColor,
  getRandomEmoji,
  selectNextJudge,
  broadcastRoomListUpdate,
  addMainScreen,
  removeMainScreen,
} from "../utils/roomManager";
import { clearTimer } from "../utils/timerManager";
import {
  addBotsIfNeeded,
  removeAllBots,
  checkAndHandleBotOnlyRoom,
} from "../utils/botManager";

export function setupRoomHandlers(socket: Socket, context: SocketContext) {
  // Create room handler
  socket.on("createRoom", (playerData, callback) => {
    console.log("createRoom event received with playerData:", playerData);
    try {
      let roomCode: string;
      do {
        roomCode = generateRoomCode();
      } while (context.rooms.has(roomCode));

      const player: Player = {
        id: socket.id,
        name: playerData.name,
        color: playerData.color || getRandomColor([]),
        emoji: playerData.emoji || getRandomEmoji([]),
        score: 0,
        likeScore: 0,
        isVIP: true,
      };
      const room: Room = {
        code: roomCode,
        players: [player],
        currentJudge: null,
        gameState: GameState.LOBBY,
        currentPrompt: null,
        currentRound: 0,
        maxRounds: GAME_CONFIG.DEFAULT_MAX_ROUNDS,
        maxScore: GAME_CONFIG.MAX_SCORE,
        allowExplicitContent: GAME_CONFIG.DEFAULT_ALLOW_EXPLICIT_CONTENT,
        submissions: [],
        winner: null,
        usedPromptIds: [],
        soundSelectionTimerStarted: false,
        judgeSelectionTimerStarted: false,
        promptChoices: [],
        lastWinner: null,
        lastWinningSubmission: null,
      };
      context.rooms.set(roomCode, room);
      context.playerRooms.set(socket.id, roomCode);
      socket.join(roomCode);

      // Add bots if needed to reach minimum player count
      addBotsIfNeeded(context, room);

      console.log("Calling callback with roomCode:", roomCode);
      callback(roomCode);
      console.log("Emitting roomCreated event with room and player");
      socket.emit("roomCreated", { room, player });
      broadcastRoomListUpdate(context);
    } catch (error) {
      console.error("Error creating room:", error);
      socket.emit("error", { message: "Failed to create room" });
    }
  });

  // Join room handler
  socket.on("joinRoom", (roomCode, playerData, callback) => {
    try {
      const room = context.rooms.get(roomCode.toUpperCase());

      if (!room) {
        callback(false);
        return;
      }

      if (room.players.length >= GAME_CONFIG.MAX_PLAYERS) {
        callback(false);
        return;
      }

      if (room.gameState !== GameState.LOBBY) {
        callback(false);
        return;
      }

      const usedColors = room.players.map((p) => p.color);
      const usedEmojis = room.players
        .map((p) => p.emoji)
        .filter(Boolean) as string[];
      const player: Player = {
        id: socket.id,
        name: playerData.name,
        color: playerData.color || getRandomColor(usedColors),
        emoji: playerData.emoji || getRandomEmoji(usedEmojis),
        score: 0,
        likeScore: 0,
        isVIP: false,
      };
      room.players.push(player);
      context.playerRooms.set(socket.id, roomCode);
      socket.join(roomCode);

      // Manage bots when a new human player joins
      const humanPlayers = room.players.filter((p) => !p.isBot);

      if (humanPlayers.length >= 3) {
        // Remove all bots if we now have 3+ human players
        removeAllBots(context, room);
      } else {
        // Add bots if we have fewer than 3 human players
        addBotsIfNeeded(context, room);
      }

      // Check if room no longer only has bots and clear destruction timer if needed
      checkAndHandleBotOnlyRoom(context, room);

      callback(true);
      socket.emit("roomJoined", { room, player });
      context.io.to(roomCode).emit("roomUpdated", room);
      context.io.to(roomCode).emit("playerJoined", { room });
      broadcastRoomListUpdate(context);
    } catch (error) {
      console.error("Error joining room:", error);
      callback(false);
    }
  });

  // Update game settings handler
  socket.on("updateGameSettings", (settings) => {
    try {
      const roomCode = context.playerRooms.get(socket.id);
      if (!roomCode) return;

      const room = context.rooms.get(roomCode);
      if (!room) return;

      const player = room.players.find((p) => p.id === socket.id);
      if (!player?.isVIP) {
        socket.emit("error", {
          message: "Only the VIP can change game settings",
        });
        return;
      }

      if (room.gameState !== GameState.LOBBY) {
        socket.emit("error", {
          message: "Game settings can only be changed in the lobby",
        });
        return;
      }

      // Validate settings
      const { maxRounds, maxScore, allowExplicitContent } = settings;
      if (
        !Number.isInteger(maxRounds) ||
        maxRounds < 1 ||
        maxRounds > 20 ||
        !Number.isInteger(maxScore) ||
        maxScore < 1 ||
        maxScore > 10 ||
        typeof allowExplicitContent !== "boolean"
      ) {
        socket.emit("error", {
          message:
            "Invalid game settings. Rounds: 1-20, Score: 1-10, Explicit: true/false",
        });
        return;
      }

      // Update room settings
      room.maxRounds = maxRounds;
      room.maxScore = maxScore;
      room.allowExplicitContent = allowExplicitContent;

      console.log(
        `VIP ${player.name} updated game settings for room ${roomCode}: maxRounds=${maxRounds}, maxScore=${maxScore}, allowExplicitContent=${allowExplicitContent}`
      );

      // Notify all players in the room
      context.io.to(roomCode).emit("gameSettingsUpdated", {
        maxRounds,
        maxScore,
        allowExplicitContent,
      });
      context.io.to(roomCode).emit("roomUpdated", room);
    } catch (error) {
      console.error("Error updating game settings:", error);
      socket.emit("error", { message: "Failed to update game settings" });
    }
  });

  // Leave room handler
  socket.on("leaveRoom", () => {
    try {
      const roomCode = context.playerRooms.get(socket.id);
      if (roomCode) {
        const room = context.rooms.get(roomCode);
        if (room) {
          // Check if this is a main screen leaving
          // Socket augmentation for custom properties - proper interface extension would require module declaration
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((socket as any).isViewer) {
            console.log(
              `[MAIN SCREEN] Main screen ${socket.id} leaving room ${roomCode}`
            );
            removeMainScreen(context, roomCode, socket.id);
            context.playerRooms.delete(socket.id);
            socket.leave(roomCode);
          } else {
            // Regular player leaving
            const wasBot = room.players.find((p) => p.id === socket.id)?.isBot;
            room.players = room.players.filter((p) => p.id !== socket.id);
            context.playerRooms.delete(socket.id);
            socket.leave(roomCode);

            if (room.players.length === 0) {
              context.rooms.delete(roomCode);
              clearTimer(context, roomCode);
              // Clean up main screen tracking too
              context.mainScreens.delete(roomCode);
              context.primaryMainScreens.delete(roomCode);
              console.log(`Room ${roomCode} closed as it's empty.`);
            } else {
              // If a human player left (not a bot), manage bot count
              if (!wasBot) {
                const humanPlayers = room.players.filter((p) => !p.isBot);

                // If we have 3+ humans, remove all bots
                if (humanPlayers.length >= 3) {
                  removeAllBots(context, room);
                }
                // If we have 1-2 humans, ensure we have enough bots to reach 3 total
                else if (humanPlayers.length > 0) {
                  // First remove all existing bots, then add the right number
                  removeAllBots(context, room);
                  addBotsIfNeeded(context, room);
                }
                // If no humans left, remove all bots too (room will close)
                else {
                  removeAllBots(context, room);
                }

                // Check if room now only has bots and start destruction timer if needed
                checkAndHandleBotOnlyRoom(context, room);
              }

              // If room still active, select new VIP if old one left, or new judge
              if (
                room.players.every((p) => !p.isVIP) &&
                room.players.length > 0
              ) {
                room.players[0].isVIP = true;
              }
              if (room.currentJudge === socket.id) {
                room.currentJudge = selectNextJudge(room);
                context.io
                  .to(roomCode)
                  .emit("judgeSelected", room.currentJudge as string);
              }
              context.io.to(roomCode).emit("roomUpdated", room);
            }
          }

          context.io.to(roomCode).emit("playerLeft", socket.id);
          broadcastRoomListUpdate(context);
        }
      }
    } catch (error) {
      console.error("Error leaving room:", error);
      socket.emit("error", { message: "Failed to leave room" });
    }
  });

  // Join room as viewer (main screen) handler
  socket.on("joinRoomAsViewer", (roomCode) => {
    try {
      const normalizedRoomCode = roomCode.toUpperCase();
      const room = context.rooms.get(normalizedRoomCode);
      if (room) {
        console.log(
          `[VIEWER] Main screen ${socket.id} joining room ${normalizedRoomCode} as viewer`
        );
        socket.join(normalizedRoomCode);

        // Add viewer to playerRooms map so they can emit events for this room
        context.playerRooms.set(socket.id, normalizedRoomCode);

        // Track this main screen and potentially elect as primary
        addMainScreen(context, normalizedRoomCode, socket.id);

        // Verify the join worked
        const roomMembers =
          context.io.sockets.adapter.rooms.get(normalizedRoomCode);
        console.log(
          `[VIEWER] After join, room ${normalizedRoomCode} has ${
            roomMembers?.size || 0
          } members`
        );
        console.log(
          `[VIEWER] Socket ${socket.id} is now in room ${normalizedRoomCode}`
        );

        // Socket augmentation for custom properties - proper interface extension would require module declaration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (socket as any).isViewer = true; // Mark this socket as a viewer
        // Socket augmentation for custom properties - proper interface extension would require module declaration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (socket as any).isPrimaryMainScreen =
          context.primaryMainScreens.get(normalizedRoomCode) === socket.id; // Mark if primary

        socket.emit("roomJoined", room);
      } else {
        console.log(
          `[VIEWER] Room ${normalizedRoomCode} not found for main screen`
        );
        socket.emit("error", {
          message: `Room ${normalizedRoomCode} not found`,
        });
      }
    } catch (error) {
      console.error("Error joining room as viewer:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  // Request main screen update handler
  socket.on("requestMainScreenUpdate", () => {
    try {
      const roomsArray = Array.from(context.rooms.values())
        .map((room) => ({
          ...room,
          // Only include rooms that have players
        }))
        .filter((room) => room.players.length > 0);

      console.log(
        `Main screen update requested, sending ${roomsArray.length} active rooms`
      );
      socket.emit("mainScreenUpdate", { rooms: roomsArray });
    } catch (error) {
      console.error("Error handling main screen update:", error);
    }
  });
}
