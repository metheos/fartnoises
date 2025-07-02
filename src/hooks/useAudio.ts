import { useState, useEffect } from "react";
import { getSoundEffects } from "@/data/gameData";
import { audioSystem } from "@/utils/audioSystem";
import { SoundEffect } from "@/types/game";

interface UseAudioReturn {
  soundEffects: SoundEffect[];
  isAudioReady: boolean;
  setIsAudioReady: React.Dispatch<React.SetStateAction<boolean>>;
  activateAudio: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  hasTriedAutoInit: boolean;
  isInitializing: boolean;
}

interface UseAudioProps {
  allowExplicitContent?: boolean;
}

export function useAudio({
  allowExplicitContent = true,
}: UseAudioProps = {}): UseAudioReturn {
  const [soundEffects, setSoundEffects] = useState<SoundEffect[]>([]);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasTriedAutoInit, setHasTriedAutoInit] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Load sound effects and check audio readiness on component mount
  useEffect(() => {
    const loadSounds = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const sounds = await getSoundEffects(allowExplicitContent);
        setSoundEffects(sounds);
        console.log(
          `useAudio: Loaded ${sounds.length} sound effects (explicit: ${allowExplicitContent})`
        );

        // Check if audio can already be initialized (due to previous user interaction)
        if (audioSystem.canInitialize()) {
          console.log(
            "🔊 useAudio: Audio can be initialized, checking if already active..."
          );

          // Only set ready to true if the audio system is actually initialized and running
          if (audioSystem.isInitialized()) {
            console.log("🔊 useAudio: Audio system already active");
            setIsAudioReady(true);
            setHasTriedAutoInit(true); // Mark as tried since it's already working
          } else {
            console.log("🔊 useAudio: Auto-initializing audio system...");
            setIsInitializing(true);
            setHasTriedAutoInit(true);
            // Since canInitialize() returned true, try direct initialization
            audioSystem
              .initialize()
              .then(() => {
                setIsAudioReady(true);
                setIsInitializing(false);
                console.log(
                  "✅ useAudio: Audio system auto-initialized successfully"
                );
              })
              .catch((error) => {
                setIsInitializing(false);
                console.warn(
                  "⚠️ useAudio: Auto-initialization failed, will require manual activation:",
                  error
                );
                // setIsAudioReady remains false, and hasTriedAutoInit is true, so manual activation button will show
              });
          }
        } else {
          console.log(
            "🔊 useAudio: Audio requires user activation - no interaction detected yet"
          );
          // Don't set hasTriedAutoInit yet - we'll wait for user interaction
        }
      } catch (loadError) {
        console.error("useAudio: Failed to load sound effects:", loadError);
        setError("Failed to load sound effects");
      } finally {
        setIsLoading(false);
      }
    };

    loadSounds();
  }, [allowExplicitContent]);

  // Debug effect to log state changes
  useEffect(() => {
    console.log(
      `🔊 useAudio: State change - isAudioReady: ${isAudioReady}, hasTriedAutoInit: ${hasTriedAutoInit}, isInitializing: ${isInitializing}, isLoading: ${isLoading}`
    );
  }, [isAudioReady, hasTriedAutoInit, isInitializing, isLoading]);

  // Immediate check when user interaction becomes available
  useEffect(() => {
    if (isAudioReady || hasTriedAutoInit) return;

    const handleInteractionCheck = () => {
      // Small delay to ensure the user interaction flag is set
      setTimeout(() => {
        console.log(
          `🔊 useAudio: Interaction check - hasTriedAutoInit: ${hasTriedAutoInit}, isAudioReady: ${isAudioReady}, isInitializing: ${isInitializing}`
        );
        if (
          !hasTriedAutoInit &&
          audioSystem.canInitialize() &&
          !audioSystem.isInitialized()
        ) {
          console.log(
            "🔊 useAudio: User interaction detected - immediately auto-initializing audio..."
          );
          console.log(
            `🔊 useAudio: Setting isInitializing: true, hasTriedAutoInit: true`
          );
          setIsInitializing(true);
          setHasTriedAutoInit(true);
          audioSystem
            .initialize()
            .then(() => {
              console.log(
                `🔊 useAudio: Initialization succeeded - setting isAudioReady: true, isInitializing: false`
              );
              setIsAudioReady(true);
              setIsInitializing(false);
              console.log(
                "✅ useAudio: Audio system auto-initialized after user interaction"
              );
            })
            .catch((error) => {
              console.log(
                `🔊 useAudio: Initialization failed - setting isInitializing: false`
              );
              setIsInitializing(false);
              console.log(
                "⚠️ useAudio: Auto-initialization failed after user interaction:",
                error
              );
            });
        } else {
          console.log(
            `🔊 useAudio: Skipping interaction init - hasTriedAutoInit: ${hasTriedAutoInit}, canInit: ${audioSystem.canInitialize()}, isInit: ${audioSystem.isInitialized()}`
          );
        }
      }, 150);
    };

    // Listen for the same interaction events to trigger immediate check
    const events = [
      "click",
      "touchstart",
      "touchend",
      "keydown",
      "keyup",
      "pointerdown",
      "mousedown",
    ];

    events.forEach((event) => {
      document.addEventListener(event, handleInteractionCheck, {
        passive: true,
        once: true, // Only need to check once per useAudio instance
      });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleInteractionCheck);
      });
    };
  }, [isAudioReady, hasTriedAutoInit]);

  // Periodic check for auto-initialization when user interaction becomes available
  useEffect(() => {
    if (isAudioReady || hasTriedAutoInit) return; // Already ready or already tried, no need to check

    const checkAndAutoInit = () => {
      console.log(
        `🔊 useAudio: Periodic check - hasTriedAutoInit: ${hasTriedAutoInit}, isAudioReady: ${isAudioReady}, isInitializing: ${isInitializing}`
      );
      // Only proceed if we haven't tried auto-init yet and audio can actually initialize
      if (
        !hasTriedAutoInit &&
        audioSystem.canInitialize() &&
        !audioSystem.isInitialized()
      ) {
        console.log("🔊 useAudio: Periodic check - auto-initializing audio...");
        console.log(
          `🔊 useAudio: Periodic - setting isInitializing: true, hasTriedAutoInit: true`
        );
        setIsInitializing(true);
        setHasTriedAutoInit(true);
        audioSystem
          .initialize()
          .then(() => {
            console.log(
              `🔊 useAudio: Periodic initialization succeeded - setting isAudioReady: true, isInitializing: false`
            );
            setIsAudioReady(true);
            setIsInitializing(false);
            console.log(
              "✅ useAudio: Audio system auto-initialized via periodic check"
            );
          })
          .catch((error) => {
            console.log(
              `🔊 useAudio: Periodic initialization failed - setting isInitializing: false`
            );
            setIsInitializing(false);
            console.log(
              "⚠️ useAudio: Periodic auto-initialization failed:",
              error
            );
            // hasTriedAutoInit is true and isAudioReady is false, so manual button will show
          });
      } else {
        console.log(
          `🔊 useAudio: Skipping periodic init - hasTriedAutoInit: ${hasTriedAutoInit}, canInit: ${audioSystem.canInitialize()}, isInit: ${audioSystem.isInitialized()}`
        );
      }
    };

    // Check every 2 seconds for user interaction (back to 2 seconds since we have immediate check now)
    const interval = setInterval(checkAndAutoInit, 2000);

    return () => clearInterval(interval);
  }, [isAudioReady, hasTriedAutoInit]);

  const activateAudio = async () => {
    try {
      console.log("🔊 useAudio: Activating audio system...");
      setIsInitializing(true);
      await audioSystem.initialize();
      setIsAudioReady(true);
      setIsInitializing(false);
      setError(null);
      console.log("✅ useAudio: Audio system activated successfully");
    } catch (activationError) {
      setIsInitializing(false);
      console.error(
        "❌ useAudio: Failed to activate audio system:",
        activationError
      );
      setError("Failed to activate audio system");
      throw activationError;
    }
  };

  return {
    soundEffects,
    isAudioReady,
    setIsAudioReady,
    activateAudio,
    isLoading,
    error,
    hasTriedAutoInit,
    isInitializing,
  };
}
