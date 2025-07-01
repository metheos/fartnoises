// Audio system for playing sound effects
export class AudioSystem {
  private static instance: AudioSystem;
  private audioContext: AudioContext | null = null;
  private loadedSounds: Map<string, AudioBuffer> = new Map();
  private failedSounds: Set<string> = new Set();
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  // Real-time audio analysis properties
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private timeData: Uint8Array | null = null;
  private isAnalysisActive: boolean = false;

  static getInstance(): AudioSystem {
    if (!AudioSystem.instance) {
      AudioSystem.instance = new AudioSystem();
    }
    return AudioSystem.instance;
  }
  async initialize(): Promise<void> {
    try {
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
        console.log("🔊 Resuming suspended AudioContext...");
        await this.audioContext.resume();
      }

      // Set up audio analysis nodes
      this.setupAudioAnalysis();

      console.log(
        `✅ AudioContext initialized successfully (state: ${this.audioContext.state})`
      );
    } catch (error) {
      console.error("❌ Failed to initialize AudioContext:", error);
      throw error;
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

      // Connect through analysis chain if available, otherwise direct to destination
      if (this.gainNode) {
        source.connect(this.gainNode);
        this.setAnalysisActive(true);
      } else {
        source.connect(this.audioContext!.destination);
      }

      // Track this source so we can stop it if needed
      this.activeSources.add(source);

      // Resolve the promise and clean up when the sound finishes
      source.onended = () => {
        this.activeSources.delete(source);
        // Stop analysis if no more sounds are playing
        if (this.activeSources.size === 0) {
          this.setAnalysisActive(false);
        }
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
      } catch {
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

    // Connect through analysis chain if available, otherwise direct to destination
    if (this.gainNode) {
      source.connect(this.gainNode);
      this.setAnalysisActive(true);
    } else {
      source.connect(this.audioContext!.destination);
    }

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

  private setupAudioAnalysis(): void {
    if (!this.audioContext) return;

    try {
      // Create analyser node for frequency analysis
      this.analyser = this.audioContext.createAnalyser();

      // Detect browser for performance optimization
      const isChrome =
        /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);

      // Configure for optimal frequency analysis with browser-specific settings
      if (isChrome) {
        // Chrome-optimized settings for better performance
        this.analyser.fftSize = 512; // Lower FFT for Chrome performance (256 bins)
        this.analyser.smoothingTimeConstant = 0.2; // Slightly more smoothing to reduce jitter
      } else {
        // Firefox/other browsers can handle higher resolution
        this.analyser.fftSize = 1024; // Higher resolution for other browsers (512 bins)
        this.analyser.smoothingTimeConstant = 0.1; // Less smoothing for responsiveness
      }

      this.analyser.minDecibels = -90; // Lower noise floor for better sensitivity
      this.analyser.maxDecibels = -10; // Higher ceiling for dynamic range

      // Log actual audio context sample rate and browser-specific settings
      console.log(
        `🔊 Audio Context Sample Rate: ${this.audioContext.sampleRate}Hz (${
          isChrome ? "Chrome" : "Other"
        } optimized)`
      );

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // Connect: gainNode -> analyser -> destination
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      // Initialize data arrays
      const bufferLength = this.analyser.frequencyBinCount;
      this.frequencyData = new Uint8Array(bufferLength);
      this.timeData = new Uint8Array(bufferLength);

      console.log(
        `✅ Audio analysis nodes set up successfully - FFT: ${this.analyser.fftSize}, Bins: ${bufferLength}, Sample Rate: ${this.audioContext.sampleRate}Hz`
      );
    } catch (error) {
      console.error("❌ Failed to set up audio analysis:", error);
    }
  }

  // Get the actual sample rate from the audio context
  getSampleRate(): number {
    return this.audioContext?.sampleRate || 44100;
  }

  // Get real-time frequency data for visualization
  getFrequencyData(): Uint8Array | null {
    if (!this.analyser || !this.frequencyData) return null;

    this.analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  // Get real-time waveform data
  getTimeData(): Uint8Array | null {
    if (!this.analyser || !this.timeData) return null;

    this.analyser.getByteTimeDomainData(this.timeData);
    return this.timeData;
  }

  // Check if audio analysis is available
  isAnalysisReady(): boolean {
    return this.analyser !== null && this.frequencyData !== null;
  }

  // Start/stop analysis tracking
  setAnalysisActive(active: boolean): void {
    this.isAnalysisActive = active;
  }

  getAnalysisActive(): boolean {
    return this.isAnalysisActive;
  }

  // Check if audio can be initialized (usually true after user interaction)
  canInitialize(): boolean {
    try {
      // If we already have an AudioContext, check its state
      if (this.audioContext) {
        return this.audioContext.state !== "suspended";
      }

      // Check if we're in a browser environment and user has interacted
      if (typeof window === "undefined") return false;

      // Modern browsers: check if audio can be played without user gesture
      // AudioContext state starts as 'suspended' until user interaction
      // We can detect this by seeing if we can create one in a 'running' state
      const tempContext = new (window.AudioContext ||
        // Legacy Safari WebKit prefix support - any cast needed for window extension
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext ||
        AudioContext)();

      const canInit = tempContext.state === "running";

      // Clean up the temporary context
      tempContext.close();

      return canInit;
    } catch (error) {
      // If we can't even create an AudioContext, audio is not ready
      console.log("🔊 AudioContext creation failed, audio not ready:", error);
      return false;
    }
  }
}

// Hook for React components
import { useEffect, useState } from "react";

export function useAudioSystem() {
  const [audioSystem, setAudioSystem] = useState<AudioSystem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only get the AudioSystem instance, don't initialize yet
    // Initialization will happen on first user interaction
    const audio = AudioSystem.getInstance();
    setAudioSystem(audio);
    setIsLoading(false);
  }, []);

  return { audioSystem, isLoading };
}

// Export singleton instance
export const audioSystem = AudioSystem.getInstance();
