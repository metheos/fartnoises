'use client';

import { Player } from '@/types/game';
import PlayerAvatar from './PlayerAvatar';
import Card from './Card';

interface JudgeDisplayProps {
  /** Judge player data */
  judge: Player;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show as compact inline display */
  isCompact?: boolean;
  /** Additional message to display */
  message?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Judge display component with consistent special styling.
 * Used to highlight the current judge across different game views.
 */
export default function JudgeDisplay({
  judge,
  size = 'md',
  isCompact = false,
  message,
  className = ''
}: JudgeDisplayProps) {

  const getSizeConfig = () => {
    switch (size) {
      case 'sm':
        return {
          avatarSize: 'sm' as const,
          titleText: 'text-sm',
          messageText: 'text-sm',
          padding: 'p-2'
        };
      case 'md':
        return {
          avatarSize: 'md' as const,
          titleText: 'text-lg',
          messageText: 'text-base',
          padding: 'p-3'
        };
      case 'lg':
        return {
          avatarSize: 'xl' as const,
          titleText: 'text-xl',
          messageText: 'text-lg',
          padding: 'p-6'
        };
      default:
        return {
          avatarSize: 'md' as const,
          titleText: 'text-lg',
          messageText: 'text-base',
          padding: 'p-3'
        };
    }
  };

  const config = getSizeConfig();

  if (isCompact) {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        <PlayerAvatar
          player={judge}
          size={config.avatarSize}
          isHighlighted={true}
          highlightStyle="judge"
          showName={false}
        />
        <div className="text-left">
          <div className={`font-black text-amber-900 drop-shadow-sm ${config.titleText}`}>
            {judge.name}
          </div>
          <div className="text-sm font-black text-amber-900 drop-shadow-sm underline">
            The Judge
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-block ${className}`}>
      <div className="relative bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-200 rounded-2xl shadow-xl border border-yellow-400 overflow-hidden">
        
        {/* Animated border glow effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 opacity-25 animate-pulse"></div>
        
        <div className={`relative z-10 flex flex-col items-center ${config.padding}`}>
          <div className="bg-white bg-opacity-90 rounded-xl shadow-md border border-yellow-300 text-center min-w-32">
            <div className={config.padding}>
              
              {/* Judge Title */}
              <div className="mb-2">
                <span className={`font-black text-amber-900 drop-shadow-sm underline ${config.titleText}`}>
                  The Judge
                </span>
              </div>
              
              {/* Judge Avatar */}
              <div className="mb-2">
                <PlayerAvatar
                  player={judge}
                  size={config.avatarSize}
                  isHighlighted={true}
                  highlightStyle="judge"
                  showName={false}
                />
              </div>
              
              {/* Judge Name */}
              <div className="mb-2">
                <span className={`font-black text-amber-900 drop-shadow-sm ${config.titleText}`}>
                  {judge.name}
                </span>
              </div>

              {/* Optional Message */}
              {message && (
                <div className="mt-2 pt-2 border-t border-yellow-200">
                  <p className={`text-amber-800 ${config.messageText}`}>
                    {message}
                  </p>
                </div>
              )}
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
