'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { SoundSubmission } from '@/types/game';
import ConnectionStatus from '@/components/mainscreen/ConnectionStatus';
import AudioActivationBanner from '@/components/mainscreen/AudioActivationBanner';
import { WaitingForGameScreen } from '@/components/mainscreen/WaitingForGameScreen';
import { MainScreenGameDisplay } from '@/components/mainscreen/MainScreenGameDisplay';
import ExplosionOverlay from '@/components/mainscreen/ExplosionOverlay';
import { useSocket } from '@/hooks/useSocket';
import { useAudio } from '@/hooks/useAudio';
import { useBackgroundMusic, BACKGROUND_MUSIC } from '@/hooks/useBackgroundMusic';
import { useGameplayEffects } from '@/hooks/useGameplayEffects';

function MainScreenContent() {
  const searchParams = useSearchParams();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [currentPlayingSubmission, setCurrentPlayingSubmission] = useState<SoundSubmission | null>(null);
  const prevGameState = useRef<string | null>(null);
  
  // Use custom hooks for audio, socket, and background music management
  const { soundEffects, isAudioReady, setIsAudioReady, activateAudio } = useAudio();
  const { 
    currentTrack: currentMusicTrack,
    isPlaying: isMusicPlaying,
    isFading: isMusicFading,
    isAudioReady: isMusicAudioReady,
    changeMusic,
    setVolume: setMusicVolume,
    activateAudio: activateBackgroundAudio
  } = useBackgroundMusic();
  
  // Gameplay sound effects hook
  const {
    effects: availableEffects,
    isLoading: effectsLoading,
    playEffect,
    playJudgeReveal,
    playPromptReveal,
    playSubmissionActivate,
    playRoundResult,
    playLikeIncrement,
    playPointIncrement,
    playGameOver,
    playFailSound
  } = useGameplayEffects(isAudioReady);
  
  const { 
    socket, 
    isConnected, 
    currentRoom, 
    roundWinner, 
    nuclearExplosion,
    setNuclearExplosion,
    joinError, 
    joinRoom
  } = useSocket({ 
    soundEffects, 
    isAudioReady, 
    setIsAudioReady, 
    setCurrentPlayingSubmission,
    gameplayEffects: {
      playLikeIncrement
    }
  });

  // Handle URL parameters - populate input field on load and handle browser navigation
  useEffect(() => {
    const urlRoomCode = searchParams?.get('room');
    if (urlRoomCode && urlRoomCode.length === 4) {
      const upperRoomCode = urlRoomCode.toUpperCase();
      console.log('Main screen: Found room code in URL:', upperRoomCode);
      setRoomCodeInput(upperRoomCode);
    } else if (!urlRoomCode && currentRoom) {
      // URL was cleared but we still have a room - user navigated away
      console.log('Main screen: URL cleared, leaving current room');
      setRoomCodeInput('');
    }
  }, [searchParams, currentRoom]);

  // Handle background music changes based on game state
  useEffect(() => {
    let targetMusic: string | null = null;

    if (!currentRoom) {
      // No room joined - lobby music
      targetMusic = BACKGROUND_MUSIC.LOBBY;
    } else {
      // Determine music based on game state
      switch (currentRoom.gameState) {
        case 'lobby':
          targetMusic = BACKGROUND_MUSIC.WAITING_FOR_PLAYERS;
          break;
        case 'judge_selection':
          targetMusic = null; // No music during judge selection
          break;
        case 'prompt_selection':
        case 'sound_selection':
          targetMusic = BACKGROUND_MUSIC.SOUND_SELECTION;
          break;
        case 'playback':
          targetMusic = BACKGROUND_MUSIC.PLAYBACK;
          break;
        case 'judging':
          targetMusic = BACKGROUND_MUSIC.JUDGING;
          break;
        case 'round_results':
          targetMusic = BACKGROUND_MUSIC.RESULTS;
          break;
        case 'game_over':
          targetMusic = BACKGROUND_MUSIC.GAME_OVER;
          break;
        case 'paused_for_disconnection':
          // Keep current music during pause, don't change
          return;
        default:
          targetMusic = BACKGROUND_MUSIC.WAITING_FOR_PLAYERS;
      }
    }

    console.log('Main screen: Game state changed to', currentRoom?.gameState, ', setting music to:', targetMusic);

    // Debounce music changes to prevent rapid switching
    const timeoutId = setTimeout(() => {
      changeMusic(targetMusic);
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [currentRoom?.gameState, currentRoom?.code]);
  
  // Enhanced wrapper function to handle both audio systems
  const handleJoinRoom = async () => {
    // Activate both audio systems on user interaction
    await Promise.all([
      activateAudio(),
      activateBackgroundAudio()
    ]);
    joinRoom(roomCodeInput);
  };

  // Combined audio activation function
  const handleActivateAudio = async () => {
    await Promise.all([
      activateAudio(),
      activateBackgroundAudio()
    ]);
  };

  // Handle explosion completion
  const handleExplosionComplete = () => {
    console.log('Main screen: Explosion animation completed');
    setNuclearExplosion(null);
  };

  // Handle gameplay sound effects based on game state changes and events
  useEffect(() => {
    if (!isAudioReady || effectsLoading) return;
    
    if (currentRoom && prevGameState.current !== currentRoom.gameState) {
      console.log(`🎵 Game state changed from ${prevGameState.current} to ${currentRoom.gameState}`);
      
      // Play appropriate sound effect for state transition
      switch (currentRoom.gameState) {
        case 'judge_selection':
          // Judge being revealed
          playJudgeReveal();
          break;
        case 'prompt_selection':
          break;
        case 'sound_selection':
          // Sound selection phase starts
          // Prompt reveal
          playPromptReveal();
          break;
        case 'playback':
          break;
        case 'round_results':
          // Round results being shown
          playRoundResult();
          break;
        case 'game_over':
          // Game over
          playGameOver();
          break;
        default:
          // No specific sound for other states
          break;
      }
      
      prevGameState.current = currentRoom.gameState;
    }
  }, [currentRoom?.gameState, isAudioReady, effectsLoading, playJudgeReveal, playPromptReveal, playEffect, playSubmissionActivate, playRoundResult, playGameOver]);

  // Handle round winner announcement effects - now handled by winnerAudioComplete event
  // (Point increment sound is triggered when winner audio finishes playing)
  useEffect(() => {
    if (roundWinner && isAudioReady && !effectsLoading) {
      console.log('🎵 Round winner announced, point increment sound will play after winner audio completes');
    }
  }, [roundWinner, isAudioReady, effectsLoading]);

  // Handle nuclear explosion effect
  useEffect(() => {
    if (nuclearExplosion?.isExploding && isAudioReady && !effectsLoading) {
      console.log('🎵 Nuclear explosion triggered, playing dramatic effect');
      // Play a dramatic sound effect for the nuclear explosion
      playEffect('judge', { volume: 1.0, speed: 0.7 }); // Slower, more dramatic
    }
  }, [nuclearExplosion?.isExploding, isAudioReady, effectsLoading, playEffect]);

  if (!isConnected) {
    return <ConnectionStatus isConnected={isConnected} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 p-2">
      <div className="mx-auto">

        {/* Audio Activation Banner - show if either audio system isn't ready */}
        {(!isAudioReady || !isMusicAudioReady) && (
          <div className="mb-4">
            <AudioActivationBanner 
              isAudioReady={isAudioReady && isMusicAudioReady}
              onActivateAudio={handleActivateAudio}
            />
          </div>
        )}

        {/* Music Status Indicator (for debugging) */}
        {/* {process.env.NODE_ENV === 'development' && (
          <div className="fixed top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded text-xs z-50">
            <div>Music: {currentMusicTrack ? currentMusicTrack.split('/').pop() : 'None'}</div>
            <div>Playing: {isMusicPlaying ? 'Yes' : 'No'}</div>
            <div>Fading: {isMusicFading ? 'Yes' : 'No'}</div>
            <div>Audio Ready: {isMusicAudioReady ? 'Yes' : 'No'}</div>
          </div>
        )} */}

        {currentRoom ? (
          <MainScreenGameDisplay 
            room={currentRoom} 
            roundWinner={roundWinner} 
            soundEffects={soundEffects}
            isAudioReady={isAudioReady}
            onActivateAudio={activateAudio}
            currentPlayingSubmission={currentPlayingSubmission}
            socket={socket}
            gameplayEffects={{
              playEffect,
              playJudgeReveal,
              playPromptReveal,
              playSubmissionActivate,
              playRoundResult,
              playLikeIncrement,
              playPointIncrement,
              playGameOver,
              playFailSound
            }}
          />
        ) : (          
        <WaitingForGameScreen 
            onJoinRoom={handleJoinRoom}
            roomCodeInput={roomCodeInput}
            setRoomCodeInput={setRoomCodeInput}
            joinError={joinError}
            roomCodeFromURL={searchParams?.get('room')}
          />
        )}

      </div>

      {/* Nuclear Explosion Overlay */}
      <ExplosionOverlay 
        isExploding={nuclearExplosion?.isExploding || false}
        judgeName={nuclearExplosion?.judgeName || ''}
        onExplosionComplete={handleExplosionComplete}
      />
    </div>
  );
}

export default function MainScreen() {
  return (
    <Suspense fallback={<div>Loading Main Screen...</div>}>
      <MainScreenContent />
    </Suspense>
  );
}

