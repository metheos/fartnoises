import { useCallback } from "react";
import { audioSystem } from "@/utils/audioSystem";
import { usePlayingState } from "./usePlayingState";

interface UseAudioPlaybackReturn {
  playingSounds: Set<string>;
  playingButtons: Set<string>;
  isPlaying: (soundId?: string, buttonId?: string) => boolean;
  playSoundWithFeedback: (soundId: string, buttonId?: string) => Promise<void>;
  playSoundCombinationWithFeedback: (
    sounds: string[],
    buttonId: string
  ) => Promise<void>;
  clearAllPlaying: () => void;
}

/**
 * Enhanced custom hook to manage audio playback with comprehensive state management.
 * Combines sound playback with playing state tracking and feedback.
 */
export function useAudioPlaybackEnhanced(): UseAudioPlaybackReturn {
  const {
    playingSounds,
    playingButtons,
    isPlaying,
    setPlaying,
    clearAllPlaying,
  } = usePlayingState();

  // Helper function to play sound with button state management
  const playSoundWithFeedback = useCallback(
    async (soundId: string, buttonId?: string) => {
      // If this specific sound is already playing, ignore the click
      if (playingSounds.has(soundId)) {
        console.log(`Sound ${soundId} is already playing, ignoring click`);
        return;
      }

      // If a buttonId is provided and it's already in a playing state, ignore
      if (buttonId && playingButtons.has(buttonId)) {
        console.log(`Button ${buttonId} is already playing, ignoring click`);
        return;
      }

      try {
        // Mark sound and button as playing
        setPlaying(soundId, buttonId, true);

        // Play the sound and wait for it to finish
        await audioSystem.playSound(soundId);
      } catch (error) {
        console.error(`Error playing sound ${soundId}:`, error);
      } finally {
        // Clean up - remove from playing sets
        setPlaying(soundId, buttonId, false);
      }
    },
    [playingSounds, playingButtons, setPlaying]
  );

  // Helper function to play sound combinations with button state management
  const playSoundCombinationWithFeedback = useCallback(
    async (sounds: string[], buttonId: string) => {
      // If this button is already playing, ignore the click
      if (playingButtons.has(buttonId)) {
        console.log(
          `Button ${buttonId} is already playing combination, ignoring click`
        );
        return;
      }

      try {
        // Mark button as playing
        setPlaying(undefined, buttonId, true);

        // Play the sound combination and wait for it to finish
        await audioSystem.playSoundsSequentially(sounds);
      } catch (error) {
        console.error(`Error playing sound combination:`, error);
      } finally {
        // Clean up - remove from playing set
        setPlaying(undefined, buttonId, false);
      }
    },
    [playingButtons, setPlaying]
  );

  return {
    playingSounds,
    playingButtons,
    isPlaying,
    playSoundWithFeedback,
    playSoundCombinationWithFeedback,
    clearAllPlaying,
  };
}
