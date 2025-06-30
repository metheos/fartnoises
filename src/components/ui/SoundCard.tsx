'use client';

import { SoundEffect } from '@/types/game';

interface SoundCardProps {
  /** Sound effect data */
  sound: SoundEffect;
  /** Whether this sound is selected */
  isSelected?: boolean;
  /** Whether this sound is currently playing */
  isPlaying?: boolean;
  /** Selection index (1, 2, etc.) if selected */
  selectionIndex?: number;
  /** Click handler for sound selection */
  onSelect?: (soundId: string) => void;
  /** Click handler for preview */
  onPreview?: (soundId: string) => void;
  /** Whether preview is disabled */
  previewDisabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Sound card component for displaying and interacting with sound effects.
 * Used in sound selection grids and submission displays.
 */
export default function SoundCard({
  sound,
  isSelected = false,
  isPlaying = false,
  selectionIndex,
  onSelect,
  onPreview,
  previewDisabled = false,
  className = ''
}: SoundCardProps) {

  const handleSelect = () => {
    if (onSelect) {
      onSelect(sound.id);
    }
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection when previewing
    if (onPreview && !previewDisabled) {
      onPreview(sound.id);
    }
  };

  const getCardClasses = () => {
    const baseClasses = 'relative border-2 rounded-xl py-2 px-3 transition-all duration-300 cursor-pointer';
    
    if (isSelected) {
      return `${baseClasses} bg-gradient-to-br from-purple-500 to-purple-600 text-white border-purple-700 shadow-lg transform scale-105`;
    } else {
      return `${baseClasses} bg-gradient-to-br from-purple-100 to-pink-100 text-gray-800 border-purple-200 hover:from-purple-200 hover:to-pink-200 hover:scale-102`;
    }
  };

  const getPreviewButtonClasses = () => {
    const baseClasses = 'absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all duration-200';
    
    if (previewDisabled || isPlaying) {
      return `${baseClasses} bg-gray-300 text-gray-500 cursor-not-allowed`;
    } else {
      return `${baseClasses} bg-white bg-opacity-80 hover:bg-opacity-100 shadow-md hover:shadow-lg hover:scale-110`;
    }
  };

  return (
    <div 
      className={`${getCardClasses()} ${className}`}
      onClick={handleSelect}
    >
      {/* Selection Index Badge */}
      {isSelected && selectionIndex && (
        <div className="absolute -top-2 -left-2 w-6 h-6 bg-yellow-400 text-yellow-900 rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
          {selectionIndex}
        </div>
      )}

      {/* Preview Button */}
      {onPreview && (
        <button
          onClick={handlePreview}
          disabled={previewDisabled}
          className={getPreviewButtonClasses()}
          title={isPlaying ? 'Playing...' : 'Preview sound'}
        >
          {isPlaying ? '🔇' : '🔊'}
        </button>
      )}

      {/* Sound Name */}
      <div className="flex items-center justify-center h-full">
        <h4 className="font-bold text-xs text-center">
          {sound.name}
        </h4>
        
        {/* Playing indicator */}
        {/* {isPlaying && (
          <div className="flex items-center justify-center space-x-1 text-xs">
            <div className="w-1 h-1 bg-current rounded-full animate-bounce"></div>
            <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <span className="ml-1">Playing</span>
          </div>
        )} */}
        
        {/* Selection status */}
        {/* {isSelected && !isPlaying && (
          <div className="text-xs font-medium opacity-90">
            Selected
          </div>
        )} */}
      </div>
    </div>
  );
}
