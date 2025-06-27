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
  barCount = 8
}: WaveformAnimationProps) {
  const animationRef = useRef<number | undefined>(undefined);
  const [frequencyData, setFrequencyData] = useState<number[]>(new Array(barCount).fill(0));

  // Different size configurations
  const sizeConfig = {
    sm: {
      container: 'mt-4',
      barWidth: 'w-1',
      maxHeight: 16, // h-4 in pixels (roughly)
      minHeight: 8   // h-2 in pixels (roughly)
    },
    md: {
      container: 'mt-6',
      barWidth: 'w-1',
      maxHeight: 24, // h-6 in pixels (roughly)
      minHeight: 16  // h-4 in pixels (roughly)
    },
    lg: {
      container: 'mt-8',
      barWidth: 'w-1.5',
      maxHeight: 32, // h-8 in pixels (roughly)
      minHeight: 20  // h-5 in pixels (roughly)
    }
  };

  const config = sizeConfig[size];

  // Real-time frequency analysis
  const updateFrequencyData = () => {
    if (!isPlaying || !audioSystem.isAnalysisReady() || !audioSystem.getAnalysisActive()) {
      // Gradually fade out the bars when not playing
      setFrequencyData(prev => prev.map(val => Math.max(0, val * 0.85)));
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
    const segmentSize = Math.floor(rawFrequencyData.length / barCount);
    
    for (let i = 0; i < barCount; i++) {
      const start = i * segmentSize;
      const end = start + segmentSize;
      
      // Average the frequency data for this segment
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += rawFrequencyData[j];
      }
      
      const average = sum / segmentSize;
      // Normalize to 0-1 range and apply some smoothing
      const normalized = Math.min(1, average / 255);
      
      // Apply logarithmic scaling for better visual representation
      const scaled = Math.pow(normalized, 0.5);
      
      newFrequencyData.push(scaled);
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
      // Keep a gentle fade-out animation even when stopped
      const fadeInterval = setInterval(() => {
        setFrequencyData(prev => {
          const newData = prev.map(val => Math.max(0, val * 0.9));
          const hasValues = newData.some(val => val > 0.01);
          if (!hasValues) {
            clearInterval(fadeInterval);
            return new Array(barCount).fill(0);
          }
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

  if (!isPlaying && frequencyData.every(val => val === 0)) {
    return <div className={`${config.container} flex justify-center space-x-1 ${className}`}></div>;
  }

  return (
    <div className={`${config.container} flex justify-center items-end space-x-1 ${className}`}>
      {frequencyData.map((intensity, index) => {
        // Map intensity to Tailwind height classes
        const getHeightClass = (intensity: number, size: string) => {
          if (size === 'sm') {
            if (intensity < 0.2) return 'h-2';
            if (intensity < 0.4) return 'h-3';
            if (intensity < 0.6) return 'h-4';
            if (intensity < 0.8) return 'h-5';
            return 'h-6';
          } else if (size === 'md') {
            if (intensity < 0.2) return 'h-4';
            if (intensity < 0.4) return 'h-5';
            if (intensity < 0.6) return 'h-6';
            if (intensity < 0.8) return 'h-7';
            return 'h-8';
          } else { // lg
            if (intensity < 0.2) return 'h-5';
            if (intensity < 0.4) return 'h-6';
            if (intensity < 0.6) return 'h-8';
            if (intensity < 0.8) return 'h-10';
            return 'h-12';
          }
        };

        const getOpacityClass = (intensity: number) => {
          if (intensity < 0.2) return 'opacity-70';
          if (intensity < 0.4) return 'opacity-75';
          if (intensity < 0.6) return 'opacity-80';
          if (intensity < 0.8) return 'opacity-90';
          return 'opacity-100';
        };

        const heightClass = getHeightClass(intensity, size);
        const opacityClass = getOpacityClass(intensity);
        
        return (
          <div 
            key={index}
            className={`${config.barWidth} ${color} ${heightClass} ${opacityClass} rounded-full transition-all duration-75 ease-out`}
          />
        );
      })}
    </div>
  );
}
