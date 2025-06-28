'use client';

import { Room, Player } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';

interface ClientJudgeSelectionProps {
  room: Room;
  player: Player;
}

export default function ClientJudgeSelection({ room, player }: ClientJudgeSelectionProps) {
  const judge = room.players.find(p => p.id === room.currentJudge);
  
  return (
    <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
      {/* Main judge content */}
      {judge ? (
          <div className="inline-block">
            <div className="relative bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-200 rounded-3xl p-3 shadow-2xl border-1 border-yellow-400 overflow-hidden">
            
              <div className="relative z-10 flex flex-col items-center">
                <div className="bg-white bg-opacity-90 rounded-2xl p-4 shadow-lg border-1 border-yellow-300 min-w-50 text-center">
                  
                  
                  {/* Judge Title */}
                  <div className="mb-3">
                    <span className="text-xl font-black text-amber-900 drop-shadow-sm underline">The Judge</span>
                  </div>
                  
                  {/* Judge avatar - larger and more prominent */}
                  <div className="relative mb-3">
                    <div 
                      className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl ring-6 ring-yellow-300 ring-opacity-75 mx-auto ${getPlayerColorClass(judge.color)}`}
                    >
                      {judge.emoji || judge.name[0].toUpperCase()}
                    </div>
                  </div>
                  
                  {/* Judge name with emphasis */}
                  <div className="">
                    <span className="text-xl font-black text-amber-900 drop-shadow-sm">{judge.name}</span>
                  </div>
                </div>
              </div>
             </div>
          </div>
      ) : (
        <p className="text-gray-800">Waiting for judge selection...</p>
      )}
      {player.id === room.currentJudge && <p className="mt-4 text-lg text-green-600">You are the Judge!</p>}
    </div>
  );
}
