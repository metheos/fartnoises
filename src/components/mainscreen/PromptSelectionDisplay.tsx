import React from 'react';
import { Socket } from 'socket.io-client';
import { Room } from '@/types/game';
import { GAME_CONFIG } from '@/data/gameData';
import { JudgePromptDisplay } from '../shared/JudgePromptDisplay';
import GameTimer from './GameTimer';

interface PromptSelectionDisplayProps {
  room: Room;
  socket: Socket | null;
}

export default function PromptSelectionDisplay({ room, socket }: PromptSelectionDisplayProps) {
  const judge = room.players.find(p => p.id === room.currentJudge);
  
  return (
    <div className="bg-white rounded-3xl p-6 text-center shadow-2xl transition-all duration-300">
      {judge ? (
        <JudgePromptDisplay 
          judge={judge} 
          prompt={undefined} 
          showPrompt={false}
        />
      ) : (
        <p className="text-2xl text-gray-800 mb-4">Waiting for judge selection...</p>
      )}
      <p className="text-lg text-gray-600 mb-6">
        {room.currentPrompt ? (
          <span className="font-bold text-purple-600">Judge is selecting a prompt...</span>
        ) : (
          <span className="text-gray-500">Waiting for {judge?.name || 'The Judge'} to select a prompt...</span>
        )}
      </p>
            
      {/* Timer Display */}
      <GameTimer 
        maxTime={GAME_CONFIG.PROMPT_SELECTION_TIME}
        socket={socket}
      />
    </div>
  );
}
