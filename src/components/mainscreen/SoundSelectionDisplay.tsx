import React from 'react';
import { Socket } from 'socket.io-client';
import { Room } from '@/types/game';
import { GAME_CONFIG } from '@/data/gameData';
import { getPlayerColorClass } from '@/utils/gameUtils';
import { JudgePromptDisplay } from '../shared/JudgePromptDisplay';
import GameTimer from './GameTimer';

interface SoundSelectionDisplayProps {
  room: Room;
  socket: Socket | null;
}

export default function SoundSelectionDisplay({ room, socket }: SoundSelectionDisplayProps) {
  const otherPlayers = room.players.filter(p => p.id !== room.currentJudge);
  const submittedCount = room.submissions.length;
  const totalNeeded = otherPlayers.length;
  const hasFirstSubmission = submittedCount > 0;
  const judge = room.players.find(p => p.id === room.currentJudge);
  
  // Debug logging
  console.log('SoundSelectionDisplay render:', {
    submittedCount,
    totalNeeded,
    hasFirstSubmission,
    submissions: room.submissions,
    otherPlayers: otherPlayers.map(p => p.name)
  });
  
  return (
    <div className="bg-white rounded-3xl p-3 shadow-2xl transition-all duration-300 min-h-[75vh]">
      {/* Judge and Prompt Display - Side by Side */}
      {room.currentPrompt && judge && (
        <JudgePromptDisplay 
          judge={judge} 
          prompt={room.currentPrompt} 
          showPrompt={true}
        />
      )}

      {/* Timer Display */}
      <GameTimer 
        maxTime={GAME_CONFIG.SOUND_SELECTION_TIME}
        socket={socket}
      />

      {/* Fallback for when no judge or prompt */}
      {room.currentPrompt && !judge && (
        <div className="bg-purple-100 rounded-2xl p-6 mb-8">
          <p className="text-2xl text-center text-gray-800 font-bold" dangerouslySetInnerHTML={{ __html: room.currentPrompt.text }}></p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {otherPlayers.map((player) => {
          const hasSubmitted = room.submissions.find(s => s.playerId === player.id);
          const isFirstSubmitter = hasSubmitted && submittedCount === 1 && room.submissions[0].playerId === player.id;
          
          return (
            <div 
              key={player.id} 
              className={`text-center p-4 rounded-2xl transition-all duration-300 ${
              hasSubmitted 
                ? isFirstSubmitter 
                ? 'bg-gradient-to-br from-green-200 to-blue-200 border-2 border-green-400 scale-105' 
                : 'bg-green-100 border-2 border-green-300 hover:scale-105'
                : hasFirstSubmission 
                ? 'bg-yellow-100 border-2 border-yellow-300 animate-pulse'
                : 'bg-gray-100 hover:bg-gray-200 animate-pulse'
              }`}
            >
              <div 
              className={`w-24 h-24 text-5xl rounded-full mx-auto mb-2 flex items-center justify-center transition-transform duration-300 ${getPlayerColorClass(player.color)} ${
                hasSubmitted 
                ? isFirstSubmitter 
                  ? 'animate-spin' 
                  : 'hover:rotate-12'
                : 'animate-pulse'
              }`}
              >
              {player.emoji || '🍑'}
              </div>
              <p className={`font-bold text-2xl text-gray-900 transition-all duration-300 ${
              hasSubmitted 
                ? isFirstSubmitter 
                ? 'animate-pulse' 
                : 'hover:scale-105'
                : 'animate-pulse'
              }`}>
              {player.name}
              </p>
              
              <p className={`text-xl font-semibold transition-all duration-300 ${
              hasSubmitted 
                ? isFirstSubmitter 
                ? 'text-blue-700 animate-pulse' 
                : 'text-green-700'
                : hasFirstSubmission 
                ? 'text-yellow-700' 
                : 'text-gray-700'
              }`}>
              {hasSubmitted 
                ? '✔️ Ready'
                : '🤔 Thinking...'
              }
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
