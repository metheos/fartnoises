'use client';

import { useEffect, useRef, useState } from 'react';
import { Room, SoundEffect, Player, GameState } from '@/types/game';
import { Socket } from 'socket.io-client';
import { audioSystem } from '@/utils/audioSystem';
import { SubmissionCard } from './SubmissionCard';
import { PlayerScoreList } from './PlayerScoreList';
import { JudgePromptDisplay } from '../shared/JudgePromptDisplay';

interface ResultsDisplayProps {
  room: Room;
  roundWinner: {
    winnerId: string;
    winnerName: string;
    winningSubmission: { sounds: string[]; playerId: string; playerName: string };
    submissionIndex: number;
  } | null;
  soundEffects: SoundEffect[];
  socket: Socket | null;
  onWinnerAudioComplete?: () => void;
}

export function ResultsDisplay({ 
  room, 
  roundWinner,
  soundEffects,
  socket,
  onWinnerAudioComplete
}: ResultsDisplayProps) {  
  const [isPlayingWinner, setIsPlayingWinner] = useState(false);
  const [currentPlayingSoundIndex, setCurrentPlayingSoundIndex] = useState(-1);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioCompletionSentRef = useRef(false);
  const playbackStartedRef = useRef(false);
  const [animatedScores, setAnimatedScores] = useState<{ [playerId: string]: number }>({});
  const [showPointAnimation, setShowPointAnimation] = useState(false);
  
  // Initialize animated scores and trigger score animation when results are first shown
  useEffect(() => {
    if (roundWinner && room.players.length > 0) {
      // Reset animation state for new round
      setShowPointAnimation(false);
      
      // Reset audio completion tracking for new round
      audioCompletionSentRef.current = false;
      playbackStartedRef.current = false;
      
      // Initialize animated scores to current scores minus 1 for the winner (to animate the +1)
      const initialScores: { [playerId: string]: number } = {};
      room.players.forEach((player: Player) => {
        if (player.id === roundWinner.winnerId) {
          // For the winner, always start from current score - 1 to show the increment
          // The winner's current score should be at least 1 (they just won a point)
          initialScores[player.id] = Math.max(0, player.score - 1);
        } else {
          // For non-winners, start from current score (no change)
          initialScores[player.id] = player.score;
        }
      });
      
      console.log('[SCORE ANIMATION] Initializing animated scores:', {
        roundWinner: roundWinner.winnerId,
        initialScores,
        currentScores: room.players.reduce((acc, p) => ({ ...acc, [p.id]: p.score }), {})
      });
      
      setAnimatedScores(initialScores);
    }
  }, [roundWinner?.winnerId, room.currentRound, room.players, roundWinner]); // Trigger when winner changes or new round

  // Clean up if game state changes away from ROUND_RESULTS while audio is playing
  useEffect(() => {
    if (room.gameState !== GameState.ROUND_RESULTS && isPlayingWinner) {
      console.log('[WINNER AUDIO] Game state changed away from ROUND_RESULTS, stopping audio');
      setIsPlayingWinner(false);
      setCurrentPlayingSoundIndex(-1);
      setPlaybackProgress(0);
    }
  }, [room.gameState, isPlayingWinner]);
  
  // Automatically play the winning combination when results are shown
  useEffect(() => {
    if (roundWinner?.winningSubmission && soundEffects.length > 0 && !isPlayingWinner && !playbackStartedRef.current) {
      // Small delay to let the UI render, then start playing automatically
      console.log('[WINNER AUDIO] Scheduling winner audio playback...');
      playbackStartedRef.current = true; // Mark as started immediately to prevent duplicates
      
      const playDelay = setTimeout(() => {
        playWinningCombination();
      }, 3000); // 3 second delay for dramatic effect

      return () => clearTimeout(playDelay);
    } else if (playbackStartedRef.current) {
      console.log('[WINNER AUDIO] Playback already started for this round, skipping');
    }
    // playWinningCombination is stable function defined below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundWinner?.winningSubmission, soundEffects.length, isPlayingWinner]);

  const playWinningCombination = async () => {
    if (!roundWinner?.winningSubmission || isPlayingWinner) {
      console.log('[WINNER AUDIO] Skipping playback - already playing or no winner');
      return;
    }
    
    // Double-check that we haven't already started
    if (playbackStartedRef.current && isPlayingWinner) {
      console.log('[WINNER AUDIO] Playback already in progress, aborting duplicate');
      return;
    }
    
    console.log('[WINNER AUDIO] Starting winner audio playback');
    setIsPlayingWinner(true);
    setCurrentPlayingSoundIndex(-1);
    setPlaybackProgress(0);
    
    try {
      // Get the winning sounds
      const sounds = roundWinner.winningSubmission.sounds;
      
      // Play sounds sequentially using audioSystem
      const playNextSound = async (soundIndex: number) => {
        if (soundIndex >= sounds.length) {
          console.log(`[WINNER AUDIO] All sounds finished`);
          setIsPlayingWinner(false);
          setCurrentPlayingSoundIndex(-1);
          setPlaybackProgress(0);
          
          // Trigger point increment sound immediately when audio completes
          if (onWinnerAudioComplete) {
            console.log('[WINNER AUDIO] Triggering point increment sound callback');
            onWinnerAudioComplete();
          }
          
          // Trigger score animation after audio completes
          setTimeout(() => {
            setShowPointAnimation(true);
            
            // Start score counting animation after +1PT appears - ONLY for winner
            setTimeout(() => {
              // Only animate the winner's score
              // Use the initialScores directly instead of reading from state to avoid closure issues
              const winnerPlayer = room.players.find(p => p.id === roundWinner.winnerId);
              const winnerStartScore = winnerPlayer ? Math.max(0, winnerPlayer.score - 1) : 0;
              const winnerEndScore = winnerPlayer?.score || 0;
              
              console.log('[SCORE ANIMATION] Starting winner score animation:', {
                winnerId: roundWinner.winnerId,
                startScore: winnerStartScore,
                endScore: winnerEndScore,
                playerCurrentScore: winnerPlayer?.score
              });
              
              // Animate the score increment for the winner only
              const duration = 1500; // 1.5 seconds for count-up
              const startTime = Date.now();
              
              const animateWinnerScore = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Use easing function for smooth animation
                const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                
                const winnerCurrentScore = Math.round(winnerStartScore + (winnerEndScore - winnerStartScore) * easeOutQuart);
                
                // Update only the winner's score, keep others unchanged
                setAnimatedScores(prev => ({
                  ...prev,
                  [roundWinner.winnerId]: winnerCurrentScore
                }));
                
                if (progress < 1) {
                  requestAnimationFrame(animateWinnerScore);
                }
              };
              
              animateWinnerScore();
            }, 500); // Start score counting 500ms after +1PT appears
          }, 500); // Show +1PT animation 500ms after audio ends
          
          // Notify server that winner audio is complete after a brief delay
          // Only send this event once per round to prevent race conditions
          setTimeout(() => {
            if (socket && socket.connected && !audioCompletionSentRef.current) {
              console.log('[WINNER AUDIO] Notifying server: winner audio complete');
              audioCompletionSentRef.current = true; // Mark as sent
              socket.emit('winnerAudioComplete');
            } else if (audioCompletionSentRef.current) {
              console.log('[WINNER AUDIO] Audio completion already sent, skipping duplicate');
            }
          }, 2000); // 2 second pause after audio ends
          
          return;
        }

        const soundId = sounds[soundIndex];
        const sound = soundEffects.find(s => s.id === soundId);
        
        if (!sound) {
          console.warn(`[WINNER AUDIO] Sound effect not found for ID: ${soundId}`);
          // Move to next sound if this one isn't found
          setTimeout(() => playNextSound(soundIndex + 1), 300);
          return;
        }

        console.log(`[WINNER AUDIO] Playing sound ${soundIndex + 1} of ${sounds.length}: ${sound.name}`);
        
        // Update the current playing sound index for UI animation
        setCurrentPlayingSoundIndex(soundIndex);
        
        try {
          // Load and play using audioSystem for real-time waveform analysis
          await audioSystem.loadSound(sound.id, sound.fileName);
          
          // Set up progress tracking before playing
          let startTime = Date.now();
          let duration = 0;
          
          // Get approximate duration - we'll update progress based on time
          const tempAudio = new Audio(`/sounds/Earwax/EarwaxAudio/Audio/${sound.fileName}`);
          await new Promise<void>((resolve, reject) => {
            tempAudio.onloadedmetadata = () => {
              duration = tempAudio.duration;
              resolve();
            };
            tempAudio.onerror = () => reject(new Error('Failed to load metadata'));
            tempAudio.load();
          });
          
          // Progress tracking during playback
          const updateProgress = () => {
            if (duration > 0) {
              const elapsed = (Date.now() - startTime) / 1000;
              const currentSoundProgress = Math.min(elapsed / duration, 1);
              const overallProgress = (soundIndex + currentSoundProgress) / sounds.length;
              setPlaybackProgress(overallProgress);
              
              if (currentSoundProgress < 1) {
                requestAnimationFrame(updateProgress);
              }
            }
          };
          
          // Start progress tracking
          startTime = Date.now();
          updateProgress();
          
          // Play the sound and wait for completion
          await audioSystem.playSound(sound.id);
          
          console.log(`[WINNER AUDIO] Sound ${soundIndex + 1} finished playing`);
          
          // Clear the current playing sound index
          setCurrentPlayingSoundIndex(-1);
          
          // Wait a brief moment between sounds, then play the next one
          setTimeout(() => {
            playNextSound(soundIndex + 1);
          }, 300); // 300ms pause between sounds
          
        } catch (audioError) {
          console.error(`[WINNER AUDIO] AudioSystem failed for ${sound.name}, skipping:`, audioError);
          // Clear the current playing sound index on error
          setCurrentPlayingSoundIndex(-1);
          // Move to next sound if this one fails
          setTimeout(() => {
            playNextSound(soundIndex + 1);
          }, 500);
        }
      };

      // Start with the first sound after a brief delay
      setTimeout(() => {
        playNextSound(0);
      }, 200);
      
    } catch (error) {
      console.error('Error playing winning combination:', error);
      setIsPlayingWinner(false);
      setCurrentPlayingSoundIndex(-1);
      setPlaybackProgress(0);
    }
  };
  
  return (
    <div className="bg-white rounded-3xl p-3 shadow-2xl transition-all duration-300 min-h-[75vh]">
      {/* Show loading state if roundWinner is null (e.g., after page refresh) */}
      {!roundWinner ? (
        <div className="text-center">
          <div className="text-6xl mb-6">⏳</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Loading Round Results...</h3>
          <p className="text-gray-600">Reconnecting to the game state...</p>
          <div className="mt-6 animate-pulse flex justify-center space-x-2">
            <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
            <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
            <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
          </div>
        </div>
      ) : (
        <>
        {/* Display the Prompt above the round winner and score list */}
        <div className="mb-8">
          <JudgePromptDisplay 
            judge={undefined} // No judge in results display
            showJudge={false}
            prompt={room.currentPrompt || undefined}
            showPrompt={true}
            size="large"
          />
        </div>
        <div className="flex justify-center items-center gap-16 mb-8">
          {/* Left Column - Winning Sound Combination Card */}
          <div className="text-center">
            {roundWinner.winningSubmission && (
              <div>

                <SubmissionCard
                  submission={roundWinner.winningSubmission}
                  index={0}
                  soundEffects={soundEffects}
                  isCurrentlyPlaying={isPlayingWinner}
                  currentPlayingSoundIndex={currentPlayingSoundIndex}
                  showSoundNames={true}
                  playingMode="results"
                  isWinner={true}
                  playbackProgress={playbackProgress}
                />
              </div>
            )}
          </div>

          {/* Right Column - Scores List */}
          <div className="text-center w-[35rem]">
          <PlayerScoreList
            players={room.players}
            roundWinnerId={roundWinner.winnerId}
            animatedScores={animatedScores}
            showPointAnimation={showPointAnimation}
            isGameOver={false}
          />
          </div>
        </div>
        </>
      )}
    </div>
  );
}
