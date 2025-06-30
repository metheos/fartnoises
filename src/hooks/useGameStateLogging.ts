import { useEffect, useCallback } from "react";
import { Room, Player } from "@/types/game";

interface UseGameStateLoggingOptions {
  /** Debug logging function */
  addDebugLog: (message: string) => void;
  /** Component name for prefixing logs */
  componentName?: string;
  /** Whether to log room state changes */
  logRoomChanges?: boolean;
  /** Whether to log player state changes */
  logPlayerChanges?: boolean;
  /** Whether to log general game events */
  logGameEvents?: boolean;
}

/**
 * Custom hook for consistent debug logging patterns across game components
 * Provides standardized logging for room state, player state, and custom events
 */
export function useGameStateLogging(
  room: Room | null,
  player: Player | null,
  options: UseGameStateLoggingOptions
) {
  const {
    addDebugLog,
    componentName = "GameComponent",
    logRoomChanges = true,
    logPlayerChanges = true,
    logGameEvents = true,
  } = options;

  // Monitor room state changes
  useEffect(() => {
    if (!logRoomChanges) return;

    addDebugLog(
      `[${componentName}] Room state changed: ${
        room
          ? `${room.code} with ${room.players?.length} players, state: ${room.gameState}`
          : "null"
      }`
    );
  }, [room, addDebugLog, componentName, logRoomChanges]);

  // Monitor player state changes
  useEffect(() => {
    if (!logPlayerChanges) return;

    addDebugLog(
      `[${componentName}] Player state changed: ${
        player ? player.name : "null"
      }`
    );
  }, [player, addDebugLog, componentName, logPlayerChanges]);

  // Custom event logging function
  const logGameEvent = useCallback(
    // Using any for details parameter as game events can contain various data structures
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: string, details?: any) => {
      if (!logGameEvents) return;

      const message = details
        ? `[${componentName}] ${event}: ${JSON.stringify(details)}`
        : `[${componentName}] ${event}`;


      addDebugLog(message);
      console.log(message);
    },
    [addDebugLog, componentName, logGameEvents]
  );

  // Room-specific logging utilities
  const logRoomEvent = useCallback(
    // Using any for details parameter as room events can contain various data structures
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: string, details?: any) => {
      if (!room) return;

      logGameEvent(`Room ${room.code} - ${event}`, details);
    },
    [room, logGameEvent]
  );

  // Player-specific logging utilities
  const logPlayerEvent = useCallback(
    // Using any for details parameter as player events can contain various data structures
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: string, details?: any) => {
      if (!player) return;

      logGameEvent(`Player ${player.name} - ${event}`, details);
    },
    [player, logGameEvent]
  );

  // Submission logging utility
  const logSubmissions = useCallback(
    (prefix: string = "Submissions") => {
      if (!room) return;

      console.log(
        `[${componentName}] ${prefix} - Room submissions: ${room.submissions.length}`
      );
      console.log(
        `[${componentName}] ${prefix} - Room randomizedSubmissions: ${
          room.randomizedSubmissions?.length || 0
        }`
      );
      console.log(
        `[${componentName}] ${prefix} - Room randomizedSubmissions data:`,
        room.randomizedSubmissions
      );

      const submissionsToShow = room.randomizedSubmissions || room.submissions;
      console.log(
        `[${componentName}] ${prefix} - Submissions to show: ${submissionsToShow.length}`
      );

      // Additional debugging
      console.log(
        `[${componentName}] ${prefix} - Original submissions order:`,
        room.submissions.map((s) => s.playerName)
      );
      console.log(
        `[${componentName}] ${prefix} - Randomized submissions order:`,
        room.randomizedSubmissions?.map((s) => s.playerName) || "None"
      );
      console.log(
        `[${componentName}] ${prefix} - Are they different?`,
        JSON.stringify(room.submissions.map((s) => s.playerName)) !==
          JSON.stringify(
            room.randomizedSubmissions?.map((s) => s.playerName) || []
          )
      );
    },
    [room, componentName]
  );

  return {
    logGameEvent,
    logRoomEvent,
    logPlayerEvent,
    logSubmissions,
  };
}
