import React from 'react';
import { Room } from '@/types/game';
import { JudgePromptDisplay } from '../shared/JudgePromptDisplay';

interface JudgeSelectionDisplayProps {
  room: Room;
}

export default function JudgeSelectionDisplay({ room }: JudgeSelectionDisplayProps) {
  const judge = room.players.find(p => p.id === room.currentJudge);
  
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl ">     
      {/* Judge Display*/} 
      {judge ? (
        <JudgePromptDisplay 
          judge={judge} 
          prompt={undefined} 
          showPrompt={false}
        />
      ) : (
        <p className="text-xl text-gray-800">Selecting judge...</p>
      )}
    </div>
  );
}
