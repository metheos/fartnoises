import { useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { Socket } from "socket.io-client";
import { SoundEffect } from "@/types/game";
import { audioSystem } from "@/utils/audioSystem";

interface UseSubmissionPlaybackProps {
  socket: Socket | null;
  soundEffects: SoundEffect[];
}

interface PlaybackOptions {
  /** Timeout for waiting for main screen response (ms) */
  mainScreenTimeout?: number;
  /** Delay between sounds in sequence (ms) */
  soundDelay?: number;
  /** Average duration per sound for main screen timing (ms) */
  averageSoundDuration?: number;
}

/**
 * Custom hook for managing submission playback with main screen fallback logic
 * Handles the complex flow of attempting main screen playback first, then falling back to local
 */
export function useSubmissionPlayback({
  socket,
  soundEffects,
}: UseSubmissionPlaybackProps) {
  const [playingButtons, setPlayingButtons] = useState<Set<string>>(new Set());

  const playSubmissionSounds = useCallback(
    async (
      sounds: string[],
      submissionIndex: number,
      options: PlaybackOptions = {}
    ) => {
      const {
        mainScreenTimeout = 1000,
        soundDelay = 200,
        averageSoundDuration = 2000,
      } = options;

      const buttonId = `submission-${submissionIndex}`;

      console.log(`[PLAYBACK] Starting playSubmissionSounds for ${buttonId}`);
      console.log(
        `[PLAYBACK] Current playingButtons before check:`,
        Array.from(playingButtons)
      );

      // If this button is already playing, ignore the click
      if (playingButtons.has(buttonId)) {
        console.log(`[PLAYBACK] ${buttonId} is already playing, ignoring`);
        return;
      }

      if (sounds.length === 0) {
        console.log(`[PLAYBACK] No sounds provided for ${buttonId}`);
        return;
      }

      console.log(`[PLAYBACK] Setting ${buttonId} to playing state`);
      // Mark button as playing IMMEDIATELY and force synchronous render
      flushSync(() => {
        setPlayingButtons((prev) => {
          const newSet = new Set(prev).add(buttonId);
          console.log(`[PLAYBACK] Updated playingButtons:`, Array.from(newSet));
          return newSet;
        });
      });

      console.log(`[PLAYBACK] After flushSync, should be playing now`);

      try {
        // Check if we have a socket connection and should try main screen playback
        if (socket && socket.connected) {
          console.log(
            `[JUDGING] Attempting to play submission ${submissionIndex} on main screen via socket`
          );

          // Create a promise that resolves when playback is complete
          await new Promise<void>((resolve) => {
            // Emit event to server to request main screen playback
            socket.emit("requestJudgingPlayback", {
              submissionIndex,
              sounds,
            });

            // Set up fallback timeout for local playback
            const fallbackTimeout = setTimeout(async () => {
              console.log(
                `[JUDGING] No main screen response for submission ${submissionIndex}, falling back to local playback`
              );
              await performLocalPlayback();
              resolve(); // Resolve the promise when local playback is done
            }, mainScreenTimeout);

            // Listen for server response
            const handleMainScreenResponse = (response: {
              success: boolean;
              submissionIndex: number;
            }) => {
              if (response.submissionIndex === submissionIndex) {
                clearTimeout(fallbackTimeout);
                socket.off("judgingPlaybackResponse", handleMainScreenResponse);
                if (!response.success) {
                  console.log(
                    `[JUDGING] Main screen playback failed for submission ${submissionIndex}, falling back to local`
                  );
                  performLocalPlayback().then(() => resolve()); // Resolve when local playback is done
                } else {
                  console.log(
                    `[JUDGING] Main screen playback successful for submission ${submissionIndex}, waiting for audio duration...`
                  );
                  // For main screen playback, we need to wait for the estimated audio duration
                  // Calculate approximate duration and wait for it
                  waitForMainScreenPlayback().then(() => resolve());
                }
              }
            };

            socket.on("judgingPlaybackResponse", handleMainScreenResponse);

            // Clean up the listener after a timeout regardless
            setTimeout(() => {
              socket.off("judgingPlaybackResponse", handleMainScreenResponse);
            }, 5000);
          });
        } else {
          // No socket connection, play locally
          console.log(
            `[JUDGING] No socket connection, playing submission ${submissionIndex} locally`
          );
          await performLocalPlayback();
        }

        // Local playback function
        async function performLocalPlayback() {
          console.log(`[PLAYBACK] Starting local playback for ${buttonId}`);
          // Filter out any invalid sounds and get filenames
          const validSounds = sounds
            .map((soundId) => soundEffects.find((s) => s.id === soundId))
            .filter((sound) => sound !== undefined);

          if (validSounds.length > 0) {
            console.log(
              `Playing ${validSounds.length} sound(s) locally: [${sounds.join(
                ", "
              )}]`
            );
            // Use the proper sequence method that waits for each sound to finish
            await audioSystem.playSoundSequence(sounds, soundDelay);
          }
          console.log(`[PLAYBACK] Finished local playback for ${buttonId}`);
        }

        // Main screen playback duration wait function
        async function waitForMainScreenPlayback() {
          console.log(
            `[PLAYBACK] Waiting for main screen playback duration for ${buttonId}`
          );

          // Calculate estimated playback duration
          const totalEstimatedDuration =
            sounds.length * averageSoundDuration +
            (sounds.length - 1) * soundDelay;

          console.log(
            `[PLAYBACK] Estimated duration for ${sounds.length} sounds: ${totalEstimatedDuration}ms`
          );

          // Wait for the estimated duration
          await new Promise((resolve) =>
            setTimeout(resolve, totalEstimatedDuration)
          );

          console.log(
            `[PLAYBACK] Finished waiting for main screen playback duration for ${buttonId}`
          );
        }
      } catch (error) {
        console.error(`Error playing submission sounds:`, error);
      } finally {
        console.log(`[PLAYBACK] Cleaning up ${buttonId} from playing state`);
        // Clean up - remove from playing set with immediate render
        flushSync(() => {
          setPlayingButtons((prev) => {
            const newSet = new Set(prev);
            newSet.delete(buttonId);
            console.log(`[PLAYBACK] Final playingButtons:`, Array.from(newSet));
            return newSet;
          });
        });
      }
    },
    [socket, soundEffects, playingButtons]
  );

  const isButtonPlaying = useCallback(
    (submissionIndex: number) => {
      return playingButtons.has(`submission-${submissionIndex}`);
    },
    [playingButtons]
  );

  return {
    playSubmissionSounds,
    isButtonPlaying,
    playingButtons,
  };
}
