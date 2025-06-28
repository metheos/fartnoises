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
import {
  ClientGameLayout,
  ClientLobby,
  ClientJudgeSelection,
  ClientPromptSelection,
  ClientSoundSelection,
  ClientJudging,
  ClientResults,
  ClientGameOver,
  ClientPausedForDisconnection
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

  // Load sound effects on component mount
  useEffect(() => {
    const loadSounds = async () => {
      try {
        const sounds = await getSoundEffects();
        setSoundEffects(sounds);
        console.log(`Loaded ${sounds.length} sound effects`);
        addDebugLog(`Loaded ${sounds.length} sound effects`);
      } catch (error) {
        console.error('Failed to load sound effects:', error);
        addDebugLog(`Failed to load sound effects: ${error}`);
      }
    };
    loadSounds();
  }, [addDebugLog]);

  // Handle redirection in a separate effect to avoid dependency issues
  useEffect(() => {
    if (!playerName) {
      addDebugLog('No playerName, redirecting to home.');
      router.push('/');
    }
  }, [playerName, router, addDebugLog]);

  // Monitor room state changes
  useEffect(() => {
    addDebugLog(`Room state changed: ${room ? `${room.code} with ${room.players?.length} players, state: ${room.gameState}` : 'null'}`);
  }, [room, addDebugLog]);

  // Monitor player state changes
  useEffect(() => {
    addDebugLog(`Player state changed: ${player ? player.name : 'null'}`);
    // Store original player ID for reconnection purposes
    if (player && socket?.id) {
      localStorage.setItem('originalPlayerId', socket.id);
    }
  }, [player, socket, addDebugLog]);

  // Sound selection functions - keep these local as they handle local state
  const selectSounds = (sounds: string[]) => {
    // Filter out empty strings and ensure we have 1-2 valid sounds
    const validSounds = sounds.filter(sound => sound && sound.trim() !== '');
    if (validSounds.length >= 1 && validSounds.length <= 2) {
      setSelectedSounds(validSounds);
    } else if (validSounds.length === 0) {
      // Allow clearing the selection with an empty array
      setSelectedSounds(null);
    }
  };

  const submitSounds = () => {
    if (selectedSounds) {
      gameActions.submitSounds(selectedSounds);
      // Note: Don't call setSelectedSounds(null) here as it affects all players
      // The SoundSelectionComponent will handle its own state
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
          timeLeft={timeLeft}
          soundEffects={soundEffects}
        />
      )}        

      {room?.gameState === GameState.JUDGING && (
        <ClientJudging 
          room={room} 
          player={player!} 
          onJudgeSubmission={gameActions.judgeSubmission}
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
        />
      )}

      {room?.gameState === GameState.PAUSED_FOR_DISCONNECTION && (
        <ClientPausedForDisconnection 
          room={room} 
          player={player!} 
          onAttemptReconnection={handleAttemptReconnection} 
        />
      )}        

      {/* Fallback for unknown game states */}
      {room && !Object.values(GameState).includes(room.gameState as GameState) && (
        <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
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
