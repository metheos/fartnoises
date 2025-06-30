import { Player } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';

interface PlayerAvatarGridProps {
  /** Array of players to display */
  players: Player[];
  /** Current judge ID to highlight (optional) */
  currentJudgeId?: string;
  /** Additional CSS classes */
  className?: string;
  /** Layout style variant */
  variant?: 'lobby' | 'compact' | 'status';
  /** Maximum columns for grid layout */
  maxColumns?: number;
}

export default function PlayerAvatarGrid({ 
  players, 
  currentJudgeId,
  className = "",
  variant = 'lobby',
  maxColumns = 6 
}: PlayerAvatarGridProps) {
  const getGridCols = () => {
    if (maxColumns === 6) return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6';
    if (maxColumns === 4) return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
    if (maxColumns === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    return `grid-cols-${Math.min(maxColumns, 6)}`;
  };

  const getAvatarSize = () => {
    switch (variant) {
      case 'lobby':
        return 'text-4xl mb-2';
      case 'compact':
        return 'text-2xl mb-1';
      case 'status':
        return 'text-3xl mb-2';
      default:
        return 'text-4xl mb-2';
    }
  };

  const getCardStyle = () => {
    switch (variant) {
      case 'lobby':
        return 'flex flex-col items-center p-4 rounded-2xl shadow-md border-2 flex-grow max-w-50 bg-opacity-80';
      case 'compact':
        return 'flex flex-col items-center p-2 rounded-xl shadow-sm border flex-grow bg-opacity-70';
      case 'status':
        return 'flex flex-col items-center p-3 rounded-2xl shadow-md border-2 bg-opacity-80';
      default:
        return 'flex flex-col items-center p-4 rounded-2xl shadow-md border-2 flex-grow bg-opacity-80';
    }
  };

  const getNameStyle = () => {
    switch (variant) {
      case 'lobby':
        return 'font-bold text-lg text-white drop-shadow text-center';
      case 'compact':
        return 'font-semibold text-sm text-white drop-shadow text-center';
      case 'status':
        return 'font-bold text-base text-white drop-shadow text-center';
      default:
        return 'font-bold text-lg text-white drop-shadow text-center';
    }
  };

  if (players.length === 0) {
    return (
      <div className={`text-center text-gray-500 ${className}`}>
        No players to display
      </div>
    );
  }

  if (variant === 'lobby') {
    return (
      <div className={`flex justify-center flex-wrap gap-4 ${className}`}>
        {players.map((player) => (
          <div
            key={player.id}
            className={`${getCardStyle()} ${getPlayerColorClass(player.color)}`}
          >
            <div className={getAvatarSize()}>
              {player.isBot ? '🤖' : player.emoji || "🎵"}
            </div>
            <span className={getNameStyle()}>
              {player.name}
              {player.isBot && (
                <span className="ml-1 text-gray-300 text-xs" title="Bot Player">
                  🤖
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid ${getGridCols()} gap-4 ${className}`}>
      {players.map((player) => {
        const isJudge = currentJudgeId === player.id;
        
        return (
          <div 
            key={player.id} 
            className={`${getCardStyle()} ${getPlayerColorClass(player.color)} ${
              isJudge ? 'ring-4 ring-yellow-400 scale-110' : ''
            }`}
          >
            <div className={getAvatarSize()}>
              {isJudge ? '👨‍⚖️' : player.isBot ? '🤖' : (player.emoji || '🎵')}
            </div>
            <span className={getNameStyle()}>
              {player.name}
              {player.isBot && !isJudge && (
                <span className="ml-1 text-gray-300 text-xs" title="Bot Player">
                  🤖
                </span>
              )}
            </span>
            {variant === 'status' && (
              <p className="text-white font-bold text-xl mt-1">{player.score}</p>
            )}
            {isJudge && (
              <p className="text-yellow-200 font-bold text-sm mt-1">JUDGE</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
