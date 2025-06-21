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
export async function getGamePrompts(): Promise<GamePrompt[]> {
  return await loadEarwaxPrompts();
}

// Player colors for avatars
export const PLAYER_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
  "#98D8C8", // Mint
  "#F7DC6F", // Light yellow
];

// Game configuration
export const GAME_CONFIG = {
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 8,
  DEFAULT_MAX_ROUNDS: 10,
  SOUND_SELECTION_TIME: 45, // seconds
  PROMPT_SELECTION_TIME: 30, // seconds
  ROOM_CODE_LENGTH: 4,
  // Disconnection handling
  RECONNECTION_GRACE_PERIOD: 30, // seconds to wait for reconnection
  RECONNECTION_VOTE_TIMEOUT: 20, // seconds for players to vote
  MAX_DISCONNECTION_TIME: 300, // 5 minutes max before auto-removal
};
