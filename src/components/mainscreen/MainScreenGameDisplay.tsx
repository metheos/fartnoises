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
import GamePausedDisplay from './GamePausedDisplay';

interface GameplayEffects {
  playEffect: (effectName: string, options?: { reverse?: boolean; speed?: number; volume?: number }) => Promise<void>;
  playJudgeReveal: () => Promise<void>;
  playPromptReveal: () => Promise<void>;
  playSubmissionActivate: () => Promise<void>;
  playRoundResult: () => Promise<void>;
  playLikeIncrement: () => Promise<void>;
  playPointIncrement: () => Promise<void>;
  playGameOver: () => Promise<void>;
  playFailSound: () => Promise<void>;
}

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
  gameplayEffects?: GameplayEffects;
  backgroundMusic: {
    currentTrack: string | null;
    isPlaying: boolean;
    isFading: boolean;
    isAudioReady: boolean;
    volume: number;
    changeMusic: (newTrack: string | null) => void;
    setVolume: (volume: number) => void;
    activateAudio: () => Promise<void>;
  };
}

export function MainScreenGameDisplay({ 
  room, 
  roundWinner,
  soundEffects,
  isAudioReady,
  onActivateAudio,
  currentPlayingSubmission,
  socket,
  gameplayEffects,
  backgroundMusic
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
        backgroundMusic={backgroundMusic}
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
        <ResultsDisplay 
          room={room} 
          roundWinner={roundWinner} 
          soundEffects={soundEffects} 
          socket={socket} 
          onWinnerAudioComplete={() => {
            console.log('[MAIN SCREEN] Winner audio complete callback triggered');
            if (gameplayEffects?.playPointIncrement) {
              console.log('[MAIN SCREEN] Calling playPointIncrement function');
                setTimeout(() => {
                gameplayEffects.playPointIncrement()
                  .then(() => {
                  console.log('[MAIN SCREEN] playPointIncrement completed successfully');
                  })
                  .catch((error) => {
                  console.error('[MAIN SCREEN] playPointIncrement failed:', error);
                  });
                }, 500);
            } else {
              console.warn('[MAIN SCREEN] playPointIncrement function not available in gameplayEffects');
            }
          }}
        />
      )}

      {room.gameState === GameState.GAME_OVER && (
        <GameOverDisplay room={room} />
      )}

      {room.gameState === GameState.PAUSED_FOR_DISCONNECTION && (
        <GamePausedDisplay room={room} socket={socket} />
      )}
    </div>
  );
}
