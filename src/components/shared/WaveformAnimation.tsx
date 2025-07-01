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

  // Real-time frequency analysis with Chrome performance optimization
  const updateFrequencyData = () => {
    if (!isPlaying || !audioSystem.isAnalysisReady() || !audioSystem.getAnalysisActive()) {
      // Gradually fade out the bars when not playing, but keep minimum stub height
      setFrequencyData(prev => prev.map(val => {
        const fadedValue = Math.max(0, val * 0.55);
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

    // Detect Chrome for performance optimization
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
    
    // Process frequency data to create visual bars
    const newFrequencyData: number[] = [];
    const totalBins = rawFrequencyData.length; // 256 bins (Chrome) or 512 bins (others)
    
    // Get the actual sample rate from the audio system
    const sampleRate = audioSystem.getSampleRate(); // Get real sample rate instead of assuming
    const nyquistFreq = sampleRate / 2; // Usually 22.05kHz for 44.1kHz sample rate
    const freqPerBin = nyquistFreq / totalBins; // Actual Hz per bin based on real sample rate
    
    // console.log(`🎵 Audio Analysis: ${totalBins} bins, ${sampleRate}Hz sample rate, ${freqPerBin.toFixed(1)}Hz per bin`);
    
    // Cover musical spectrum with heavy emphasis on vocal range
    const minFreq = 20; // Start lower to capture more bass
    const maxFreq = 10000; // Extended range for better high-frequency coverage
    
    // Vocal range optimization: 85% of bars for vocal frequencies (85Hz - 8kHz)
    const vocalMinFreq = 100;   // Start of vocal range
    const vocalMaxFreq = 3000; // End of vocal range
    
    // Fixed distribution: 2 bass + 20 vocal + 2 treble = 24 total
    // This gives us 20/24 = 83.3% for vocal (close to 85%)
    const bassBarCount = 0;     // Fixed 0 bars for bass (100-85Hz)
    const vocalBarCount = 24;   // Fixed 24 bars for vocal (85-5000Hz) = 100%
    const trebleBarCount = 0;   // Fixed 0 bars for treble (5000-10000Hz)

    // Debug logging to verify distribution
    // console.log(`🎵 Frequency distribution: Bass(${bassBarCount} bars, 100-${vocalMinFreq}Hz) + Vocal(${vocalBarCount} bars, ${vocalMinFreq}-${vocalMaxFreq}Hz) + Treble(${trebleBarCount} bars, ${vocalMaxFreq}-${maxFreq}Hz)`);

    // Use logarithmic distribution optimized for vocal content
    for (let i = 0; i < barCount; i++) {
      let startFreq: number;
      let endFreq: number;
      
      if (i < bassBarCount) {
        // Bass range: 60Hz - 85Hz (first ~2 bars)
        const bassProgress = i / bassBarCount;
        const bassLogProgress = Math.pow(bassProgress, 0.001);
        startFreq = minFreq * Math.pow(vocalMinFreq / minFreq, bassLogProgress);
        
        if (i === bassBarCount - 1) {
          endFreq = vocalMinFreq;
        } else {
          const nextBassProgress = (i + 1) / bassBarCount;
          const nextBassLogProgress = Math.pow(nextBassProgress, 0.001);
          endFreq = minFreq * Math.pow(vocalMinFreq / minFreq, nextBassLogProgress);
        }
      } else if (i < bassBarCount + vocalBarCount) {
        // Vocal range: 85Hz - 8kHz (next ~20 bars)
        const vocalIndex = i - bassBarCount;
        const vocalProgress = vocalIndex / (vocalBarCount - 1);
        
        // Use a gentler logarithmic curve for vocal range to give more resolution
        const vocalLogProgress = Math.pow(vocalProgress, 0.3); // Very gentle curve for detailed vocal analysis
        startFreq = vocalMinFreq * Math.pow(vocalMaxFreq / vocalMinFreq, vocalLogProgress);
        
        if (i === bassBarCount + vocalBarCount - 1) {
          endFreq = vocalMaxFreq;
        } else {
          const nextVocalProgress = (vocalIndex + 1) / (vocalBarCount - 1);
          const nextVocalLogProgress = Math.pow(nextVocalProgress, 0.4);
          endFreq = vocalMinFreq * Math.pow(vocalMaxFreq / vocalMinFreq, nextVocalLogProgress);
        }
      } else {
        // Treble range: 8kHz - 18kHz (last ~2 bars)
        const trebleIndex = i - bassBarCount - vocalBarCount;
        const trebleProgress = trebleIndex / Math.max(1, trebleBarCount - 1);
        const trebleLogProgress = Math.pow(trebleProgress, 0.4);
        startFreq = vocalMaxFreq * Math.pow(maxFreq / vocalMaxFreq, trebleLogProgress);
        
        if (i === barCount - 1) {
          endFreq = maxFreq;
        } else {
          const nextTrebleProgress = (trebleIndex + 1) / Math.max(1, trebleBarCount - 1);
          const nextTrebleLogProgress = Math.pow(nextTrebleProgress, 0.6);
          endFreq = vocalMaxFreq * Math.pow(maxFreq / vocalMaxFreq, nextTrebleLogProgress);
        }
      }
      
      // Log frequency ranges for debugging
      if (i < 5 || i >= barCount - 3) {
        // console.log(`Bar ${i}: ${barType} ${Math.round(startFreq)}Hz - ${Math.round(endFreq)}Hz`);
      }
      
      const startBin = Math.max(0, Math.floor(startFreq / freqPerBin));
      const endBin = Math.min(totalBins - 1, Math.floor(endFreq / freqPerBin));
      
      // Ensure we have at least one bin per bar
      const actualEndBin = Math.max(startBin + 1, endBin + 1);
      
      // Use weighted average with peak detection for better cross-browser consistency
      let peakValue = 0;
      let weightedSum = 0;
      let totalWeight = 0;
      
      for (let j = startBin; j < actualEndBin && j < totalBins; j++) {
        const normalizedValue = rawFrequencyData[j] / 255;
        
        // Weight bins by their position in the frequency range for this bar
        const binWeight = 1.0; // Equal weighting for now
        
        peakValue = Math.max(peakValue, normalizedValue);
        weightedSum += normalizedValue * binWeight;
        totalWeight += binWeight;
      }
      
      const averageValue = totalWeight > 0 ? weightedSum / totalWeight : 0;
      
      // Combine peak and average for better responsiveness across browsers
      let intensity = (peakValue * 0.7) + (averageValue * 0.3);
      
      // Apply frequency-specific boosting optimized for vocal range
      if (i < bassBarCount) {
        // Bass range: minimal boost since it's naturally prominent
        intensity *= 1.0;
      } else if (i < bassBarCount + vocalBarCount) {
        // Vocal range: the star of the show - slight boost for clarity
        const vocalPosition = (i - bassBarCount) / vocalBarCount;
        if (vocalPosition < 0.3) {
          // Lower vocal range (consonants, male voices): boost
          intensity *= 1.2;
        } else if (vocalPosition < 0.7) {
          // Mid vocal range (vowels, female voices): strong boost
          intensity *= 1.4;
        } else {
          // Upper vocal range (harmonics, sibilants): moderate boost
          intensity *= 1.1;
        }
      } else {
        // Treble range: boost significantly to compensate for natural rolloff
        intensity *= 1.8;
      }
      
      // Apply a power curve to make lower values more visible, but preserve high-frequency dynamics
      intensity = Math.pow(Math.min(1, intensity), 0.6);
      
      newFrequencyData.push(intensity);
    }
    
    // Apply adaptive smoothing optimized for browser performance
    setFrequencyData(prev => {
      // Chrome-specific smoothing optimization
      const smoothingFactor = isChrome ? 0.25 : 0.15; // More smoothing for Chrome stability
      
      return newFrequencyData.map((val, index) => {
        const prevVal = prev[index] || 0;
        let smoothedValue = prevVal * smoothingFactor + val * (1 - smoothingFactor);
        
        // Chrome-specific performance boost
        if (isChrome && val > 0.1) {
          // Boost responsiveness in Chrome for active frequencies, but cap to prevent jitter
          smoothedValue = Math.min(1, smoothedValue * 1.05); // Reduced boost to prevent stuttering
        }
        
        return smoothedValue;
      });
    });

    // Chrome performance: Use longer intervals between updates
    const nextUpdateDelay = isChrome ? 32 : 16; // ~30fps for Chrome, ~60fps for others
    setTimeout(() => {
      animationRef.current = requestAnimationFrame(updateFrequencyData);
    }, nextUpdateDelay);
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
