'use client';

import { Room } from '@/types/game';
import CircularButton from './CircularButton';
import Card from './Card';

interface GameSettingsPanelProps {
  /** Room data containing current settings */
  room: Room;
  /** Whether user can edit settings (VIP/host) */
  canEdit?: boolean;
  /** Callback when a setting is updated */
  onUpdateSetting?: (setting: 'maxScore' | 'maxRounds' | 'allowExplicitContent', value: number | boolean) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Game settings panel component that shows current settings and allows editing for VIP players.
 * Used in lobby and other configuration screens.
 */
export default function GameSettingsPanel({
  room,
  canEdit = false,
  onUpdateSetting,
  className = ''
}: GameSettingsPanelProps) {

  const handleScoreChange = (increment: boolean) => {
    if (!onUpdateSetting) return;
    const newValue = increment 
      ? Math.min(10, room.maxScore + 1)
      : Math.max(1, room.maxScore - 1);
    onUpdateSetting('maxScore', newValue);
  };

  const handleRoundsChange = (increment: boolean) => {
    if (!onUpdateSetting) return;
    const newValue = increment 
      ? Math.min(20, room.maxRounds + 1)
      : Math.max(1, room.maxRounds - 1);
    onUpdateSetting('maxRounds', newValue);
  };

  const handleExplicitContentToggle = () => {
    if (!onUpdateSetting) return;
    onUpdateSetting('allowExplicitContent', !room.allowExplicitContent);
  };

  return (
    <Card 
      variant={canEdit ? 'warning' : 'purple'} 
      className={`max-w-sm mx-auto ${className}`}
    >
      {/* Score and Rounds Settings */}
      <div className={`flex justify-between items-center ${canEdit ? 'mb-4' : 'mb-2'}`}>
        {/* Score to Win */}
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600">Score to Win</p>
          {canEdit ? (
            <div className="flex items-center justify-center gap-2 mt-1">
              <CircularButton
                icon="−"
                onClick={() => handleScoreChange(false)}
                disabled={room.maxScore <= 1}
              />
              <p className="text-2xl font-bold text-purple-600 min-w-[3rem] text-center">
                {room.maxScore}
              </p>
              <CircularButton
                icon="+"
                onClick={() => handleScoreChange(true)}
                disabled={room.maxScore >= 10}
              />
            </div>
          ) : (
            <p className="text-2xl font-bold text-purple-600">{room.maxScore}</p>
          )}
        </div>

        {/* Max Rounds */}
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600">Max Rounds</p>
          {canEdit ? (
            <div className="flex items-center justify-center gap-2 mt-1">
              <CircularButton
                icon="−"
                onClick={() => handleRoundsChange(false)}
                disabled={room.maxRounds <= 1}
              />
              <p className="text-2xl font-bold text-purple-600 min-w-[3rem] text-center">
                {room.maxRounds}
              </p>
              <CircularButton
                icon="+"
                onClick={() => handleRoundsChange(true)}
                disabled={room.maxRounds >= 20}
              />
            </div>
          ) : (
            <p className="text-2xl font-bold text-purple-600">{room.maxRounds}</p>
          )}
        </div>
      </div>

      {/* Explicit Content Setting */}
      {canEdit ? (
        <div className="border-t border-yellow-200 pt-4">
          <div className="flex items-center justify-center gap-3">
            <p className="text-sm font-medium text-gray-600">Allow Explicit Content</p>
            <button
              onClick={handleExplicitContentToggle}
              title={`Toggle explicit content ${room.allowExplicitContent ? 'off' : 'on'}`}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                room.allowExplicitContent ? 'bg-purple-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  room.allowExplicitContent ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs font-medium ${room.allowExplicitContent ? 'text-purple-600' : 'text-gray-400'}`}>
              {room.allowExplicitContent ? 'ON' : 'OFF'}
            </span>
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            {room.allowExplicitContent ? 'Adult content enabled' : 'Family-friendly mode'}
          </p>
        </div>
      ) : (
        <div className="border-t border-purple-200 pt-2">
          <div className="text-center">
            <p className="text-xs font-medium text-gray-600">Content Rating</p>
            <p className={`text-sm font-bold ${room.allowExplicitContent ? 'text-red-600' : 'text-green-600'}`}>
              {room.allowExplicitContent ? 'Adult Content' : 'Family Friendly'}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
