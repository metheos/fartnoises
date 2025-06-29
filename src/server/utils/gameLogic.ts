// Game logic utilities for the fartnoises game server
import { Room, GameState } from "@/types/game";
import { GAME_CONFIG } from "@/data/gameData";
import { getRandomSounds } from "@/utils/soundLoader";
import { SocketContext } from "../types/socketTypes";
import { startTimer, clearTimer } from "./timerManager";

// Helper function for starting the delayed sound selection timer
// This should only be called after the first player submits their sounds
export function startDelayedSoundSelectionTimer(
  context: SocketContext,
  roomCode: string,
  room: Room
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
    context,
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
                `[TIMER] Auto-submitting for ${
                  player.name
                }: [${selectedSounds.join(", ")}]`
              );
              room.submissions.push(autoSubmission);
              context.io.to(roomCode).emit("soundSubmitted", autoSubmission);
            }
          } else {
            console.log(
              `[TIMER] Player ${player.name} has no sound set available for auto-submission`
            );
          }
        }

        // Update room state after auto-submissions
        context.io.to(roomCode).emit("roomUpdated", room);

        // Proceed with normal end-of-submissions logic
        handleAllSubmissionsComplete(context, roomCode, room);
      }
    },
    (timeLeft) => {
      // Only send timeUpdate if timer has been started (prevents premature time updates)
      if (room.soundSelectionTimerStarted) {
        console.log(
          `[${new Date().toISOString()}] [TIMER] Sound selection time update: ${timeLeft}s remaining for room ${roomCode}, game state: ${
            room.gameState
          }`
        );
        if (room.gameState === GameState.SOUND_SELECTION) {
          context.io.to(roomCode).emit("timeUpdate", { timeLeft });
        } else {
          console.log(
            `[${new Date().toISOString()}] [TIMER] Suppressing timeUpdate for sound selection: game state is now ${
              room.gameState
            }`
          );
        }
      } else {
        console.log(
          `[${new Date().toISOString()}] [TIMER] Suppressing timeUpdate for sound selection: timer not yet started in room ${roomCode}`
        );
      }
    }
  );
}

// Generate individual random sound sets for each non-judge player
export async function generatePlayerSoundSets(room: Room): Promise<void> {
  const nonJudgePlayers = room.players.filter(
    (p) => p.id !== room.currentJudge
  );

  // Generate sounds for each non-judge player
  for (const player of nonJudgePlayers) {
    try {
      // Generate 15 random sounds for this player
      const playerSounds = await getRandomSounds(
        15,
        undefined,
        room.allowExplicitContent
      );
      player.soundSet = playerSounds.map((sound) => sound.id);
      console.log(
        `Generated ${playerSounds.length} sounds for player ${player.name}`
      );
    } catch (error) {
      console.error(
        `Error generating sounds for player ${player.name}:`,
        error
      );
      player.soundSet = []; // Fallback to empty array
    }
  }
}

// Handle the completion of all submissions
export function handleAllSubmissionsComplete(
  context: SocketContext,
  roomCode: string,
  room: Room
) {
  // Clear the sound selection timer since all players submitted
  clearTimer(context, roomCode);

  // All submissions are in - now randomize them for consistent order across all clients
  console.log(
    `[SUBMISSION] All submissions received for room ${roomCode}. Randomizing order...`
  );

  // Generate a seed for deterministic randomization
  const seed = generateSubmissionSeed(roomCode, room.currentRound);
  room.submissionSeed = seed.toString();

  // Create randomized order that will be consistent for all clients
  room.randomizedSubmissions = shuffleWithSeed(room.submissions, seed);

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
  const roomMainScreens = context.mainScreens.get(roomCode);
  const hasMainScreensConnected = roomMainScreens
    ? roomMainScreens.size > 0
    : false;
  if (!hasMainScreensConnected) {
    // No main screens - skip playback and go directly to judging
    console.log(
      `[SUBMISSION] No main screens connected. Skipping playback, going to JUDGING`
    );
    room.gameState = GameState.JUDGING;
    context.io.to(roomCode).emit("gameStateChanged", GameState.JUDGING, {
      submissions: room.submissions, // Send original submissions
      randomizedSubmissions: room.randomizedSubmissions, // Send randomized submissions separately
      judgeId: room.currentJudge,
    });
    context.io.to(roomCode).emit("roomUpdated", room);
  } else {
    // Main screens present - proceed with playback
    room.gameState = GameState.PLAYBACK;
    room.currentSubmissionIndex = 0; // Initialize for client-driven playback
    console.log(
      `[SUBMISSION] Transitioning to PLAYBACK with randomized submissions. Primary main screen: ${context.primaryMainScreens.get(
        roomCode
      )}`
    );

    // Notify clients to start the playback sequence with randomized submissions
    context.io.to(roomCode).emit("gameStateChanged", GameState.PLAYBACK, {
      submissions: room.randomizedSubmissions, // Use randomized submissions
    });
    context.io.to(roomCode).emit("roomUpdated", room);

    // The primary main screen will now drive the playback by emitting 'requestNextSubmission'
  }
}

// Utility functions for submission randomization
export function generateSubmissionSeed(
  roomCode: string,
  round: number
): number {
  // Create a deterministic seed based on room code and round
  let hash = 0;
  const str = `${roomCode}-${round}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let random = seed;

  // Simple linear congruential generator for deterministic randomness
  const lcg = () => {
    random = (random * 1664525 + 1013904223) % 2 ** 32;
    return random / 2 ** 32;
  };

  // Fisher-Yates shuffle with seeded randomness
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(lcg() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}
