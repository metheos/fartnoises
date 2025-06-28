import { useState, useCallback } from "react";
import { audioSystem } from "@/utils/audioSystem";

/**
 * Custom hook to manage audio playback state and prevent duplicate sound playing
 */
export function useAudioPlayback() {
  const [playingSounds, setPlayingSounds] = useState<Set<string>>(new Set());
  const [playingButtons, setPlayingButtons] = useState<Set<string>>(new Set());

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
        setPlayingSounds((prev) => new Set(prev).add(soundId));
        if (buttonId) {
          setPlayingButtons((prev) => new Set(prev).add(buttonId));
        }

        // Play the sound and wait for it to finish
        await audioSystem.playSound(soundId);
      } catch (error) {
        console.error(`Error playing sound ${soundId}:`, error);
      } finally {
        // Clean up - remove from playing sets
        setPlayingSounds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(soundId);
          return newSet;
        });
        if (buttonId) {
          setPlayingButtons((prev) => {
            const newSet = new Set(prev);
            newSet.delete(buttonId);
            return newSet;
          });
        }
      }
    },
    [playingSounds, playingButtons]
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
        setPlayingButtons((prev) => new Set(prev).add(buttonId));

        // Play the sound combination and wait for it to finish
        await audioSystem.playSoundsSequentially(sounds);
      } catch (error) {
        console.error(`Error playing sound combination:`, error);
      } finally {
        // Clean up - remove from playing set
        setPlayingButtons((prev) => {
          const newSet = new Set(prev);
          newSet.delete(buttonId);
          return newSet;
        });
      }
    },
    [playingButtons]
  );

  return {
    playingSounds,
    playingButtons,
    playSoundWithFeedback,
    playSoundCombinationWithFeedback,
  };
}
