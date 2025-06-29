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
      container: 'h-24 py-2 ', // Removed mt-6 to avoid conflicts with mt-auto
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
    
    // Cover musical spectrum with better distribution
    const minFreq = 150; // Start lower since we're cramming all bass into bar 1
    const maxFreq = 15000; // Extend highs a bit for sweep testing
    
    // Use logarithmic distribution optimized for musical content
    for (let i = 0; i < barCount; i++) {
      // Use a more aggressive curve that compresses lows and highs
      const normalizedPosition = i / (barCount - 1); // 0 to 1
      
      // Create a custom curve that:
      // - First bar gets ALL the bass (150Hz-500Hz)
      // - Bars 2-21 get massively expanded mid-range (500Hz-8kHz) 
      // - Last 3 bars get super-compressed highs (8kHz-15kHz)
      let curvedPosition;
      if (i === 0) {
        // First bar: all bass frequencies
        curvedPosition = 0; // Start at minFreq
      } else if (i === 1) {
        // Second bar starts at ~500Hz (beginning of mids)
        curvedPosition = Math.log(500 / minFreq) / Math.log(maxFreq / minFreq);
      } else if (i <= 21) {
        // Bars 2-21: Massively expanded mid-range (500Hz to 8kHz)
        const midStart = Math.log(500 / minFreq) / Math.log(maxFreq / minFreq);
        const midEnd = Math.log(8000 / minFreq) / Math.log(maxFreq / minFreq);
        const midProgress = (i - 1) / 20; // Progress through 20 bars (bars 2-21)
        curvedPosition = midStart + midProgress * (midEnd - midStart);
      } else {
        // Last 3 bars: Super-compressed highs (8kHz to 15kHz)
        const highStart = Math.log(8000 / minFreq) / Math.log(maxFreq / minFreq);
        const highProgress = (i - 22) / 2; // Progress through last 3 bars (22, 23, 24)
        curvedPosition = highStart + Math.pow(highProgress, 0.5) * (1 - highStart);
      }
      
      const startFreq = minFreq * Math.pow(maxFreq / minFreq, curvedPosition);
      
      // Calculate end frequency for this bar
      let endFreq;
      if (i === 0) {
        // First bar covers all bass up to 500Hz
        endFreq = 500;
      } else if (i === barCount - 1) {
        // Last bar goes to maxFreq
        endFreq = maxFreq;
      } else {
        // Calculate next bar's start frequency
        let nextCurvedPosition;
        if (i + 1 === 1) {
          nextCurvedPosition = Math.log(500 / minFreq) / Math.log(maxFreq / minFreq);
        } else if (i + 1 <= 21) {
          const midStart = Math.log(500 / minFreq) / Math.log(maxFreq / minFreq);
          const midEnd = Math.log(8000 / minFreq) / Math.log(maxFreq / minFreq);
          const midProgress = ((i + 1) - 1) / 20; // Progress through 20 bars
          nextCurvedPosition = midStart + midProgress * (midEnd - midStart);
        } else {
          const highStart = Math.log(8000 / minFreq) / Math.log(maxFreq / minFreq);
          const highProgress = ((i + 1) - 22) / 2; // Progress through last 3 bars
          nextCurvedPosition = highStart + Math.pow(highProgress, 0.5) * (1 - highStart);
        }
        endFreq = minFreq * Math.pow(maxFreq / minFreq, nextCurvedPosition);
      }
      
      const startBin = Math.max(0, Math.floor(startFreq / freqPerBin));
      const endBin = Math.min(totalBins, Math.floor(endFreq / freqPerBin));
      
      // Ensure we have at least one bin per bar
      const actualEndBin = Math.max(startBin + 1, endBin);
      
      // Use peak detection for more dramatic visualization
      let peakValue = 0;
      let averageValue = 0;
      const binCount = Math.max(1, actualEndBin - startBin);
      
      for (let j = startBin; j < actualEndBin; j++) {
        const normalizedValue = rawFrequencyData[j] / 255;
        peakValue = Math.max(peakValue, normalizedValue);
        averageValue += normalizedValue;
      }
      averageValue /= binCount;
      
      // Combine peak and average for better responsiveness
      let intensity = (peakValue * 0.7) + (averageValue * 0.3);
      
      // No frequency boosting - use raw intensity for natural response
      
      // Apply a gentle power curve to make lower values visible
      intensity = Math.pow(intensity, 0.6);
      
      newFrequencyData.push(Math.min(1, intensity));
    }
    
    // Apply light smoothing to prevent jitter while preserving dynamics
    setFrequencyData(prev => {
      const smoothingFactor = 0.3; // Reduced smoothing for more variation
      return newFrequencyData.map((val, index) => {
        const prevVal = prev[index] || 0;
        return prevVal * smoothingFactor + val * (1 - smoothingFactor);
      });
    });

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
  // Animation dependency management - simplified deps to avoid animation restart loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // Calculate bar height based on intensity
        const getBarHeight = (intensity: number) => {
          const { maxHeight, minHeight } = config;
          const heightRange = maxHeight - minHeight;
          // Use continuous values instead of Math.floor for smooth animation
          return Math.max(minHeight, (intensity * heightRange) + minHeight);
        };

        const getAnimationClass = () => {
        //   if (intensity > 0.7) return 'animate-pulse';
        //   if (intensity > 0.4) return 'animate-bounce';
          return '';
        };

        const getBarColor = (index: number, intensity: number) => {
          // When idle (low intensity), show gray bars
          if (intensity <= 0.15) {
            return '#6b7280'; // Tailwind gray-500
          }
          
          // Create rainbow colors across the frequency spectrum for active bars
          const hue = (index / barCount) * 360;
          const saturation = 70 + (intensity * 30); // 70-100%
          const lightness = 40 + (intensity * 35); // 45-80%
          return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        };

        const getGlowIntensity = (intensity: number) => {
          return intensity * 12; // 0-12px glow for bars
        };

        const barHeight = getBarHeight(intensity);
        const animationClass = getAnimationClass();
        const barColor = getBarColor(index, intensity);
        const glowIntensity = getGlowIntensity(intensity);
        
        return (
          <div 
            key={index}
            className={`${config.barWidth} rounded-full transition-all duration-150 ease-out ${animationClass}`}
            style={{
              height: `${barHeight}px`,
              backgroundColor: barColor,
              boxShadow: `0 0 ${glowIntensity}px ${barColor}`,
              transform: `scaleY(${0.7 + intensity * 0.6})`, // Additional vertical scaling for bounce
            }}
          />
        );
      })}
    </div>
  );
}
