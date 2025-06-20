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
  getSoundEffects,
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
const roomTimers: Map<string, NodeJS.Timeout> = new Map(); // roomCode -> timer
const disconnectionTimers: Map<string, NodeJS.Timeout> = new Map(); // roomCode -> disconnection timer
const reconnectionVoteTimers: Map<string, NodeJS.Timeout> = new Map(); // roomCode -> vote timer

// Constants for disconnection handling
const RECONNECTION_GRACE_PERIOD = 30000; // 30 seconds
const RECONNECTION_VOTE_TIMEOUT = 20000; // 20 seconds to vote

// Helper function to broadcast the list of rooms
function broadcastRoomListUpdate(
  ioInstance: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
) {
  const roomsArray = Array.from(rooms.values()).filter(
    (room) => room.players.length > 0
  ); // Only show rooms with players
  ioInstance.emit("mainScreenUpdate", { rooms: roomsArray });
}

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

async function getRandomSounds(count: number = 10) {
  try {
    const soundEffects = await getSoundEffects();
    const shuffled = [...soundEffects].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  } catch (error) {
    console.error("Failed to load sounds for random selection:", error);
    return [];
  }
}

// Timer utility functions
function startTimer(
  roomCode: string,
  duration: number,
  onComplete: () => void,
  onTick?: (timeLeft: number) => void
) {
  // Clear any existing timer
  clearTimer(roomCode);

  let timeLeft = duration;

  const timer = setInterval(() => {
    timeLeft--;

    if (onTick) {
      onTick(timeLeft);
    }

    if (timeLeft <= 0) {
      clearTimer(roomCode);
      onComplete();
    }
  }, 1000);

  roomTimers.set(roomCode, timer);

  // Send initial time
  if (onTick) {
    onTick(timeLeft);
  }
}

function clearTimer(roomCode: string) {
  const timer = roomTimers.get(roomCode);
  if (timer) {
    clearInterval(timer);
    roomTimers.delete(roomCode);
  }
}

function startSoundSelectionTimer(
  roomCode: string,
  room: Room,
  io: SocketIOServer
) {
  startTimer(
    roomCode,
    GAME_CONFIG.SOUND_SELECTION_TIME,
    () => {
      // Auto-transition to judging if time runs out
      if (room.gameState === GameState.SOUND_SELECTION) {
        room.gameState = GameState.JUDGING;
        io.to(roomCode).emit("gameStateChanged", GameState.JUDGING, {
          submissions: room.submissions,
          judgeId: room.currentJudge,
        });
      }
    },
    (timeLeft) => {
      io.to(roomCode).emit("timeUpdate", { timeLeft });
    }
  );
}

// Disconnection handling utility functions
function handlePlayerDisconnection(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socketId: string,
  roomCode: string
) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const player = room.players.find((p) => p.id === socketId);
  if (!player) return;

  console.log(`Player ${player.name} disconnected from room ${roomCode}`);

  // If we're in lobby or game over, handle immediately without grace period
  if (
    room.gameState === GameState.LOBBY ||
    room.gameState === GameState.GAME_OVER
  ) {
    removePlayerFromRoom(io, socketId, roomCode);
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
  room.disconnectionTimestamp = Date.now();

  // Clear any existing game timers
  clearTimer(roomCode);

  // Notify all players about the disconnection
  io.to(roomCode).emit("playerDisconnected", {
    playerId: socketId,
    playerName: player.name,
    canReconnect: true,
  });

  io.to(roomCode).emit("gamePausedForDisconnection", {
    disconnectedPlayerName: player.name,
    timeLeft: RECONNECTION_GRACE_PERIOD / 1000,
  });

  io.to(roomCode).emit("gameStateChanged", GameState.PAUSED_FOR_DISCONNECTION, {
    previousState: previousGameState,
    disconnectedPlayer: player.name,
  });

  // Start reconnection grace period timer
  startReconnectionTimer(io, roomCode, previousGameState);
}

function startReconnectionTimer(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  roomCode: string,
  previousGameState: GameState
) {
  // Clear any existing disconnection timer
  if (disconnectionTimers.has(roomCode)) {
    clearTimeout(disconnectionTimers.get(roomCode)!);
  }

  const timer = setTimeout(() => {
    const room = rooms.get(roomCode);
    if (!room || !room.pausedForDisconnection) return;

    // Grace period expired, start voting process
    startReconnectionVote(io, roomCode, previousGameState);
  }, RECONNECTION_GRACE_PERIOD);

  disconnectionTimers.set(roomCode, timer);
}

function startReconnectionVote(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  roomCode: string,
  previousGameState: GameState
) {
  const room = rooms.get(roomCode);
  if (!room || !room.disconnectedPlayers?.length) return;

  const disconnectedPlayer = room.disconnectedPlayers[0]; // Handle first disconnected player
  const connectedPlayers = room.players.filter((p) => !p.isDisconnected);

  if (connectedPlayers.length === 0) {
    // No connected players left, close room
    rooms.delete(roomCode);
    clearTimer(roomCode);
    clearDisconnectionTimer(roomCode);
    broadcastRoomListUpdate(io);
    return;
  }

  // Select a random connected player to vote
  const randomVoter =
    connectedPlayers[Math.floor(Math.random() * connectedPlayers.length)];

  // Send vote request to the selected player
  io.to(randomVoter.id).emit("reconnectionVoteRequest", {
    disconnectedPlayerName: disconnectedPlayer.name,
    timeLeft: RECONNECTION_VOTE_TIMEOUT / 1000,
  });

  // Set vote timeout
  const voteTimer = setTimeout(() => {
    // No vote received, default to continuing without the player
    handleReconnectionVoteResult(
      io,
      roomCode,
      true,
      disconnectedPlayer.name,
      previousGameState
    );
  }, RECONNECTION_VOTE_TIMEOUT);

  reconnectionVoteTimers.set(roomCode, voteTimer);
}

function handleReconnectionVoteResult(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  roomCode: string,
  continueWithoutPlayer: boolean,
  disconnectedPlayerName: string,
  previousGameState: GameState
) {
  const room = rooms.get(roomCode);
  if (!room) return;

  // Clear vote timer
  if (reconnectionVoteTimers.has(roomCode)) {
    clearTimeout(reconnectionVoteTimers.get(roomCode)!);
    reconnectionVoteTimers.delete(roomCode);
  }

  // Notify all players of the vote result
  io.to(roomCode).emit("reconnectionVoteResult", {
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

    resumeGame(io, roomCode, previousGameState);
  } else {
    // Wait longer - restart the reconnection timer
    startReconnectionTimer(io, roomCode, previousGameState);
  }
}

function resumeGame(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  roomCode: string,
  previousGameState: GameState
) {
  const room = rooms.get(roomCode);
  if (!room) return;

  // Clear disconnection state
  room.gameState = previousGameState;
  room.pausedForDisconnection = false;
  room.disconnectionTimestamp = undefined;
  room.reconnectionVote = null;

  // Handle judge reassignment if needed
  if (
    room.currentJudge &&
    !room.players.find((p) => p.id === room.currentJudge)
  ) {
    room.currentJudge = selectNextJudge(room);
    io.to(roomCode).emit("judgeSelected", room.currentJudge);
  }

  // Notify players that game is resuming
  io.to(roomCode).emit("gameResumed");
  io.to(roomCode).emit("gameStateChanged", previousGameState);
  io.to(roomCode).emit("roomUpdated", room);
  // Restart game timers if needed
  if (previousGameState === GameState.SOUND_SELECTION) {
    startSoundSelectionTimer(roomCode, room, io);
  }
  // Note: Add other timer restarts as needed based on game state
}

function handlePlayerReconnection(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: any,
  roomCode: string,
  playerName: string,
  originalPlayerId: string
): boolean {
  const room = rooms.get(roomCode);
  if (!room || !room.disconnectedPlayers) return false;

  const disconnectedPlayer = room.disconnectedPlayers.find(
    (p) => p.name === playerName && p.socketId === originalPlayerId
  );

  if (!disconnectedPlayer) return false;

  console.log(`Player ${playerName} reconnecting to room ${roomCode}`);

  // Remove from disconnected list and add back to active players
  room.disconnectedPlayers = room.disconnectedPlayers.filter(
    (p) => p.socketId !== originalPlayerId
  );
  const reconnectedPlayer: Player = {
    id: socket.id, // Update with new socket ID
    name: disconnectedPlayer.name,
    color: disconnectedPlayer.color,
    score: disconnectedPlayer.score,
    isVIP: disconnectedPlayer.isVIP,
    isDisconnected: false,
  };

  room.players.push(reconnectedPlayer);
  playerRooms.set(socket.id, roomCode);

  // If no more disconnected players, resume the game
  if (room.disconnectedPlayers.length === 0 && room.pausedForDisconnection) {
    const previousGameState = room.gameState; // This should be PAUSED_FOR_DISCONNECTION
    // We need to restore the actual previous game state - this would require tracking it
    // For now, let's assume we can determine it from context or add tracking
    resumeGame(io, roomCode, GameState.SOUND_SELECTION); // Default to sound selection for now
  }

  // Notify everyone about the reconnection
  io.to(roomCode).emit("playerReconnected", {
    playerId: socket.id,
    playerName: playerName,
  });

  io.to(roomCode).emit("roomUpdated", room);

  return true;
}

function removePlayerFromRoom(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socketId: string,
  roomCode: string
) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const player = room.players.find((p) => p.id === socketId);
  room.players = room.players.filter((p) => p.id !== socketId);
  playerRooms.delete(socketId);

  if (room.players.length === 0) {
    rooms.delete(roomCode);
    clearTimer(roomCode);
    clearDisconnectionTimer(roomCode);
    console.log(`Room ${roomCode} closed due to no players.`);
    broadcastRoomListUpdate(io);
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
      io.to(roomCode).emit("judgeSelected", room.currentJudge as string);
    }
    io.to(roomCode).emit("roomUpdated", room);
    io.to(roomCode).emit("playerLeft", socketId);
    broadcastRoomListUpdate(io);
  }
}

function clearDisconnectionTimer(roomCode: string) {
  if (disconnectionTimers.has(roomCode)) {
    clearTimeout(disconnectionTimers.get(roomCode)!);
    disconnectionTimers.delete(roomCode);
  }
  if (reconnectionVoteTimers.has(roomCode)) {
    clearTimeout(reconnectionVoteTimers.get(roomCode)!);
    reconnectionVoteTimers.delete(roomCode);
  }
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
      // Send current room list to newly connected client
      broadcastRoomListUpdate(io); // Send to all, or use socket.emit to send only to the new client if preferred

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
          // Broadcast updated room list to all clients
          broadcastRoomListUpdate(io);
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
          // Broadcast to all main screens so they can see the updated player count
          broadcastRoomListUpdate(io);
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
          });

          // Auto-transition to prompt selection after a delay
          setTimeout(() => {
            if (room.gameState === GameState.JUDGE_SELECTION) {
              room.gameState = GameState.PROMPT_SELECTION;
              const prompts = getRandomPrompts(3);
              room.availablePrompts = prompts;

              io.to(roomCode).emit(
                "gameStateChanged",
                GameState.PROMPT_SELECTION,
                {
                  prompts,
                  judgeId: room.currentJudge,
                  timeLimit: GAME_CONFIG.PROMPT_SELECTION_TIME,
                }
              );

              // Start countdown timer for prompt selection
              startTimer(
                roomCode,
                GAME_CONFIG.PROMPT_SELECTION_TIME,
                () => {
                  // Auto-select first prompt if no selection made
                  if (room.gameState === GameState.PROMPT_SELECTION) {
                    const firstPrompt = prompts[0];
                    room.currentPrompt = firstPrompt.text;
                    room.gameState = GameState.SOUND_SELECTION;
                    room.submissions = [];

                    const soundOptions = getRandomSounds(12);

                    io.to(roomCode).emit("roomUpdated", room);
                    io.to(roomCode).emit("promptSelected", firstPrompt.text);
                    io.to(roomCode).emit(
                      "gameStateChanged",
                      GameState.SOUND_SELECTION,
                      {
                        prompt: firstPrompt.text,
                        sounds: soundOptions,
                        timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
                      }
                    );

                    // Start sound selection timer
                    startSoundSelectionTimer(roomCode, room, io);
                  }
                },
                (timeLeft) => {
                  io.to(roomCode).emit("timeUpdate", { timeLeft });
                }
              );
            }
          }, 3000);
        } catch (error) {
          console.error("Error starting game:", error);
        }
      });
      socket.on("selectPrompt", (promptId) => {
        console.log(
          `🎯 SERVER: selectPrompt received from ${socket.id} with promptId: ${promptId}`
        );
        try {
          const roomCode = playerRooms.get(socket.id);
          console.log(`🎯 SERVER: Player room lookup - roomCode: ${roomCode}`);
          if (!roomCode) {
            console.log(`🎯 SERVER: No room found for socket ${socket.id}`);
            return;
          }

          const room = rooms.get(roomCode);
          console.log(`🎯 SERVER: Room lookup - room exists: ${!!room}`);
          if (!room) {
            console.log(`🎯 SERVER: Room ${roomCode} not found`);
            return;
          }

          console.log(
            `🎯 SERVER: Current judge: ${room.currentJudge}, Socket ID: ${
              socket.id
            }, Match: ${room.currentJudge === socket.id}`
          );
          if (room.currentJudge !== socket.id) {
            console.log(
              `🎯 SERVER: Judge validation failed - current judge: ${room.currentJudge}, socket: ${socket.id}`
            );
            return;
          }

          // Use available prompts from room if they exist, otherwise fallback to finding by ID
          let prompt;
          if (room.availablePrompts) {
            prompt = room.availablePrompts.find((p) => p.id === promptId);
          } else {
            prompt = GAME_PROMPTS.find((p) => p.id === promptId);
          }

          console.log(
            `🎯 SERVER: Prompt lookup - found: ${!!prompt}, promptId: ${promptId}`
          );
          if (!prompt) {
            console.log(`🎯 SERVER: Prompt ${promptId} not found`);
            return;
          }

          // Clear the prompt selection timer since judge made a manual selection
          clearTimer(roomCode);

          console.log(
            `🎯 SERVER: All validations passed, updating room state to SOUND_SELECTION`
          );
          room.currentPrompt = prompt.text;
          room.gameState = GameState.SOUND_SELECTION;
          room.submissions = [];

          const soundOptions = getRandomSounds(12);

          console.log(`🎯 SERVER: Emitting room updates for ${roomCode}`);
          io.to(roomCode).emit("roomUpdated", room);
          io.to(roomCode).emit("promptSelected", prompt.text);
          io.to(roomCode).emit("gameStateChanged", GameState.SOUND_SELECTION, {
            prompt: prompt.text,
            sounds: soundOptions,
            timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
          });

          // Start sound selection timer
          startSoundSelectionTimer(roomCode, room, io);

          console.log(`🎯 SERVER: selectPrompt completed successfully`);
        } catch (error) {
          console.error("🎯 SERVER: Error selecting prompt:", error);
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

          // Send updated room state to all clients (including main screen viewers)
          io.to(roomCode).emit("roomUpdated", room);

          // Check if all non-judge players have submitted
          const nonJudgePlayers = room.players.filter(
            (p) => p.id !== room.currentJudge
          );
          if (room.submissions.length === nonJudgePlayers.length) {
            // Clear the sound selection timer since all players submitted
            clearTimer(roomCode);
            room.gameState = GameState.PLAYBACK;
            io.to(roomCode).emit("gameStateChanged", GameState.PLAYBACK, {
              submissions: room.submissions,
            });
            io.to(roomCode).emit("roomUpdated", room);

            // Reduced delay - auto-transition to judging after shorter playback time
            setTimeout(() => {
              if (room.gameState === GameState.PLAYBACK) {
                room.gameState = GameState.JUDGING;
                io.to(roomCode).emit("gameStateChanged", GameState.JUDGING, {
                  submissions: room.submissions,
                  judgeId: room.currentJudge,
                });
                io.to(roomCode).emit("roomUpdated", room);
              }
            }, room.submissions.length * 1500 + 1000); // Reduced from 3000ms to 1500ms per submission + 1000ms buffer
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

          // Send comprehensive winner information to all clients
          io.to(roomCode).emit("roundComplete", {
            winnerId: winner.id,
            winnerName: winner.name,
            winningSubmission: winningSubmission,
            submissionIndex: parseInt(submissionIndex),
          });
          io.to(roomCode).emit("roomUpdated", room); // Check if game is complete
          const maxScore = Math.max(...room.players.map((p) => p.score));
          const gameWinners = room.players.filter((p) => p.score === maxScore);

          console.log(
            `🏁 Game completion check: currentRound=${
              room.currentRound
            }, maxRounds=${
              room.maxRounds
            }, maxScore=${maxScore}, scoreThreshold=${Math.ceil(
              room.maxRounds / 2
            )}`
          );

          if (
            room.currentRound >= room.maxRounds ||
            maxScore >= Math.ceil(room.maxRounds / 2)
          ) {
            console.log(
              `🎉 Game ending: Round ${room.currentRound}/${room.maxRounds} or score ${maxScore} reached threshold`
            );
            room.gameState = GameState.GAME_OVER;
            room.winner = gameWinners[0].id;
            io.to(roomCode).emit("roomUpdated", room);
            io.to(roomCode).emit("gameStateChanged", GameState.GAME_OVER, {
              winner: gameWinners[0],
              finalScores: room.players.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score,
              })),
            });
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
                  room.availablePrompts = prompts;

                  io.to(roomCode).emit(
                    "gameStateChanged",
                    GameState.PROMPT_SELECTION,
                    {
                      prompts,
                      judgeId: room.currentJudge,
                      timeLimit: GAME_CONFIG.PROMPT_SELECTION_TIME,
                    }
                  );

                  // Start countdown timer for prompt selection
                  startTimer(
                    roomCode,
                    GAME_CONFIG.PROMPT_SELECTION_TIME,
                    () => {
                      // Auto-select first prompt if no selection made
                      if (room.gameState === GameState.PROMPT_SELECTION) {
                        const firstPrompt = prompts[0];
                        room.currentPrompt = firstPrompt.text;
                        room.gameState = GameState.SOUND_SELECTION;
                        room.submissions = [];

                        const soundOptions = getRandomSounds(12);

                        io.to(roomCode).emit("roomUpdated", room);
                        io.to(roomCode).emit(
                          "promptSelected",
                          firstPrompt.text
                        );
                        io.to(roomCode).emit(
                          "gameStateChanged",
                          GameState.SOUND_SELECTION,
                          {
                            prompt: firstPrompt.text,
                            sounds: soundOptions,
                            timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
                          }
                        );

                        // Start sound selection timer
                        startSoundSelectionTimer(roomCode, room, io);
                      }
                    },
                    (timeLeft) => {
                      io.to(roomCode).emit("timeUpdate", { timeLeft });
                    }
                  );
                }
              }, 3000);
            }, 5000);
          }
        } catch (error) {
          console.error("Error selecting winner:", error);
        }
      }); // Main screen handlers
      socket.on("requestMainScreenUpdate", () => {
        try {
          const roomsArray = Array.from(rooms.values())
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

      socket.on("joinRoomAsViewer", (roomCode) => {
        try {
          const room = rooms.get(roomCode.toUpperCase());
          if (room) {
            console.log(`Main screen joining room ${roomCode} as viewer`);
            socket.join(roomCode);
            socket.emit("roomJoined", room);
          } else {
            socket.emit("error", { message: `Room ${roomCode} not found` });
          }
        } catch (error) {
          console.error("Error joining room as viewer:", error);
          socket.emit("error", { message: "Failed to join room" });
        }
      });

      socket.on("leaveRoom", () => {
        try {
          const roomCode = playerRooms.get(socket.id);
          if (roomCode) {
            const room = rooms.get(roomCode);
            if (room) {
              room.players = room.players.filter((p) => p.id !== socket.id);
              playerRooms.delete(socket.id);
              socket.leave(roomCode);

              if (room.players.length === 0) {
                rooms.delete(roomCode);
                clearTimer(roomCode); // Clear any timers associated with the empty room
                console.log(`Room ${roomCode} closed as it's empty.`);
              } else {
                // If room still active, select new VIP if old one left, or new judge
                if (
                  room.players.every((p) => !p.isVIP) &&
                  room.players.length > 0
                ) {
                  room.players[0].isVIP = true;
                }
                if (room.currentJudge === socket.id) {
                  room.currentJudge = selectNextJudge(room); // Or handle judge leaving differently
                  io.to(roomCode).emit(
                    "judgeSelected",
                    room.currentJudge as string
                  );
                }
                io.to(roomCode).emit("roomUpdated", room);
              }
              io.to(roomCode).emit("playerLeft", socket.id);
              // Broadcast updated room list to all clients
              broadcastRoomListUpdate(io);
            }
          }
        } catch (error) {
          console.error("Error leaving room:", error);
          socket.emit("error", { message: "Failed to leave room" });
        }
      });
      socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
        try {
          const roomCode = playerRooms.get(socket.id);
          if (roomCode) {
            // Use new disconnection handling
            handlePlayerDisconnection(io, socket.id, roomCode);
          }
        } catch (error) {
          console.error("Error during disconnect:", error);
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
          });

          // Auto-transition to prompt selection after a delay
          setTimeout(() => {
            if (room.gameState === GameState.JUDGE_SELECTION) {
              room.gameState = GameState.PROMPT_SELECTION;
              const prompts = getRandomPrompts(3);
              room.availablePrompts = prompts;

              io.to(roomCode).emit(
                "gameStateChanged",
                GameState.PROMPT_SELECTION,
                {
                  prompts,
                  judgeId: room.currentJudge,
                  timeLimit: GAME_CONFIG.PROMPT_SELECTION_TIME,
                }
              );

              // Start countdown timer for prompt selection
              startTimer(
                roomCode,
                GAME_CONFIG.PROMPT_SELECTION_TIME,
                () => {
                  // Auto-select first prompt if no selection made
                  if (room.gameState === GameState.PROMPT_SELECTION) {
                    const firstPrompt = prompts[0];
                    room.currentPrompt = firstPrompt.text;
                    room.gameState = GameState.SOUND_SELECTION;
                    room.submissions = [];

                    const soundOptions = getRandomSounds(12);

                    io.to(roomCode).emit("roomUpdated", room);
                    io.to(roomCode).emit("promptSelected", firstPrompt.text);
                    io.to(roomCode).emit(
                      "gameStateChanged",
                      GameState.SOUND_SELECTION,
                      {
                        prompt: firstPrompt.text,
                        sounds: soundOptions,
                        timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
                      }
                    );

                    // Start sound selection timer
                    startSoundSelectionTimer(roomCode, room, io);
                  }
                },
                (timeLeft) => {
                  io.to(roomCode).emit("timeUpdate", { timeLeft });
                }
              );
            }
          }, 3000);
        } catch (error) {
          console.error("Error starting game:", error);
        }
      });
      socket.on("selectPrompt", (promptId) => {
        console.log(
          `🎯 SERVER: selectPrompt received from ${socket.id} with promptId: ${promptId}`
        );
        try {
          const roomCode = playerRooms.get(socket.id);
          console.log(`🎯 SERVER: Player room lookup - roomCode: ${roomCode}`);
          if (!roomCode) {
            console.log(`🎯 SERVER: No room found for socket ${socket.id}`);
            return;
          }

          const room = rooms.get(roomCode);
          console.log(`🎯 SERVER: Room lookup - room exists: ${!!room}`);
          if (!room) {
            console.log(`🎯 SERVER: Room ${roomCode} not found`);
            return;
          }

          console.log(
            `🎯 SERVER: Current judge: ${room.currentJudge}, Socket ID: ${
              socket.id
            }, Match: ${room.currentJudge === socket.id}`
          );
          if (room.currentJudge !== socket.id) {
            console.log(
              `🎯 SERVER: Judge validation failed - current judge: ${room.currentJudge}, socket: ${socket.id}`
            );
            return;
          }

          // Use available prompts from room if they exist, otherwise fallback to finding by ID
          let prompt;
          if (room.availablePrompts) {
            prompt = room.availablePrompts.find((p) => p.id === promptId);
          } else {
            prompt = GAME_PROMPTS.find((p) => p.id === promptId);
          }

          console.log(
            `🎯 SERVER: Prompt lookup - found: ${!!prompt}, promptId: ${promptId}`
          );
          if (!prompt) {
            console.log(`🎯 SERVER: Prompt ${promptId} not found`);
            return;
          }

          // Clear the prompt selection timer since judge made a manual selection
          clearTimer(roomCode);

          console.log(
            `🎯 SERVER: All validations passed, updating room state to SOUND_SELECTION`
          );
          room.currentPrompt = prompt.text;
          room.gameState = GameState.SOUND_SELECTION;
          room.submissions = [];

          const soundOptions = getRandomSounds(12);

          console.log(`🎯 SERVER: Emitting room updates for ${roomCode}`);
          io.to(roomCode).emit("roomUpdated", room);
          io.to(roomCode).emit("promptSelected", prompt.text);
          io.to(roomCode).emit("gameStateChanged", GameState.SOUND_SELECTION, {
            prompt: prompt.text,
            sounds: soundOptions,
            timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
          });

          // Start sound selection timer
          startSoundSelectionTimer(roomCode, room, io);

          console.log(`🎯 SERVER: selectPrompt completed successfully`);
        } catch (error) {
          console.error("🎯 SERVER: Error selecting prompt:", error);
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

          // Send updated room state to all clients (including main screen viewers)
          io.to(roomCode).emit("roomUpdated", room);

          // Check if all non-judge players have submitted
          const nonJudgePlayers = room.players.filter(
            (p) => p.id !== room.currentJudge
          );
          if (room.submissions.length === nonJudgePlayers.length) {
            // Clear the sound selection timer since all players submitted
            clearTimer(roomCode);
            room.gameState = GameState.PLAYBACK;
            io.to(roomCode).emit("gameStateChanged", GameState.PLAYBACK, {
              submissions: room.submissions,
            });
            io.to(roomCode).emit("roomUpdated", room);

            // Reduced delay - auto-transition to judging after shorter playback time
            setTimeout(() => {
              if (room.gameState === GameState.PLAYBACK) {
                room.gameState = GameState.JUDGING;
                io.to(roomCode).emit("gameStateChanged", GameState.JUDGING, {
                  submissions: room.submissions,
                  judgeId: room.currentJudge,
                });
                io.to(roomCode).emit("roomUpdated", room);
              }
            }, room.submissions.length * 1500 + 1000); // Reduced from 3000ms to 1500ms per submission + 1000ms buffer
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

          // Send comprehensive winner information to all clients
          io.to(roomCode).emit("roundComplete", {
            winnerId: winner.id,
            winnerName: winner.name,
            winningSubmission: winningSubmission,
            submissionIndex: parseInt(submissionIndex),
          });
          io.to(roomCode).emit("roomUpdated", room); // Check if game is complete
          const maxScore = Math.max(...room.players.map((p) => p.score));
          const gameWinners = room.players.filter((p) => p.score === maxScore);

          console.log(
            `🏁 Game completion check: currentRound=${
              room.currentRound
            }, maxRounds=${
              room.maxRounds
            }, maxScore=${maxScore}, scoreThreshold=${Math.ceil(
              room.maxRounds / 2
            )}`
          );

          if (
            room.currentRound >= room.maxRounds ||
            maxScore >= Math.ceil(room.maxRounds / 2)
          ) {
            console.log(
              `🎉 Game ending: Round ${room.currentRound}/${room.maxRounds} or score ${maxScore} reached threshold`
            );
            room.gameState = GameState.GAME_OVER;
            room.winner = gameWinners[0].id;
            io.to(roomCode).emit("roomUpdated", room);
            io.to(roomCode).emit("gameStateChanged", GameState.GAME_OVER, {
              winner: gameWinners[0],
              finalScores: room.players.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score,
              })),
            });
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
                  room.availablePrompts = prompts;

                  io.to(roomCode).emit(
                    "gameStateChanged",
                    GameState.PROMPT_SELECTION,
                    {
                      prompts,
                      judgeId: room.currentJudge,
                      timeLimit: GAME_CONFIG.PROMPT_SELECTION_TIME,
                    }
                  );

                  // Start countdown timer for prompt selection
                  startTimer(
                    roomCode,
                    GAME_CONFIG.PROMPT_SELECTION_TIME,
                    () => {
                      // Auto-select first prompt if no selection made
                      if (room.gameState === GameState.PROMPT_SELECTION) {
                        const firstPrompt = prompts[0];
                        room.currentPrompt = firstPrompt.text;
                        room.gameState = GameState.SOUND_SELECTION;
                        room.submissions = [];

                        const soundOptions = getRandomSounds(12);

                        io.to(roomCode).emit("roomUpdated", room);
                        io.to(roomCode).emit(
                          "promptSelected",
                          firstPrompt.text
                        );
                        io.to(roomCode).emit(
                          "gameStateChanged",
                          GameState.SOUND_SELECTION,
                          {
                            prompt: firstPrompt.text,
                            sounds: soundOptions,
                            timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
                          }
                        );

                        // Start sound selection timer
                        startSoundSelectionTimer(roomCode, room, io);
                      }
                    },
                    (timeLeft) => {
                      io.to(roomCode).emit("timeUpdate", { timeLeft });
                    }
                  );
                }
              }, 3000);
            }, 5000);
          }
        } catch (error) {
          console.error("Error selecting winner:", error);
        }
      });
      socket.on(
        "reconnectToRoom",
        (roomCode, playerName, originalPlayerId, callback) => {
          try {
            console.log(
              `Reconnection attempt: ${playerName} to room ${roomCode} with original ID ${originalPlayerId}`
            );

            if (!rooms.has(roomCode)) {
              callback(false);
              return;
            }

            const success = handlePlayerReconnection(
              io,
              socket,
              roomCode,
              playerName,
              originalPlayerId
            );

            if (success) {
              const room = rooms.get(roomCode);
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

      socket.on("voteOnReconnection", (continueWithoutPlayer) => {
        try {
          const roomCode = playerRooms.get(socket.id);
          if (!roomCode) return;

          const room = rooms.get(roomCode);
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
          io.to(roomCode).emit("reconnectionVoteUpdate", {
            vote: room.reconnectionVote,
          });

          // Get the disconnected player name for the vote result
          const disconnectedPlayerName =
            room.disconnectedPlayers?.[0]?.name || "Unknown Player";

          // Handle the vote result immediately (in a real implementation, you might want to collect multiple votes)
          handleReconnectionVoteResult(
            io,
            roomCode,
            continueWithoutPlayer,
            disconnectedPlayerName,
            GameState.SOUND_SELECTION
          );
        } catch (error) {
          console.error("Error handling reconnection vote:", error);
        }
      });
    });
  }
  res.end();
}
