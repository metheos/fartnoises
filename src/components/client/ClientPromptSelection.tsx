'use client';

import { Room, Player, GamePrompt } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';

interface ClientPromptSelectionProps {
  room: Room;
  player: Player;
  onSelectPrompt: (promptId: string) => void;
}

export default function ClientPromptSelection({ 
  room, 
  player, 
  onSelectPrompt 
}: ClientPromptSelectionProps) {
  const isJudge = player.id === room.currentJudge;
  
  // Debug logging to see what prompts we're receiving
  console.log('PromptSelectionComponent - Available prompts:', room.availablePrompts);
  
  return (
    <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
      {isJudge ? (
        <>
          <p className="text-gray-800 mb-4">Choose a prompt for this round:</p>
          <div className="space-y-3">
            {room.availablePrompts?.map((prompt: GamePrompt) => (
              <button 
                key={prompt.id}
                onClick={() => onSelectPrompt(prompt.id)}
                className="w-full bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors"
                aria-label={`Select prompt: ${prompt.text.replace(/<[^>]*>/g, '')}`}
                dangerouslySetInnerHTML={{ __html: prompt.text }} />
            ))}
          </div>
        </>
      ) : (
        <div className="text-gray-800">
          {(() => {
            const judge = room.players.find(p => p.id === room.currentJudge);
            return judge ? (
            <div className="inline-block">
            <div className="relative bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-200 rounded-3xl p-3 shadow-2xl border-1 border-yellow-400 overflow-hidden">
              
              {/* Main judge content */}
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
              
              {/* Animated border glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 opacity-25 animate-pulse"></div>
            </div>
            </div>
            ) : null;
          })()}
          <p className="mt-4">Waiting for the Judge to select a prompt...</p>
        </div>
      )}
    </div>
  );
}
