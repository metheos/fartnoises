// Bot management utilities for the fartnoises game server
import { Room, Player, GameState, SoundSubmission } from "@/types/game";
import { SocketContext } from "../types/socketTypes";
import { getRandomColor, getRandomEmoji, processAndAssignPrompt, selectNextJudge } from "./roomManager";
import { getRandomSounds } from "@/utils/soundLoader";
import { GAME_CONFIG } from "@/data/gameData";
import { clearTimer } from "./timerManager";
import { generatePlayerSoundSets } from "./gameLogic";

// List of bot names that sound fun and quirky
const BOT_NAMES = [
  "SoundBot", "Farticus", "TootMaster", "GasBot", "WindBot", 
  "BubbleBot", "SqueakBot", "WhooshBot", "BoomBot", "ZapBot",
  "PoofBot", "ChimeBot", "BuzzBot", "CrackleBot", "RumbleBot",
  "ThudBot", "PlinkBot", "DingBot", "ClangBot", "WhistleBot"
];

// Create a bot player with random characteristics
export function createBot(room: Room): Player {
  const usedNames = room.players.map(p => p.name);
  const usedColors = room.players.map(p => p.color);
  const usedEmojis = room.players.map(p => p.emoji).filter(Boolean) as string[];
  
  // Find an available bot name
  const availableNames = BOT_NAMES.filter(name => !usedNames.includes(name));
  const botName = availableNames.length > 0 
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
    hasUsedNuclearOption: false
  };
  
  console.log(`[BOT] Created bot player: ${bot.name} (${bot.id})`);
  return bot;
}

// Add bots to bring the room to minimum player count (3)
export async function addBotsIfNeeded(context: SocketContext, room: Room): Promise<void> {
  const humanPlayers = room.players.filter(p => !p.isBot);
  const totalPlayers = room.players.length;
  
  // Only add bots if we have 1-2 human players and need to reach minimum of 3
  if (humanPlayers.length >= 3 || humanPlayers.length === 0) {
    return; // Don't add bots if we have 3+ humans or no humans
  }
  
  const botsNeeded = Math.max(0, 3 - totalPlayers);
  
  console.log(`[BOT] Room ${room.code} has ${humanPlayers.length} human players and ${totalPlayers - humanPlayers.length} bots. Adding ${botsNeeded} more bots.`);
  
  for (let i = 0; i < botsNeeded; i++) {
    const bot = createBot(room);
    room.players.push(bot);
    
    // Emit player joined event for the bot
    context.io.to(room.code).emit("playerJoined", { room });
    context.io.to(room.code).emit("roomUpdated", room);
  }
  
  console.log(`[BOT] Room ${room.code} now has ${room.players.length} total players`);
}

// Remove all bots from the room
export function removeAllBots(context: SocketContext, room: Room): void {
  const initialPlayerCount = room.players.length;
  room.players = room.players.filter(p => !p.isBot);
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
  const botPlayers = room.players.filter(p => p.isBot && p.id !== room.currentJudge);
  
  if (botPlayers.length === 0) return;
  
  console.log(`[BOT] Making sound submissions for ${botPlayers.length} bots`);
  
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
  if (room.submissions.some(s => s.playerId === bot.id)) {
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
  if (!bot.hasUsedRefresh && Math.random() < 0.10) {
    bot.hasUsedRefresh = true;
    console.log(`[BOT] ${bot.name} is using refresh powerup`);
    
    // Generate new sounds
    try {
      const newSounds = await getRandomSounds(10, undefined, room.allowExplicitContent);
      bot.soundSet = newSounds.map(sound => sound.id);
      context.io.to(room.code).emit("soundsRefreshed", { 
        playerId: bot.id, 
        newSounds: bot.soundSet 
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
      sounds: selectedSounds
    };
    
    // Add a small delay to make bot submissions feel more natural
    const delay = Math.random() * 3000 + 1000; // 1-4 seconds
    setTimeout(() => {
      room.submissions.push(submission);
      context.io.to(room.code).emit("soundSubmitted", submission);
      context.io.to(room.code).emit("roomUpdated", room);
      
      console.log(`[BOT] ${bot.name} submitted sounds: [${selectedSounds.join(", ")}]`);
    }, delay);
  }
}

// Bot decision making for judging (picking a winner)
export function makeBotJudgingDecision(
  context: SocketContext,
  room: Room
): void {
  const judge = room.players.find(p => p.id === room.currentJudge);
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
        roomCode: room.code
      });
      return;
    }
    
    // Otherwise, pick a random submission as winner
    const randomIndex = Math.floor(Math.random() * room.randomizedSubmissions!.length);
    const winningSubmission = room.randomizedSubmissions![randomIndex];
    
    // Implement the selectWinner logic directly
    const winner = room.players.find(p => p.id === winningSubmission.playerId);
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
    
    console.log(`[BOT] Judge bot ${judge.name} selected ${winner.name} as winner`);
    
    // Check if there are main screens to handle audio playback
    const roomMainScreens = context.mainScreens.get(room.code);
    const hasMainScreensConnected = roomMainScreens ? roomMainScreens.size > 0 : false;
    if (!hasMainScreensConnected) {
      // No main screens - skip audio playback and proceed immediately
      console.log(`[BOT] No main screens connected. Proceeding directly to next round/game end check...`);

      // Simulate a short delay for results display, then proceed to next round
      setTimeout(async () => {
        // Check if game should end
        if (winner.score >= room.maxScore || room.currentRound >= room.maxRounds) {
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
          room.players.forEach(player => {
            player.hasActivatedTripleSound = false;
          });

          context.io.to(room.code).emit("roomUpdated", room);
          if (room.currentJudge) {
            context.io.to(room.code).emit("judgeSelected", room.currentJudge);
            context.io.to(room.code).emit("gameStateChanged", GameState.JUDGE_SELECTION, {
              judgeId: room.currentJudge,
            });
          }

          // Auto-transition to prompt selection after a delay
          setTimeout(async () => {
            if (room.gameState === GameState.JUDGE_SELECTION) {
              room.judgeSelectionTimerStarted = false;
              room.gameState = GameState.PROMPT_SELECTION;
              
              // Generate prompts similar to gameHandlers.ts
              console.log("Generating prompts for players:", room.players.map((p) => p.name));
              const { getRandomPrompts } = await import("@/utils/soundLoader");
              const prompts = await getRandomPrompts(
                6,
                room.usedPromptIds || [],
                room.players.map((p) => p.name),
                room.allowExplicitContent
              );
              console.log("Generated prompts:", prompts.map((p: any) => ({ id: p.id, text: p.text })));
              room.availablePrompts = prompts;

              context.io.to(room.code).emit("gameStateChanged", GameState.PROMPT_SELECTION, {
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
  const judge = room.players.find(p => p.id === room.currentJudge);
  if (!judge || !judge.isBot) return;
  
  if (!room.availablePrompts || room.availablePrompts.length === 0) {
    console.log(`[BOT] Judge bot ${judge.name} found no prompts to select`);
    return;
  }
  
  console.log(`[BOT] Judge bot ${judge.name} is selecting a prompt...`);
  
  // Add delay to make the bot feel more natural
  const delay = Math.random() * 3000 + 1000; // 1-4 seconds
  
  setTimeout(async () => {
    // Pick a random prompt
    const randomIndex = Math.floor(Math.random() * room.availablePrompts!.length);
    const selectedPrompt = room.availablePrompts![randomIndex];
    
    console.log(`[BOT] Judge bot ${judge.name} selected prompt: ${selectedPrompt.text}`);
    
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
