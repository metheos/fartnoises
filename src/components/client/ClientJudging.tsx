'use client';

import { useState, useEffect } from 'react';
import { Room, Player, SoundEffect } from '@/types/game';
import { Socket } from 'socket.io-client';
import { Card, Button } from '@/components/ui';
import { JudgePromptDisplay } from '../shared/JudgePromptDisplay';
import { useSubmissionPlayback, useJudgeCheck, useGameStateLogging } from '@/hooks';

interface ClientJudgingProps {
  room: Room;
  player: Player;
  onJudgeSubmission: (submissionIndex: number) => void;
  onLikeSubmission: (submissionIndex: number) => void;
  soundEffects: SoundEffect[];
  socket: Socket | null;
  playSoundCombinationWithFeedback?: (sounds: string[], buttonId: string) => Promise<void>;
}

export default function ClientJudging({ 
  room, 
  player, 
  onJudgeSubmission,
  onLikeSubmission, 
  soundEffects, 
  socket
}: ClientJudgingProps) {
  // State for tracking likes
  const [likedSubmissions, setLikedSubmissions] = useState<Set<number>>(new Set());
  
  // State for the protected "Can't Decide" nuclear option
  type NuclearStage = 'locked' | 'armed' | 'confirmed' | 'launched';
  const [canteDecideStage, setCantDecideStage] = useState<NuclearStage>('locked');
  const [countdown, setCountdown] = useState<number>(0);
  
  // Check if player has used nuclear option from room data
  const hasUsedNuclearOption = player.hasUsedNuclearOption || false;

  // Use custom hooks for common patterns
  const { isJudge, judge } = useJudgeCheck(room, player);

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

  // Listen for submission like updates
  useEffect(() => {
    if (!socket) return;

    const handleSubmissionLiked = (data: {
      submissionIndex: number;
      likedBy: string;
      likedByName: string;
      totalLikes: number;
    }) => {
      // Update the liked submissions if this player liked it
      if (data.likedBy === player.id) {
        setLikedSubmissions(prev => new Set([...prev, data.submissionIndex]));
      }
    };

    socket.on('submissionLiked', handleSubmissionLiked);

    return () => {
      socket.off('submissionLiked', handleSubmissionLiked);
    };
  }, [socket, player.id]);

  // Countdown effect for nuclear option
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (canteDecideStage === 'confirmed' && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // Trigger the nuclear explosion
            if (socket) {
              socket.emit('judgeNuclearOption', {
                roomCode: room.code,
                judgeId: player.id,
                judgeName: player.name
              });
            }
            setCantDecideStage('launched');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [canteDecideStage, countdown, socket, room.code, player.id, player.name]);

  // Function to handle liking a submission
  const handleLikeSubmission = (submissionIndex: number) => {
    if (isJudge) return;
    
    const submission = submissionsToShow[submissionIndex];
    if (!submission) return;
    
    // Don't allow liking own submission
    if (submission.playerId === player.id) return;
    
    // Don't allow liking already liked submissions
    if (likedSubmissions.has(submissionIndex)) return;
    
    onLikeSubmission(submissionIndex);
    setLikedSubmissions(prev => new Set([...prev, submissionIndex]));
  };

  // Nuclear option functions
  const handleNuclearStage1 = () => {
    if (canteDecideStage === 'locked') {
      setCantDecideStage('armed');
    }
  };

  const handleNuclearStage2 = () => {
    if (canteDecideStage === 'armed') {
      setCantDecideStage('confirmed');
      setCountdown(5); // 5 second countdown
    }
  };

  const handleNuclearAbort = () => {
    setCantDecideStage('locked');
    setCountdown(0);
  };

  // Debug logging for submissions
  logSubmissions('Component render');
  const submissionsToShow = room.randomizedSubmissions || room.submissions;

  return (
    <Card className="text-center">
      
      {isJudge ? (
        <>
          {/* Judge Display for the judge themselves */}
          <div className="mb-0">
            <JudgePromptDisplay 
              judge={judge || undefined} 
              prompt={room.currentPrompt || undefined} 
              showPrompt={true} 
              showJudge={false}
              size="small"
            />
          </div>
          
          {/* <p className="text-gray-800 mb-4">Choose the winner!</p> */}
        </>
      ) : (
        <div className="mb-0">
            <JudgePromptDisplay 
              judge={judge || undefined} 
              prompt={room.currentPrompt || undefined} 
              showPrompt={true} 
              showJudge={false}
              size="small"
            />
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
        <div className={`grid gap-4 mt-0 ${isJudge ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
          {submissionsToShow.map((submission, index) => (
          <div 
            key={index} 
            className={`relative transition-all duration-500 bg-gray-100 hover:bg-gray-50 border-2 border-gray-200 ${
              isJudge 
                ? 'rounded-3xl p-3' 
                : 'rounded-2xl p-3'
            }`}
          >
            <div className="relative z-10">
              {/* Header - different layouts for judge vs non-judge */}
              {isJudge ? (
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-md font-bold text-gray-800 px-2">
                    {/* Submission {index + 1} */}
                  </h4>
                  
                  <div className="flex items-center space-x-2">
                    {/* Like count indicator */}
                    {(submission.likeCount || 0) > 0 && (
                      <div className="flex items-center space-x-1 bg-pink-100 rounded-full px-2 py-1">
                        <span className="text-sm">❤️</span>
                        <span className="text-sm font-bold text-pink-600">
                          {submission.likeCount}
                        </span>
                      </div>
                    )}
                    
                    {/* Status Indicator */}
                    <div className="w-4 h-4 rounded-full bg-green-400 animate-pulse"></div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-gray-800">
                    {/* #{index + 1} */}
                  </h4>
                  
                  <div className="flex items-center space-x-1">
                    {/* Like count indicator */}
                    {(submission.likeCount || 0) > 0 && (
                      <div className="flex items-center space-x-1 bg-pink-100 rounded-full px-1.5 py-0.5">
                        <span className="text-xs">❤️</span>
                        <span className="text-xs font-bold text-pink-600">
                          {submission.likeCount}
                        </span>
                      </div>
                    )}
                    
                    {/* Compact Status Indicator */}
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                  </div>
                </div>
              )}

              {/* Sound list - different layouts for judge vs non-judge */}
              {isJudge ? (
                <div className="space-y-1 mb-2">
                  {submission.sounds.map((soundId, soundIndex) => {
                    const sound = soundEffects.find(s => s.id === soundId);
                    
                    return (
                      <div 
                        key={soundIndex} 
                        className="px-2 py-2 rounded-xl transition-all duration-300 bg-white text-gray-800 shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm">{sound?.name || soundId}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1 mb-3">
                  {submission.sounds.map((soundId, soundIndex) => {
                    const sound = soundEffects.find(s => s.id === soundId);
                    
                    return (
                      <div 
                        key={soundIndex} 
                        className="px-2 py-1.5 rounded-lg bg-white text-gray-800 shadow-sm"
                      >
                        <div className="flex items-center space-x-1">
                          {/* <span className="text-sm">🎵</span> */}
                          <span className="font-medium text-xs truncate">{sound?.name || soundId}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
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
                  className={isJudge ? 'w-12 h-12 p-0 flex items-center justify-center' : 'flex-1 text-xs py-1 px-2'}
                >
                  {isButtonPlaying(index) ? (isJudge ? '🔇' : '🔇') : (isJudge ? '🔊' : '🔊 Play')}
                </Button>
                
                {/* Like button for non-judges */}
                {!isJudge && submission.playerId !== player.id && (
                  <Button
                    onClick={() => handleLikeSubmission(index)}
                    disabled={likedSubmissions.has(index)}
                    variant={likedSubmissions.has(index) ? 'secondary' : 'primary'}
                    className={`flex-1 text-xs py-1 px-2 ${
                      likedSubmissions.has(index) 
                        ? 'bg-pink-200 text-pink-600 cursor-not-allowed' 
                        : 'bg-pink-500 hover:bg-pink-600 text-white'
                    }`}
                  >
                    {likedSubmissions.has(index) ? '❤️ Liked!' : '🤍 Like'}
                  </Button>
                )}
                
                {isJudge && (
                  <Button 
                    onClick={() => onJudgeSubmission(index)}
                    variant="success"
                    className="flex-1"
                  >
                    🏆 Pick as Winner
                  </Button>
                )}
              </div>

              {/* Judge consideration indicator for non-judges - compact version */}
              {/* {!isJudge && (
                <div className="mt-2 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce"></div>
                    <span className="text-purple-600 font-medium text-xs">UNDER REVIEW</span>
                    <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              )} */}
            </div>
          </div>
        ))}
        </div>
      )}

      {/* Nuclear Option - Only for judges who haven't used it yet */}
      {isJudge && !hasUsedNuclearOption && (
        <div className="mt-8 border-t-2 border-red-300 pt-6">
          <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-3xl p-6 text-white relative overflow-hidden">
            {/* Warning stripes background */}
            <div className="absolute inset-0 opacity-20">
              <div className="h-full w-full bg-gradient-to-r from-transparent via-yellow-400 to-transparent transform -skew-x-12 animate-pulse"></div>
            </div>
            
            <div className="relative z-10 text-center">
              <h3 className="text-xl font-bold mb-2 text-yellow-300">⚠️ EMERGENCY PROTOCOL ⚠️</h3>
              <p className="text-sm mb-4 opacity-90">Can't decide? Nuclear option available.</p>
              
              {canteDecideStage === 'locked' && (
                <div className="space-y-4">
                  <p className="text-xs opacity-75">This will trigger an explosion and skip to the next round!</p>
                  <Button
                    onClick={handleNuclearStage1}
                    variant="secondary"
                    className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold border-2 border-yellow-400"
                  >
                    🔒 ARM NUCLEAR OPTION
                  </Button>
                </div>
              )}

              {canteDecideStage === 'armed' && (
                <div className="space-y-4">
                  <p className="text-yellow-200 font-bold animate-pulse">SYSTEM ARMED - CONFIRM TO PROCEED</p>
                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={handleNuclearAbort}
                      variant="secondary"
                      className="bg-gray-600 hover:bg-gray-700 text-white"
                    >
                      🚫 ABORT
                    </Button>
                    <Button
                      onClick={handleNuclearStage2}
                      variant="secondary"
                      className="bg-red-600 hover:bg-red-700 text-white font-bold border-2 border-red-400 animate-pulse"
                    >
                      💥 CONFIRM LAUNCH
                    </Button>
                  </div>
                </div>
              )}

              {canteDecideStage === 'confirmed' && (
                <div className="space-y-4">
                  <div className="text-4xl font-black text-yellow-300 animate-bounce">
                    {countdown}
                  </div>
                  <p className="text-red-200 font-bold animate-pulse">LAUNCH IMMINENT!</p>
                  <Button
                    onClick={handleNuclearAbort}
                    variant="secondary"
                    className="bg-gray-600 hover:bg-gray-700 text-white"
                    disabled={countdown <= 2}
                  >
                    {countdown <= 2 ? '🚫 TOO LATE!' : '🚫 EMERGENCY STOP'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Show explosion confirmation after launch */}
      {isJudge && hasUsedNuclearOption && (
        <div className="mt-8 border-t-2 border-red-300 pt-6">
          <div className="bg-gradient-to-br from-gray-800 to-black rounded-3xl p-6 text-white text-center">
            <div className="space-y-4">
              <div className="text-6xl animate-spin">💥</div>
              <p className="text-red-400 font-bold text-xl">NUCLEAR OPTION USED!</p>
              <p className="text-gray-300">The main screen should be exploding...</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
