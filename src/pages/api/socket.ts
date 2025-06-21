// Socket server setup for Next.js API routes
import { NextApiRequest } from "next";
import { Server as NetServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { EventEmitter } from "events";
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

// Global event emitter for internal server events
const serverEvents = new EventEmitter();

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

  console.log(
    `[${new Date().toISOString()}] [TIMER] Starting timer for room ${roomCode}, duration: ${duration}s`
  );

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
    console.log(
      `[${new Date().toISOString()}] [TIMER] Clearing timer for room ${roomCode}`
    );
    clearInterval(timer);
    roomTimers.delete(roomCode);
  } else {
    console.log(
      `[${new Date().toISOString()}] [TIMER] No timer found to clear for room ${roomCode}`
    );
  }
}

// Orchestrated playback sequence for submissions
async function startPlaybackSequence(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  roomCode: string,
  room: Room
) {
  const submissions = room.submissions;
  const PROGRESS_UPDATE_INTERVAL = 100; // Update progress every 100ms
  const TIMEOUT_DURATION = 15000; // 15 second fallback timeout per submission

  console.log(
    `[PLAYBACK] Starting playback sequence for room ${roomCode} with ${submissions.length} submissions`
  );
  console.log(`[PLAYBACK] Current room state: ${room.gameState}`);
  console.log(
    `[PLAYBACK] Submissions:`,
    submissions.map((s) => ({ playerId: s.playerId, sounds: s.sounds.length }))
  );

  // Check who is in the socket room
  const roomMembers = io.sockets.adapter.rooms.get(roomCode);
  console.log(
    `[PLAYBACK] Room ${roomCode} has ${
      roomMembers?.size || 0
    } socket connections`
  );
  if (roomMembers) {
    console.log(`[PLAYBACK] Socket IDs in room:`, Array.from(roomMembers));
  }

  // Wait a moment before starting
  console.log(`[PLAYBACK] Waiting 2 seconds before starting playback...`);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Create a promise-based system for each submission
  for (let i = 0; i < submissions.length; i++) {
    // Check if room is still in playback state
    const currentRoom = rooms.get(roomCode);
    console.log(
      `[PLAYBACK] Loop iteration ${i}: Room state is ${currentRoom?.gameState}, expected PLAYBACK`
    );
    if (!currentRoom || currentRoom.gameState !== GameState.PLAYBACK) {
      console.log(
        `[PLAYBACK] Playback sequence cancelled for room ${roomCode} - state changed to ${currentRoom?.gameState}`
      );
      return;
    }

    console.log(
      `[PLAYBACK] Playing submission ${i + 1} of ${
        submissions.length
      } for room ${roomCode}`
    );

    // Start playing this submission
    console.log(
      `[PLAYBACK] Emitting submissionPlayback event for submission ${i}`
    );
    io.to(roomCode).emit("submissionPlayback", {
      submissionIndex: i,
      submission: submissions[i],
    });

    // Wait for client to notify us when this submission is complete
    console.log(`[PLAYBACK] Waiting for submission ${i} to complete...`);
    await waitForSubmissionComplete(io, roomCode, i, TIMEOUT_DURATION);

    // Brief pause between submissions
    if (i < submissions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // All submissions played
  console.log(`[PLAYBACK] Playback sequence completed for room ${roomCode}`);
  io.to(roomCode).emit("playbackComplete");

  // Clear the playback flag
  room.isPlayingBack = false;

  // Transition to judging phase after a brief delay
  setTimeout(() => {
    const currentRoom = rooms.get(roomCode);
    if (currentRoom && currentRoom.gameState === GameState.PLAYBACK) {
      console.log(`[PLAYBACK] Transitioning room ${roomCode} to JUDGING phase`);
      currentRoom.gameState = GameState.JUDGING;
      io.to(roomCode).emit("gameStateChanged", GameState.JUDGING, {
        submissions: currentRoom.submissions,
        judgeId: currentRoom.currentJudge,
      });
      io.to(roomCode).emit("roomUpdated", currentRoom);
      console.log(`Room ${roomCode} transitioned to JUDGING phase`);
    } else {
      console.log(
        `[PLAYBACK] Cannot transition room ${roomCode} - state is ${currentRoom?.gameState}`
      );
    }
  }, 1500); // 1.5 second delay before judging
}

// Helper function for starting the delayed sound selection timer
// This should only be called after the first player submits their sounds
function startDelayedSoundSelectionTimer(
  roomCode: string,
  room: Room,
  io: SocketIOServer
) {
  // Prevent starting multiple timers
  if (room.soundSelectionTimerStarted) {
    console.log(
      `[${new Date().toISOString()}] [TIMER] Timer already started for room ${roomCode}, skipping`
    );
    return;
  }

  // Add stack trace to see where this is being called from
  console.log(
    `[${new Date().toISOString()}] [TIMER] *** startDelayedSoundSelectionTimer called for room ${roomCode} ***`
  );
  console.log(
    `[${new Date().toISOString()}] [TIMER] Call stack:`,
    new Error().stack
  );
  room.soundSelectionTimerStarted = true;
  startTimer(
    roomCode,
    GAME_CONFIG.SOUND_SELECTION_TIME,
    () => {
      // Auto-transition to judging if time runs out, but only if not already in playback
      if (room.gameState === GameState.SOUND_SELECTION && !room.isPlayingBack) {
        console.log(
          `[${new Date().toISOString()}] [TIMER] Sound selection time expired for room ${roomCode}, transitioning to JUDGING`
        );
        room.gameState = GameState.JUDGING;
        io.to(roomCode).emit("gameStateChanged", GameState.JUDGING, {
          submissions: room.submissions,
          judgeId: room.currentJudge,
        });
      } else {
        console.log(
          `[${new Date().toISOString()}] [TIMER] Sound selection time expired for room ${roomCode}, but room state is ${
            room.gameState
          }, playback flag: ${room.isPlayingBack}`
        );
      }
    },
    (timeLeft) => {
      // Only send timer updates if the timer has been started
      if (room.soundSelectionTimerStarted) {
        console.log(
          `[${new Date().toISOString()}] [TIMER] Sending timeUpdate for sound selection: ${timeLeft}s remaining in room ${roomCode}`
        );
        io.to(roomCode).emit("timeUpdate", { timeLeft });
      } else {
        console.log(
          `[${new Date().toISOString()}] [TIMER] Suppressing timeUpdate for sound selection: timer not yet started in room ${roomCode}`
        );
      }
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
  room.previousGameState = previousGameState; // Store the previous state for restoration
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
  room.previousGameState = undefined; // Clear the stored previous state
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
  io.to(roomCode).emit("roomUpdated", room); // Restart game timers if needed
  if (previousGameState === GameState.SOUND_SELECTION) {
    // Only restart timer if it was already started before disconnection
    if (room.soundSelectionTimerStarted) {
      startDelayedSoundSelectionTimer(roomCode, room, io);
    }
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
  socket.join(roomCode); // CRITICAL: Join the socket to the room for broadcasts
  // If no more disconnected players, resume the game
  if (room.disconnectedPlayers.length === 0 && room.pausedForDisconnection) {
    // Restore the previous game state instead of defaulting to SOUND_SELECTION
    const gameStateToRestore =
      room.previousGameState || GameState.SOUND_SELECTION;
    console.log(
      `Restoring game state to: ${gameStateToRestore} (was paused at: ${room.previousGameState})`
    );
    resumeGame(io, roomCode, gameStateToRestore);
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

// Helper function to wait for client to complete submission playback
function waitForSubmissionComplete(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  roomCode: string,
  submissionIndex: number,
  timeoutDuration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    let completed = false;
    let timeoutId: NodeJS.Timeout;

    // Set up timeout fallback
    timeoutId = setTimeout(() => {
      if (!completed) {
        completed = true;
        console.log(
          `[PLAYBACK] Timeout reached for submission ${submissionIndex} in room ${roomCode}, continuing...`
        );
        // Remove the listener before resolving
        serverEvents.off(
          `submissionComplete_${roomCode}_${submissionIndex}`,
          handleSubmissionComplete
        );
        resolve();
      }
    }, timeoutDuration);

    // Listen for completion from any client in the room
    const handleSubmissionComplete = () => {
      if (!completed) {
        completed = true;
        clearTimeout(timeoutId);
        console.log(
          `[PLAYBACK] Received completion notification for submission ${submissionIndex} in room ${roomCode}`
        );

        // Remove the listener to prevent memory leaks
        serverEvents.off(
          `submissionComplete_${roomCode}_${submissionIndex}`,
          handleSubmissionComplete
        );
        resolve();
      }
    }; // Listen for the specific submission completion event
    const eventName = `submissionComplete_${roomCode}_${submissionIndex}`;
    serverEvents.on(eventName, handleSubmissionComplete);

    console.log(`[PLAYBACK] Waiting for event: ${eventName}`);
    console.log(
      `[PLAYBACK] EventEmitter listener count for ${eventName}: ${serverEvents.listenerCount(
        eventName
      )}`
    );
  });
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
            soundSelectionTimerStarted: false,
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
            socket.emit("error", {
              message: `Need at least ${GAME_CONFIG.MIN_PLAYERS} players to start`,
            });
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
                    console.log(
                      `[TIMER] Prompt selection time expired for room ${roomCode}, auto-selecting first prompt`
                    );
                    // Clear the prompt selection timer first
                    clearTimer(roomCode);

                    const firstPrompt = prompts[0];
                    room.currentPrompt = firstPrompt.text;
                    room.gameState = GameState.SOUND_SELECTION;
                    room.submissions = [];
                    room.soundSelectionTimerStarted = false;

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

                    // Note: Sound selection timer will start when first player submits
                    console.log(
                      `[TIMER] Transitioned to sound selection, waiting for first submission to start timer`
                    );
                  }
                },
                (timeLeft) => {
                  console.log(
                    `[TIMER] Sending timeUpdate for prompt selection: ${timeLeft}s remaining in room ${roomCode}, game state: ${room.gameState}`
                  );
                  // Only send timeUpdate if we're still in prompt selection
                  if (room.gameState === GameState.PROMPT_SELECTION) {
                    io.to(roomCode).emit("timeUpdate", { timeLeft });
                  } else {
                    console.log(
                      `[TIMER] Suppressing timeUpdate for prompt selection: game state is now ${room.gameState}`
                    );
                  }
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
          } // Clear the prompt selection timer since judge made a manual selection
          clearTimer(roomCode);

          console.log(
            `🎯 SERVER: All validations passed, updating room state to SOUND_SELECTION`
          );
          room.currentPrompt = prompt.text;
          room.gameState = GameState.SOUND_SELECTION;
          room.submissions = [];
          room.soundSelectionTimerStarted = false;

          const soundOptions = getRandomSounds(12);

          console.log(`🎯 SERVER: Emitting room updates for ${roomCode}`);
          io.to(roomCode).emit("roomUpdated", room);
          io.to(roomCode).emit("promptSelected", prompt.text);
          io.to(roomCode).emit("gameStateChanged", GameState.SOUND_SELECTION, {
            prompt: prompt.text,
            sounds: soundOptions,
            timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
          });

          // Note: Sound selection timer will start when first player submits
          console.log(
            `[${new Date().toISOString()}] [TIMER] Judge selected prompt, transitioned to sound selection, waiting for first submission to start timer`
          );

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
          io.to(roomCode).emit("soundSubmitted", submission); // Check if this is the first submission and start the timer
          if (
            room.submissions.length === 1 &&
            !room.soundSelectionTimerStarted
          ) {
            console.log(
              `[${new Date().toISOString()}] [SUBMISSION] First player submitted for room ${roomCode}, starting countdown timer`
            );
            startDelayedSoundSelectionTimer(roomCode, room, io);
          }

          // Send updated room state to all clients (including main screen viewers)
          io.to(roomCode).emit("roomUpdated", room); // Check if all non-judge players have submitted
          const nonJudgePlayers = room.players.filter(
            (p) => p.id !== room.currentJudge
          );
          if (room.submissions.length === nonJudgePlayers.length) {
            // Clear the sound selection timer since all players submitted
            clearTimer(roomCode);
            room.gameState = GameState.PLAYBACK;
            console.log(
              `[SUBMISSION] All submissions received for room ${roomCode}, transitioning to PLAYBACK`
            );
            io.to(roomCode).emit("gameStateChanged", GameState.PLAYBACK, {
              submissions: room.submissions,
            });
            io.to(roomCode).emit("roomUpdated", room); // Start orchestrated playback of all submissions
            console.log(
              `[SUBMISSION] Calling startPlaybackSequence for room ${roomCode}`
            );

            // Set a flag to prevent other transitions during playback
            room.isPlayingBack = true;

            startPlaybackSequence(io, roomCode, room).catch((error) => {
              console.error(
                `[PLAYBACK] Error in playback sequence for room ${roomCode}:`,
                error
              );
              // Clean up flag on error
              if (room) {
                room.isPlayingBack = false;
              }
            });
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
            // Don't automatically start next round - wait for client to finish playing winner audio
            console.log(
              "Round results displayed, waiting for client audio completion..."
            );
            // The next round will be triggered when client emits 'winnerAudioComplete'
          }
        } catch (error) {
          console.error("Error selecting winner:", error);
        }
      });

      // Handle winner audio completion to trigger next round
      socket.on("winnerAudioComplete", () => {
        try {
          const roomCode = playerRooms.get(socket.id);
          if (!roomCode) return;

          const room = rooms.get(roomCode);
          if (!room || room.gameState !== GameState.ROUND_RESULTS) return;

          console.log(
            "Winner audio complete, starting next round after brief delay..."
          );

          // Start next round after a brief pause
          setTimeout(() => {
            room.currentRound += 1;
            room.currentJudge = selectNextJudge(room);
            room.gameState = GameState.JUDGE_SELECTION;
            room.currentPrompt = null;
            room.submissions = [];
            room.soundSelectionTimerStarted = false;

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
                      room.soundSelectionTimerStarted = false;

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

                      console.log(
                        `[TIMER] Transitioned to sound selection (post-audio), waiting for first submission to start timer`
                      );
                    }
                  },
                  (timeLeft) => {
                    if (room.gameState === GameState.PROMPT_SELECTION) {
                      io.to(roomCode).emit("timeUpdate", { timeLeft });
                    }
                  }
                );
              }
            }, 3000);
          }, 2000); // 2 second pause after audio completes
        } catch (error) {
          console.error("Error processing winner audio completion:", error);
        }
      });

      // Main screen handlers
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
          const normalizedRoomCode = roomCode.toUpperCase();
          const room = rooms.get(normalizedRoomCode);
          if (room) {
            console.log(
              `[VIEWER] Main screen joining room ${normalizedRoomCode} as viewer`
            );
            socket.join(normalizedRoomCode);

            // Add viewer to playerRooms map so they can emit events for this room
            playerRooms.set(socket.id, normalizedRoomCode);

            // Verify the join worked
            const roomMembers =
              io.sockets.adapter.rooms.get(normalizedRoomCode);
            console.log(
              `[VIEWER] After join, room ${normalizedRoomCode} has ${
                roomMembers?.size || 0
              } members`
            );
            console.log(
              `[VIEWER] Socket ${socket.id} is now in room ${normalizedRoomCode}`
            );

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
      }); // Handle submission playback completion from main screen
      socket.on("submissionPlaybackComplete", (submissionIndex) => {
        try {
          const roomCode = playerRooms.get(socket.id);
          let targetRoomCode = roomCode;
          if (!roomCode) {
            console.log(
              `[PLAYBACK] Submission completion from unknown socket: ${socket.id}`
            );
            // This might be from the main screen viewer, which doesn't have a playerRooms entry
            // Try to find the room code another way - check all rooms to see which one is in PLAYBACK state
            for (const [code, room] of rooms.entries()) {
              if (room.gameState === GameState.PLAYBACK) {
                targetRoomCode = code;
                console.log(
                  `[PLAYBACK] Found room ${code} in PLAYBACK state for submission ${submissionIndex}`
                );
                break;
              }
            }

            if (!targetRoomCode) {
              console.log(
                `[PLAYBACK] No room found in PLAYBACK state for submission ${submissionIndex}`
              );
              return;
            }

            console.log(
              `[PLAYBACK] Using found room code ${targetRoomCode} for submission ${submissionIndex}`
            );
          } else {
            console.log(
              `[PLAYBACK] Using player room code ${targetRoomCode} for submission ${submissionIndex}`
            );
          }

          // targetRoomCode is guaranteed to be a string at this point
          const room = rooms.get(targetRoomCode!);

          if (!room) {
            console.error(
              `[PLAYBACK] Room ${targetRoomCode} not found for submission completion`
            );
            return;
          }

          console.log(
            `[PLAYBACK] Received submission completion for submission ${submissionIndex} in room ${targetRoomCode}`
          ); // Emit to our internal EventEmitter for the waitForSubmissionComplete function
          const eventName = `submissionComplete_${targetRoomCode}_${submissionIndex}`;
          console.log(`[PLAYBACK] Emitting internal event: ${eventName}`);
          console.log(
            `[PLAYBACK] Current EventEmitter listener count for ${eventName}: ${serverEvents.listenerCount(
              eventName
            )}`
          );
          serverEvents.emit(eventName);
          console.log(`[PLAYBACK] Event ${eventName} emitted successfully`);
        } catch (error) {
          console.error(
            "Error handling submission playback completion:",
            error
          );
        }
      });
    });
  }
  res.end();
}
