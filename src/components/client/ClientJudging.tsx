'use client';

import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Socket } from 'socket.io-client';
import { Room, Player, SoundEffect } from '@/types/game';
import { audioSystem } from '@/utils/audioSystem';
import { getPlayerColorClass } from '@/utils/gameUtils';

interface ClientJudgingProps {
  room: Room;
  player: Player;
  onJudgeSubmission: (submissionIndex: number) => void;
  soundEffects: SoundEffect[];
  socket: Socket | null;
  playSoundCombinationWithFeedback: (sounds: string[], buttonId: string) => Promise<void>;
}

export default function ClientJudging({ 
  room, 
  player, 
  onJudgeSubmission, 
  soundEffects, 
  socket
}: ClientJudgingProps) {
  const isJudge = player.id === room.currentJudge;
  const [playingButtons, setPlayingButtons] = useState<Set<string>>(new Set());
  
  // Debug logging for submissions
  console.log(`[JUDGING] Component render - Player: ${player.name}, isJudge: ${isJudge}`);
  console.log(`[JUDGING] Room submissions: ${room.submissions.length}`);
  console.log(`[JUDGING] Room randomizedSubmissions: ${room.randomizedSubmissions?.length || 0}`);
  console.log(`[JUDGING] Room randomizedSubmissions data:`, room.randomizedSubmissions);
  const submissionsToShow = room.randomizedSubmissions || room.submissions;
  console.log(`[JUDGING] Submissions to show: ${submissionsToShow.length}`);
  submissionsToShow.forEach((sub, index) => {
    console.log(`[JUDGING] Submission ${index}: ${sub.playerName} - [${sub.sounds.join(', ')}]`);
  });
  
  const playSubmissionSounds = async (sounds: string[], submissionIndex: number) => {
    const buttonId = `submission-${submissionIndex}`;
    
    console.log(`[PLAYBACK] Starting playSubmissionSounds for ${buttonId}`);
    console.log(`[PLAYBACK] Current playingButtons before check:`, Array.from(playingButtons));
    
    // If this button is already playing, ignore the click
    if (playingButtons.has(buttonId)) {
      console.log(`[PLAYBACK] ${buttonId} is already playing, ignoring`);
      return;
    }

    if (sounds.length === 0) {
      console.log(`[PLAYBACK] No sounds provided for ${buttonId}`);
      return;
    }
    
    console.log(`[PLAYBACK] Setting ${buttonId} to playing state`);
    // Mark button as playing IMMEDIATELY and force synchronous render
    flushSync(() => {
      setPlayingButtons(prev => {
        const newSet = new Set(prev).add(buttonId);
        console.log(`[PLAYBACK] Updated playingButtons:`, Array.from(newSet));
        return newSet;
      });
    });
    
    console.log(`[PLAYBACK] After flushSync, should be playing now`);
    
    try {
      // Check if we have a socket connection and should try main screen playback
      if (socket && socket.connected) {
        console.log(`[JUDGING] Attempting to play submission ${submissionIndex} on main screen via socket`);
        
        // Create a promise that resolves when playback is complete
        await new Promise<void>((resolve) => {
          // Emit event to server to request main screen playback
          socket.emit('requestJudgingPlayback', {
            submissionIndex,
            sounds
          });
          
          // Set up fallback timeout for local playback
          const fallbackTimeout = setTimeout(async () => {
            console.log(`[JUDGING] No main screen response for submission ${submissionIndex}, falling back to local playback`);
            await performLocalPlayback();
            resolve(); // Resolve the promise when local playback is done
          }, 1000); // 1 second timeout
          
          // Listen for server response
          const handleMainScreenResponse = (response: { success: boolean; submissionIndex: number }) => {
            if (response.submissionIndex === submissionIndex) {
              clearTimeout(fallbackTimeout);
              socket.off('judgingPlaybackResponse', handleMainScreenResponse);
              if (!response.success) {
                console.log(`[JUDGING] Main screen playback failed for submission ${submissionIndex}, falling back to local`);
                performLocalPlayback().then(() => resolve()); // Resolve when local playback is done
              } else {
                console.log(`[JUDGING] Main screen playback successful for submission ${submissionIndex}, waiting for audio duration...`);
                // For main screen playback, we need to wait for the estimated audio duration
                // Calculate approximate duration and wait for it
                waitForMainScreenPlayback().then(() => resolve());
              }
            }
          };
          
          socket.on('judgingPlaybackResponse', handleMainScreenResponse);
          
          // Clean up the listener after a timeout regardless
          setTimeout(() => {
            socket.off('judgingPlaybackResponse', handleMainScreenResponse);
          }, 5000);
        });
        
      } else {
        // No socket connection, play locally
        console.log(`[JUDGING] No socket connection, playing submission ${submissionIndex} locally`);
        await performLocalPlayback();
      }
      
      // Local playback function
      async function performLocalPlayback() {
        console.log(`[PLAYBACK] Starting local playback for ${buttonId}`);
        // Filter out any invalid sounds and get filenames
        const validSounds = sounds
          .map(soundId => soundEffects.find(s => s.id === soundId))
          .filter(sound => sound !== undefined);
        
        if (validSounds.length > 0) {
          console.log(`Playing ${validSounds.length} sound(s) locally: [${sounds.join(', ')}]`);
          // Use the proper sequence method that waits for each sound to finish
          await audioSystem.playSoundSequence(sounds, 200); // 200ms delay between sounds
        }
        console.log(`[PLAYBACK] Finished local playback for ${buttonId}`);
      }
      
      // Main screen playback duration wait function
      async function waitForMainScreenPlayback() {
        console.log(`[PLAYBACK] Waiting for main screen playback duration for ${buttonId}`);
        
        // Calculate estimated playback duration
        // Each sound is roughly 1-3 seconds, plus 200ms delays between sounds
        const estimatedDurationPerSound = 2000; // 2 seconds average per sound
        const delayBetweenSounds = 200; // 200ms delay as used in local playback
        const totalEstimatedDuration = (sounds.length * estimatedDurationPerSound) + ((sounds.length - 1) * delayBetweenSounds);
        
        console.log(`[PLAYBACK] Estimated duration for ${sounds.length} sounds: ${totalEstimatedDuration}ms`);
        
        // Wait for the estimated duration
        await new Promise(resolve => setTimeout(resolve, totalEstimatedDuration));
        
        console.log(`[PLAYBACK] Finished waiting for main screen playback duration for ${buttonId}`);
      }
      
    } catch (error) {
      console.error(`Error playing submission sounds:`, error);
    } finally {
      console.log(`[PLAYBACK] Cleaning up ${buttonId} from playing state`);
      // Clean up - remove from playing set with immediate render
      flushSync(() => {
        setPlayingButtons(prev => {
          const newSet = new Set(prev);
          newSet.delete(buttonId);
          console.log(`[PLAYBACK] Final playingButtons:`, Array.from(newSet));
          return newSet;
        });
      });
    }
  };

  return (
    <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
      
      {/* Styled Prompt Display */}
      <div className="bg-purple-100 rounded-2xl p-6 mb-6">
        <p className="text-lg text-gray-800 font-bold" dangerouslySetInnerHTML={{ __html: room.currentPrompt?.text || '' }}></p>
      </div>
      
      {isJudge ? (
        <p className="text-gray-800 mb-4">Choose the winner!</p>
      ) : (
        <div className="flex items-center justify-center gap-2 mb-4">
          {(() => {
            const judge = room.players.find(p => p.id === room.currentJudge);
            {/* Main judge content */}
            return judge ? (
                <div className="inline-block">
                <div className="relative bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-200 rounded-2xl p-2 shadow-xl border-1 border-yellow-400 overflow-hidden">
                
                  <div className="relative z-10 flex flex-col items-center">
                  <div className="bg-white bg-opacity-90 rounded-xl p-2 shadow-md border-1 border-yellow-300 min-w-32 text-center">
                    
                    
                    {/* Judge Title */}
                    <div className="mb-2">
                    <span className="text-sm font-black text-amber-900 drop-shadow-sm underline">The Judge</span>
                    </div>
                    
                    {/* Judge avatar - smaller */}
                    <div className="relative mb-2">
                    <div 
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-xl ring-3 ring-yellow-300 ring-opacity-75 mx-auto ${getPlayerColorClass(judge.color)}`}
                    >
                      {judge.emoji || judge.name[0].toUpperCase()}
                    </div>
                    </div>
                    
                    {/* Judge name with emphasis */}
                    <div className="">
                    <span className="text-sm font-black text-amber-900 drop-shadow-sm">{judge.name}</span>
                    </div>
                  </div>
                  </div>
                </div>
                </div>
            ) : (
              <p className="text-gray-800">The judge is choosing the winner...</p>
            );
          })()}
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
                <button 
                  onClick={() => {
                    const buttonId = `submission-${index}`;
                    
                    console.log(`[BUTTON] Button clicked for ${buttonId}`);
                    console.log(`[BUTTON] Current playingButtons state:`, Array.from(playingButtons));
                    
                    // Immediate state check and early return to prevent race conditions
                    if (playingButtons.has(buttonId)) {
                      console.log(`[BUTTON] ${buttonId} is already playing, ignoring click`);
                      return;
                    }
                    
                    console.log(`[BUTTON] Calling playSubmissionSounds for ${buttonId}`);
                    // Call the function that handles main screen logic
                    playSubmissionSounds(submission.sounds, index);
                  }}
                  disabled={playingButtons.has(`submission-${index}`)}
                  className={`w-full px-4 py-3 rounded-xl font-semibold transition-colors ${
                    playingButtons.has(`submission-${index}`)
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {playingButtons.has(`submission-${index}`) ? '🔇 Playing...' : '🔊 Play Sounds'}
                </button>
                {isJudge && (
                  <button 
                    onClick={() => onJudgeSubmission(index)}
                    className="w-full bg-green-500 text-white px-4 py-3 rounded-xl hover:bg-green-600 transition-colors font-semibold"
                  >
                    🏆 Pick as Winner
                  </button>
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
    </div>
  );
}
