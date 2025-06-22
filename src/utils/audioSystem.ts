// Audio system for playing sound effects
export class AudioSystem {
  private static instance: AudioSystem;
  private audioContext: AudioContext | null = null;
  private loadedSounds: Map<string, AudioBuffer> = new Map();
  private failedSounds: Set<string> = new Set();
  private activeSources: Set<AudioBufferSourceNode> = new Set();

  static getInstance(): AudioSystem {
    if (!AudioSystem.instance) {
      AudioSystem.instance = new AudioSystem();
    }
    return AudioSystem.instance;
  }
  async initialize(): Promise<void> {
    if (!this.audioContext) {
      // Create proper type definition for webkit prefix
      const WindowWithWebkit = window as Window & {
        webkitAudioContext?: typeof AudioContext;
      };

      this.audioContext = new (window.AudioContext ||
        WindowWithWebkit.webkitAudioContext ||
        AudioContext)();
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }
  async loadSound(id: string, fileName: string): Promise<void> {
    if (this.loadedSounds.has(id) || this.failedSounds.has(id)) return;

    try {
      // Earwax audio files are located in /sounds/Earwax/EarwaxAudio/Audio/
      const response = await fetch(
        `/sounds/Earwax/EarwaxAudio/Audio/${fileName}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load sound: ${fileName}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      if (!this.audioContext) {
        await this.initialize();
      }

      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      this.loadedSounds.set(id, audioBuffer);

      console.log(`✅ Loaded sound: ${fileName}`);
    } catch (error) {
      console.warn(`⚠️ Failed to load sound ${fileName}:`, error);
      this.failedSounds.add(id);

      // Generate a placeholder beep sound for missing files
      this.generatePlaceholderSound(id);
    }
  }

  private generatePlaceholderSound(id: string): void {
    if (!this.audioContext) return;

    // Create a simple beep tone as placeholder
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.5; // 500ms
    const length = sampleRate * duration;
    const audioBuffer = this.audioContext.createBuffer(1, length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    // Generate a simple sine wave beep
    const frequency = 440; // A4 note
    for (let i = 0; i < length; i++) {
      channelData[i] =
        Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.3;
    }

    this.loadedSounds.set(id, audioBuffer);
    console.log(`🔊 Generated placeholder beep for: ${id}`);
  }
  async playSound(id: string): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }

    // If sound is not loaded, try to load it on-demand
    if (!this.loadedSounds.has(id) && !this.failedSounds.has(id)) {
      console.log(`Loading sound on-demand: ${id}`);
      await this.loadSound(id, `${id}.ogg`);
    }

    const audioBuffer = this.loadedSounds.get(id);
    if (!audioBuffer) {
      console.warn(`Sound not loaded: ${id}`);
      return;
    }

    return new Promise<void>((resolve) => {
      const source = this.audioContext!.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext!.destination);

      // Track this source so we can stop it if needed
      this.activeSources.add(source);

      // Resolve the promise and clean up when the sound finishes
      source.onended = () => {
        this.activeSources.delete(source);
        resolve();
      };

      source.start();
    });
  }

  async playSoundsSequentially(soundIds: string[]): Promise<void> {
    for (const soundId of soundIds) {
      try {
        await this.playSound(soundId);
        // No extra delay needed here as playSound now resolves on completion
      } catch (error) {
        console.error(`Error playing sound ${soundId} in sequence:`, error);
        // Decide if you want to continue or stop on error
      }
    }
  }

  stopAllSounds(): void {
    if (!this.audioContext) return;
    console.log(`Stopping ${this.activeSources.size} active sounds.`);
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors if the source is already stopped
      }
    });
    this.activeSources.clear();
  }

  async playSoundSequence(
    soundIds: string[],
    delay: number = 500
  ): Promise<void> {
    for (let i = 0; i < soundIds.length; i++) {
      await this.playSound(soundIds[i]);
      if (i < soundIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  // Preview a sound with visual feedback
  async previewSound(
    id: string,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    if (onStart) onStart();

    try {
      await this.playSound(id); // This now properly waits for the sound to finish
      if (onEnd) onEnd();
    } catch (error) {
      console.error("Error previewing sound:", error);
      if (onEnd) onEnd();
    }
  }

  // Play a sound immediately without waiting for it to finish (for rapid playback)
  async playSoundImmediate(id: string): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }

    // If sound is not loaded, try to load it on-demand
    if (!this.loadedSounds.has(id) && !this.failedSounds.has(id)) {
      console.log(`Loading sound on-demand: ${id}`);
      await this.loadSound(id, `${id}.ogg`);
    }

    const audioBuffer = this.loadedSounds.get(id);
    if (!audioBuffer) {
      console.warn(`Sound not loaded: ${id}`);
      return;
    }

    const source = this.audioContext!.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext!.destination);
    source.start();
  }

  isSoundLoaded(id: string): boolean {
    return this.loadedSounds.has(id);
  }
  getSoundStatus(id: string): "loaded" | "failed" | "not-loaded" {
    if (this.loadedSounds.has(id)) return "loaded";
    if (this.failedSounds.has(id)) return "failed";
    return "not-loaded";
  }

  // Preload specific sounds (useful when players select sounds)
  async preloadSounds(soundIds: string[]): Promise<void> {
    const loadPromises = soundIds.map(async (id) => {
      if (!this.loadedSounds.has(id) && !this.failedSounds.has(id)) {
        return this.loadSound(id, `${id}.ogg`);
      }
    });

    await Promise.all(loadPromises);
    console.log(`Preloaded ${soundIds.length} specific sounds`);
  }

  // Load and play prompt audio from EarwaxPrompts folder
  async loadAndPlayPromptAudio(audioFileName: string): Promise<void> {
    const promptId = `prompt_${audioFileName}`;

    try {
      // Check if already loaded
      if (this.loadedSounds.has(promptId)) {
        await this.playSound(promptId);
        return;
      }

      // Load prompt audio from the EarwaxPrompts folder
      const response = await fetch(
        `/sounds/Earwax/EarwaxPrompts/${audioFileName}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load prompt audio: ${audioFileName}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      if (!this.audioContext) {
        await this.initialize();
      }

      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      this.loadedSounds.set(promptId, audioBuffer); // Play the audio immediately after loading
      await this.playSound(promptId);

      console.log(`✅ Played prompt audio: ${audioFileName}`);
    } catch (error) {
      console.error(
        `❌ Failed to load/play prompt audio ${audioFileName}:`,
        error
      );
      this.failedSounds.add(promptId);
    }
  }
}

// Hook for React components
import { useEffect, useState } from "react";
import { getSoundEffects } from "@/data/gameData";

export function useAudioSystem() {
  const [audioSystem, setAudioSystem] = useState<AudioSystem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAudio = async () => {
      const audio = AudioSystem.getInstance();
      await audio.initialize();
      setAudioSystem(audio);
      setIsLoading(false);
    };

    initializeAudio();
  }, []);

  return { audioSystem, isLoading };
}

// Export singleton instance
export const audioSystem = AudioSystem.getInstance();
