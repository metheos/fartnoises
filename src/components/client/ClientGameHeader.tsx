'use client';

import { Player, Room } from '@/types/game';

interface ClientGameHeaderProps {
  room: Room;
  player: Player;
}

export default function ClientGameHeader({ room, player }: ClientGameHeaderProps) {
  return (
    <div className="bg-white rounded-3xl p-4 mb-6 shadow-lg">
      <div className="flex justify-between items-center">            
        <div>
          <h1 className="text-2xl font-black text-gray-900 leading-tight">fartnoises</h1>
          <p className="text-sm text-gray-800">Room: <span className="font-mono font-bold">{room.code}</span></p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-700">Round {room.currentRound}/{room.maxRounds}</p>
          <p className="text-base font-bold text-purple-600 leading-tight">{player.name}</p>
          <p className="text-xs text-gray-700">Score: {player.score}/{room.maxScore}</p>
        </div>
      </div>        
    </div>
  );
}
