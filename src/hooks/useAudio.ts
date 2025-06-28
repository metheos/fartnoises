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
}

export function useAudio(): UseAudioReturn {
  const [soundEffects, setSoundEffects] = useState<SoundEffect[]>([]);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load sound effects on component mount
  useEffect(() => {
    const loadSounds = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const sounds = await getSoundEffects();
        setSoundEffects(sounds);
        console.log(`useAudio: Loaded ${sounds.length} sound effects`);
      } catch (loadError) {
        console.error("useAudio: Failed to load sound effects:", loadError);
        setError("Failed to load sound effects");
      } finally {
        setIsLoading(false);
      }
    };

    loadSounds();
  }, []);

  const activateAudio = async () => {
    try {
      console.log("🔊 useAudio: Activating audio system...");
      await audioSystem.initialize();
      setIsAudioReady(true);
      setError(null);
      console.log("✅ useAudio: Audio system activated successfully");
    } catch (activationError) {
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
  };
}
