// Socket server setup for Next.js API routes
import { NextApiRequest } from "next";
import { Server as NetServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import {
  Room,
  Player,
  GameState,
  ServerToClientEvents,
  ClientToServerEvents,
} from "@/types/game";
import {
  GAME_PROMPTS,
  SOUND_EFFECTS,
  PLAYER_COLORS,
  GAME_CONFIG,
} from "@/data/gameData";

interface SocketServer extends NetServer {
  io?: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
}

interface SocketApiResponse {
  socket: {
    server: SocketServer;
  };
  json: (data: unknown) => void;
  status: (code: number) => SocketApiResponse;
  end: () => void;
}

// In-memory storage for rooms (in production, use Redis or database)
const rooms: Map<string, Room> = new Map();
const playerRooms: Map<string, string> = new Map(); // socketId -> roomCode

// Utility functions
function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < GAME_CONFIG.ROOM_CODE_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getRandomColor(usedColors: string[]): string {
  const availableColors = PLAYER_COLORS.filter(
    (color) => !usedColors.includes(color)
  );
  return availableColors.length > 0
    ? availableColors[Math.floor(Math.random() * availableColors.length)]
    : PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
}

function selectNextJudge(room: Room): string {
  const playerIds = room.players.map((p) => p.id);
  if (!room.currentJudge) {
    return playerIds[0];
  }

  const currentIndex = playerIds.indexOf(room.currentJudge);
  const nextIndex = (currentIndex + 1) % playerIds.length;
  return playerIds[nextIndex];
}

function getRandomPrompts(count: number = 3) {
  const shuffled = [...GAME_PROMPTS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getRandomSounds(count: number = 10) {
  const shuffled = [...SOUND_EFFECTS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export default function SocketHandler(
  req: NextApiRequest,
  res: SocketApiResponse
) {
  if (res.socket.server.io) {
    console.log("Socket is already running");
  } else {
    console.log("Socket is initializing");
    const io = new SocketIOServer(res.socket.server, {
      path: "/api/socket",
      addTrailingSlash: false,
    });
    res.socket.server.io = io;

    io.on("connection", (socket) => {
      console.log(`Client connected: ${socket.id}`);
      socket.on("createRoom", (playerName, callback) => {
        console.log("createRoom event received with playerName:", playerName);
        try {
          let roomCode: string;
          do {
            roomCode = generateRoomCode();
          } while (rooms.has(roomCode));

          const player: Player = {
            id: socket.id,
            name: playerName,
            color: getRandomColor([]),
            score: 0,
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
            submissions: [],
            winner: null,
          };
          rooms.set(roomCode, room);
          playerRooms.set(socket.id, roomCode);
          socket.join(roomCode);

          console.log("Calling callback with roomCode:", roomCode);
          callback(roomCode);
          console.log("Emitting roomCreated event with room and player");
          socket.emit("roomCreated", { room, player });
        } catch (error) {
          console.error("Error creating room:", error);
          socket.emit("error", { message: "Failed to create room" });
        }
      });

      socket.on("joinRoom", (roomCode, playerName, callback) => {
        try {
          const room = rooms.get(roomCode.toUpperCase());

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
          const player: Player = {
            id: socket.id,
            name: playerName,
            color: getRandomColor(usedColors),
            score: 0,
            isVIP: false,
          };
          room.players.push(player);
          playerRooms.set(socket.id, roomCode);
          socket.join(roomCode);

          callback(true);
          socket.emit("roomJoined", { room, player });
          io.to(roomCode).emit("roomUpdated", room);
          io.to(roomCode).emit("playerJoined", { room });
        } catch (error) {
          console.error("Error joining room:", error);
          callback(false);
        }
      });

      socket.on("startGame", () => {
        try {
          const roomCode = playerRooms.get(socket.id);
          if (!roomCode) return;

          const room = rooms.get(roomCode);
          if (!room) return;

          const player = room.players.find((p) => p.id === socket.id);
          if (!player?.isVIP) return;

          if (room.players.length < GAME_CONFIG.MIN_PLAYERS) {
            socket.emit(
              "error",
              `Need at least ${GAME_CONFIG.MIN_PLAYERS} players to start`
            );
            return;
          }

          room.gameState = GameState.JUDGE_SELECTION;
          room.currentJudge = selectNextJudge(room);
          room.currentRound = 1;

          io.to(roomCode).emit("roomUpdated", room);
          io.to(roomCode).emit("judgeSelected", room.currentJudge);
          io.to(roomCode).emit("gameStateChanged", GameState.JUDGE_SELECTION, {
            judgeId: room.currentJudge,
          }); // Auto-transition to prompt selection after a delay
          setTimeout(() => {
            if (room.gameState === GameState.JUDGE_SELECTION) {
              room.gameState = GameState.PROMPT_SELECTION;
              const prompts = getRandomPrompts(3);
              io.to(roomCode).emit(
                "gameStateChanged",
                GameState.PROMPT_SELECTION,
                { prompts, judgeId: room.currentJudge }
              );
            }
          }, 3000);
        } catch (error) {
          console.error("Error starting game:", error);
        }
      });

      socket.on("selectPrompt", (promptId) => {
        try {
          const roomCode = playerRooms.get(socket.id);
          if (!roomCode) return;

          const room = rooms.get(roomCode);
          if (!room || room.currentJudge !== socket.id) return;

          const prompt = GAME_PROMPTS.find((p) => p.id === promptId);
          if (!prompt) return;

          room.currentPrompt = prompt.text;
          room.gameState = GameState.SOUND_SELECTION;
          room.submissions = [];

          const soundOptions = getRandomSounds(12);

          io.to(roomCode).emit("roomUpdated", room);
          io.to(roomCode).emit("promptSelected", prompt.text);
          io.to(roomCode).emit("gameStateChanged", GameState.SOUND_SELECTION, {
            prompt: prompt.text,
            sounds: soundOptions,
            timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
          });
        } catch (error) {
          console.error("Error selecting prompt:", error);
        }
      });

      socket.on("submitSounds", (sounds) => {
        try {
          const roomCode = playerRooms.get(socket.id);
          if (!roomCode) return;

          const room = rooms.get(roomCode);
          if (!room || room.gameState !== GameState.SOUND_SELECTION) return;

          const player = room.players.find((p) => p.id === socket.id);
          if (!player || socket.id === room.currentJudge) return;

          // Check if player already submitted
          const existingSubmission = room.submissions.find(
            (s) => s.playerId === socket.id
          );
          if (existingSubmission) return;

          const submission = {
            playerId: socket.id,
            playerName: player.name,
            sounds: sounds,
          };

          room.submissions.push(submission);
          io.to(roomCode).emit("soundSubmitted", submission);

          // Check if all non-judge players have submitted
          const nonJudgePlayers = room.players.filter(
            (p) => p.id !== room.currentJudge
          );
          if (room.submissions.length === nonJudgePlayers.length) {
            room.gameState = GameState.PLAYBACK;
            io.to(roomCode).emit("gameStateChanged", GameState.PLAYBACK, {
              submissions: room.submissions,
            });

            // Auto-transition to judging after playback
            setTimeout(() => {
              if (room.gameState === GameState.PLAYBACK) {
                room.gameState = GameState.JUDGING;
                io.to(roomCode).emit("gameStateChanged", GameState.JUDGING, {
                  submissions: room.submissions,
                  judgeId: room.currentJudge,
                });
              }
            }, room.submissions.length * 3000 + 2000); // Time for all sounds to play
          }
        } catch (error) {
          console.error("Error submitting sounds:", error);
        }
      });

      socket.on("selectWinner", (submissionIndex) => {
        try {
          const roomCode = playerRooms.get(socket.id);
          if (!roomCode) return;

          const room = rooms.get(roomCode);
          if (
            !room ||
            room.currentJudge !== socket.id ||
            room.gameState !== GameState.JUDGING
          )
            return;

          const winningSubmission = room.submissions[parseInt(submissionIndex)];
          if (!winningSubmission) return;

          const winner = room.players.find(
            (p) => p.id === winningSubmission.playerId
          );
          if (!winner) return;

          winner.score += 1;
          room.gameState = GameState.ROUND_RESULTS;

          io.to(roomCode).emit("roundComplete", winner.id, winner.name);
          io.to(roomCode).emit("roomUpdated", room);

          // Check if game is complete
          const maxScore = Math.max(...room.players.map((p) => p.score));
          const gameWinners = room.players.filter((p) => p.score === maxScore);

          if (
            room.currentRound >= room.maxRounds ||
            maxScore >= Math.ceil(room.maxRounds / 2)
          ) {
            room.gameState = GameState.GAME_OVER;
            room.winner = gameWinners[0].id;
            io.to(roomCode).emit(
              "gameComplete",
              gameWinners[0].id,
              gameWinners[0].name
            );
          } else {
            // Start next round
            setTimeout(() => {
              room.currentRound += 1;
              room.currentJudge = selectNextJudge(room);
              room.gameState = GameState.JUDGE_SELECTION;
              room.currentPrompt = null;
              room.submissions = [];

              io.to(roomCode).emit("judgeSelected", room.currentJudge);
              io.to(roomCode).emit(
                "gameStateChanged",
                GameState.JUDGE_SELECTION,
                { judgeId: room.currentJudge }
              );

              // Auto-transition to prompt selection
              setTimeout(() => {
                if (room.gameState === GameState.JUDGE_SELECTION) {
                  room.gameState = GameState.PROMPT_SELECTION;
                  const prompts = getRandomPrompts(3);
                  io.to(roomCode).emit(
                    "gameStateChanged",
                    GameState.PROMPT_SELECTION,
                    { prompts, judgeId: room.currentJudge }
                  );
                }
              }, 3000);
            }, 5000);
          }
        } catch (error) {
          console.error("Error selecting winner:", error);
        }
      });

      socket.on("disconnect", () => {
        try {
          const roomCode = playerRooms.get(socket.id);
          if (roomCode) {
            const room = rooms.get(roomCode);
            if (room) {
              room.players = room.players.filter((p) => p.id !== socket.id);

              if (room.players.length === 0) {
                rooms.delete(roomCode);
              } else {
                // Reassign VIP if needed
                if (!room.players.some((p) => p.isVIP)) {
                  room.players[0].isVIP = true;
                }

                // Handle judge leaving
                if (
                  room.currentJudge === socket.id &&
                  room.gameState !== GameState.LOBBY
                ) {
                  room.currentJudge = selectNextJudge(room);
                  io.to(roomCode).emit("judgeSelected", room.currentJudge);
                }

                io.to(roomCode).emit("roomUpdated", room);
                io.to(roomCode).emit("playerLeft", socket.id);
              }
            }
            playerRooms.delete(socket.id);
          }
        } catch (error) {
          console.error("Error handling disconnect:", error);
        }
      });
    });
  }
  res.end();
}
