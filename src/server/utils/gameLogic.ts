// Game logic utilities for the fartnoises game server
import { Room, GameState } from "@/types/game";
import { GAME_CONFIG } from "@/data/gameData";
import { getRandomSounds } from "@/utils/soundLoader";
import { SocketContext } from "../types/socketTypes";
import { startTimer, clearTimer } from "./timerManager";
import { makeBotJudgingDecision } from "./botManager";

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
      // Generate 10 random sounds for this player
      console.log(
        `[SOUND_GEN] Generating sounds for player ${player.name}, requesting 10 sounds`
      );
      const playerSounds = await getRandomSounds(
        10,
        undefined,
        room.allowExplicitContent
      );
      player.soundSet = playerSounds.map((sound) => sound.id);
      console.log(
        `[SOUND_GEN] Generated ${playerSounds.length} sounds for player ${
          player.name
        }: [${player.soundSet.join(", ")}]`
      );

      // Debug: Check if we got less than 10 sounds
      if (playerSounds.length !== 10) {
        console.warn(
          `[SOUND_GEN] ⚠️  Expected 10 sounds, got ${playerSounds.length} for ${player.name}`
        );
        console.warn(`[SOUND_GEN] Sound IDs: [${player.soundSet.join(", ")}]`);
      }
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

  // Generate a well-mixed seed for deterministic randomization
  // This breaks the linear pattern of consecutive timestamps while staying deterministic
  const timestamp = Math.floor(Date.now() / 1000);
  const seed = generateWellMixedSeed(roomCode, room.currentRound, timestamp);
  room.submissionSeed = seed.toString();

  console.log(
    `[SUBMISSION] Using well-mixed seed: ${seed} (from timestamp: ${timestamp})`
  );

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

    // If judge is a bot, make the judging decision
    makeBotJudgingDecision(context, room);
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

// Generate a well-mixed seed that breaks linear patterns of consecutive timestamps
export function generateWellMixedSeed(
  roomCode: string,
  round: number,
  timestamp: number
): number {
  // Combine multiple sources to create a well-distributed seed
  let hash = 0;

  // Mix in room code
  for (let i = 0; i < roomCode.length; i++) {
    hash = ((hash << 5) - hash + roomCode.charCodeAt(i)) & 0xffffffff;
  }

  // Mix in round number with large prime multiplier
  hash = (hash * 1009 + round * 2017) & 0xffffffff;

  // Mix in timestamp with bit manipulation to break linear patterns
  const mixedTimestamp = timestamp ^ (timestamp >>> 16) ^ (timestamp << 11);
  hash = (hash * 3001 + mixedTimestamp * 5003) & 0xffffffff;

  // Additional mixing pass using xorshift-like operations
  hash ^= hash >>> 13;
  hash = (hash * 0x85ebca6b) & 0xffffffff;
  hash ^= hash >>> 16;
  hash = (hash * 0xc2b2ae35) & 0xffffffff;
  hash ^= hash >>> 13;

  // Ensure positive result
  const result = Math.abs(hash);

  console.log(
    `[SEED] Mixed seed generation: room=${roomCode}, round=${round}, timestamp=${timestamp} → ${result}`
  );

  return result;
}

export function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let random = seed;

  console.log(
    `[SHUFFLE] Starting shuffle with seed: ${seed}, array length: ${array.length}`
  );

  // For arrays of length 2, use a simpler approach to ensure 50/50 chance
  if (array.length === 2) {
    // Simple linear congruential generator for deterministic randomness
    random = (random * 1664525 + 1013904223) % 2 ** 32;
    const randomValue = random / 2 ** 32;
    console.log(`[SHUFFLE] Two-item array - LCG generated: ${randomValue}`);

    // If random value is >= 0.5, swap the items
    if (randomValue >= 0.5) {
      console.log(`[SHUFFLE] Random value >= 0.5, swapping items`);
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    } else {
      console.log(`[SHUFFLE] Random value < 0.5, keeping original order`);
    }

    console.log(
      `[SHUFFLE] Final shuffled array:`,
      // Using any here because this debug function works with either submission objects or strings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      shuffled.map((item: any) => item.playerName || item)
    );
    return shuffled;
  }

  // Simple linear congruential generator for deterministic randomness
  const lcg = () => {
    random = (random * 1664525 + 1013904223) % 2 ** 32;
    const result = random / 2 ** 32;
    console.log(`[SHUFFLE] LCG generated: ${result}`);
    return result;
  };

  // Fisher-Yates shuffle with seeded randomness
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomValue = lcg();
    const j = Math.floor(randomValue * (i + 1));
    console.log(
      `[SHUFFLE] Step ${
        shuffled.length - 1 - i
      }: i=${i}, randomValue=${randomValue}, j=${j}`
    );

    if (i !== j) {
      console.log(`[SHUFFLE] Swapping positions ${i} and ${j}`);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    } else {
      console.log(`[SHUFFLE] No swap needed (i === j)`);
    }
  }

  console.log(
    `[SHUFFLE] Final shuffled array:`,
    // Using any here because this debug function works with either submission objects or strings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shuffled.map((item: any) => item.playerName || item)
  );
  return shuffled;
}
