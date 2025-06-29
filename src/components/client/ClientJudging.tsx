'use client';

import { Room, Player, SoundEffect } from '@/types/game';
import { Socket } from 'socket.io-client';
import { Card, Button, JudgeDisplay } from '@/components/ui';
import { useSubmissionPlayback, useJudgeCheck, useGameStateLogging } from '@/hooks';

interface ClientJudgingProps {
  room: Room;
  player: Player;
  onJudgeSubmission: (submissionIndex: number) => void;
  soundEffects: SoundEffect[];
  socket: Socket | null;
  playSoundCombinationWithFeedback?: (sounds: string[], buttonId: string) => Promise<void>;
}

export default function ClientJudging({ 
  room, 
  player, 
  onJudgeSubmission, 
  soundEffects, 
  socket
}: ClientJudgingProps) {
  // Use custom hooks for common patterns
  const { isJudge, judgeDisplayProps } = useJudgeCheck(room, player, {
    displaySize: 'sm',
    isCompact: true
  });

  const { playSubmissionSounds, isButtonPlaying } = useSubmissionPlayback({
    socket,
    soundEffects
  });

  const { logSubmissions } = useGameStateLogging(room, player, {
    addDebugLog: console.log,
    componentName: 'JUDGING',
    logRoomChanges: false,
    logPlayerChanges: false
  });

  // Debug logging for submissions
  logSubmissions('Component render');
  const submissionsToShow = room.randomizedSubmissions || room.submissions;

  return (
    <Card className="text-center">
      
      {/* Styled Prompt Display */}
      <div className="bg-purple-100 rounded-2xl p-6 mb-6">
        <p className="text-lg text-gray-800 font-bold" dangerouslySetInnerHTML={{ __html: room.currentPrompt?.text || '' }}></p>
      </div>
      
      {isJudge ? (
        <p className="text-gray-800 mb-4">Choose the winner!</p>
      ) : (
        <div className="flex items-center justify-center gap-2 mb-4">
          {judgeDisplayProps ? (
            <JudgeDisplay {...judgeDisplayProps} />
          ) : (
            <p className="text-gray-800">The judge is choosing the winner...</p>
          )}
        </div>
      )}
      
      {submissionsToShow.length === 0 ? (
        <div className="bg-yellow-100 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-yellow-800 mb-4">No Submissions Found!</h3>
          <p className="text-yellow-700 text-lg">
            There seems to be an issue - no sound submissions are available for judging.
          </p>
          <div className="mt-4 text-sm text-yellow-600">
            <p>Debug Info:</p>
            <p>Regular submissions: {room.submissions.length}</p>
            <p>Randomized submissions: {room.randomizedSubmissions?.length || 0}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {submissionsToShow.map((submission, index) => (
          <div 
            key={index} 
            className="relative rounded-3xl p-6 transition-all duration-500 bg-gray-100 hover:bg-gray-50 border-2 border-gray-200"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-bold text-gray-800">
                  Submission {index + 1}
                </h4>
                
                {/* Status Indicator */}
                {isJudge ? (
                  <div className="w-4 h-4 rounded-full bg-green-400 animate-pulse"></div>
                ) : (
                  <div className="w-4 h-4 rounded-full bg-purple-400 animate-pulse"></div>
                )}
              </div>

              <div className="space-y-3 mb-4">
                {submission.sounds.map((soundId, soundIndex) => {
                  const sound = soundEffects.find(s => s.id === soundId);
                  
                  return (
                    <div 
                      key={soundIndex} 
                      className="px-4 py-3 rounded-xl transition-all duration-300 bg-white text-gray-800 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">🎵</span>
                        <span className="font-semibold">{sound?.name || soundId}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={() => {
                    const buttonId = `submission-${index}`;
                    
                    console.log(`[BUTTON] Button clicked for ${buttonId}`);
                    
                    // Immediate state check and early return to prevent race conditions
                    if (isButtonPlaying(index)) {
                      console.log(`[BUTTON] ${buttonId} is already playing, ignoring click`);
                      return;
                    }
                    
                    console.log(`[BUTTON] Calling playSubmissionSounds for ${buttonId}`);
                    // Call the function that handles main screen logic
                    playSubmissionSounds(submission.sounds, index);
                  }}
                  disabled={isButtonPlaying(index)}
                  variant={isButtonPlaying(index) ? 'secondary' : 'primary'}
                  className="w-full"
                >
                  {isButtonPlaying(index) ? '🔇 Playing...' : '🔊 Play Sounds'}
                </Button>
                {isJudge && (
                  <Button 
                    onClick={() => onJudgeSubmission(index)}
                    variant="success"
                    className="w-full"
                  >
                    🏆 Pick as Winner
                  </Button>
                )}
              </div>

              {/* Judge consideration indicator for non-judges */}
              {!isJudge && (
                <div className="mt-4 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <span className="text-purple-600 font-medium text-sm">UNDER REVIEW</span>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        </div>
      )}
    </Card>
  );
}
