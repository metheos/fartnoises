'use client';

import { Player } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';

interface PlayerAvatarProps {
  /** Player data */
  player: Player;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  /** Whether this player is highlighted (e.g., judge) */
  isHighlighted?: boolean;
  /** Highlight color/style */
  highlightStyle?: 'judge' | 'winner' | 'current' | 'vip';
  /** Whether to show the player name */
  showName?: boolean;
  /** Whether to show the player score */
  showScore?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Player avatar component with consistent styling across all game views.
 * Handles different sizes, highlighting, and display modes.
 */
export default function PlayerAvatar({
  player,
  size = 'md',
  isHighlighted = false,
  highlightStyle = 'current',
  showName = true,
  showScore = false,
  className = '',
  onClick
}: PlayerAvatarProps) {
  
  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return {
          container: 'w-8 h-8',
          text: 'text-sm',
          nameText: 'text-xs',
          scoreText: 'text-xs'
        };
      case 'sm':
        return {
          container: 'w-10 h-10',
          text: 'text-lg',
          nameText: 'text-sm',
          scoreText: 'text-sm'
        };
      case 'md':
        return {
          container: 'w-14 h-14',
          text: 'text-2xl',
          nameText: 'text-base',
          scoreText: 'text-base'
        };
      case 'lg':
        return {
          container: 'w-20 h-20',
          text: 'text-3xl',
          nameText: 'text-lg',
          scoreText: 'text-lg'
        };
      case 'xl':
        return {
          container: 'w-28 h-28',
          text: 'text-5xl',
          nameText: 'text-xl',
          scoreText: 'text-xl'
        };
      case 'xxl':
        return {
          container: 'w-32 h-32',
          text: 'text-6xl',
          nameText: 'text-2xl',
          scoreText: 'text-2xl'
        };
      default:
        return {
          container: 'w-14 h-14',
          text: 'text-2xl',
          nameText: 'text-base',
          scoreText: 'text-base'
        };
    }
  };

  const getHighlightClasses = () => {
    if (!isHighlighted) return '';
    
    switch (highlightStyle) {
      case 'judge':
        return 'ring-4 ring-yellow-400 ring-opacity-75 scale-110';
      case 'winner':
        return 'ring-4 ring-green-400 ring-opacity-75 scale-105';
      case 'current':
        return 'ring-4 ring-purple-400 ring-opacity-75 scale-105';
      case 'vip':
        return 'ring-4 ring-yellow-300 ring-opacity-75';
      default:
        return 'ring-4 ring-purple-400 ring-opacity-75';
    }
  };

  const getSpecialIcon = () => {
    if (isHighlighted && highlightStyle === 'judge') {
      return '👨‍⚖️';
    }
    if (player.isVIP) {
      return '👑';
    }
    // Show robot emoji for bots
    if (player.isBot) {
      return '🤖';
    }
    return player.emoji || player.name[0].toUpperCase();
  };

  const sizeClasses = getSizeClasses();
  const isClickable = !!onClick;

  return (
    <div 
      className={`flex flex-col items-center ${isClickable ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Avatar Circle */}
      <div 
        className={`
          ${sizeClasses.container} 
          ${getPlayerColorClass(player.color)} 
          ${getHighlightClasses()}
          rounded-full flex items-center justify-center 
          font-bold text-white shadow-lg 
          transition-all duration-300
          ${isClickable ? 'hover:scale-110' : ''}
        `}
      >
        <span className={sizeClasses.text}>
          {getSpecialIcon()}
        </span>
      </div>

      {/* Player Name */}
      {showName && (
        <div className="mt-2 text-center">
          <span className={`font-bold text-white drop-shadow ${sizeClasses.nameText}`}>
            {player.name}
            {player.isBot && (
              <span className="ml-1 text-gray-300 text-xs" title="Bot Player">
                🤖
              </span>
            )}
          </span>
          {player.isVIP && !isHighlighted && (
            <span className="ml-1 text-yellow-400 text-sm animate-bounce" title="Host">
              👑
            </span>
          )}
        </div>
      )}

      {/* Player Score */}
      {showScore && (
        <div className="mt-1 text-center">
          <span className={`font-black text-purple-600 ${sizeClasses.scoreText}`}>
            {player.score}
          </span>
          <span className={`text-xs text-gray-500 block uppercase`}>
            Points
          </span>
        </div>
      )}

      {/* Judge Label */}
      {isHighlighted && highlightStyle === 'judge' && (
        <p className="text-yellow-200 font-bold text-sm mt-1">JUDGE</p>
      )}
    </div>
  );
}
