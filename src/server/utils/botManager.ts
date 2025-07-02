// Bot management utilities for the fartnoises game server
import { Room, Player, GameState, SoundSubmission } from "@/types/game";
import { SocketContext, BOT_ONLY_ROOM_TIMEOUT } from "../types/socketTypes";
import {
  getRandomColor,
  getRandomEmoji,
  processAndAssignPrompt,
  selectNextJudge,
  broadcastRoomListUpdate,
} from "./roomManager";
import { getRandomSounds } from "@/utils/soundLoader";
import { GAME_CONFIG } from "@/data/gameData";
import { clearTimer } from "./timerManager";
import {
  generatePlayerSoundSets,
  startDelayedSoundSelectionTimer,
  handleAllSubmissionsComplete,
} from "./gameLogic";

// List of bot names that sound fun and quirky
const BOT_NAMES = [
  "SoundBot",
  "Farticus",
  "TootMaster",
  "GasBot",
  "WindBot",
  "BubbleBot",
  "SqueakBot",
  "WhooshBot",
  "BoomBot",
  "ZapBot",
  "PoofBot",
  "ChimeBot",
  "BuzzBot",
  "CrackleBot",
  "RumbleBot",
  "ThudBot",
  "PlinkBot",
  "DingBot",
  "ClangBot",
  "WhistleBot",
];

// Create a bot player with random characteristics
export function createBot(room: Room): Player {
  const usedNames = room.players.map((p) => p.name);
  const usedColors = room.players.map((p) => p.color);
  const usedEmojis = room.players
    .map((p) => p.emoji)
    .filter(Boolean) as string[];

  // Find an available bot name
  const availableNames = BOT_NAMES.filter((name) => !usedNames.includes(name));
  const botName =
    availableNames.length > 0
      ? availableNames[Math.floor(Math.random() * availableNames.length)]
      : `Bot${Math.floor(Math.random() * 1000)}`;

  const bot: Player = {
    id: `bot_${Date.now()}_${Math.random()}`, // Unique bot ID
    name: botName,
    color: getRandomColor(usedColors),
    emoji: getRandomEmoji(usedEmojis),
    score: 0,
    likeScore: 0,
    isVIP: false,
    isBot: true,
    hasUsedRefresh: false,
    hasUsedTripleSound: false,
    hasActivatedTripleSound: false,
    hasUsedNuclearOption: false,
  };

  console.log(`[BOT] Created bot player: ${bot.name} (${bot.id})`);
  return bot;
}

// Add bots to bring the room to minimum player count (3)
export async function addBotsIfNeeded(
  context: SocketContext,
  room: Room
): Promise<void> {
  const humanPlayers = room.players.filter((p) => !p.isBot);
  const totalPlayers = room.players.length;

  // Only add bots if we have 1-2 human players and need to reach minimum of 3
  if (humanPlayers.length >= 3 || humanPlayers.length === 0) {
    return; // Don't add bots if we have 3+ humans or no humans
  }

  const botsNeeded = Math.max(0, 3 - totalPlayers);

  console.log(
    `[BOT] Room ${room.code} has ${humanPlayers.length} human players and ${
      totalPlayers - humanPlayers.length
    } bots. Adding ${botsNeeded} more bots.`
  );

  for (let i = 0; i < botsNeeded; i++) {
    const bot = createBot(room);
    room.players.push(bot);

    // Emit player joined event for the bot
    context.io.to(room.code).emit("playerJoined", { room });
    context.io.to(room.code).emit("roomUpdated", room);
  }

  console.log(
    `[BOT] Room ${room.code} now has ${room.players.length} total players`
  );
}

// Remove all bots from the room
export function removeAllBots(context: SocketContext, room: Room): void {
  const initialPlayerCount = room.players.length;
  room.players = room.players.filter((p) => !p.isBot);
  const removedBots = initialPlayerCount - room.players.length;

  if (removedBots > 0) {
    console.log(`[BOT] Removed ${removedBots} bots from room ${room.code}`);
    context.io.to(room.code).emit("roomUpdated", room);
  }
}

// Bot decision making for sound selection
export async function makeBotSoundSubmissions(
  context: SocketContext,
  room: Room
): Promise<void> {
  const botPlayers = room.players.filter(
    (p) => p.isBot && p.id !== room.currentJudge
  );

  console.log(
    `[BOT] makeBotSoundSubmissions called for room ${room.code}, found ${botPlayers.length} non-judge bots`
  );

  if (botPlayers.length === 0) {
    console.log(`[BOT] No non-judge bot players found in room ${room.code}`);
    return;
  }

  console.log(
    `[BOT] Making sound submissions for ${botPlayers.length} bots: ${botPlayers
      .map((b) => b.name)
      .join(", ")}`
  );

  for (const bot of botPlayers) {
    await makeBotSoundSubmission(context, room, bot);
  }
}

// Make a single bot's sound submission
async function makeBotSoundSubmission(
  context: SocketContext,
  room: Room,
  bot: Player
): Promise<void> {
  if (!bot.soundSet || bot.soundSet.length === 0) {
    console.log(`[BOT] Bot ${bot.name} has no sound set, skipping submission`);
    return;
  }

  // Check if this bot already submitted
  if (room.submissions.some((s) => s.playerId === bot.id)) {
    return;
  }

  // Randomly decide how many sounds to submit (1-2, or 3 if using triple sound)
  let numSounds = Math.random() < 0.7 ? 2 : 1; // 70% chance of 2 sounds

  // 15% chance to use triple sound powerup if available
  if (!bot.hasUsedTripleSound && Math.random() < 0.15) {
    bot.hasUsedTripleSound = true;
    bot.hasActivatedTripleSound = true;
    numSounds = 3;
    console.log(`[BOT] ${bot.name} is using triple sound powerup`);
    context.io.to(room.code).emit("tripleSoundActivated", { playerId: bot.id });
  }

  // 10% chance to use refresh powerup if available and hasn't used it
  if (!bot.hasUsedRefresh && Math.random() < 0.1) {
    bot.hasUsedRefresh = true;
    console.log(`[BOT] ${bot.name} is using refresh powerup`);

    // Generate new sounds
    try {
      const newSounds = await getRandomSounds(
        10,
        undefined,
        room.allowExplicitContent
      );
      bot.soundSet = newSounds.map((sound) => sound.id);
      context.io.to(room.code).emit("soundsRefreshed", {
        playerId: bot.id,
        newSounds: bot.soundSet,
      });
    } catch (error) {
      console.error(`[BOT] Error refreshing sounds for ${bot.name}:`, error);
    }
  }

  // Select sounds randomly from the bot's sound set
  const selectedSounds: string[] = [];
  const availableSounds = [...bot.soundSet]; // Copy to avoid modifying original

  for (let i = 0; i < Math.min(numSounds, availableSounds.length); i++) {
    const randomIndex = Math.floor(Math.random() * availableSounds.length);
    const selectedSound = availableSounds.splice(randomIndex, 1)[0];
    selectedSounds.push(selectedSound);
  }

  if (selectedSounds.length > 0) {
    const submission: SoundSubmission = {
      playerId: bot.id,
      playerName: bot.name,
      sounds: selectedSounds,
    };

    // Add a small delay to make bot submissions feel more natural
    const delay = Math.random() * 3000 + 1000; // 1-4 seconds
    setTimeout(() => {
      room.submissions.push(submission);
      context.io.to(room.code).emit("soundSubmitted", submission);

      console.log(
        `[BOT] ${bot.name} submitted sounds: [${selectedSounds.join(", ")}]`
      );

      // Check if this is the first submission and start the timer
      if (room.submissions.length === 1 && !room.soundSelectionTimerStarted) {
        console.log(
          `[${new Date().toISOString()}] [BOT SUBMISSION] First submission (bot), starting countdown timer`
        );
        startDelayedSoundSelectionTimer(context, room.code, room);
      }

      // Send updated room state to all clients (including main screen viewers)
      context.io.to(room.code).emit("roomUpdated", room);

      // Check if all non-judge players have submitted
      const nonJudgePlayers = room.players.filter(
        (p) => p.id !== room.currentJudge
      );
      if (room.submissions.length === nonJudgePlayers.length) {
        console.log(
          `[BOT SUBMISSION] All ${nonJudgePlayers.length} players have submitted, proceeding to game completion logic`
        );
        handleAllSubmissionsComplete(context, room.code, room);
      }
    }, delay);
  }
}

// Bot decision making for judging (picking a winner)
export function makeBotJudgingDecision(
  context: SocketContext,
  room: Room
): void {
  const judge = room.players.find((p) => p.id === room.currentJudge);
  if (!judge || !judge.isBot) return;

  if (!room.randomizedSubmissions || room.randomizedSubmissions.length === 0) {
    console.log(`[BOT] Judge bot ${judge.name} found no submissions to judge`);
    return;
  }

  console.log(`[BOT] Judge bot ${judge.name} is making a decision...`);

  // Add delay to make the bot feel more natural
  const delay = Math.random() * 4000 + 2000; // 2-6 seconds

  setTimeout(() => {
    // 5% chance to use nuclear option if available
    if (!judge.hasUsedNuclearOption && Math.random() < 0.05) {
      judge.hasUsedNuclearOption = true;
      console.log(`[BOT] Judge bot ${judge.name} used nuclear option!`);

      context.io.to(room.code).emit("nuclearOptionTriggered", {
        judgeId: judge.id,
        judgeName: judge.name,
        roomCode: room.code,
      });

      // Add the same timeout logic as the human nuclear option handler
      // After explosion animation (5 seconds), proceed to next round
      setTimeout(async () => {
        if (room.gameState === GameState.JUDGING) {
          console.log(
            `[BOT NUCLEAR] Proceeding to next round after bot nuclear explosion`
          );

          // Move to next round without selecting a winner
          room.currentRound += 1;

          // Check if game should end
          const isEndOfRounds = room.currentRound > room.maxRounds;

          if (isEndOfRounds) {
            // Game over - determine winner by current scores
            const maxScore = Math.max(...room.players.map((p) => p.score));
            const gameWinners = room.players.filter(
              (p) => p.score === maxScore
            );

            if (gameWinners.length === 1) {
              room.gameState = GameState.GAME_OVER;
              room.winner = gameWinners[0].id;
              context.io
                .to(room.code)
                .emit("gameComplete", gameWinners[0].id, gameWinners[0].name);
            } else {
              // Tie - continue with tie-breaker
              context.io.to(room.code).emit("tieBreakerRound", {
                tiedPlayers: gameWinners.map((p) => ({
                  id: p.id,
                  name: p.name,
                })),
              });
              // Continue to next round for tie-breaker
            }
          } else {
            // Start next round - import the function
            const { startNextRound } = await import("../handlers/gameHandlers");
            await startNextRound(context, room.code);
          }

          context.io.to(room.code).emit("roomUpdated", room);
        }
      }, 5000); // 5 seconds for explosion animation

      return;
    }

    // Otherwise, pick a random submission as winner
    const randomIndex = Math.floor(
      Math.random() * room.randomizedSubmissions!.length
    );
    const winningSubmission = room.randomizedSubmissions![randomIndex];

    // Implement the selectWinner logic directly
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
    context.io.to(room.code).emit("roundComplete", {
      winnerId: winner.id,
      winnerName: winner.name,
      winningSubmission: winningSubmission,
      submissionIndex: randomIndex,
    });
    context.io.to(room.code).emit("roomUpdated", room);

    console.log(
      `[BOT] Judge bot ${judge.name} selected ${winner.name} as winner`
    );

    // Check if there are main screens to handle audio playback
    const roomMainScreens = context.mainScreens.get(room.code);
    const hasMainScreensConnected = roomMainScreens
      ? roomMainScreens.size > 0
      : false;
    if (!hasMainScreensConnected) {
      // No main screens - skip audio playback and proceed immediately
      console.log(
        `[BOT] No main screens connected. Proceeding directly to next round/game end check...`
      );

      // Simulate a short delay for results display, then proceed to next round
      setTimeout(async () => {
        // Check if game should end
        if (
          winner.score >= room.maxScore ||
          room.currentRound >= room.maxRounds
        ) {
          room.gameState = GameState.GAME_OVER;
          room.winner = winner.id;

          context.io.to(room.code).emit("gameComplete", winner.id, winner.name);
          context.io.to(room.code).emit("roomUpdated", room);
        } else {
          // Start next round - similar to the startNextRound logic
          room.currentRound += 1;
          room.currentJudge = selectNextJudge(room);
          room.gameState = GameState.JUDGE_SELECTION;
          room.submissions = [];
          room.randomizedSubmissions = [];
          room.lastWinner = null;
          room.lastWinningSubmission = null;
          room.currentPrompt = null;
          room.judgeSelectionTimerStarted = false;

          // Reset player abilities for the new round
          room.players.forEach((player) => {
            player.hasActivatedTripleSound = false;
          });

          context.io.to(room.code).emit("roomUpdated", room);
          if (room.currentJudge) {
            context.io.to(room.code).emit("judgeSelected", room.currentJudge);
            context.io
              .to(room.code)
              .emit("gameStateChanged", GameState.JUDGE_SELECTION, {
                judgeId: room.currentJudge,
              });
          }

          // Auto-transition to prompt selection after a delay
          setTimeout(async () => {
            if (room.gameState === GameState.JUDGE_SELECTION) {
              room.judgeSelectionTimerStarted = false;
              room.gameState = GameState.PROMPT_SELECTION;

              // Generate prompts similar to gameHandlers.ts
              console.log(
                "Generating prompts for players:",
                room.players.map((p) => p.name)
              );
              const { getRandomPrompts } = await import("@/utils/soundLoader");
              const prompts = await getRandomPrompts(
                6,
                room.usedPromptIds || [],
                room.players.map((p) => p.name),
                room.allowExplicitContent
              );
              console.log(
                "Generated prompts:",
                prompts.map((p: { id: string; text: string }) => ({
                  id: p.id,
                  text: p.text,
                }))
              );
              room.availablePrompts = prompts;

              context.io
                .to(room.code)
                .emit("gameStateChanged", GameState.PROMPT_SELECTION, {
                  prompts,
                  judgeId: room.currentJudge,
                  timeLimit: GAME_CONFIG.PROMPT_SELECTION_TIME,
                });

              // If the judge is a bot, make the prompt selection automatically
              makeBotPromptSelection(context, room);
            }
          }, 3000);
        }
      }, 2000); // 2 second pause to show results
    }
    // If main screens are present, the existing winnerAudioComplete logic will handle progression
  }, delay);
}

// Bot decision making for prompt selection (when bot is judge)
export async function makeBotPromptSelection(
  context: SocketContext,
  room: Room
): Promise<void> {
  const judge = room.players.find((p) => p.id === room.currentJudge);

  console.log(
    `[BOT] makeBotPromptSelection called for room ${room.code}, current judge: ${room.currentJudge}`
  );

  if (!judge) {
    console.log(`[BOT] No judge found with ID ${room.currentJudge}`);
    return;
  }

  if (!judge.isBot) {
    console.log(
      `[BOT] Judge ${judge.name} (${judge.id}) is not a bot, skipping bot prompt selection`
    );
    return;
  }

  if (!room.availablePrompts || room.availablePrompts.length === 0) {
    console.log(`[BOT] Judge bot ${judge.name} found no prompts to select`);
    return;
  }

  console.log(`[BOT] Judge bot ${judge.name} is selecting a prompt...`);

  // Add delay to make the bot feel more natural
  const delay = Math.random() * 3000 + 1000; // 1-4 seconds

  console.log(`[BOT] Judge bot ${judge.name} will respond in ${delay}ms`);

  setTimeout(async () => {
    console.log(
      `[BOT] Judge bot ${judge.name} timeout fired, checking game state...`
    );

    // Double-check that we're still in the right state and this bot is still the judge
    if (room.gameState !== GameState.PROMPT_SELECTION) {
      console.log(
        `[BOT] Game state changed to ${room.gameState}, aborting bot prompt selection`
      );
      return;
    }

    if (room.currentJudge !== judge.id) {
      console.log(
        `[BOT] Judge changed from ${judge.id} to ${room.currentJudge}, aborting bot prompt selection`
      );
      return;
    }

    if (!room.availablePrompts || room.availablePrompts.length === 0) {
      console.log(
        `[BOT] No available prompts when timeout fired, aborting bot prompt selection`
      );
      return;
    }
    // Pick a random prompt
    const randomIndex = Math.floor(
      Math.random() * room.availablePrompts!.length
    );
    const selectedPrompt = room.availablePrompts![randomIndex];

    console.log(
      `[BOT] Judge bot ${judge.name} selected prompt: ${selectedPrompt.text}`
    );

    // Directly implement the prompt selection logic (from selectPrompt handler)
    // Clear the prompt selection timer since judge made a selection
    clearTimer(context, room.code);

    processAndAssignPrompt(room, selectedPrompt);

    // Track this prompt as used to avoid repeating in future rounds
    if (!room.usedPromptIds) {
      room.usedPromptIds = [];
    }
    room.usedPromptIds.push(selectedPrompt.id);

    room.gameState = GameState.SOUND_SELECTION;
    room.submissions = [];
    room.randomizedSubmissions = [];
    room.submissionSeed = undefined;
    room.soundSelectionTimerStarted = false;

    // Generate individual random sound sets for each non-judge player
    await generatePlayerSoundSets(room);

    console.log(`🎯 BOT: Emitting room updates for ${room.code}`);
    context.io.to(room.code).emit("roomUpdated", room);
    context.io.to(room.code).emit("promptSelected", selectedPrompt);
    context.io
      .to(room.code)
      .emit("gameStateChanged", GameState.SOUND_SELECTION, {
        prompt: selectedPrompt,
        timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
        currentRound: room.currentRound,
      });

    // Make bot submissions for sound selection
    await makeBotSoundSubmissions(context, room);
  }, delay);
}

// Check if room has no human players (empty or bots-only) and start destruction timer if needed
export function checkAndHandleBotOnlyRoom(
  context: SocketContext,
  room: Room
): void {
  const humanPlayers = room.players.filter((p) => !p.isBot);
  const botPlayers = room.players.filter((p) => p.isBot);
  const roomMainScreens = context.mainScreens.get(room.code);
  const mainScreenCount = roomMainScreens?.size || 0;

  console.log(
    `[BOT-TIMER] Checking room ${room.code} (${room.gameState}): ${humanPlayers.length} humans, ${botPlayers.length} bots, ${mainScreenCount} main screens`
  );

  if (humanPlayers.length === 0 && mainScreenCount === 0) {
    // Room is either empty or only has bots, AND has no main screens - start destruction timer
    if (room.players.length === 0) {
      console.log(
        `[BOT-TIMER] ⚠️  Room ${room.code} is completely empty (no players, no main screens). Starting destruction timer.`
      );
    } else {
      console.log(
        `[BOT-TIMER] ⚠️  Room ${room.code} now only has bots (${botPlayers.length}) and no main screens. Starting destruction timer.`
      );
    }

    // During GAME_OVER, use a shorter timeout since the game is finished
    const timeout =
      room.gameState === GameState.GAME_OVER ? 10000 : BOT_ONLY_ROOM_TIMEOUT; // 10 seconds vs 60 seconds

    if (room.gameState === GameState.GAME_OVER) {
      console.log(
        `[BOT-TIMER] Room ${room.code} is in GAME_OVER state - using accelerated cleanup (10 seconds)`
      );
    }

    startBotOnlyRoomDestructionTimer(context, room.code, timeout);
  } else {
    // Room has human players or main screens - clear any existing bot-only timer
    if (context.botOnlyRoomTimers.has(room.code)) {
      if (humanPlayers.length > 0 && mainScreenCount > 0) {
        console.log(
          `[BOT-TIMER] ✅ Room ${room.code} has ${humanPlayers.length} human player(s) and ${mainScreenCount} main screen(s). Clearing bot-only destruction timer.`
        );
      } else if (humanPlayers.length > 0) {
        console.log(
          `[BOT-TIMER] ✅ Room ${room.code} has ${humanPlayers.length} human player(s). Clearing bot-only destruction timer.`
        );
      } else if (mainScreenCount > 0) {
        console.log(
          `[BOT-TIMER] ✅ Room ${room.code} has ${mainScreenCount} main screen(s) connected. Clearing bot-only destruction timer.`
        );
      }
    }
    clearBotOnlyRoomDestructionTimer(context, room.code);
  }
}

// Start a timer to destroy the room after specified timeout if it has no human players (empty or bots-only)
function startBotOnlyRoomDestructionTimer(
  context: SocketContext,
  roomCode: string,
  timeoutMs: number = BOT_ONLY_ROOM_TIMEOUT
): void {
  // Clear any existing timer first
  clearBotOnlyRoomDestructionTimer(context, roomCode);

  console.log(
    `[BOT-TIMER] 🔥 Starting ${
      timeoutMs / 1000
    }-second destruction timer for room ${roomCode}`
  );

  const timer = setTimeout(() => {
    console.log(
      `[BOT-TIMER] ⏰ Timer expired for room ${roomCode}. Checking room status...`
    );

    const room = context.rooms.get(roomCode);
    if (!room) {
      console.log(
        `[BOT-TIMER] ❌ Room ${roomCode} no longer exists. Timer cleanup complete.`
      );
      return;
    }

    const humanPlayers = room.players.filter((p) => !p.isBot);
    const botPlayers = room.players.filter((p) => p.isBot);
    const roomMainScreens = context.mainScreens.get(roomCode);
    const mainScreenCount = roomMainScreens?.size || 0;

    console.log(
      `[BOT-TIMER] Room ${roomCode} status: ${humanPlayers.length} humans, ${botPlayers.length} bots, ${mainScreenCount} main screens`
    );

    // Double-check that room still has no human players AND no main screens (empty or bots-only)
    if (humanPlayers.length === 0 && mainScreenCount === 0) {
      if (room.players.length === 0) {
        console.log(
          `[BOT-TIMER] 💥 DESTROYING empty room ${roomCode} after ${
            timeoutMs / 1000
          } seconds (0 players, 0 main screens)`
        );
      } else {
        console.log(
          `[BOT-TIMER] 💥 DESTROYING room ${roomCode} after ${
            timeoutMs / 1000
          } seconds with only bots (${
            room.players.length
          } bots, 0 main screens)`
        );
      }

      // Notify any connected main screens that the room is closing
      const roomMainScreens = context.mainScreens.get(roomCode);
      if (roomMainScreens && roomMainScreens.size > 0) {
        console.log(
          `[BOT-TIMER] Notifying ${roomMainScreens.size} main screen(s) that room ${roomCode} is closing due to no human players`
        );
        roomMainScreens.forEach((mainScreenId) => {
          context.io.to(mainScreenId).emit("roomClosed", {
            roomCode,
          });
        });
      }

      // Clean up all room data
      context.rooms.delete(roomCode);

      // Clean up all timers for this room
      if (context.roomTimers.has(roomCode)) {
        clearTimeout(context.roomTimers.get(roomCode)!);
        context.roomTimers.delete(roomCode);
        console.log(`[BOT-TIMER] Cleared room timer for ${roomCode}`);
      }
      if (context.gracePeriodTimers.has(roomCode)) {
        clearTimeout(context.gracePeriodTimers.get(roomCode)!);
        context.gracePeriodTimers.delete(roomCode);
        console.log(`[BOT-TIMER] Cleared grace period timer for ${roomCode}`);
      }
      if (context.disconnectionTimers.has(roomCode)) {
        clearTimeout(context.disconnectionTimers.get(roomCode)!);
        context.disconnectionTimers.delete(roomCode);
        console.log(`[BOT-TIMER] Cleared disconnection timer for ${roomCode}`);
      }
      if (context.reconnectionVoteTimers.has(roomCode)) {
        clearTimeout(context.reconnectionVoteTimers.get(roomCode)!);
        context.reconnectionVoteTimers.delete(roomCode);
        console.log(
          `[BOT-TIMER] Cleared reconnection vote timer for ${roomCode}`
        );
      }

      // Clean up main screen tracking
      context.mainScreens.delete(roomCode);
      context.primaryMainScreens.delete(roomCode);

      // Remove bot-only timer tracking
      context.botOnlyRoomTimers.delete(roomCode);

      console.log(
        `[BOT-TIMER] ✅ Room ${roomCode} successfully destroyed due to no human players. All cleanup complete.`
      );

      // Update room list for main screens
      broadcastRoomListUpdate(context);
    } else {
      if (humanPlayers.length > 0 && mainScreenCount > 0) {
        console.log(
          `[BOT-TIMER] ⚠️  Room ${roomCode} timer expired but room now has ${humanPlayers.length} human(s) and ${mainScreenCount} main screen(s) - canceling destruction`
        );
      } else if (humanPlayers.length > 0) {
        console.log(
          `[BOT-TIMER] ⚠️  Room ${roomCode} timer expired but room now has ${humanPlayers.length} human(s) - canceling destruction`
        );
      } else if (mainScreenCount > 0) {
        console.log(
          `[BOT-TIMER] ⚠️  Room ${roomCode} timer expired but room now has ${mainScreenCount} main screen(s) connected - canceling destruction`
        );
      }
      context.botOnlyRoomTimers.delete(roomCode);
    }
  }, timeoutMs);

  context.botOnlyRoomTimers.set(roomCode, timer);
  console.log(
    `[BOT-TIMER] ✅ Timer set for room ${roomCode}. Will check again in ${
      timeoutMs / 1000
    } seconds.`
  );
}

// Clear the room destruction timer (for empty or bot-only rooms)
function clearBotOnlyRoomDestructionTimer(
  context: SocketContext,
  roomCode: string
): void {
  const timer = context.botOnlyRoomTimers.get(roomCode);
  if (timer) {
    console.log(
      `[BOT-TIMER] 🛑 Clearing room destruction timer for room ${roomCode} - room has active connections`
    );
    clearTimeout(timer);
    context.botOnlyRoomTimers.delete(roomCode);
    console.log(
      `[BOT-TIMER] ✅ Timer cleared for room ${roomCode}. Room destruction canceled.`
    );
  }
}
