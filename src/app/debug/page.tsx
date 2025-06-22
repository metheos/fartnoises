'use client';

import { useState } from 'react';
import { Room, GameState, Player, SoundSubmission, GamePrompt, SoundEffect } from '@/types/game';
import {
  LobbyDisplay,
  JudgeSelectionDisplay,
  PromptSelectionDisplay,
  SoundSelectionDisplay,
  PlaybackSubmissionsDisplay,
  JudgingDisplay,
  ResultsDisplay,
  GameOverDisplay,
  WaitingForGameScreen,
} from '@/app/main-screen/page';

// Mock Data
const mockPlayers: Player[] = [
  { id: 'player1', name: 'Alice', color: '#ef4444', score: 1, isVIP: true, isDisconnected: false },
  { id: 'player2', name: 'Bob', color: '#3b82f6', score: 2, isVIP: false, isDisconnected: false },
  { id: 'player3', name: 'Charlie', color: '#22c55e', score: 0, isVIP: false, isDisconnected: false },
  { id: 'player4', name: 'Diana', color: '#eab308', score: 3, isVIP: false, isDisconnected: false },
];

const mockSoundEffects: SoundEffect[] = [
  { id: 'sound1', name: 'Fart', fileName: 'fart.ogg', category: 'Gross' },
  { id: 'sound2', name: 'Burp', fileName: 'burp.ogg', category: 'Gross' },
  { id: 'sound3', name: 'Scream', fileName: 'scream.ogg', category: 'Vocal' },
  { id: 'sound4', name: 'Laugh', fileName: 'laugh.ogg', category: 'Vocal' },
  { id: 'sound5', name: 'Laser', fileName: 'laser.ogg', category: 'Sci-Fi' },
  { id: 'sound6', name: 'Explosion', fileName: 'explosion.ogg', category: 'Action' },
];

const mockSubmissions: SoundSubmission[] = [
  { playerId: 'player2', playerName: 'Bob', sounds: ['sound1', 'sound3'] },
  { playerId: 'player3', playerName: 'Charlie', sounds: ['sound2', 'sound4'] },
  { playerId: 'player4', playerName: 'Diana', sounds: ['sound5', 'sound6'] },
];

const mockAvailablePrompts: GamePrompt[] = [
    { id: 'p1', text: 'The sound of a robot trying to love.', category: 'Modern Life' },
    { id: 'p2', text: 'What a cat really thinks about you.', category: 'Animals' },
    { id: 'p3', text: 'The noise that finally breaks the internet.', category: 'Absurd' },
];

const baseMockRoom: Omit<Room, 'gameState'> = {
  code: 'DBUG',
  players: mockPlayers,
  currentJudge: 'player1',
  currentPrompt: { id: 'p1', text: 'The sound of a robot trying to love.', category: 'Modern Life' },
  currentRound: 2,
  maxRounds: 5,
  submissions: [],
  winner: null,
  availablePrompts: mockAvailablePrompts,
  usedPromptIds: ['p0'],
  isPlayingBack: false,
  soundSelectionTimerStarted: false,
  promptChoices: mockAvailablePrompts,
  lastWinner: null,
  lastWinningSubmission: null,
};

const mockRoundWinner = {
  winnerId: 'player2',
  winnerName: 'Bob',
  winningSubmission: mockSubmissions[0],
  submissionIndex: 0,
};

const gameStates = Object.values(GameState);

export default function DebugPage() {
  const [view, setView] = useState<GameState | 'WAITING'>(GameState.LOBBY);

  const getMockRoomForState = (state: GameState | 'WAITING'): Room => {
    switch (state) {
      case GameState.LOBBY:
        return { ...baseMockRoom, gameState: GameState.LOBBY, currentJudge: null, currentPrompt: null, submissions: [] };
      case GameState.JUDGE_SELECTION:
        return { ...baseMockRoom, gameState: GameState.JUDGE_SELECTION, currentPrompt: null, submissions: [] };
      case GameState.PROMPT_SELECTION:
        return { ...baseMockRoom, gameState: GameState.PROMPT_SELECTION, currentPrompt: null, submissions: [] };
      case GameState.SOUND_SELECTION:
        return { ...baseMockRoom, gameState: GameState.SOUND_SELECTION, submissions: mockSubmissions.slice(0, 1) };
      case GameState.PLAYBACK:
        return { ...baseMockRoom, gameState: GameState.PLAYBACK, submissions: mockSubmissions };
      case GameState.JUDGING:
        return { ...baseMockRoom, gameState: GameState.JUDGING, submissions: mockSubmissions };
      case GameState.ROUND_RESULTS:
        return { ...baseMockRoom, gameState: GameState.ROUND_RESULTS, submissions: mockSubmissions };
      case GameState.GAME_OVER:
        return { ...baseMockRoom, gameState: GameState.GAME_OVER, submissions: mockSubmissions };
      default:
        return { ...baseMockRoom, gameState: GameState.LOBBY };
    }
  };

  const mockRoom = getMockRoomForState(view);

  const renderView = () => {
    switch (view) {
      case 'WAITING':
        return <WaitingForGameScreen rooms={[]} onJoinRoom={() => {}} onRefreshRooms={() => {}} roomCodeInput="" setRoomCodeInput={() => {}} joinError="" />;
      case GameState.LOBBY:
        return <LobbyDisplay room={mockRoom} />;
      case GameState.JUDGE_SELECTION:
        return <JudgeSelectionDisplay room={mockRoom} />;
      case GameState.PROMPT_SELECTION:
        return <PromptSelectionDisplay room={mockRoom} />;
      case GameState.SOUND_SELECTION:
        return <SoundSelectionDisplay room={mockRoom} />;
      case GameState.PLAYBACK:
        // Provide a mock socket object for debug purposes
        return <PlaybackSubmissionsDisplay room={mockRoom} soundEffects={mockSoundEffects} socket={{ on: () => {}, off: () => {}, emit: () => {}, disconnect: () => {}, connect: () => {}, connected: false } as any} />;
      case GameState.JUDGING:
        return <JudgingDisplay room={mockRoom} soundEffects={mockSoundEffects} />;
      case GameState.ROUND_RESULTS:
        return <ResultsDisplay room={mockRoom} roundWinner={mockRoundWinner} soundEffects={mockSoundEffects} />;
      case GameState.GAME_OVER:
        return <GameOverDisplay room={mockRoom} />;
      default:
        return <div>Select a view</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-4">Debug View</h1>
      <div className="bg-gray-800 p-4 rounded-lg mb-4">
        <h2 className="text-xl mb-2">Select Game State Component</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setView('WAITING')} className={`px-3 py-1 rounded ${view === 'WAITING' ? 'bg-indigo-500' : 'bg-gray-700'}`}>WaitingForGame</button>
          {gameStates.map(state => (
            <button key={state} onClick={() => setView(state)} className={`px-3 py-1 rounded ${view === state ? 'bg-indigo-500' : 'bg-gray-700'}`}>
              {state}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 p-8">
        <div className="max-w-7xl mx-auto">
          {renderView()}
        </div>
      </div>
    </div>
  );
}
