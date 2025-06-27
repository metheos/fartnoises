// Game data: sound effects library
import { SoundEffect, GamePrompt } from "@/types/game";
import { loadEarwaxSounds, loadEarwaxPrompts } from "@/utils/soundLoader";

// Dynamic sound effects loaded from EarwaxAudio.jet
// Use getSoundEffects() to get the actual sound effects at runtime
// Legacy SOUND_EFFECTS array removed - now using dynamic loader from soundLoader.ts

// Function to get sound effects (use this instead of the static array)
export async function getSoundEffects(): Promise<SoundEffect[]> {
  return await loadEarwaxSounds();
}

// Dynamic game prompts loaded from EarwaxPrompts.jet
// Use getGamePrompts() to get the actual prompts at runtime
// Legacy GAME_PROMPTS array removed - now using dynamic loader from soundLoader.ts

// Function to get game prompts (use this instead of the static array)
export async function getGamePrompts(
  playerNames: string[] = []
): Promise<GamePrompt[]> {
  const prompts = await loadEarwaxPrompts();

  // Process prompt text for each prompt if player names are provided
  if (playerNames.length > 0) {
    return prompts.map((prompt) => ({
      ...prompt,
      text: processPromptText(prompt.text, playerNames),
    }));
  }

  return prompts;
}

// Function to process prompt text for special tags (imported from soundLoader)
export function processPromptText(
  text: string,
  playerNames: string[] = []
): string {
  let processedText = text;

  console.log("processPromptText called with:", { text, playerNames });

  // Replace <ANY> tags with random player names
  if (playerNames.length > 0) {
    processedText = processedText.replace(/<ANY>/g, () => {
      const randomIndex = Math.floor(Math.random() * playerNames.length);
      const selectedName = playerNames[randomIndex];
      console.log("Replacing <ANY> with:", selectedName);
      return selectedName;
    });
  } else {
    console.log("No player names provided, <ANY> tags will remain unchanged");
  }

  console.log("processPromptText result:", processedText);

  // Keep <i></i> tags as HTML for React rendering
  return processedText;
}

// Player colors for avatars
export const PLAYER_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Green
  "#9B59B6", // Purple
  "#F39C12", // Orange
  "#E91E63", // Pink
  "#34495E", // Dark Gray
];

// Player emoji options for avatars
export const PLAYER_EMOJIS = [
  "🎵",
  "🎶",
  "🎤",
  "🎸",
  "🥁",
  "🎹",
  "🎺",
  "🎷",
  "😂",
  "😎",
  "🤪",
  "🤯",
  "😜",
  "🤔",
  "😈",
  "🤓",
  "🦄",
  "🐱",
  "🐶",
  "🐸",
  "🦊",
  "🐻",
  "🐼",
  "🐨",
  "🚀",
  "⭐",
  "🌟",
  "✨",
  "🔥",
  "💫",
  "🌈",
  "🎊",
  "🍕",
  "🍔",
  "🍟",
  "🍎",
  "🍌",
  "🍇",
  "🍓",
  "🥑",
  "🎮",
  "🕹️",
  "🎯",
  "🎲",
  "🃏",
  "🎪",
  "🎭",
  "🎨",
];

// Game configuration
export const GAME_CONFIG = {
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 8,
  DEFAULT_MAX_ROUNDS: 8,
  MAX_SCORE: 3, // Default score needed to win the game
  // Game settings validation ranges for VIP configuration
  MIN_ROUNDS: 1,
  MAX_ROUNDS_LIMIT: 20,
  MIN_SCORE: 1,
  MAX_SCORE_LIMIT: 10,
  SOUND_SELECTION_TIME: 999, // seconds 45 default
  PROMPT_SELECTION_TIME: 999, // seconds 30 default
  ROOM_CODE_LENGTH: 4,
  // Disconnection handling
  RECONNECTION_GRACE_PERIOD: 30, // seconds to wait for reconnection
  RECONNECTION_VOTE_TIMEOUT: 20, // seconds for players to vote
  MAX_DISCONNECTION_TIME: 300, // 5 minutes max before auto-removal
};

// Helper functions for player customization
export function getRandomColor(excludedColors: string[] = []): string {
  const availableColors = PLAYER_COLORS.filter(
    (color) => !excludedColors.includes(color)
  );
  if (availableColors.length === 0) {
    return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
  }
  return availableColors[Math.floor(Math.random() * availableColors.length)];
}

export function getRandomEmoji(excludedEmojis: string[] = []): string {
  const availableEmojis = PLAYER_EMOJIS.filter(
    (emoji) => !excludedEmojis.includes(emoji)
  );
  if (availableEmojis.length === 0) {
    return PLAYER_EMOJIS[Math.floor(Math.random() * PLAYER_EMOJIS.length)];
  }
  return availableEmojis[Math.floor(Math.random() * availableEmojis.length)];
}

// Helper function to convert hex colors to Tailwind classes
export function getPlayerColorClass(color: string): string {
  const colorMap: { [key: string]: string } = {
    "#FF6B6B": "bg-red-400", // Red
    "#4ECDC4": "bg-teal-400", // Teal
    "#45B7D1": "bg-blue-400", // Blue
    "#96CEB4": "bg-green-400", // Green
    "#9B59B6": "bg-purple-400", // Purple
    "#F39C12": "bg-orange-400", // Orange
    "#E91E63": "bg-pink-400", // Pink
    "#34495E": "bg-gray-600", // Dark Gray
  };
  return colorMap[color] || "bg-gray-400";
}
