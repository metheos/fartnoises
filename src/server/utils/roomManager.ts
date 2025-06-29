// Room management utilities for the fartnoises game server
import { Room, GamePrompt } from "@/types/game";
import { PLAYER_COLORS, PLAYER_EMOJIS, GAME_CONFIG } from "@/data/gameData";
import { processPromptText } from "@/utils/gameUtils";
import { SocketContext } from "../types/socketTypes";

// Utility functions for room management
export function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < GAME_CONFIG.ROOM_CODE_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getRandomColor(usedColors: string[]): string {
  const availableColors = PLAYER_COLORS.filter(
    (color) => !usedColors.includes(color)
  );
  return availableColors.length > 0
    ? availableColors[Math.floor(Math.random() * availableColors.length)]
    : PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
}

export function getRandomEmoji(usedEmojis: string[]): string {
  const availableEmojis = PLAYER_EMOJIS.filter(
    (emoji) => !usedEmojis.includes(emoji)
  );
  return availableEmojis.length > 0
    ? availableEmojis[Math.floor(Math.random() * availableEmojis.length)]
    : PLAYER_EMOJIS[Math.floor(Math.random() * PLAYER_EMOJIS.length)];
}

export function selectNextJudge(room: Room): string {
  const playerIds = room.players.map((p) => p.id);
  if (!room.currentJudge) {
    return playerIds[0];
  }

  const currentIndex = playerIds.indexOf(room.currentJudge);
  const nextIndex = (currentIndex + 1) % playerIds.length;
  return playerIds[nextIndex];
}

// Helper function to ensure prompts are always processed with player names
export function processAndAssignPrompt(room: Room, prompt: GamePrompt): void {
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
export function broadcastRoomListUpdate(context: SocketContext) {
  const roomsArray = Array.from(context.rooms.values()).filter(
    (room) => room.players.length > 0
  ); // Only show rooms with players
  context.io.emit("mainScreenUpdate", { rooms: roomsArray });
}

// Main screen management functions
export function addMainScreen(
  context: SocketContext,
  roomCode: string,
  socketId: string
): void {
  if (!context.mainScreens.has(roomCode)) {
    context.mainScreens.set(roomCode, new Set());
  }

  const roomMainScreens = context.mainScreens.get(roomCode)!;
  roomMainScreens.add(socketId);

  // If this is the first main screen or there's no primary, elect it as primary
  if (!context.primaryMainScreens.has(roomCode) || roomMainScreens.size === 1) {
    context.primaryMainScreens.set(roomCode, socketId);
    console.log(
      `[MAIN SCREEN] Elected ${socketId} as primary main screen for room ${roomCode}`
    );
  } else {
    console.log(
      `[MAIN SCREEN] Added ${socketId} as secondary main screen for room ${roomCode}. Primary remains: ${context.primaryMainScreens.get(
        roomCode
      )}`
    );
  }
}

export function removeMainScreen(
  context: SocketContext,
  roomCode: string,
  socketId: string
): void {
  const roomMainScreens = context.mainScreens.get(roomCode);
  if (!roomMainScreens) return;

  roomMainScreens.delete(socketId);

  // If the primary main screen disconnected, elect a new one
  if (context.primaryMainScreens.get(roomCode) === socketId) {
    if (roomMainScreens.size > 0) {
      const newPrimary = Array.from(roomMainScreens)[0]; // Get first remaining main screen
      context.primaryMainScreens.set(roomCode, newPrimary);
      console.log(
        `[MAIN SCREEN] Primary main screen ${socketId} disconnected. Elected ${newPrimary} as new primary for room ${roomCode}`
      );
    } else {
      context.primaryMainScreens.delete(roomCode);
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
    context.mainScreens.delete(roomCode);
  }
}
