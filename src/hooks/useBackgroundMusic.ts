import { useState, useEffect, useRef, useCallback } from "react";

interface BackgroundMusicHook {
  currentTrack: string | null;
  isPlaying: boolean;
  isFading: boolean;
  isAudioReady: boolean;
  volume: number;
  changeMusic: (newTrack: string | null) => void;
  setVolume: (volume: number) => void;
  activateAudio: () => Promise<void>;
}

// Define music folders for different game states
export const BACKGROUND_MUSIC = {
  LOBBY: "Lobby",
  WAITING_FOR_PLAYERS: "Lobby", // Use lobby music while waiting
  SOUND_SELECTION: "Selection",
  PLAYBACK: null, // No music during playback - let sound effects have full attention
  JUDGING: "Judging",
  RESULTS: null, // No music during results - let sound effects have full attention
  ROUND_END: "RoundResults",
  GAME_OVER: "GameOver",
} as const;

// Music file cache to avoid re-fetching file lists
const musicCache = new Map<string, string[]>();

// Simple seeded random number generator for consistent randomness per session
class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

const rng = new SeededRandom();

// Function to get random music file from a folder
async function getRandomMusicFromFolder(
  folderName: string
): Promise<string | null> {
  try {
    // Check cache first
    if (musicCache.has(folderName)) {
      const files = musicCache.get(folderName)!;
      if (files.length === 0) return null;

      const randomIndex = Math.floor(rng.next() * files.length);
      const selectedFile = files[randomIndex];
      console.log(
        `Background music: Selected ${selectedFile} from ${folderName} (${
          randomIndex + 1
        }/${files.length})`
      );
      return `/sounds/Music/${folderName}/${selectedFile}`;
    }

    // If not cached, we'll need to have the files pre-defined since we can't fetch directory listings in the browser
    // For now, we'll use the known files based on the folder structure
    const knownFiles: Record<string, string[]> = {
      GameOver: ["neon-route-retro-future-80s-synthwave-366377.mp3"],
      Judging: ["molten-city-188967.mp3"],
      Lobby: ["in-the-game-313592.mp3"],
      RoundResults: ["back-to-80s-no2-367064.mp3"],
      Selection: ["cheesy-fun-215400.mp3"],
    };

    const files = knownFiles[folderName] || [];
    musicCache.set(folderName, files);

    if (files.length === 0) {
      console.warn(`Background music: No files found for folder ${folderName}`);
      return null;
    }

    const randomIndex = Math.floor(rng.next() * files.length);
    const selectedFile = files[randomIndex];
    console.log(
      `Background music: Selected ${selectedFile} from ${folderName} (${
        randomIndex + 1
      }/${files.length})`
    );
    return `/sounds/Music/${folderName}/${selectedFile}`;
  } catch (error) {
    console.error(
      `Background music: Error loading files from ${folderName}:`,
      error
    );
    return null;
  }
}

export function useBackgroundMusic(): BackgroundMusicHook {
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [volume, setVolumeState] = useState(0.1); // Default background music volume
  const [isAudioReady, setIsAudioReady] = useState(false);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextActivated = useRef(false);

  // Use refs to store current values for stable access
  const currentFolderRef = useRef<string | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const volumeRef = useRef<number>(0.1);

  // Keep refs in sync with state
  useEffect(() => {
    currentFolderRef.current = currentFolder;
  }, [currentFolder]);

  // Auto-initialize audio when user interaction is available
  useEffect(() => {
    const tryAutoInit = () => {
      if (!audioContextActivated.current && !isAudioReady) {
        // Use the main audio system to check if initialization is possible
        import("@/utils/audioSystem").then(({ audioSystem }) => {
          if (audioSystem.canInitialize()) {
            console.log(
              "🔊 Background music: Auto-initializing audio context..."
            );
            // Create a dummy audio context to activate it
            const audioContext = new (window.AudioContext ||
              (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext)();

            const initPromise =
              audioContext.state === "suspended"
                ? audioContext.resume()
                : Promise.resolve();

            initPromise
              .then(() => {
                audioContextActivated.current = true;
                setIsAudioReady(true);
                console.log(
                  "✅ Background music: Audio context auto-activated"
                );
              })
              .catch((error) => {
                console.warn(
                  "⚠️ Background music: Auto-activation failed:",
                  error
                );
              });
          }
        });
      }
    };

    tryAutoInit();

    // Also set up periodic checking
    if (!isAudioReady) {
      const interval = setInterval(tryAutoInit, 2000);
      return () => clearInterval(interval);
    }
  }, [isAudioReady]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // When audio becomes ready, try to resume the last requested music
  useEffect(() => {
    if (
      isAudioReady &&
      audioContextActivated.current &&
      currentFolder &&
      !isPlaying &&
      !currentTrack &&
      !isFading // Don't interrupt fading operations
    ) {
      console.log(
        "Background music: Audio is now ready, resuming music for folder:",
        currentFolder
      );
      // Use a small delay to prevent immediate conflicts with other music requests
      const timeoutId = setTimeout(() => {
        // Double-check that we're still in the same state before resuming
        if (
          currentFolderRef.current === currentFolder &&
          !isPlayingRef.current
        ) {
          changeMusic(currentFolder);
        }
      }, 200); // Increased delay to 200ms
      return () => clearTimeout(timeoutId);
    }
  }, [isAudioReady]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.removeEventListener("canplaythrough", () => {});
      currentAudioRef.current.removeEventListener("error", () => {});
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }
  }, []);

  // Fade out current audio
  const fadeOut = useCallback(
    (audio: HTMLAudioElement, duration: number = 1000): Promise<void> => {
      return new Promise((resolve) => {
        if (!audio) {
          resolve();
          return;
        }

        const startVolume = audio.volume;
        const fadeStep = startVolume / (duration / 50); // 50ms intervals

        setIsFading(true);

        const intervalId = setInterval(() => {
          if (audio.volume > fadeStep) {
            audio.volume = Math.max(0, audio.volume - fadeStep);
          } else {
            audio.volume = 0;
            audio.pause();
            clearInterval(intervalId);
            setIsFading(false);
            resolve();
          }
        }, 50);

        fadeIntervalRef.current = intervalId;
      });
    },
    []
  );

  // Fade in new audio
  const fadeIn = useCallback(
    (
      audio: HTMLAudioElement,
      targetVolume: number,
      duration: number = 1000
    ): Promise<void> => {
      return new Promise((resolve) => {
        if (!audio) {
          console.log(
            "🎵 useBackgroundMusic: fadeIn called with no audio element"
          );
          resolve();
          return;
        }

        console.log(
          "🎵 useBackgroundMusic: fadeIn starting from 0 to",
          targetVolume
        );
        audio.volume = 0;
        const fadeStep = targetVolume / (duration / 50); // 50ms intervals

        setIsFading(true);

        const intervalId = setInterval(() => {
          // Use the current desired volume from volumeRef in case user changed it during fade
          const currentTargetVolume = volumeRef.current;

          if (audio.volume < currentTargetVolume - fadeStep) {
            audio.volume = Math.min(
              currentTargetVolume,
              audio.volume + fadeStep
            );
          } else {
            audio.volume = currentTargetVolume;
            console.log(
              "🎵 useBackgroundMusic: fadeIn completed, final volume:",
              audio.volume
            );
            clearInterval(intervalId);
            setIsFading(false);
            resolve();
          }
        }, 50);

        fadeIntervalRef.current = intervalId;
      });
    },
    []
  );

  // Activate audio context (required for autoplay)
  const activateAudio = useCallback(async (): Promise<void> => {
    if (audioContextActivated.current) {
      setIsAudioReady(true);
      return;
    }

    try {
      // Create a dummy audio context to activate it
      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      audioContextActivated.current = true;
      setIsAudioReady(true);
      console.log("Background music: Audio context activated");
    } catch (error) {
      console.error(
        "Background music: Failed to activate audio context:",
        error
      );
      setIsAudioReady(false);
    }
  }, []);

  // Change background music with fade transition
  const changeMusic = useCallback(async (newFolderName: string | null) => {
    const currentFolderValue = currentFolderRef.current;
    const isPlayingValue = isPlayingRef.current;
    const volumeValue = volumeRef.current;

    console.log(
      "Background music: Changing from folder",
      currentFolderValue,
      "to",
      newFolderName
    );

    // If same folder is already playing or loading, do nothing
    if (
      currentFolderValue === newFolderName &&
      (isPlayingValue || currentAudioRef.current)
    ) {
      console.log(
        "Background music: Same folder already playing/loading, no change needed"
      );
      return;
    }

    // If no new folder specified, just fade out current
    if (!newFolderName) {
      if (currentAudioRef.current && isPlayingValue) {
        await fadeOut(currentAudioRef.current);
        setIsPlaying(false);
        setCurrentTrack(null);
        setCurrentFolder(null);
      }
      return;
    }

    // Check if audio context is ready - if not, store the requested music but don't play
    if (!audioContextActivated.current) {
      console.log(
        "Background music: Audio not activated yet, storing folder for later:",
        newFolderName
      );
      setCurrentFolder(newFolderName);
      return;
    }

    try {
      // Immediately update the folder to prevent duplicate requests
      setCurrentFolder(newFolderName);

      // Get random track from the new folder
      const newTrack = await getRandomMusicFromFolder(newFolderName);
      if (!newTrack) {
        console.warn(
          `Background music: No valid track found for folder ${newFolderName}`
        );
        setCurrentFolder(currentFolderValue); // Revert to previous folder
        return;
      }

      // Fade out current track if playing
      if (currentAudioRef.current && isPlayingValue) {
        const oldAudio = currentAudioRef.current;
        await fadeOut(oldAudio);
        // Clean up the old audio completely
        oldAudio.src = "";
        oldAudio.removeEventListener("canplaythrough", () => {});
        oldAudio.removeEventListener("error", () => {});
      }

      // Create new audio element
      const newAudio = new Audio(newTrack);
      newAudio.loop = true;
      newAudio.preload = "auto";
      console.log(
        "🎵 useBackgroundMusic: Created new audio element for:",
        newTrack,
        "with volume:",
        volumeValue
      );

      // Wait for audio to be ready
      await new Promise((resolve, reject) => {
        newAudio.addEventListener("canplaythrough", resolve, { once: true });
        newAudio.addEventListener("error", reject, { once: true });
        newAudio.load();
      });

      // Start playing and fade in
      currentAudioRef.current = newAudio;
      setCurrentTrack(newTrack);
      // Don't set folder again here since we already did it above

      await newAudio.play();
      setIsPlaying(true);
      console.log(
        "🎵 useBackgroundMusic: Audio started playing, about to fade in to volume:",
        volumeValue
      );

      await fadeIn(newAudio, volumeValue);

      console.log("Background music: Successfully changed to", newTrack);
    } catch (error) {
      console.error("Background music: Failed to change music:", error);

      // Check if it's an autoplay permission error
      if (
        error instanceof Error &&
        error.message.includes("play method is not allowed")
      ) {
        console.log(
          "Background music: Autoplay blocked, marking audio as not ready"
        );
        setIsAudioReady(false);
        audioContextActivated.current = false;
      }

      setIsPlaying(false);
      setCurrentTrack(null);
      setCurrentFolder(currentFolderValue); // Revert to previous folder on error
    }
  }, []);

  // Set volume for current audio
  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    console.log(
      "🎵 useBackgroundMusic: setVolume called with",
      newVolume,
      "clamped to",
      clampedVolume
    );
    console.log(
      "🎵 useBackgroundMusic: Current audio ref exists:",
      !!currentAudioRef.current
    );
    console.log(
      "🎵 useBackgroundMusic: Currently fading:",
      !!fadeIntervalRef.current
    );

    setVolumeState(clampedVolume);
    volumeRef.current = clampedVolume; // Always update the stored volume

    if (currentAudioRef.current) {
      const oldVolume = currentAudioRef.current.volume;
      currentAudioRef.current.volume = clampedVolume;
      console.log(
        "🎵 useBackgroundMusic: Audio volume changed from",
        oldVolume,
        "to",
        currentAudioRef.current.volume
      );

      if (fadeIntervalRef.current) {
        console.log(
          "🎵 useBackgroundMusic: Volume set during fade - fade will continue to new target"
        );
      }
    } else {
      console.log(
        "🎵 useBackgroundMusic: No current audio to set volume on, but volume stored for future use"
      );
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    currentTrack,
    isPlaying,
    isFading,
    isAudioReady,
    volume,
    changeMusic,
    setVolume,
    activateAudio,
  };
}
