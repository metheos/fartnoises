import { Room } from '@/types/game';
import { getGameStateDisplay } from '@/utils/gameUtils';

interface GameHeaderProps {
  /** Room object containing game info */
  room: Room;
  /** Additional CSS classes */
  className?: string;
}

export default function GameHeader({ 
  room, 
  className = "" 
}: GameHeaderProps) {
  return (
    <div className={`bg-white rounded-3xl p-8 shadow-2xl ${className}`}>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-bold text-gray-800">Room {room.code}</h2>
          <p className="text-xl text-gray-800">Round {room.currentRound} of {room.maxRounds}</p>
        </div>
        <div className="text-right">
          <p className="text-lg text-gray-800">{getGameStateDisplay(room.gameState)}</p>
          <p className="text-2xl font-bold text-purple-600">{room.players.length} Players</p>
        </div>
      </div>
    </div>
  );
}
