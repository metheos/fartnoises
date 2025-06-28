import { GameState } from "@/types/game";

/**
 * Helper function to convert hex colors to Tailwind classes
 * Used for player avatar styling throughout the game
 */
export const getPlayerColorClass = (color: string): string => {
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
};

/**
 * Helper function to get human-readable game state display text
 * Used for status displays in the UI
 */
export const getGameStateDisplay = (gameState: GameState): string => {
  const stateMap: { [key in GameState]: string } = {
    [GameState.LOBBY]: "In Lobby",
    [GameState.JUDGE_SELECTION]: "Selecting Judge",
    [GameState.PROMPT_SELECTION]: "Judge is Choosing",
    [GameState.SOUND_SELECTION]: "Choosing Sounds",
    [GameState.PLAYBACK]: "Listening to Submissions",
    [GameState.JUDGING]: "Judge is Deciding",
    [GameState.ROUND_RESULTS]: "Round Results",
    [GameState.GAME_OVER]: "Game Over",
    [GameState.PAUSED_FOR_DISCONNECTION]: "Game Paused - Player Disconnected",
  };
  return stateMap[gameState] || "Unknown State";
};

/**
 * Helper function to format room codes in consistent uppercase format
 */
export const formatRoomCode = (code: string): string => {
  return code.toUpperCase().trim();
};

/**
 * Helper function to validate room code format
 */
export const isValidRoomCode = (code: string): boolean => {
  return /^[A-Z0-9]{4}$/.test(code.toUpperCase());
};

/**
 * Helper function to get player display name with fallback
 */
export const getPlayerDisplayName = (
  playerName: string | undefined,
  playerId: string
): string => {
  return playerName || `Player ${playerId.slice(-4)}`;
};

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
