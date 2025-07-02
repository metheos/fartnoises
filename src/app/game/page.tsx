'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Player, Room, GameState, SoundEffect } from '@/types/game';
import { getSoundEffects } from '@/data/gameData';
import { useGameParams } from '@/hooks/useGameParams';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { useDebugLog } from '@/hooks/useDebugLog';
import { useGameActions } from '@/hooks/useGameActions';
import { useSocketManager } from '@/hooks/useSocketManager';
import { useGameStateLogging, useAsyncOperation } from '@/hooks';
import {
  ClientGameLayout,
  ClientLobby,
  ClientJudgeSelection,
  ClientPromptSelection,
  ClientSoundSelection,
  ClientJudging,
  ClientResults,
  ClientGameOver,
  // ClientPausedForDisconnection // Now handled in ClientGameLayout
} from '@/components/client';

function GamePageContent() {
  // Core game state
  const [room, setRoom] = useState<Room | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [selectedSounds, setSelectedSounds] = useState<string[] | null>(null);
  const [error, setError] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [soundEffects, setSoundEffects] = useState<SoundEffect[]>([]);
  const [roundWinner, setRoundWinner] = useState<{
    winnerId: string;
    winnerName: string;
    winningSubmission: { sounds: string[]; playerId: string; playerName: string };
    submissionIndex: number;
  } | null>(null);
  const [lastRoundNumber, setLastRoundNumber] = useState<number>(0);
  
  // Reconnection state
  const [reconnectionVote, setReconnectionVote] = useState<{
    disconnectedPlayerName: string;
    timeLeft: number;
    showVoteDialog: boolean;
  } | null>(null);
  
  // Debug logging for reconnection vote state
  useEffect(() => {
    console.log('[CLIENT] reconnectionVote state changed:', reconnectionVote);
  }, [reconnectionVote]);
  const [gamePaused, setGamePaused] = useState<{
    disconnectedPlayerName: string;
    timeLeft: number;
  } | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Hooks
  const router = useRouter();
  const { mode, playerName, roomCode, playerColor, playerEmoji } = useGameParams();
  const { addDebugLog } = useDebugLog();
  const { 
    playSoundCombinationWithFeedback 
  } = useAudioPlayback();

  // Game state logging hook
  const { logGameEvent } = useGameStateLogging(room, player, {
    addDebugLog,
    componentName: 'GamePage'
  });

  // Sound effects loading with async operation hook
  const soundEffectsLoader = useAsyncOperation<SoundEffect[]>({
    initialData: []
  });

  // Socket management using the custom hook
  const { isConnected, socket } = useSocketManager(
    {
      mode,
      playerName,
      roomCode,
      playerColor,
      playerEmoji,
      addDebugLog,
      room,
      selectedSounds,
      lastRoundNumber
    },
    {
      setRoom,
      setPlayer,
      setError,
      setLastRoundNumber,
      setSelectedSounds,
      setRoundWinner,
      setTimeLeft,
      setIsReconnecting,
      setReconnectionVote,
      setGamePaused
    }
  );

  // Game actions using the custom hook
  const gameActions = useGameActions({
    socket,
    room,
    player,
    addDebugLog
  });

  // Load sound effects when room data is available
  useEffect(() => {
    // Only load sounds when we have room data
    if (!room) {
      return;
    }

    // Always load all sounds - let server handle filtering during selection
    const allowExplicitContent = true;
    
    soundEffectsLoader.execute(
      () => getSoundEffects(allowExplicitContent),
      (sounds) => {
        setSoundEffects(sounds);
        logGameEvent(`Loaded ${sounds.length} sound effects (all content loaded, server handles filtering)`);
        addDebugLog(`🔊 Loaded ${sounds.length} sound effects (all content - server filters during selection)`);
      },
      (error) => {
        console.error('Failed to load sound effects:', error);
        logGameEvent(`Failed to load sound effects: ${error.message}`);
      }
    );
    // Intentionally excluding function dependencies to prevent re-initialization on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.code]); // Only depend on room code change, not the functions

  // Handle redirection in a separate effect to avoid dependency issues
  useEffect(() => {
    if (!playerName) {
      addDebugLog('No playerName, redirecting to home.');
      router.push('/');
    }
  }, [playerName, router, addDebugLog]);

  // Store original player ID for reconnection purposes
  useEffect(() => {
    if (player && socket?.id) {
      localStorage.setItem('originalPlayerId', socket.id);
    }
  }, [player, socket]);

  // Sound selection functions - keep these local as they handle local state
  const selectSounds = (sounds: string[]) => {
    // Filter out empty strings and ensure we have valid sounds
    const validSounds = sounds.filter(sound => sound && sound.trim() !== '');
    const maxSounds = player?.hasActivatedTripleSound ? 3 : 2;
    
    if (validSounds.length >= 1 && validSounds.length <= maxSounds) {
      setSelectedSounds(validSounds);
      addDebugLog(`🎵 selectSounds: Accepted ${validSounds.length} sounds (max: ${maxSounds}): [${validSounds.join(', ')}]`);
    } else if (validSounds.length === 0) {
      // Allow clearing the selection with an empty array
      setSelectedSounds(null);
      addDebugLog(`🎵 selectSounds: Cleared selection`);
    } else {
      addDebugLog(`🎵 selectSounds: Rejected ${validSounds.length} sounds (max: ${maxSounds}): [${validSounds.join(', ')}]`);
    }
  };

  const submitSounds = () => {
    if (selectedSounds) {
      addDebugLog(`🎵 submitSounds: Submitting ${selectedSounds.length} sounds: [${selectedSounds.join(', ')}]`);
      gameActions.submitSounds(selectedSounds);
      // Note: Don't call setSelectedSounds(null) here as it affects all players
      // The SoundSelectionComponent will handle its own state
    } else {
      addDebugLog(`🎵 submitSounds: No sounds selected to submit`);
    }
  };

  // Wrapper functions for functions that need local state access
  const handleVoteOnReconnection = (continueWithoutPlayer: boolean) => {
    gameActions.voteOnReconnectionWithCleanup(continueWithoutPlayer, setReconnectionVote);
  };

  const handleAttemptReconnection = () => {
    if (playerName && roomCode) {
      gameActions.attemptReconnection(
        playerName, 
        roomCode, 
        setIsReconnecting, 
        setRoom, 
        setPlayer, 
        setError
      );
    }
  };
  
  const handleGoHome = () => {
    // Clear reconnection data when going back to home
    localStorage.removeItem('originalPlayerId');
    localStorage.removeItem('lastKnownRoomCode');
    router.push('/');
  };

  return (
    <ClientGameLayout
      room={room}
      player={player}
      isConnected={isConnected}
      error={error}
      reconnectionVote={reconnectionVote}
      gamePaused={gamePaused}
      isReconnecting={isReconnecting}
      onVoteOnReconnection={handleVoteOnReconnection}
      onAttemptReconnection={handleAttemptReconnection}
      onGoHome={handleGoHome}
    >
      {/* Game State Components */}
      {room?.gameState === GameState.LOBBY && (
        <ClientLobby 
          room={room} 
          player={player!} 
          onStartGame={gameActions.startGame}
          onUpdateGameSetting={gameActions.updateGameSetting}
        />
      )}

      {room?.gameState === GameState.JUDGE_SELECTION && (
        <ClientJudgeSelection 
          room={room} 
          player={player!} 
        />
      )}

      {room?.gameState === GameState.PROMPT_SELECTION && (
        <ClientPromptSelection 
          room={room} 
          player={player!} 
          onSelectPrompt={gameActions.selectPrompt} 
        />
      )}        

      {room?.gameState === GameState.SOUND_SELECTION && (
        <ClientSoundSelection 
          room={room} 
          player={player!} 
          selectedSounds={selectedSounds}
          onSelectSounds={selectSounds}
          onSubmitSounds={submitSounds}
          onRefreshSounds={gameActions.refreshSounds}
          onActivateTripleSound={gameActions.activateTripleSound}
          timeLeft={timeLeft}
          soundEffects={soundEffects}
          socket={socket}
        />
      )}        

      {room?.gameState === GameState.JUDGING && (
        <ClientJudging 
          room={room} 
          player={player!} 
          onJudgeSubmission={gameActions.judgeSubmission}
          onLikeSubmission={gameActions.likeSubmission}
          soundEffects={soundEffects}
          socket={socket}
          playSoundCombinationWithFeedback={playSoundCombinationWithFeedback}
        />
      )}

      {room?.gameState === GameState.ROUND_RESULTS && (
        <ClientResults 
          room={room} 
          player={player!} 
          roundWinner={roundWinner} 
          soundEffects={soundEffects} 
        />
      )}

      {room?.gameState === GameState.GAME_OVER && (
        <ClientGameOver 
          room={room} 
          player={player!} 
          onRestartGame={gameActions.restartGame}
        />
      )}

      {/* Disconnection handling is now done entirely in ClientGameLayout modals */}
      {/* {room?.gameState === GameState.PAUSED_FOR_DISCONNECTION && (
        <ClientPausedForDisconnection 
          room={room} 
          player={player!} 
          onAttemptReconnection={handleAttemptReconnection} 
        />
      )} */}

      {/* Fallback for unknown game states */}
      {room && !Object.values(GameState).includes(room.gameState as GameState) && (
        <div className="bg-white rounded-3xl px-4 py-2 mb-2 shadow-lg">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Unknown Game State</h2>
          <p className="text-gray-800">Current state: {room.gameState}</p>
          <p className="text-gray-800">Expected states: {Object.values(GameState).join(', ')}</p>
        </div>
      )}
    </ClientGameLayout>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div>Loading Game Page...</div>}>
      <GamePageContent />
    </Suspense>
  );
}
