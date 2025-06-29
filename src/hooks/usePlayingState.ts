import { useState, useCallback } from "react";

interface UsePlayingStateReturn {
  playingSounds: Set<string>;
  playingButtons: Set<string>;
  setPlayingSounds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setPlayingButtons: React.Dispatch<React.SetStateAction<Set<string>>>;
  isPlaying: (soundId?: string, buttonId?: string) => boolean;
  setPlaying: (
    soundId?: string,
    buttonId?: string,
    isPlaying?: boolean
  ) => void;
  clearAllPlaying: () => void;
}

/**
 * Custom hook to manage playing states for sounds and buttons.
 * Useful for preventing duplicate sound playback and managing UI feedback.
 */
export function usePlayingState(): UsePlayingStateReturn {
  const [playingSounds, setPlayingSounds] = useState<Set<string>>(new Set());
  const [playingButtons, setPlayingButtons] = useState<Set<string>>(new Set());

  // Check if a sound or button is currently playing
  const isPlaying = useCallback(
    (soundId?: string, buttonId?: string): boolean => {
      const soundPlaying = soundId ? playingSounds.has(soundId) : false;
      const buttonPlaying = buttonId ? playingButtons.has(buttonId) : false;
      return soundPlaying || buttonPlaying;
    },
    [playingSounds, playingButtons]
  );

  // Set playing state for sounds and buttons
  const setPlaying = useCallback(
    (soundId?: string, buttonId?: string, playing: boolean = true) => {
      if (soundId) {
        setPlayingSounds((prev) => {
          const newSet = new Set(prev);
          if (playing) {
            newSet.add(soundId);
          } else {
            newSet.delete(soundId);
          }
          return newSet;
        });
      }

      if (buttonId) {
        setPlayingButtons((prev) => {
          const newSet = new Set(prev);
          if (playing) {
            newSet.add(buttonId);
          } else {
            newSet.delete(buttonId);
          }
          return newSet;
        });
      }
    },
    []
  );

  // Clear all playing states
  const clearAllPlaying = useCallback(() => {
    setPlayingSounds(new Set());
    setPlayingButtons(new Set());
  }, []);

  return {
    playingSounds,
    playingButtons,
    setPlayingSounds,
    setPlayingButtons,
    isPlaying,
    setPlaying,
    clearAllPlaying,
  };
}
