// Audio system for playing sound effects
export class AudioSystem {
  private static instance: AudioSystem;
  private audioContext: AudioContext | null = null;
  private loadedSounds: Map<string, AudioBuffer> = new Map();
  private failedSounds: Set<string> = new Set();

  static getInstance(): AudioSystem {
    if (!AudioSystem.instance) {
      AudioSystem.instance = new AudioSystem();
    }
    return AudioSystem.instance;
  }
  async initialize(): Promise<void> {    if (!this.audioContext) {
      // Create proper type definition for webkit prefix
      const WindowWithWebkit = window as Window & {
        webkitAudioContext?: typeof AudioContext;
      };
      
      this.audioContext = new (window.AudioContext ||
        WindowWithWebkit.webkitAudioContext || AudioContext)();
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  async loadSound(id: string, fileName: string): Promise<void> {
    if (this.loadedSounds.has(id) || this.failedSounds.has(id)) return;

    try {
      const response = await fetch(`/sounds/${fileName}`);

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

    const audioBuffer = this.loadedSounds.get(id);
    if (!audioBuffer) {
      console.warn(`Sound not loaded: ${id}`);
      return;
    }

    const source = this.audioContext!.createBufferSource();
    const gainNode = this.audioContext!.createGain();

    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(this.audioContext!.destination);

    // Add a slight fade to prevent clicks
    gainNode.gain.setValueAtTime(0, this.audioContext!.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      1,
      this.audioContext!.currentTime + 0.01
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext!.currentTime + audioBuffer.duration - 0.01
    );

    source.start();
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
      await this.playSound(id);

      // Estimate sound duration for feedback
      const audioBuffer = this.loadedSounds.get(id);
      const duration = audioBuffer ? audioBuffer.duration * 1000 : 500;

      setTimeout(() => {
        if (onEnd) onEnd();
      }, duration);
    } catch (error) {
      console.error("Error previewing sound:", error);
      if (onEnd) onEnd();
    }
  }

  isSoundLoaded(id: string): boolean {
    return this.loadedSounds.has(id);
  }

  getSoundStatus(id: string): "loaded" | "failed" | "not-loaded" {
    if (this.loadedSounds.has(id)) return "loaded";
    if (this.failedSounds.has(id)) return "failed";
    return "not-loaded";
  }
}

// Hook for React components
import { useEffect, useState } from "react";
import { SOUND_EFFECTS } from "@/data/gameData";

export function useAudioSystem() {
  const [audioSystem, setAudioSystem] = useState<AudioSystem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAudio = async () => {
      const audio = AudioSystem.getInstance();
      await audio.initialize();

      // Preload all sound effects
      const loadPromises = SOUND_EFFECTS.map((sound) =>
        audio.loadSound(sound.id, sound.fileName)
      );

      await Promise.all(loadPromises);
      setAudioSystem(audio);
      setIsLoading(false);
    };

    initializeAudio();
  }, []);

  return { audioSystem, isLoading };
}

// Export singleton instance
export const audioSystem = AudioSystem.getInstance();
