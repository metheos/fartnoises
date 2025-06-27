import { useEffect, useRef, useState } from 'react';
import { audioSystem } from '@/utils/audioSystem';

interface WaveformAnimationProps {
  /** Whether the waveform should be visible and animating */
  isPlaying: boolean;
  /** Color of the waveform bars - defaults to white */
  color?: string;
  /** Additional CSS classes to apply to the container */
  className?: string;
  /** Size variant for the waveform */
  size?: 'sm' | 'md' | 'lg';
  /** Number of frequency bars to display */
  barCount?: number;
}

export function WaveformAnimation({ 
  isPlaying, 
  color = 'bg-white', 
  className = '', 
  size = 'md',
  barCount = 24
}: WaveformAnimationProps) {
  const animationRef = useRef<number | undefined>(undefined);
  const [frequencyData, setFrequencyData] = useState<number[]>(new Array(barCount).fill(0.1)); // Start with stub values

  // Different size configurations
  const sizeConfig = {
    sm: {
      container: 'h-10 py-2 ', // Removed mt-4 to avoid conflicts with mt-auto
      barWidth: 'w-0.5', // Thinner bars for more density
      maxHeight: 28, // Much taller maximum height
      minHeight: 1   // Keep minimum low for contrast
    },
    md: {
      container: 'h-20 py-2 ', // Removed mt-6 to avoid conflicts with mt-auto
      barWidth: 'w-2', // Thinner bars for more density
      maxHeight: 56, // Much taller maximum height
      minHeight: 2  // Keep minimum low for contrast
    },
    lg: {
      container: 'h-30 py-3 ', // Removed mt-8 to avoid conflicts with mt-auto
      barWidth: 'w-3', // Slightly thicker for large variant
      maxHeight: 72, // Much taller maximum height
      minHeight: 3  // Keep minimum low for contrast
    }
  };

  const config = sizeConfig[size];

  // Real-time frequency analysis
  const updateFrequencyData = () => {
    if (!isPlaying || !audioSystem.isAnalysisReady() || !audioSystem.getAnalysisActive()) {
      // Gradually fade out the bars when not playing, but keep minimum stub height
      setFrequencyData(prev => prev.map(val => {
        const fadedValue = Math.max(0, val * 0.85);
        // Ensure we always have at least a small stub visible
        return Math.max(0.1, fadedValue);
      }));
      animationRef.current = requestAnimationFrame(updateFrequencyData);
      return;
    }

    const rawFrequencyData = audioSystem.getFrequencyData();
    if (!rawFrequencyData) {
      animationRef.current = requestAnimationFrame(updateFrequencyData);
      return;
    }

    // Process frequency data to create visual bars
    const newFrequencyData: number[] = [];
    const totalBins = rawFrequencyData.length; // 128 bins from FFT size 256
    
    // Map to human hearing range: 20Hz to 20kHz
    // With standard sample rate of 44.1kHz, Nyquist frequency is 22.05kHz
    // Each bin represents: sampleRate / (fftSize) = 44100 / 256 = ~172.3 Hz per bin
    const sampleRate = 44100; // Standard audio sample rate
    const nyquistFreq = sampleRate / 2; // 22.05kHz
    const freqPerBin = nyquistFreq / totalBins; // ~172.3 Hz per bin
    
    // Human hearing: 20Hz to 20kHz, but focus more on musical range
    const minFreq = 60; // Start at 60Hz (more musical content)
    const maxFreq = 16000; // End at 16kHz (covers most audio content)
    
    // Use logarithmic distribution across musical range
    for (let i = 0; i < barCount; i++) {
      // More aggressive logarithmic mapping for better separation
      const logMin = Math.log(minFreq);
      const logMax = Math.log(maxFreq);
      const logStep = (logMax - logMin) / barCount;
      
      const startFreq = Math.exp(logMin + i * logStep);
      const endFreq = Math.exp(logMin + (i + 1) * logStep);
      
      // Convert frequencies to bin indices
      const startBin = Math.floor(startFreq / freqPerBin);
      const endBin = Math.floor(endFreq / freqPerBin);
      
      // Ensure we stay within bounds and have at least 1 bin per bar
      const start = Math.max(0, Math.min(startBin, totalBins - 1));
      const end = Math.max(start + 1, Math.min(endBin, totalBins - 1));
      
      // Get the maximum value in this frequency range instead of average
      // This makes peaks more prominent and creates more variation
      let maxValue = 0;
      for (let j = start; j < end; j++) {
        maxValue = Math.max(maxValue, rawFrequencyData[j]);
      }
      
      // Normalize to 0-1 range
      const normalized = Math.min(1, maxValue / 255);
      
      // Apply frequency-dependent scaling for more realistic response
      const freqCenter = (startFreq + endFreq) / 2;
      let scaled = normalized;
      
      // Correct frequency-dependent scaling for human hearing
      // Sub-bass and bass (60Hz - 200Hz) - drums, bass instruments
      if (freqCenter < 200) {
        scaled = Math.pow(normalized, 0.8) * 0.8; // Much less sensitive bass response
      }
      // Low-mids (200Hz - 500Hz) - male vocal fundamentals, lower instruments  
      else if (freqCenter >= 200 && freqCenter <= 500) {
        scaled = Math.pow(normalized, 0.65) * 0.95; // Reduced sensitivity for low-mids
      }
      // Mid-range (500Hz - 2kHz) - vocal formants, most musical content
      else if (freqCenter > 500 && freqCenter <= 2000) {
        scaled = Math.pow(normalized, 0.4) * 1.15; // Boost the important vocal range
      }
      // Upper-mids/presence (2kHz - 5kHz) - vocal clarity, attack transients
      else if (freqCenter > 2000 && freqCenter <= 5000) {
        scaled = Math.pow(normalized, 0.45) * 1.2; // Strong boost for presence
      }
      // Treble (5kHz+) - air, shimmer, sibilants
      else {
        scaled = Math.pow(normalized, 0.55) * 1.1; // Moderate treble enhancement
      }
      
      // Gentle dynamic range compression for low values only
      if (scaled < 0.15) {
        scaled = scaled * 1.6; // Modest boost for very low values
      } else if (scaled < 0.3) {
        scaled = scaled * 1.3; // Small boost for low-mid values
      }
      
      newFrequencyData.push(Math.min(1, scaled)); // Cap at 1.0 to prevent clipping
    }
    
    setFrequencyData(newFrequencyData);
    animationRef.current = requestAnimationFrame(updateFrequencyData);
  };

  // Start/stop animation loop
  useEffect(() => {
    if (isPlaying) {
      updateFrequencyData();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Keep a gentle fade-out animation even when stopped, but maintain stubs
      const fadeInterval = setInterval(() => {
        setFrequencyData(prev => {
          const newData = prev.map(val => {
            const fadedValue = Math.max(0, val * 0.9);
            // Always maintain at least 0.1 intensity for visible stubs
            return Math.max(0.1, fadedValue);
          });
          // Since we always have stub values, we don't need to clear the interval
          return newData;
        });
      }, 50);
      
      return () => clearInterval(fadeInterval);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, barCount]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Always render the waveform with stubs - remove the empty state check
  return (
    <div className={`${config.container} flex justify-center items-end space-x-1 mt-auto ${className}`}>
      {frequencyData.map((intensity, index) => {
        // Calculate actual height in pixels based on intensity and size
        const getBarHeight = (intensity: number, size: string) => {
          if (size === 'sm') {
            return Math.max(config.minHeight, Math.floor(intensity * config.maxHeight));
          } else if (size === 'md') {
            return Math.max(config.minHeight, Math.floor(intensity * config.maxHeight));
          } else {
            return Math.max(config.minHeight, Math.floor(intensity * config.maxHeight));
          }
        };

        const getOpacityValue = (intensity: number) => {
          // Smooth opacity transition from 0.7 to 1.0
          return Math.max(0.7, 0.7 + (intensity * 0.3));
        };

        const barHeight = getBarHeight(intensity, size);
        const opacity = getOpacityValue(intensity);
        
        return (
          <div 
            key={index}
            className={`${config.barWidth} ${color} rounded-full transition-all duration-75 ease-out`}
            style={{
              height: `${barHeight}px`,
              opacity: opacity
            }}
          />
        );
      })}
    </div>
  );
}
