import { useState, useEffect, useCallback } from "react";
import { audioSystem } from "@/utils/audioSystem";

interface GameplayEffectOptions {
  reverse?: boolean;
  speed?: number;
  volume?: number;
}

interface GameplayEffect {
  name: string;
  files: string[];
}

// Enhanced effect files mapping - will be expanded as more sounds are added
const effectFiles: Record<string, string[]> = {
  activate: ["toy-button-105724.mp3"],
  failunsafe: ["nuke-333673.mp3"],
  gameover: ["winning-218995.mp3"],
  judge: ["cinematic-boom-171285.mp3"],
  like: ["11l-game_complete_notifi-1749704606921-358785.mp3"],
  point: ["11l-game_complete_notifi-1749489486836-360350.mp3"],
  reveal: ["chime-and-chomp-84419.mp3"],
  roundresult: [
    "11l-victory_beat-1749704514998-358763.mp3",
    "level-win-6416.mp3",
  ],
};

// Helper function to get random file from effect folder
const getRandomEffectFile = (effectName: string): string | null => {
  const files = effectFiles[effectName];
  if (!files || files.length === 0) {
    console.warn(`No files found for effect: ${effectName}`);
    return null;
  }
  const randomIndex = Math.floor(Math.random() * files.length);
  return `/sounds/GameEffects/${effectName}/${files[randomIndex]}`;
};

export function useGameplayEffects(isAudioReady: boolean) {
  const [effects, setEffects] = useState<Map<string, GameplayEffect>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);

  // Initialize audio context
  useEffect(() => {
    // No need to manage our own audio context, we'll use the existing audioSystem
    console.log("🎵 Gameplay effects: Using existing audio system");
  }, [isAudioReady]);

  // Load available effects from GameEffects folder structure
  useEffect(() => {
    const loadEffectsList = async () => {
      try {
        setIsLoading(true);

        // Define the available effect folders
        const effectFolders = [
          "activate",
          "failunsafe",
          "gameover",
          "judge",
          "like",
          "point",
          "reveal",
          "roundresult",
        ];

        const effectsMap = new Map<string, GameplayEffect>();

        effectFolders.forEach((folder) => {
          const files = effectFiles[folder] || [];
          if (files.length > 0) {
            effectsMap.set(folder, {
              name: folder,
              files: files.map(
                (file) => `/sounds/GameEffects/${folder}/${file}`
              ),
            });
          }
        });

        setEffects(effectsMap);
        console.log(
          "🎵 Loaded gameplay effects:",
          Array.from(effectsMap.keys())
        );
      } catch (error) {
        console.error("Failed to load gameplay effects:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEffectsList();
  }, []);

  // Load an audio buffer from URL (removed - using existing audio system)

  // Play a gameplay effect with options using the existing audio system
  const playEffect = useCallback(
    async (
      effectName: string,
      options: GameplayEffectOptions = {}
    ): Promise<void> => {
      if (!isAudioReady) {
        console.warn(
          "🎵 Gameplay effects: Audio not ready yet, skipping effect:",
          effectName
        );
        return;
      }

      // Use helper function to get random file from effect folder
      const selectedFile = getRandomEffectFile(effectName);
      if (!selectedFile) {
        console.warn(`🎵 Gameplay effect not found: ${effectName}`);
        return;
      }

      console.log(
        `🎵 Playing gameplay effect: ${effectName} (${selectedFile})`
      );

      try {
        // Create a unique ID for this effect file
        const effectId = selectedFile.replace(/[\/\.]/g, "_");

        // Load the sound into the existing audio system if not already loaded
        if (!audioSystem.isSoundLoaded(effectId)) {
          console.log(`🎵 Loading effect sound: ${effectId}`);
          // For gameplay effects, we need to load them differently since they're not in the Earwax folder
          // Let's try loading it directly or create a simpler approach
          console.log(
            `🎵 Note: Game effects use different loading path than Earwax sounds`
          );
        }

        // For now, let's use a simpler approach and try to play directly
        // We'll implement a custom audio loading for game effects
        await playGameEffectDirect(selectedFile, options);

        console.log(`🎵 Successfully played effect: ${effectName}`);
      } catch (error) {
        console.error(`🎵 Error playing gameplay effect ${effectName}:`, error);
      }
    },
    [isAudioReady]
  );

  // Helper function to play game effects directly using Web Audio API
  const playGameEffectDirect = useCallback(
    async (
      filePath: string,
      options: GameplayEffectOptions = {}
    ): Promise<void> => {
      try {
        // Create a simple audio element approach for now
        const audio = new Audio(filePath);

        // Apply volume
        audio.volume = options.volume ?? 0.7;

        // Apply speed (playbackRate)
        if (options.speed && options.speed !== 1) {
          audio.playbackRate = options.speed;
        }

        // Note: reverse playback is complex with Audio elements, skip for now
        if (options.reverse) {
          console.log("🔄 Reverse playback not supported with Audio elements");
        }

        // Play the audio
        await audio.play();
      } catch (error) {
        console.error("Failed to play game effect directly:", error);
        throw error;
      }
    },
    []
  );

  // Convenience methods for specific game events
  const playJudgeReveal = useCallback(
    () => playEffect("judge", { volume: 0.8 }),
    [playEffect]
  );
  const playPromptReveal = useCallback(
    () => playEffect("reveal", { volume: 0.6 }),
    [playEffect]
  );
  const playSubmissionActivate = useCallback(
    () => playEffect("activate", { volume: 0.5 }),
    [playEffect]
  );
  const playRoundResult = useCallback(
    () => playEffect("roundresult", { volume: 0.7 }),
    [playEffect]
  );
  const playLikeIncrement = useCallback(
    () => playEffect("like", { volume: 0.4, speed: 1.2 }),
    [playEffect]
  );
  const playPointIncrement = useCallback(
    () => playEffect("point", { volume: 0.8 }),
    [playEffect]
  );
  const playGameOver = useCallback(
    () => playEffect("gameover", { volume: 0.9 }),
    [playEffect]
  );
  const playFailSound = useCallback(
    () => playEffect("failunsafe", { volume: 0.6 }),
    [playEffect]
  );

  return {
    effects: Array.from(effects.keys()),
    isLoading,
    playEffect,
    // Convenience methods for specific events
    playJudgeReveal,
    playPromptReveal,
    playSubmissionActivate,
    playRoundResult,
    playLikeIncrement,
    playPointIncrement,
    playGameOver,
    playFailSound,
  };
}
