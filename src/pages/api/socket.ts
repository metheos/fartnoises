// Socket server setup for Next.js API routes
import { NextApiRequest } from "next";
import { Server as NetServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import {
  Room,
  Player,
  GameState,
  GamePrompt,
  ServerToClientEvents,
  ClientToServerEvents,
} from "@/types/game";
import {
  getGamePrompts,
  PLAYER_COLORS,
  PLAYER_EMOJIS,
  GAME_CONFIG,
} from "@/data/gameData";
import { getRandomPrompts, getRandomSounds } from "@/utils/soundLoader";
import { processPromptText } from "@/utils/gameUtils";

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

// Main screen tracking for multiple main screen support
const mainScreens: Map<string, Set<string>> = new Map(); // roomCode -> Set of main screen socket IDs
const primaryMainScreens: Map<string, string> = new Map(); // roomCode -> primary main screen socket ID

// Global event emitter for internal server events
// const serverEvents = new EventEmitter(); // Currently unused

// Constants for disconnection handling
const RECONNECTION_GRACE_PERIOD = 30000; // 30 seconds
const RECONNECTION_VOTE_TIMEOUT = 20000; // 20 seconds to vote

// Helper function to ensure prompts are always processed with player names
function processAndAssignPrompt(room: Room, prompt: GamePrompt): void {
  if (!prompt) {
    room.currentPrompt = null;
    return;
  }

  // Process the prompt text with current player names
  const playerNames = room.players.map((p) => p.name);
  room.currentPrompt = {
    ...prompt,
    text: processPromptText(prompt.text, playerNames),
  };
}

// Helper function to broadcast the list of rooms
function broadcastRoomListUpdate(
  ioInstance: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
) {
  const roomsArray = Array.from(rooms.values()).filter(
    (room) => room.players.length > 0
  ); // Only show rooms with players
  ioInstance.emit("mainScreenUpdate", { rooms: roomsArray });
}

// Main screen management functions
function addMainScreen(roomCode: string, socketId: string): void {
  if (!mainScreens.has(roomCode)) {
    mainScreens.set(roomCode, new Set());
  }

  const roomMainScreens = mainScreens.get(roomCode)!;
  roomMainScreens.add(socketId);

  // If this is the first main screen or there's no primary, elect it as primary
  if (!primaryMainScreens.has(roomCode) || roomMainScreens.size === 1) {
    primaryMainScreens.set(roomCode, socketId);
    console.log(
      `[MAIN SCREEN] Elected ${socketId} as primary main screen for room ${roomCode}`
    );
  } else {
    console.log(
      `[MAIN SCREEN] Added ${socketId} as secondary main screen for room ${roomCode}. Primary remains: ${primaryMainScreens.get(
        roomCode
      )}`
    );
  }
}

function removeMainScreen(roomCode: string, socketId: string): void {
  const roomMainScreens = mainScreens.get(roomCode);
  if (!roomMainScreens) return;

  roomMainScreens.delete(socketId);

  // If the primary main screen disconnected, elect a new one
  if (primaryMainScreens.get(roomCode) === socketId) {
    if (roomMainScreens.size > 0) {
      const newPrimary = Array.from(roomMainScreens)[0]; // Get first remaining main screen
      primaryMainScreens.set(roomCode, newPrimary);
      console.log(
        `[MAIN SCREEN] Primary main screen ${socketId} disconnected. Elected ${newPrimary} as new primary for room ${roomCode}`
      );
    } else {
      primaryMainScreens.delete(roomCode);
      console.log(
        `[MAIN SCREEN] Last main screen ${socketId} disconnected from room ${roomCode}. No main screens remaining.`
      );
    }
  } else {
    console.log(
      `[MAIN SCREEN] Secondary main screen ${socketId} disconnected from room ${roomCode}`
    );
  }

  // Clean up if no main screens left
  if (roomMainScreens.size === 0) {
    mainScreens.delete(roomCode);
  }
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

function getRandomEmoji(usedEmojis: string[]): string {
  const availableEmojis = PLAYER_EMOJIS.filter(
    (emoji) => !usedEmojis.includes(emoji)
  );
  return availableEmojis.length > 0
    ? availableEmojis[Math.floor(Math.random() * availableEmojis.length)]
    : PLAYER_EMOJIS[Math.floor(Math.random() * PLAYER_EMOJIS.length)];
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
    async () => {
      // Auto-transition to judging if time runs out, but only if not already in playback
      if (room.gameState === GameState.SOUND_SELECTION && !room.isPlayingBack) {
        console.log(
          `[${new Date().toISOString()}] [TIMER] Sound selection time expired for room ${roomCode}, processing auto-submissions`
        );

        // Auto-submit sounds for players who haven't submitted yet
        const nonJudgePlayers = room.players.filter(
          (p) => p.id !== room.currentJudge
        );
        const playersWhoSubmitted = room.submissions.map((s) => s.playerId);
        const playersWhoNeedSubmission = nonJudgePlayers.filter(
          (p) => !playersWhoSubmitted.includes(p.id)
        );

        for (const player of playersWhoNeedSubmission) {
          console.log(
            `[TIMER] Checking player ${player.name}: soundSet = ${
              player.soundSet
                ? `[${player.soundSet.join(", ")}]`
                : "null/undefined"
            }`
          );
          if (player.soundSet && player.soundSet.length > 0) {
            // Randomly select 1-2 sounds from the player's sound set
            const numSounds = Math.random() < 0.7 ? 2 : 1; // 70% chance of 2 sounds, 30% chance of 1 sound
            const selectedSounds: string[] = [];
            const availableSounds = [...player.soundSet]; // Copy array to avoid modifying original

            for (
              let i = 0;
              i < Math.min(numSounds, availableSounds.length);
              i++
            ) {
              const randomIndex = Math.floor(
                Math.random() * availableSounds.length
              );
              const selectedSound = availableSounds.splice(randomIndex, 1)[0];
              selectedSounds.push(selectedSound);
            }

            if (selectedSounds.length > 0) {
              const autoSubmission = {
                playerId: player.id,
                playerName: player.name,
                sounds: selectedSounds,
              };

              console.log(
                `[TIMER] Auto-submitting ${
                  selectedSounds.length
                } sound(s) for ${player.name}: [${selectedSounds.join(", ")}]`
              );

              room.submissions.push(autoSubmission);
              io.to(roomCode).emit("soundSubmitted", autoSubmission);
            } else {
              console.warn(
                `[TIMER] No sounds selected for auto-submission for ${player.name}`
              );
            }
          } else {
            console.warn(
              `[TIMER] Player ${player.name} has no sound set available for auto-submission (soundSet: ${player.soundSet})`
            );
          }
        }

        // Randomize submissions if they haven't been randomized yet (when timer expires)
        if (
          (!room.randomizedSubmissions ||
            room.randomizedSubmissions.length === 0) &&
          room.submissions.length > 0
        ) {
          console.log(
            `[TIMER] Randomizing submissions due to timer expiration...`
          );
          const seed = generateSubmissionSeed(roomCode, room.currentRound);
          room.submissionSeed = seed;
          room.randomizedSubmissions = shuffleWithSeed(room.submissions, seed);
          console.log(
            `[TIMER] Original order: [${room.submissions
              .map((s) => s.playerName)
              .join(", ")}]`
          );
          console.log(
            `[TIMER] Randomized order: [${room.randomizedSubmissions
              .map((s) => s.playerName)
              .join(", ")}]`
          );
        }

        console.log(
          `[${new Date().toISOString()}] [TIMER] Transitioning to JUDGING after auto-submissions`
        );

        console.log(
          `[TIMER] Room submissions before transition: ${room.submissions.length} total`
        );
        room.submissions.forEach((sub, index) => {
          console.log(
            `[TIMER] Submission ${index}: ${
              sub.playerName
            } - [${sub.sounds.join(", ")}]`
          );
        });

        if (room.randomizedSubmissions) {
          console.log(
            `[TIMER] Room randomizedSubmissions: ${room.randomizedSubmissions.length} total`
          );
          room.randomizedSubmissions.forEach((sub, index) => {
            console.log(
              `[TIMER] Randomized submission ${index}: ${
                sub.playerName
              } - [${sub.sounds.join(", ")}]`
            );
          });
        }

        room.gameState = GameState.JUDGING;
        const submissionsToSend =
          room.randomizedSubmissions || room.submissions;
        console.log(
          `[TIMER] Sending ${submissionsToSend.length} submissions to clients`
        );

        io.to(roomCode).emit("gameStateChanged", GameState.JUDGING, {
          submissions: room.submissions, // Send original submissions
          randomizedSubmissions: submissionsToSend, // Send randomized submissions separately
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
    const disconnectedPlayer = room.disconnectedPlayers?.[0];
    if (!disconnectedPlayer) return;

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

    // Set vote timeout - default to continuing without the player
    const voteTimer = setTimeout(() => {
      handleReconnectionVoteResult(
        io,
        roomCode,
        true,
        disconnectedPlayer.name,
        previousGameState
      );
    }, RECONNECTION_VOTE_TIMEOUT);

    reconnectionVoteTimers.set(roomCode, voteTimer);
  }, RECONNECTION_GRACE_PERIOD);

  disconnectionTimers.set(roomCode, timer);
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
  } else if (previousGameState === GameState.JUDGE_SELECTION) {
    // Only restart timer if it hasn't been started yet (similar to sound selection logic)
    if (!room.judgeSelectionTimerStarted) {
      room.judgeSelectionTimerStarted = true;
      // Auto-transition from judge selection to prompt selection (same as original game start logic)
      setTimeout(async () => {
        const currentRoom = rooms.get(roomCode);
        if (
          currentRoom &&
          currentRoom.gameState === GameState.JUDGE_SELECTION
        ) {
          currentRoom.judgeSelectionTimerStarted = false;
          currentRoom.gameState = GameState.PROMPT_SELECTION;
          console.log(
            "Generating prompts for players:",
            currentRoom.players.map((p) => p.name)
          );
          const prompts = await getRandomPrompts(
            6,
            currentRoom.usedPromptIds || [],
            currentRoom.players.map((p) => p.name),
            currentRoom.allowExplicitContent
          );
          console.log(
            "Generated prompts:",
            prompts.map((p: GamePrompt) => ({ id: p.id, text: p.text }))
          );
          currentRoom.availablePrompts = prompts;

          io.to(roomCode).emit("roomUpdated", currentRoom);
          io.to(roomCode).emit("gameStateChanged", GameState.PROMPT_SELECTION, {
            prompts: prompts,
            judgeId: currentRoom.currentJudge,
            timeLimit: GAME_CONFIG.PROMPT_SELECTION_TIME,
          });

          // Start countdown timer for prompt selection (same as original logic)
          startTimer(
            roomCode,
            GAME_CONFIG.PROMPT_SELECTION_TIME,
            async () => {
              // Auto-select first prompt if no selection made
              const timerRoom = rooms.get(roomCode);
              if (
                timerRoom &&
                timerRoom.gameState === GameState.PROMPT_SELECTION &&
                timerRoom.availablePrompts &&
                timerRoom.availablePrompts.length > 0
              ) {
                // Auto-select the first prompt
                const selectedPrompt = timerRoom.availablePrompts[0];
                processAndAssignPrompt(timerRoom, selectedPrompt);

                // Track this prompt as used to avoid repeating in future rounds
                if (!timerRoom.usedPromptIds) {
                  timerRoom.usedPromptIds = [];
                }
                timerRoom.usedPromptIds.push(selectedPrompt.id);

                timerRoom.gameState = GameState.SOUND_SELECTION;
                timerRoom.submissions = [];
                timerRoom.randomizedSubmissions = []; // Clear randomized submissions for new round
                timerRoom.submissionSeed = undefined; // Clear the seed
                timerRoom.soundSelectionTimerStarted = false;

                // Generate individual random sound sets for each non-judge player
                await generatePlayerSoundSets(timerRoom);

                io.to(roomCode).emit("promptSelected", selectedPrompt);
                io.to(roomCode).emit(
                  "gameStateChanged",
                  GameState.SOUND_SELECTION,
                  {
                    prompt: selectedPrompt,
                    timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
                  }
                );
                io.to(roomCode).emit("roomUpdated", timerRoom);
              }
            },
            (timeLeft) => {
              io.to(roomCode).emit("timeUpdate", { timeLeft });
            }
          );
        }
      }, 3000); // 3 second delay (same as original logic)
    }
  }
  // Note: Add other timer restarts as needed based on game state
}

// Helper function to generate sound sets for players when entering SOUND_SELECTION
async function generatePlayerSoundSets(room: Room): Promise<void> {
  const nonJudgePlayers = room.players.filter(
    (p) => p.id !== room.currentJudge
  );

  for (const player of nonJudgePlayers) {
    // Generate 10 random sounds for each player, respecting explicit content setting
    const playerSounds = await getRandomSounds(
      10,
      undefined,
      room.allowExplicitContent
    );
    player.soundSet = playerSounds.map((sound) => sound.id);
    console.log(
      `🎯 SERVER: Generated ${player.soundSet.length} sounds for player ${player.name} (explicit: ${room.allowExplicitContent})`
    );
  }
}

function handlePlayerReconnection(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
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
    emoji: disconnectedPlayer.emoji, // Restore the player's emoji
    score: disconnectedPlayer.score,
    isVIP: disconnectedPlayer.isVIP,
    isDisconnected: false,
    soundSet: disconnectedPlayer.soundSet, // Restore the player's sound set
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
    // Notify any connected main screens that the room is closing
    const roomMainScreens = mainScreens.get(roomCode);
    console.log(`[MAIN SCREEN] Removing main screens for room ${roomCode}`);
    console.log(`[MAIN SCREEN] Current main screens:`, roomMainScreens);
    if (roomMainScreens && roomMainScreens.size > 0) {
      console.log(
        `[MAIN SCREEN] Notifying ${roomMainScreens.size} main screen(s) that room ${roomCode} is closing`
      );
      // Send to all main screens in this room
      roomMainScreens.forEach((mainScreenId) => {
        io.to(mainScreenId).emit("roomClosed", { roomCode });
      });
      // Clean up main screen tracking
      mainScreens.delete(roomCode);
      primaryMainScreens.delete(roomCode);
    }

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

// Deterministic randomization function using a simple LCG (Linear Congruential Generator)
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Use the hash as the initial seed for LCG
  let currentSeed = Math.abs(hash);

  return function () {
    // LCG formula: (a * seed + c) % m
    currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
    return currentSeed / 4294967296;
  };
}

// Shuffle array using seeded randomization for deterministic results
function shuffleWithSeed<T>(array: T[], seed: string): T[] {
  const shuffled = [...array]; // Create a copy
  const random = seededRandom(seed);

  // Fisher-Yates shuffle with seeded random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

// Generate a seed for submission randomization
function generateSubmissionSeed(roomCode: string, round: number): string {
  return `${roomCode}-round-${round}-${Date.now()}`;
}

// Socket handler function
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

      socket.on("createRoom", (playerData, callback) => {
        console.log("createRoom event received with playerData:", playerData);
        try {
          let roomCode: string;
          do {
            roomCode = generateRoomCode();
          } while (rooms.has(roomCode));

          const player: Player = {
            id: socket.id,
            name: playerData.name,
            color: playerData.color || getRandomColor([]),
            emoji: playerData.emoji || getRandomEmoji([]),
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
            maxScore: GAME_CONFIG.MAX_SCORE, // Add configurable max score
            allowExplicitContent: GAME_CONFIG.DEFAULT_ALLOW_EXPLICIT_CONTENT, // Default to family-friendly mode
            submissions: [],
            winner: null,
            usedPromptIds: [], // Track prompts used during this game session
            soundSelectionTimerStarted: false,
            judgeSelectionTimerStarted: false,
            promptChoices: [],
            lastWinner: null,
            lastWinningSubmission: null,
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

      socket.on("joinRoom", (roomCode, playerData, callback) => {
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
          const usedEmojis = room.players
            .map((p) => p.emoji)
            .filter(Boolean) as string[];
          const player: Player = {
            id: socket.id,
            name: playerData.name,
            color: playerData.color || getRandomColor(usedColors),
            emoji: playerData.emoji || getRandomEmoji(usedEmojis),
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

      socket.on("updateGameSettings", (settings) => {
        try {
          const roomCode = playerRooms.get(socket.id);
          if (!roomCode) return;

          const room = rooms.get(roomCode);
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
          io.to(roomCode).emit("gameSettingsUpdated", {
            maxRounds,
            maxScore,
            allowExplicitContent,
          });
          io.to(roomCode).emit("roomUpdated", room);
        } catch (error) {
          console.error("Error updating game settings:", error);
          socket.emit("error", { message: "Failed to update game settings" });
        }
      });

      socket.on("startGame", async () => {
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
          room.judgeSelectionTimerStarted = false;

          io.to(roomCode).emit("roomUpdated", room);
          io.to(roomCode).emit("judgeSelected", room.currentJudge);
          io.to(roomCode).emit("gameStateChanged", GameState.JUDGE_SELECTION, {
            judgeId: room.currentJudge,
          }); // Auto-transition to prompt selection after a delay
          room.judgeSelectionTimerStarted = true;
          setTimeout(async () => {
            if (room.gameState === GameState.JUDGE_SELECTION) {
              room.judgeSelectionTimerStarted = false;
              room.gameState = GameState.PROMPT_SELECTION;
              console.log(
                "Generating prompts for players:",
                room.players.map((p) => p.name)
              );
              const prompts = await getRandomPrompts(
                6,
                room.usedPromptIds || [],
                room.players.map((p) => p.name),
                room.allowExplicitContent
              );
              console.log(
                "Generated prompts:",
                prompts.map((p: GamePrompt) => ({ id: p.id, text: p.text }))
              );
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
                async () => {
                  // Auto-select first prompt if no selection made
                  if (room.gameState === GameState.PROMPT_SELECTION) {
                    console.log(
                      `[TIMER] Prompt selection time expired for room ${roomCode}, auto-selecting first prompt`
                    ); // Clear the prompt selection timer first
                    clearTimer(roomCode);

                    const firstPrompt = prompts[0];
                    processAndAssignPrompt(room, firstPrompt);

                    // Track this prompt as used to avoid repeating in future rounds
                    if (!room.usedPromptIds) {
                      room.usedPromptIds = [];
                    }
                    room.usedPromptIds.push(firstPrompt.id);

                    room.gameState = GameState.SOUND_SELECTION;
                    room.submissions = [];
                    room.randomizedSubmissions = []; // Clear randomized submissions for new round
                    room.submissionSeed = undefined; // Clear the seed
                    room.soundSelectionTimerStarted = false;

                    // Generate individual random sound sets for each non-judge player
                    await generatePlayerSoundSets(room);

                    io.to(roomCode).emit("roomUpdated", room);
                    io.to(roomCode).emit("promptSelected", firstPrompt);
                    io.to(roomCode).emit(
                      "gameStateChanged",
                      GameState.SOUND_SELECTION,
                      {
                        prompt: firstPrompt,
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
      socket.on("selectPrompt", async (promptId) => {
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
          } // Use available prompts from room if they exist, otherwise load dynamically
          let prompt;
          if (room.availablePrompts) {
            prompt = room.availablePrompts.find((p) => p.id === promptId);
          } else {
            const allPrompts = await getGamePrompts(
              room.players.map((p) => p.name)
            );
            prompt = allPrompts.find((p) => p.id === promptId);
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
          processAndAssignPrompt(room, prompt); // Store the full prompt object with processed text

          // Track this prompt as used to avoid repeating in future rounds
          if (!room.usedPromptIds) {
            room.usedPromptIds = [];
          }
          room.usedPromptIds.push(prompt.id);

          room.gameState = GameState.SOUND_SELECTION;
          room.submissions = [];
          room.randomizedSubmissions = []; // Clear randomized submissions for new round
          room.submissionSeed = undefined; // Clear the seed
          room.soundSelectionTimerStarted = false;

          // Generate individual random sound sets for each non-judge player
          await generatePlayerSoundSets(room);

          console.log(`🎯 SERVER: Emitting room updates for ${roomCode}`);
          io.to(roomCode).emit("roomUpdated", room);
          io.to(roomCode).emit("promptSelected", prompt); // Send the full prompt object
          io.to(roomCode).emit("gameStateChanged", GameState.SOUND_SELECTION, {
            prompt: prompt, // Send the full prompt object
            timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
            currentRound: room.currentRound,
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

          // Validate that sounds array has 1-2 valid sound IDs
          if (
            !Array.isArray(sounds) ||
            sounds.length < 1 ||
            sounds.length > 2
          ) {
            console.warn(
              `[SUBMISSION] Invalid sounds array from ${player.name}: ${sounds}`
            );
            return;
          }

          // Filter out empty strings and ensure we have valid sound IDs
          const validSounds = sounds.filter(
            (soundId) =>
              soundId && typeof soundId === "string" && soundId.trim() !== ""
          );
          if (validSounds.length < 1 || validSounds.length > 2) {
            console.warn(
              `[SUBMISSION] No valid sounds from ${player.name}: ${sounds}`
            );
            return;
          }

          // Check if player already submitted
          const existingSubmission = room.submissions.find(
            (s) => s.playerId === socket.id
          );
          if (existingSubmission) return;

          const submission = {
            playerId: socket.id,
            playerName: player.name,
            sounds: validSounds,
          };

          console.log(
            `[SUBMISSION] ${player.name} submitted ${
              validSounds.length
            } sound(s): [${validSounds.join(", ")}]`
          );

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

            // All submissions are in - now randomize them for consistent order across all clients
            console.log(
              `[SUBMISSION] All submissions received for room ${roomCode}. Randomizing order...`
            );

            // Generate a seed for deterministic randomization
            const seed = generateSubmissionSeed(roomCode, room.currentRound);
            room.submissionSeed = seed;

            // Create randomized order that will be consistent for all clients
            room.randomizedSubmissions = shuffleWithSeed(
              room.submissions,
              seed
            );

            console.log(
              `[SUBMISSION] Original order: [${room.submissions
                .map((s) => s.playerName)
                .join(", ")}]`
            );
            console.log(
              `[SUBMISSION] Randomized order: [${room.randomizedSubmissions
                .map((s) => s.playerName)
                .join(", ")}]`
            );

            // Check if there are any main screens connected
            const roomMainScreens = mainScreens.get(roomCode);
            const hasMainScreensConnected = roomMainScreens
              ? roomMainScreens.size > 0
              : false;
            if (!hasMainScreensConnected) {
              // No main screens - skip playback and go directly to judging
              console.log(
                `[SUBMISSION] No main screens connected. Skipping playback, going to JUDGING`
              );
              room.gameState = GameState.JUDGING;
              io.to(roomCode).emit("gameStateChanged", GameState.JUDGING, {
                submissions: room.submissions, // Send original submissions
                randomizedSubmissions: room.randomizedSubmissions, // Send randomized submissions separately
                judgeId: room.currentJudge,
              });
              io.to(roomCode).emit("roomUpdated", room);
            } else {
              // Main screens present - proceed with playback
              room.gameState = GameState.PLAYBACK;
              room.currentSubmissionIndex = 0; // Initialize for client-driven playback
              console.log(
                `[SUBMISSION] Transitioning to PLAYBACK with randomized submissions. Primary main screen: ${primaryMainScreens.get(
                  roomCode
                )}`
              );

              // Notify clients to start the playback sequence with randomized submissions
              io.to(roomCode).emit("gameStateChanged", GameState.PLAYBACK, {
                submissions: room.randomizedSubmissions, // Use randomized submissions
              });
              io.to(roomCode).emit("roomUpdated", room);

              // The primary main screen will now drive the playback by emitting 'requestNextSubmission'
            }
          }
        } catch (error) {
          console.error("Error submitting sounds:", error);
        }
      });

      socket.on("requestNextSubmission", () => {
        const roomCode = playerRooms.get(socket.id);
        if (!roomCode) return;

        // Security: Only the primary main screen should control playback
        // Socket augmentation for custom properties - proper interface extension would require module declaration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(socket as any).isViewer) {
          console.log(
            `[SECURITY] Player socket ${socket.id} attempted to control playback. Ignoring.`
          );
          return;
        }

        if (primaryMainScreens.get(roomCode) !== socket.id) {
          console.log(
            `[SECURITY] Secondary main screen ${
              socket.id
            } attempted to control playback for room ${roomCode}. Only primary main screen ${primaryMainScreens.get(
              roomCode
            )} can control playback. Ignoring.`
          );
          return;
        }

        const room = rooms.get(roomCode);
        if (!room || room.gameState !== GameState.PLAYBACK) return;

        const index = room.currentSubmissionIndex || 0;
        const submissionsToPlay =
          room.randomizedSubmissions || room.submissions; // Use randomized if available

        if (index < submissionsToPlay.length) {
          console.log(
            `[PLAYBACK] Primary main screen ${
              socket.id
            } playing randomized submission ${index + 1} of ${
              submissionsToPlay.length
            } for room ${roomCode} (Player: ${
              submissionsToPlay[index].playerName
            })`
          );
          io.to(roomCode).emit(
            "playSubmission",
            submissionsToPlay[index],
            index
          );
          room.currentSubmissionIndex = index + 1;
        } else {
          // All submissions played, add a delay before moving to judging
          console.log(
            `[PLAYBACK] All randomized submissions played for room ${roomCode}, adding delay before transitioning to JUDGING`
          );

          // Add a 2-second delay to let the final submission "breathe" before judging
          setTimeout(() => {
            console.log(
              `[PLAYBACK] Delay complete, now transitioning room ${roomCode} to JUDGING`
            );
            room.gameState = GameState.JUDGING;
            room.isPlayingBack = false; // Reset playback flag
            room.currentSubmissionIndex = 0; // Reset for next round

            io.to(roomCode).emit("gameStateChanged", GameState.JUDGING, {
              submissions: room.submissions, // Send original submissions
              randomizedSubmissions:
                room.randomizedSubmissions || room.submissions, // Send randomized submissions separately
              judgeId: room.currentJudge,
            });
            io.to(roomCode).emit("roomUpdated", room);
          }, 2500); // 2.5 second delay
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

          // Use randomized submissions for winner selection
          const submissionsToUse =
            room.randomizedSubmissions || room.submissions;
          const winningSubmission = submissionsToUse[parseInt(submissionIndex)];
          if (!winningSubmission) return;

          const winner = room.players.find(
            (p) => p.id === winningSubmission.playerId
          );
          if (!winner) return;

          winner.score += 1;
          room.gameState = GameState.ROUND_RESULTS;

          // Store winner information in room for persistence during reconnections
          room.lastWinner = winner.id;
          room.lastWinningSubmission = winningSubmission;

          // Send comprehensive winner information to all clients
          io.to(roomCode).emit("roundComplete", {
            winnerId: winner.id,
            winnerName: winner.name,
            winningSubmission: winningSubmission,
            submissionIndex: parseInt(submissionIndex),
          });
          io.to(roomCode).emit("roomUpdated", room); // Check if there are main screens to handle audio playback
          const roomMainScreens = mainScreens.get(roomCode);
          const hasMainScreensConnected = roomMainScreens
            ? roomMainScreens.size > 0
            : false;
          if (!hasMainScreensConnected) {
            // No main screens - skip audio playback and proceed immediately
            console.log(
              `No main screens connected. Proceeding directly to next round/game end check...`
            );

            // Simulate winnerAudioComplete logic inline
            setTimeout(() => {
              if (room.gameState !== GameState.ROUND_RESULTS) return;

              // Check if the game should end before starting next round
              const maxScore = Math.max(...room.players.map((p) => p.score));
              const gameWinners = room.players.filter(
                (p) => p.score === maxScore
              );
              const isEndOfRounds = room.currentRound >= room.maxRounds;
              const isScoreLimitReached = maxScore >= room.maxScore;
              const isTie = gameWinners.length > 1;

              console.log(
                `🏁 No-main-screen game completion check: currentRound=${room.currentRound}, maxRounds=${room.maxRounds}, maxScore=${maxScore}, scoreThreshold=${room.maxScore}, isTie=${isTie}`
              );

              // Game ends if end condition is met AND there is a single winner.
              if ((isEndOfRounds || isScoreLimitReached) && !isTie) {
                console.log(
                  `🎉 Game ending (no main screen): Round ${room.currentRound}/${room.maxRounds} or score ${maxScore} reached threshold with a single winner.`
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
                return; // Exit early - don't start next round
              } else if ((isEndOfRounds || isScoreLimitReached) && isTie) {
                console.log(
                  `👔 Tie detected at game end (no main screen). Entering sudden death. Players: ${gameWinners
                    .map((p) => p.name)
                    .join(", ")}`
                );
                io.to(roomCode).emit("tieBreakerRound", {
                  tiedPlayers: gameWinners.map((p) => ({
                    id: p.id,
                    name: p.name,
                  })),
                });
                // Continue to next round for tie-breaker
              }

              // Start next round (only if game didn't end)
              console.log(
                `Starting next round ${
                  room.currentRound + 1
                } (no main screen)...`
              );
              room.currentRound += 1;
              room.currentJudge = selectNextJudge(room);
              room.gameState = GameState.JUDGE_SELECTION;
              room.currentPrompt = null;
              room.submissions = [];
              room.randomizedSubmissions = []; // Clear randomized submissions for new round
              room.submissionSeed = undefined; // Clear the seed
              room.soundSelectionTimerStarted = false;
              room.judgeSelectionTimerStarted = false;

              // Clear previous round winner information
              room.lastWinner = null;
              room.lastWinningSubmission = null;

              io.to(roomCode).emit("judgeSelected", room.currentJudge);
              io.to(roomCode).emit(
                "gameStateChanged",
                GameState.JUDGE_SELECTION,
                { judgeId: room.currentJudge }
              );

              // Auto-transition to prompt selection
              room.judgeSelectionTimerStarted = true;
              setTimeout(async () => {
                if (room.gameState === GameState.JUDGE_SELECTION) {
                  room.judgeSelectionTimerStarted = false;
                  room.gameState = GameState.PROMPT_SELECTION;
                  console.log(
                    "Generating prompts for players:",
                    room.players.map((p) => p.name)
                  );
                  const prompts = await getRandomPrompts(
                    6,
                    room.usedPromptIds || [],
                    room.players.map((p) => p.name),
                    room.allowExplicitContent
                  );
                  console.log(
                    "Generated prompts:",
                    prompts.map((p: GamePrompt) => ({ id: p.id, text: p.text }))
                  );
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
                    async () => {
                      // Auto-select first prompt if no selection made
                      if (room.gameState === GameState.PROMPT_SELECTION) {
                        const firstPrompt = prompts[0];
                        processAndAssignPrompt(room, firstPrompt);

                        // Track this prompt as used to avoid repeating in future rounds
                        if (!room.usedPromptIds) {
                          room.usedPromptIds = [];
                        }
                        room.usedPromptIds.push(firstPrompt.id);

                        room.gameState = GameState.SOUND_SELECTION;
                        room.submissions = [];
                        room.randomizedSubmissions = []; // Clear randomized submissions for new round
                        room.submissionSeed = undefined; // Clear the seed
                        room.soundSelectionTimerStarted = false;

                        // Generate individual random sound sets for each non-judge player
                        await generatePlayerSoundSets(room);

                        io.to(roomCode).emit("roomUpdated", room);
                        io.to(roomCode).emit("promptSelected", firstPrompt);
                        io.to(roomCode).emit(
                          "gameStateChanged",
                          GameState.SOUND_SELECTION,
                          {
                            prompt: firstPrompt,
                            promptAudio: firstPrompt.audioFile, // Include audio file for main screen
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
            }, 2000); // 2 second pause to show results
          } else {
            // Main screens present - wait for winnerAudioComplete signal
            console.log(
              `Main screens connected. Round results displayed, waiting for client audio completion before checking game end...`
            );
            // The next round (or game end) will be triggered when client emits 'winnerAudioComplete'
          }
        } catch (error) {
          console.error("Error selecting winner:", error);
        }
      });

      // Handle judging playback requests - route to main screen if available
      socket.on(
        "requestJudgingPlayback",
        (data: { submissionIndex: number; sounds: string[] }) => {
          try {
            const roomCode = playerRooms.get(socket.id);
            if (!roomCode) {
              socket.emit("judgingPlaybackResponse", {
                success: false,
                submissionIndex: data.submissionIndex,
              });
              return;
            }

            const room = rooms.get(roomCode);
            if (!room || room.gameState !== GameState.JUDGING) {
              socket.emit("judgingPlaybackResponse", {
                success: false,
                submissionIndex: data.submissionIndex,
              });
              return;
            }

            // Only allow the judge to request playback
            if (room.currentJudge !== socket.id) {
              console.log(
                `[JUDGING PLAYBACK] Non-judge ${socket.id} attempted to request playback. Ignoring.`
              );
              socket.emit("judgingPlaybackResponse", {
                success: false,
                submissionIndex: data.submissionIndex,
              });
              return;
            }

            console.log(
              `[JUDGING PLAYBACK] Judge requesting playback for submission ${data.submissionIndex} in room ${roomCode}`
            );

            // Check if we have main screens connected
            const roomMainScreens = mainScreens.get(roomCode);
            const hasMainScreensConnected = roomMainScreens
              ? roomMainScreens.size > 0
              : false;
            if (hasMainScreensConnected) {
              console.log(
                `[JUDGING PLAYBACK] Main screens available, routing to main screen`
              );

              // Get the submission data from the room to send to main screen
              const submissionsToShow =
                room.randomizedSubmissions || room.submissions;
              const submission = submissionsToShow[data.submissionIndex];
              if (submission) {
                // Emit the playJudgingSubmission event to main screens only
                // Get all main screen socket IDs for this room
                const roomMainScreens = mainScreens.get(roomCode);
                if (roomMainScreens) {
                  roomMainScreens.forEach((mainScreenSocketId) => {
                    const mainScreenSocket =
                      io.sockets.sockets.get(mainScreenSocketId);
                    if (mainScreenSocket) {
                      console.log(
                        `[JUDGING PLAYBACK] Sending submission to main screen ${mainScreenSocketId}`
                      );
                      console.log(`[JUDGING PLAYBACK] Submission data:`, {
                        playerName: submission.playerName,
                        sounds: submission.sounds,
                      });
                      mainScreenSocket.emit(
                        "playJudgingSubmission",
                        submission,
                        data.submissionIndex
                      );
                    }
                  });
                }

                // Respond to judge that main screen playback was initiated
                socket.emit("judgingPlaybackResponse", {
                  success: true,
                  submissionIndex: data.submissionIndex,
                });
              } else {
                console.log(
                  `[JUDGING PLAYBACK] Submission ${data.submissionIndex} not found`
                );
                socket.emit("judgingPlaybackResponse", {
                  success: false,
                  submissionIndex: data.submissionIndex,
                });
              }
            } else {
              console.log(
                `[JUDGING PLAYBACK] No main screens connected, requesting local fallback`
              );
              // No main screens available, tell judge to play locally
              socket.emit("judgingPlaybackResponse", {
                success: false,
                submissionIndex: data.submissionIndex,
              });
            }
          } catch (error) {
            console.error("Error handling judging playback request:", error);
            socket.emit("judgingPlaybackResponse", {
              success: false,
              submissionIndex: data.submissionIndex,
            });
          }
        }
      );

      // Handle winner audio completion to trigger next round
      socket.on("winnerAudioComplete", () => {
        try {
          const roomCode = playerRooms.get(socket.id);
          if (!roomCode) return;

          // Only accept winner audio completion from primary main screen or if no main screens exist
          if (
            // Socket augmentation for custom properties - proper interface extension would require module declaration
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (socket as any).isViewer &&
            primaryMainScreens.get(roomCode) !== socket.id
          ) {
            console.log(
              `[SECURITY] Secondary main screen ${
                socket.id
              } attempted to signal winner audio complete for room ${roomCode}. Only primary main screen ${primaryMainScreens.get(
                roomCode
              )} can do this. Ignoring.`
            );
            return;
          }

          const room = rooms.get(roomCode);
          if (!room || room.gameState !== GameState.ROUND_RESULTS) return;

          console.log(
            `Winner audio complete from ${
              // Socket augmentation for custom properties - proper interface extension would require module declaration
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (socket as any).isViewer ? "primary main screen" : "player"
            } ${socket.id}, checking if game should continue...`
          );

          // Check if the game should end before starting next round
          const maxScore = Math.max(...room.players.map((p) => p.score));
          const gameWinners = room.players.filter((p) => p.score === maxScore);
          const isEndOfRounds = room.currentRound >= room.maxRounds;
          const isScoreLimitReached = maxScore >= room.maxScore;
          const isTie = gameWinners.length > 1;

          console.log(
            `🏁 Post-audio game completion check: currentRound=${room.currentRound}, maxRounds=${room.maxRounds}, maxScore=${maxScore}, scoreThreshold=${room.maxScore}, isTie=${isTie}`
          );

          // Game ends if end condition is met AND there is a single winner.
          if ((isEndOfRounds || isScoreLimitReached) && !isTie) {
            console.log(
              `🎉 Game ending after winner audio: Round ${room.currentRound}/${room.maxRounds} or score ${maxScore} reached threshold with a single winner. Waiting 3 seconds before showing game over screen...`
            );

            // Add 3-second delay before transitioning to game over screen
            setTimeout(() => {
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
            }, 3000); // 3 second delay for celebration
            return; // Exit early - don't start next round
          } else if ((isEndOfRounds || isScoreLimitReached) && isTie) {
            console.log(
              `👔 Tie detected at game end (post-audio). Entering sudden death. Players: ${gameWinners
                .map((p) => p.name)
                .join(", ")}`
            );
            io.to(roomCode).emit("tieBreakerRound", {
              tiedPlayers: gameWinners.map((p) => ({
                id: p.id,
                name: p.name,
              })),
            });
            // Continue to next round for tie-breaker
          }

          // Start next round after a brief pause (only if game didn't end)
          setTimeout(() => {
            console.log(
              `Starting next round ${
                room.currentRound + 1
              } after winner audio completion...`
            );
            room.currentRound += 1;
            room.currentJudge = selectNextJudge(room);
            room.gameState = GameState.JUDGE_SELECTION;
            room.currentPrompt = null;
            room.submissions = [];
            room.randomizedSubmissions = []; // Clear randomized submissions for new round
            room.submissionSeed = undefined; // Clear the seed
            room.soundSelectionTimerStarted = false;
            room.judgeSelectionTimerStarted = false;

            // Clear previous round winner information
            room.lastWinner = null;
            room.lastWinningSubmission = null;

            io.to(roomCode).emit("judgeSelected", room.currentJudge);
            io.to(roomCode).emit(
              "gameStateChanged",
              GameState.JUDGE_SELECTION,
              { judgeId: room.currentJudge }
            ); // Auto-transition to prompt selection
            room.judgeSelectionTimerStarted = true;
            setTimeout(async () => {
              if (room.gameState === GameState.JUDGE_SELECTION) {
                room.judgeSelectionTimerStarted = false;
                room.gameState = GameState.PROMPT_SELECTION;
                console.log(
                  "Generating prompts for players:",
                  room.players.map((p) => p.name)
                );
                const prompts = await getRandomPrompts(
                  6,
                  room.usedPromptIds || [],
                  room.players.map((p) => p.name),
                  room.allowExplicitContent
                );
                console.log(
                  "Generated prompts:",
                  prompts.map((p: GamePrompt) => ({ id: p.id, text: p.text }))
                );
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
                  async () => {
                    // Auto-select first prompt if no selection made
                    if (room.gameState === GameState.PROMPT_SELECTION) {
                      const firstPrompt = prompts[0];
                      processAndAssignPrompt(room, firstPrompt);

                      // Track this prompt as used to avoid repeating in future rounds
                      if (!room.usedPromptIds) {
                        room.usedPromptIds = [];
                      }
                      room.usedPromptIds.push(firstPrompt.id);

                      room.gameState = GameState.SOUND_SELECTION;
                      room.submissions = [];
                      room.randomizedSubmissions = []; // Clear randomized submissions for new round
                      room.submissionSeed = undefined; // Clear the seed
                      room.soundSelectionTimerStarted = false;

                      // Generate individual random sound sets for each non-judge player
                      await generatePlayerSoundSets(room);

                      io.to(roomCode).emit("roomUpdated", room);
                      io.to(roomCode).emit("promptSelected", firstPrompt);
                      io.to(roomCode).emit(
                        "gameStateChanged",
                        GameState.SOUND_SELECTION,
                        {
                          prompt: firstPrompt,
                          promptAudio: firstPrompt.audioFile, // Include audio file for main screen
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
              `[VIEWER] Main screen ${socket.id} joining room ${normalizedRoomCode} as viewer`
            );
            socket.join(normalizedRoomCode);

            // Add viewer to playerRooms map so they can emit events for this room
            playerRooms.set(socket.id, normalizedRoomCode);

            // Track this main screen and potentially elect as primary
            addMainScreen(normalizedRoomCode, socket.id);

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

            // Socket augmentation for custom properties - proper interface extension would require module declaration
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (socket as any).isViewer = true; // Mark this socket as a viewer
            // Socket augmentation for custom properties - proper interface extension would require module declaration
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (socket as any).isPrimaryMainScreen =
              primaryMainScreens.get(normalizedRoomCode) === socket.id; // Mark if primary

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
              // Check if this is a main screen leaving
              // Socket augmentation for custom properties - proper interface extension would require module declaration
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if ((socket as any).isViewer) {
                console.log(
                  `[MAIN SCREEN] Main screen ${socket.id} leaving room ${roomCode}`
                );
                removeMainScreen(roomCode, socket.id);
                playerRooms.delete(socket.id);
                socket.leave(roomCode);
              } else {
                // Regular player leaving
                room.players = room.players.filter((p) => p.id !== socket.id);
                playerRooms.delete(socket.id);
                socket.leave(roomCode);

                if (room.players.length === 0) {
                  rooms.delete(roomCode);
                  clearTimer(roomCode); // Clear any timers associated with the empty room
                  // Clean up main screen tracking too
                  mainScreens.delete(roomCode);
                  primaryMainScreens.delete(roomCode);
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
                    room.currentJudge = selectNextJudge(room);
                    io.to(roomCode).emit(
                      "judgeSelected",
                      room.currentJudge as string
                    );
                  }
                  io.to(roomCode).emit("roomUpdated", room);
                }
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
            // Check if this was a main screen and clean up tracking
            // Socket augmentation for custom properties - proper interface extension would require module declaration
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((socket as any).isViewer) {
              console.log(
                `[MAIN SCREEN] Main screen ${socket.id} disconnected from room ${roomCode}`
              );
              removeMainScreen(roomCode, socket.id);
            } else {
              // Use new disconnection handling for regular players
              handlePlayerDisconnection(io, socket.id, roomCode);
            }
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
      });
    });
  }
  res.end();
}
