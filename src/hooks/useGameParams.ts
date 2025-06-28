import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

export interface GameParams {
  mode: string | null;
  playerName: string | null;
  roomCode: string | null;
  playerColor: string | null;
  playerEmoji: string | null;
}

/**
 * Custom hook to manage URL parameters for the game page
 * Stabilizes parameters to prevent unnecessary re-renders
 */
export function useGameParams(): GameParams {
  const searchParams = useSearchParams();

  const stableParams = useMemo(() => {
    const mode = searchParams?.get("mode") || null;
    const playerName =
      searchParams?.get("playerName") || searchParams?.get("name") || null;
    const roomCode =
      searchParams?.get("roomCode") || searchParams?.get("room") || null;
    const playerColor = searchParams?.get("playerColor") || null;
    const playerEmoji = searchParams?.get("playerEmoji") || null;
    return { mode, playerName, roomCode, playerColor, playerEmoji };
  }, [searchParams]);

  return stableParams;
}
