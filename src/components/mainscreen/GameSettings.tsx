import { Room } from '@/types/game';

interface GameSettingsProps {
  /** Room object containing game settings */
  room: Room;
  /** Additional CSS classes */
  className?: string;
  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical';
}

export default function GameSettings({ 
  room, 
  className = "",
  orientation = 'horizontal' 
}: GameSettingsProps) {
  if (orientation === 'vertical') {
    return (
      <div className={`space-y-4 ${className}`}>
        {/* Score to Win */}
        <div className="flex flex-col items-center">
          <div className="text-lg font-bold text-purple-600 mb-1">Score to Win</div>
          <div className="bg-purple-100 rounded-lg px-4 py-2 border-2 border-purple-300">
            <span className="text-2xl font-black text-purple-700">{room.maxScore}</span>
          </div>
        </div>

        {/* Max Rounds */}
        <div className="flex flex-col items-center">
          <div className="text-lg font-bold text-blue-600 mb-1">Max Rounds</div>
          <div className="bg-blue-100 rounded-lg px-4 py-2 border-2 border-blue-300">
            <span className="text-2xl font-black text-blue-700">{room.maxRounds}</span>
          </div>
        </div>

        {/* Content Rating */}
        <div className="flex flex-col items-center">
          <div className="text-sm font-bold text-gray-600 mb-1">Content Rating</div>
          <div className={`rounded-lg px-3 py-1 border-2 ${
            room.allowExplicitContent 
              ? 'bg-red-100 border-red-300 text-red-700' 
              : 'bg-green-100 border-green-300 text-green-700'
          }`}>
            <span className="text-sm font-bold">
              {room.allowExplicitContent ? '🔞 Adult Content' : '👨‍👩‍👧‍👦 Family Friendly'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {/* Score to Win (Left) */}
      <div className="flex flex-col items-center">
        <div className="text-lg font-bold text-purple-600 mb-1">Score to Win</div>
        <div className="bg-purple-100 rounded-lg px-4 py-2 border-2 border-purple-300">
          <span className="text-2xl font-black text-purple-700">{room.maxScore}</span>
        </div>
      </div>

      {/* Content Rating (Center) */}
      <div className="flex flex-col items-center px-8">
        <div className="text-sm font-bold text-gray-600 mb-1">Content Rating</div>
        <div className={`rounded-lg px-3 py-1 border-2 ${
          room.allowExplicitContent 
            ? 'bg-red-100 border-red-300 text-red-700' 
            : 'bg-green-100 border-green-300 text-green-700'
        }`}>
          <span className="text-sm font-bold">
            {room.allowExplicitContent ? '🔞 Adult Content' : '👨‍👩‍👧‍👦 Family Friendly'}
          </span>
        </div>
      </div>

      {/* Max Rounds (Right) */}
      <div className="flex flex-col items-center">
        <div className="text-lg font-bold text-blue-600 mb-1">Max Rounds</div>
        <div className="bg-blue-100 rounded-lg px-4 py-2 border-2 border-blue-300">
          <span className="text-2xl font-black text-blue-700">{room.maxRounds}</span>
        </div>
      </div>
    </div>
  );
}
