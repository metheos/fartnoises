'use client';

import { Room, SoundEffect, SoundSubmission } from '@/types/game';
import { JudgePromptDisplay } from '../shared/JudgePromptDisplay';
import { SubmissionCard } from './SubmissionCard';

interface JudgingDisplayProps {
  room: Room;
  soundEffects: SoundEffect[];
  currentPlayingSubmission: SoundSubmission | null;
  currentPlayingSoundIndex: number;
}

export function JudgingDisplay({ 
  room, 
  soundEffects, 
  currentPlayingSubmission,
  currentPlayingSoundIndex
}: JudgingDisplayProps) {
  const judge = room.players.find(p => p.id === room.currentJudge);
  
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

      {/* Fallback for when no judge or prompt */}
      {room.currentPrompt && !judge && (
        <div className="bg-purple-100 rounded-2xl p-6 mb-8">
          <p className="text-2xl text-center text-gray-800 font-bold" dangerouslySetInnerHTML={{ __html: room.currentPrompt.text }}></p>
        </div>
      )}
      

      {/* Timer Display */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 rounded-full h-3 mx-auto">
          <div className="h-3 rounded-full transition-all duration-1000 bg-white" style={{ width: '100%' }}></div>
        </div>
      </div>

      <div className="flex justify-center gap-8">
        {(room.randomizedSubmissions || room.submissions).map((submission, index) => {
          const isCurrentlyPlaying = currentPlayingSubmission?.playerId === submission.playerId;
          
          return (
            <SubmissionCard
              key={index}
              submission={submission}
              index={index}
              soundEffects={soundEffects}
              isCurrentlyPlaying={isCurrentlyPlaying}
              currentPlayingSoundIndex={isCurrentlyPlaying ? currentPlayingSoundIndex : -1}
              showSoundNames={true}
              playingMode="judging"
            />
          );
        })}
      </div>
    </div>
  );
}
