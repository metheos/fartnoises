import { useEffect, useState } from "react";
import { audioSystem } from "../utils/audioSystem";

/**
 * Hook to track user interactions and mark them for audio system initialization
 * This should be used in the root component to ensure audio is ready when needed
 */
export function useUserInteractionTracking() {
  useEffect(() => {
    let hasInteracted = false;

    const markInteraction = () => {
      if (!hasInteracted) {
        hasInteracted = true;
        audioSystem.markUserInteraction();
        console.log(
          "🔊 First user interaction detected - audio system ready for auto-initialization"
        );

        // Give a small delay to ensure the user interaction flag is properly set
        // before any periodic checks run in other hooks
        setTimeout(() => {
          // This timeout ensures that any useAudio hooks have time to react to the user interaction
        }, 100);
      }
    };

    // Listen for various user interaction events
    const events = [
      "click",
      "touchstart",
      "touchend",
      "keydown",
      "keyup",
      "pointerdown",
      "mousedown",
    ];

    // Add event listeners to document
    events.forEach((event) => {
      document.addEventListener(event, markInteraction, {
        passive: true,
        once: false, // Keep listening in case first interaction doesn't work
      });
    });

    // Also listen for focus events (user switching back to tab)
    window.addEventListener("focus", markInteraction, { passive: true });

    // Cleanup function
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, markInteraction);
      });
      window.removeEventListener("focus", markInteraction);
    };
  }, []);
}

/**
 * Hook that provides a manual function to mark user interaction
 * Useful for specific components that handle user actions
 */
export function useMarkUserInteraction() {
  return () => {
    audioSystem.markUserInteraction();
  };
}

/**
 * Hook that checks if the audio system can be initialized
 * Updates when user interaction state changes
 */
export function useAudioReadiness() {
  const [canInitialize, setCanInitialize] = useState(false);

  useEffect(() => {
    // Check initial state
    setCanInitialize(audioSystem.canInitialize());

    // Set up interval to check for changes
    const interval = setInterval(() => {
      const newCanInit = audioSystem.canInitialize();
      setCanInitialize((current) => {
        if (current !== newCanInit) {
          console.log(`🔊 Audio readiness changed: ${newCanInit}`);
          return newCanInit;
        }
        return current;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return canInitialize;
}
