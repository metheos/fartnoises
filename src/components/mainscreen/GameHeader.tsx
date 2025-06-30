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
    <div className={`${className}`}>
      {/* Room code positioned fixed in bottom left of viewport */}
      <div className="fixed bottom-6 left-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl px-6 py-3 shadow-xl z-10 transform -rotate-12 hover:rotate-0 transition-transform duration-300 border-4 border-white">
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-purple-100 opacity-80 tracking-wide">ROOM</span>
          <h2 className="text-4xl font-black text-white tracking-wider drop-shadow-lg -mt-1">
        {room.code}
          </h2>
        </div>
      </div>
      
      {/* Commented out other elements */}
      {/* 
      <div className="bg-white rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xl text-gray-800">Round {room.currentRound} of {room.maxRounds}</p>
          </div>
          <div className="text-right">
            <p className="text-lg text-gray-800">{getGameStateDisplay(room.gameState)}</p>
            <p className="text-2xl font-bold text-purple-600">{room.players.length} Players</p>
          </div>
        </div>
      </div>
      */}
    </div>
  );
}
