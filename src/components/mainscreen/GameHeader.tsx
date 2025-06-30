import { Room } from '@/types/game';

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
      <div className="fixed bottom-2 left-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl px-6 py-2 shadow-xl z-10 transform transition-transform duration-300 border-4 border-white ">
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-purple-100 opacity-80 tracking-wide">ROOM</span>
          <h2 className="text-2xl font-black text-white tracking-wider drop-shadow-lg -mt-1">
        {room.code}
          </h2>
        </div>
      </div>

      {/* Fartnoises logo positioned fixed in bottom right of viewport */}
      <div className="fixed bottom-2 right-2 bg-gradient-to-r from-green-400 to-blue-500 rounded-2xl px-4 py-2 shadow-xl z-10 transform transition-transform duration-300 border-4 border-white">
        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-black text-white tracking-wide drop-shadow-lg">
            🎵💨 fartnoises
          </h1>
          <span className="text-xs font-medium text-green-100 opacity-80 tracking-wide -mt-1">
            THE GAME
          </span>
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
