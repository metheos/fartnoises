import React from 'react';
import { Socket } from 'socket.io-client';
import { Room, GameState, SoundSubmission, SoundEffect } from '@/types/game';
import AudioActivationBanner from './AudioActivationBanner';
import GameHeader from './GameHeader';
import LobbyDisplay from './LobbyDisplay';
import JudgeSelectionDisplay from './JudgeSelectionDisplay';
import PromptSelectionDisplay from './PromptSelectionDisplay';
import SoundSelectionDisplay from './SoundSelectionDisplay';
import { PlaybackSubmissionsDisplay } from './PlaybackSubmissionsDisplay';
import { JudgingDisplay } from './JudgingDisplay';
import { ResultsDisplay } from './ResultsDisplay';
import GameOverDisplay from './GameOverDisplay';

interface MainScreenGameDisplayProps {
  room: Room;
  roundWinner: {
    winnerId: string;
    winnerName: string;
    winningSubmission: { sounds: string[]; playerId: string; playerName: string };
    submissionIndex: number;
  } | null;
  soundEffects: SoundEffect[];
  isAudioReady: boolean;
  onActivateAudio: () => Promise<void>;
  currentPlayingSubmission: SoundSubmission | null;
  socket: Socket | null;
}

export function MainScreenGameDisplay({ 
  room, 
  roundWinner,
  soundEffects,
  isAudioReady,
  onActivateAudio,
  currentPlayingSubmission,
  socket
}: MainScreenGameDisplayProps) {
  return (
    <div className="space-y-2">
      {/* Audio Activation Banner */}
      <AudioActivationBanner 
        isAudioReady={isAudioReady}
        onActivateAudio={onActivateAudio}
      />

      {/* Game Header */}
      <GameHeader 
        room={room}
      />

      {/* Game State Display */}
      {room.gameState === GameState.LOBBY && (
        <LobbyDisplay room={room} />
      )}

      {room.gameState === GameState.JUDGE_SELECTION && (
        <JudgeSelectionDisplay room={room} />
      )}

      {room.gameState === GameState.PROMPT_SELECTION && (
        <PromptSelectionDisplay room={room} socket={socket} />
      )}

      {room.gameState === GameState.SOUND_SELECTION && (
        <SoundSelectionDisplay room={room} socket={socket} />
      )}

      {room.gameState === GameState.PLAYBACK && socket && (
        <PlaybackSubmissionsDisplay 
          key={`playback-${room.code}-${room.currentRound}`}
          room={room} 
          soundEffects={soundEffects} 
          socket={socket} 
        />
      )}

      {room.gameState === GameState.JUDGING && (
        <JudgingDisplay room={room} soundEffects={soundEffects} currentPlayingSubmission={currentPlayingSubmission} />
      )}
      
      {room.gameState === GameState.ROUND_RESULTS && (
        <ResultsDisplay room={room} roundWinner={roundWinner} soundEffects={soundEffects} socket={socket} />
      )}

      {room.gameState === GameState.GAME_OVER && (
        <GameOverDisplay room={room} />
      )}
    </div>
  );
}
