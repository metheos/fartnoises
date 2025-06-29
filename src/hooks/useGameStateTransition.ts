import { useState, useEffect, useCallback } from "react";
import { GameState } from "@/types/game";

interface UseGameStateTransitionOptions {
  currentGameState: GameState;
  onStateChange?: (newState: GameState, oldState: GameState) => void;
}

interface UseGameStateTransitionReturn {
  previousState: GameState | null;
  isTransitioning: boolean;
  hasTransitioned: (fromState: GameState, toState: GameState) => boolean;
  resetTransition: () => void;
}

/**
 * Custom hook to manage game state transitions and detect state changes.
 * Useful for triggering effects when moving between game states.
 */
export function useGameStateTransition({
  currentGameState,
  onStateChange,
}: UseGameStateTransitionOptions): UseGameStateTransitionReturn {
  const [previousState, setPreviousState] = useState<GameState | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [lastTransition, setLastTransition] = useState<{
    from: GameState | null;
    to: GameState;
  } | null>(null);

  // Handle state changes
  useEffect(() => {
    if (previousState !== null && previousState !== currentGameState) {
      setIsTransitioning(true);

      // Record the transition
      setLastTransition({ from: previousState, to: currentGameState });

      // Call state change callback
      if (onStateChange) {
        onStateChange(currentGameState, previousState);
      }

      // Clear transitioning flag after a brief delay
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 100);

      return () => clearTimeout(timer);
    }

    setPreviousState(currentGameState);
  }, [currentGameState, previousState, onStateChange]);

  // Check if a specific transition has occurred
  const hasTransitioned = useCallback(
    (fromState: GameState, toState: GameState): boolean => {
      return (
        lastTransition?.from === fromState && lastTransition?.to === toState
      );
    },
    [lastTransition]
  );

  // Reset transition tracking
  const resetTransition = useCallback(() => {
    setLastTransition(null);
    setIsTransitioning(false);
  }, []);

  return {
    previousState,
    isTransitioning,
    hasTransitioned,
    resetTransition,
  };
}
