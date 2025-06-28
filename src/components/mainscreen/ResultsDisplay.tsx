'use client';

import { useEffect, useRef, useState } from 'react';
import { Room, SoundEffect, Player, GameState } from '@/types/game';
import { Socket } from 'socket.io-client';
import { audioSystem } from '@/utils/audioSystem';
import { SubmissionCard } from './SubmissionCard';
import { PlayerScoreList } from './PlayerScoreList';

interface ResultsDisplayProps {
  room: Room;
  roundWinner: {
    winnerId: string;
    winnerName: string;
    winningSubmission: any;
    submissionIndex: number;
  } | null;
  soundEffects: SoundEffect[];
  socket: Socket | null;
}

export function ResultsDisplay({ 
  room, 
  roundWinner,
  soundEffects,
  socket
}: ResultsDisplayProps) {  
  const [isPlayingWinner, setIsPlayingWinner] = useState(false);
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
  }, [roundWinner?.winnerId, room.currentRound]); // Trigger when winner changes or new round

  // Clean up if game state changes away from ROUND_RESULTS while audio is playing
  useEffect(() => {
    if (room.gameState !== GameState.ROUND_RESULTS && isPlayingWinner) {
      console.log('[WINNER AUDIO] Game state changed away from ROUND_RESULTS, stopping audio');
      setIsPlayingWinner(false);
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
      }, 1000); // 1 second delay for dramatic effect

      return () => clearTimeout(playDelay);
    } else if (playbackStartedRef.current) {
      console.log('[WINNER AUDIO] Playback already started for this round, skipping');
    }
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
    setPlaybackProgress(0);
    
    try {
      // Get the winning sounds
      const sounds = roundWinner.winningSubmission.sounds;
      
      // Play sounds sequentially using audioSystem
      const playNextSound = async (soundIndex: number) => {
        if (soundIndex >= sounds.length) {
          console.log(`[WINNER AUDIO] All sounds finished`);
          setIsPlayingWinner(false);
          setPlaybackProgress(0);
          
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
          
          // Wait a brief moment between sounds, then play the next one
          setTimeout(() => {
            playNextSound(soundIndex + 1);
          }, 300); // 300ms pause between sounds
          
        } catch (audioError) {
          console.error(`[WINNER AUDIO] AudioSystem failed for ${sound.name}, skipping:`, audioError);
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
      setPlaybackProgress(0);
    }
  };
  
  return (
    <div className="bg-white rounded-3xl p-12 shadow-2xl transition-all duration-300">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start mb-8">
          {/* Left Column - Winning Sound Combination Card */}
          <div className="text-center">
            {roundWinner.winningSubmission && (
              <div>
                <p className="text-xl font-extrabold text-purple-700 mb-6 drop-shadow-lg" dangerouslySetInnerHTML={{ __html: room.currentPrompt?.text || '' }}>
                </p>
                <SubmissionCard
                  submission={roundWinner.winningSubmission}
                  index={0}
                  soundEffects={soundEffects}
                  isCurrentlyPlaying={isPlayingWinner}
                  showSoundNames={true}
                  playingMode="results"
                  isWinner={true}
                  playbackProgress={playbackProgress}
                />
              </div>
            )}
          </div>

          {/* Right Column - Scores List */}
          <div className="text-center">
          <PlayerScoreList
            players={room.players}
            roundWinnerId={roundWinner.winnerId}
            animatedScores={animatedScores}
            showPointAnimation={showPointAnimation}
            isGameOver={false}
          />
          </div>
        </div>
      )}
    </div>
  );
}
