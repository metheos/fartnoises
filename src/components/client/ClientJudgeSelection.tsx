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
        <div className="mt-6 p-4 bg-green-100 rounded-2xl border-2 border-green-300">
          <p className="text-lg font-bold text-green-700">You are the Judge!</p>
        </div>
      )}
    </div>
  );
}
