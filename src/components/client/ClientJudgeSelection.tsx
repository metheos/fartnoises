'use client';

import { Room, Player } from '@/types/game';
import { JudgePromptDisplay } from '../shared/JudgePromptDisplay';

interface ClientJudgeSelectionProps {
  room: Room;
  player: Player;
}

export default function ClientJudgeSelection({ room, player }: ClientJudgeSelectionProps) {
  const judge = room.players.find(p => p.id === room.currentJudge);
  
  return (
    <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
      {judge ? (
        <div className="mb-4">
          <JudgePromptDisplay 
            judge={judge} 
            prompt={undefined} 
            showPrompt={false} 
            size="small"
          />
        </div>
      ) : (
        <p className="text-gray-800">Waiting for judge selection...</p>
      )}
      
      {player.id === room.currentJudge && (
        <div className="mt-6 p-6 bg-gradient-to-br from-purple-400 to-pink-500 rounded-3xl shadow-lg border-4 border-white">
          <div className="text-center">
            <div className="text-3xl mb-2">⚖️</div>
            <p className="text-xl font-bold text-white drop-shadow-lg">You're the Judge!</p>
            <p className="text-sm text-purple-100 mt-1">Choose your favorite!</p>
          </div>
        </div>
      )}
    </div>
  );
}
