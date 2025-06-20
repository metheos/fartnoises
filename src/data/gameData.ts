// Game data: sound effects library
import { SoundEffect, GamePrompt } from "@/types/game";
import { loadEarwaxSounds } from "@/utils/soundLoader";

// Dynamic sound effects loaded from EarwaxAudio.jet
// Use getSoundEffects() to get the actual sound effects at runtime
// Legacy SOUND_EFFECTS array removed - now using dynamic loader from soundLoader.ts

// Function to get sound effects (use this instead of the static array)
export async function getSoundEffects(): Promise<SoundEffect[]> {
  return await loadEarwaxSounds();
}

export const GAME_PROMPTS: GamePrompt[] = [
  // Relationship/Dating
  { id: "first-kiss", text: "The sound of a first kiss", category: "romance" },
  { id: "bad-date", text: "The worst date ever", category: "romance" },
  { id: "breakup", text: "Getting dumped via text", category: "romance" },
  { id: "wedding", text: "A wedding gone wrong", category: "romance" },

  // Everyday situations
  { id: "monday", text: "Monday morning", category: "daily" },
  { id: "traffic", text: "Being stuck in traffic", category: "daily" },
  { id: "wifi-down", text: "When the wifi goes down", category: "daily" },
  { id: "alarm", text: "Hitting the snooze button", category: "daily" },
  { id: "cooking", text: "Attempting to cook", category: "daily" },

  // Weird/Abstract
  { id: "wombat", text: "The inside of a wombat", category: "weird" },
  { id: "alien", text: "First contact with aliens", category: "weird" },
  { id: "time-travel", text: "Traveling back in time", category: "weird" },
  { id: "dreams", text: "A fever dream", category: "weird" },
  { id: "space", text: "The sound of space", category: "weird" },

  // Life events
  { id: "birthday", text: "The worst birthday ever", category: "events" },
  {
    id: "job-interview",
    text: "A disastrous job interview",
    category: "events",
  },
  { id: "dentist", text: "Going to the dentist", category: "events" },
  { id: "exercise", text: "Trying to exercise", category: "events" },

  // Food/Eating
  { id: "spicy", text: "Eating something too spicy", category: "food" },
  { id: "expired", text: "Realizing the milk is expired", category: "food" },
  { id: "diet", text: "Starting a new diet", category: "food" },
  { id: "cooking-show", text: "A cooking show disaster", category: "food" },

  // Technology
  { id: "phone-battery", text: "Your phone dying at 1%", category: "tech" },
  { id: "password", text: "Forgetting your password", category: "tech" },
  {
    id: "video-call",
    text: "Joining a video call with your camera on",
    category: "tech",
  },
  { id: "autocorrect", text: "Autocorrect embarrassment", category: "tech" },

  // Random/Funny
  { id: "babies", text: "How babies are made", category: "random" },
  { id: "taxes", text: "Doing your taxes", category: "random" },
  { id: "elevator", text: "Awkward elevator silence", category: "random" },
  {
    id: "public-speaking",
    text: "Fear of public speaking",
    category: "random",
  },
];

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
  DEFAULT_MAX_ROUNDS: 5,
  SOUND_SELECTION_TIME: 45, // seconds
  PROMPT_SELECTION_TIME: 15, // seconds
  ROOM_CODE_LENGTH: 4,
};
