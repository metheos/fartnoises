'use client';

import { useState } from 'react';
import { Room, GameState, Player, SoundSubmission, GamePrompt, SoundEffect } from '@/types/game';

// Import Main Screen Components
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

// Import Client/Player Components
import {
  LobbyComponent,
  JudgeSelectionComponent,
  PromptSelectionComponent,
  SoundSelectionComponent,
  JudgingComponent,
  ResultsComponent,
  GameOverComponent,
  PausedForDisconnectionComponent,
} from '@/app/game/page';

// Mock Data
const mockPlayers: Player[] = [
  { id: 'player1', name: 'Alice', color: '#FF6B6B', emoji: '😂', score: 1, isVIP: true, isDisconnected: false },
  { id: 'player2', name: 'Bob', color: '#4ECDC4', emoji: '🎵', score: 2, isVIP: false, isDisconnected: false },
  { id: 'player3', name: 'Charlie', color: '#45B7D1', emoji: '🤪', score: 0, isVIP: false, isDisconnected: false },
  { id: 'player4', name: 'Diana', color: '#96CEB4', emoji: '🎸', score: 3, isVIP: false, isDisconnected: false },
];

const mockPlayerView = mockPlayers[1]; // Bob's view (non-VIP, non-judge)
const mockJudgeView = mockPlayers[0]; // Alice's view (VIP, judge)

const mockSoundEffects: SoundEffect[] = [
  { id: 'sound1', name: 'Fart', fileName: 'fart.ogg', category: 'Gross' },
  { id: 'sound2', name: 'Burp', fileName: 'burp.ogg', category: 'Gross' },
  { id: 'sound3', name: 'Scream', fileName: 'scream.ogg', category: 'Vocal' },
  { id: 'sound4', name: 'Laugh', fileName: 'laugh.ogg', category: 'Vocal' },
  { id: 'sound5', name: 'Laser', fileName: 'laser.ogg', category: 'Sci-Fi' },
  { id: 'sound6', name: 'Explosion', fileName: 'explosion.ogg', category: 'Action' },
  { id: 'sound7', name: 'Whistle', fileName: 'whistle.ogg', category: 'Musical' },
  { id: 'sound8', name: 'Boing', fileName: 'boing.ogg', category: 'Cartoon' },
  { id: 'sound9', name: 'Crash', fileName: 'crash.ogg', category: 'Action' },
  { id: 'sound10', name: 'Meow', fileName: 'meow.ogg', category: 'Animals' },
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
    { id: 'p4', text: 'Your morning routine but make it dramatic.', category: 'Daily Life' },
    { id: 'p5', text: 'The secret language of houseplants.', category: 'Nature' },
    { id: 'p6', text: 'What happens when WiFi gets jealous.', category: 'Technology' },
];

const baseMockRoom: Omit<Room, 'gameState'> = {
  code: 'DBUG',
  players: mockPlayers,
  currentJudge: 'player1',
  currentPrompt: { id: 'p1', text: 'The sound of a robot trying to love.', category: 'Modern Life' },
  currentRound: 2,
  maxRounds: 5,
  maxScore: 3,
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
  const [view, setView] = useState<GameState | 'WAITING'>('WAITING');
  const [viewType, setViewType] = useState<'main-screen' | 'client'>('main-screen');
  const [clientPlayerType, setClientPlayerType] = useState<'regular' | 'judge' | 'vip'>('regular');
  const [selectedSounds, setSelectedSounds] = useState<string[]>(['sound1', 'sound3']);
  const [timeLeft, setTimeLeft] = useState<number>(45);

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
        return { ...baseMockRoom, gameState: GameState.PLAYBACK, submissions: mockSubmissions, currentSubmissionIndex: 1 };
      case GameState.JUDGING:
        return { ...baseMockRoom, gameState: GameState.JUDGING, submissions: mockSubmissions, randomizedSubmissions: mockSubmissions };
      case GameState.ROUND_RESULTS:
        return { ...baseMockRoom, gameState: GameState.ROUND_RESULTS, submissions: mockSubmissions };
      case GameState.GAME_OVER:
        return { ...baseMockRoom, gameState: GameState.GAME_OVER, submissions: mockSubmissions, winner: 'player4' };
      case GameState.PAUSED_FOR_DISCONNECTION:
        return { 
          ...baseMockRoom, 
          gameState: GameState.PAUSED_FOR_DISCONNECTION, 
          submissions: mockSubmissions,
          disconnectedPlayers: [{ 
            id: 'player3', 
            name: 'Charlie', 
            color: '#45B7D1', 
            score: 0, 
            isVIP: false, 
            disconnectedAt: Date.now(),
            socketId: 'old-socket-id'
          }],
          pausedForDisconnection: true
        };
      default:
        return { ...baseMockRoom, gameState: GameState.LOBBY };
    }
  };

  const mockRoom = getMockRoomForState(view);
  
  // Get the appropriate player view based on selection
  const getCurrentPlayer = (): Player => {
    switch (clientPlayerType) {
      case 'judge':
        return mockJudgeView;
      case 'vip':
        return { ...mockPlayerView, isVIP: true };
      default:
        return mockPlayerView;
    }
  };

  const currentPlayer = getCurrentPlayer();

  const renderMainScreenView = () => {
    switch (view) {
      case 'WAITING':
        return <WaitingForGameScreen onJoinRoom={() => {}} roomCodeInput="" setRoomCodeInput={() => {}} joinError="" />;
      case GameState.LOBBY:
        return <LobbyDisplay room={mockRoom} />;
      case GameState.JUDGE_SELECTION:
        return <JudgeSelectionDisplay room={mockRoom} />;
      case GameState.PROMPT_SELECTION:
        return <PromptSelectionDisplay room={mockRoom} />;
      case GameState.SOUND_SELECTION:
        return <SoundSelectionDisplay room={mockRoom} />;
      case GameState.PLAYBACK:
        return <PlaybackSubmissionsDisplay room={mockRoom} soundEffects={mockSoundEffects} socket={{ on: () => {}, off: () => {}, emit: () => {}, disconnect: () => {}, connect: () => {}, connected: false } as any} />;
      case GameState.JUDGING:
        return <JudgingDisplay room={mockRoom} soundEffects={mockSoundEffects} />;
      case GameState.ROUND_RESULTS:
        return <ResultsDisplay room={mockRoom} roundWinner={mockRoundWinner} soundEffects={mockSoundEffects} />;
      case GameState.GAME_OVER:
        return <GameOverDisplay room={mockRoom} />;
      case GameState.PAUSED_FOR_DISCONNECTION:
        return (
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-orange-600 mb-4">Game Paused</h2>
            <p className="text-gray-700">Main screen shows paused state during disconnections</p>
          </div>
        );
      default:
        return <div>Select a view</div>;
    }
  };

  const renderClientView = () => {
    switch (view) {
      case 'WAITING':
        return (
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-purple-600 mb-4">Join a Game</h2>
            <p className="text-gray-700">Player would enter room code here</p>
          </div>
        );
      case GameState.LOBBY:
        return (
          <LobbyComponent 
            room={mockRoom} 
            player={currentPlayer} 
            onStartGame={() => console.log('Start game')}
            onUpdateGameSetting={(setting, value) => console.log('Update setting:', setting, value)}
          />
        );
      case GameState.JUDGE_SELECTION:
        return <JudgeSelectionComponent room={mockRoom} player={currentPlayer} />;
      case GameState.PROMPT_SELECTION:
        return (
          <PromptSelectionComponent 
            room={mockRoom} 
            player={currentPlayer} 
            onSelectPrompt={(id) => console.log('Select prompt:', id)} 
          />
        );
      case GameState.SOUND_SELECTION:
        return (
          <SoundSelectionComponent 
            room={mockRoom} 
            player={currentPlayer} 
            selectedSounds={selectedSounds}
            onSelectSounds={setSelectedSounds}
            onSubmitSounds={() => console.log('Submit sounds:', selectedSounds)}
            timeLeft={timeLeft}
            soundEffects={mockSoundEffects}
          />
        );
      case GameState.PLAYBACK:
        return (
          <div className="bg-white rounded-3xl p-8 shadow-lg text-center">
            <h2 className="text-3xl font-bold text-purple-600 mb-6">Playback in Progress</h2>
            
            <div className="bg-purple-50 p-6 rounded-xl mb-6">
              <h3 className="text-xl font-bold text-purple-800 mb-2">Prompt:</h3>
              <p className="text-purple-700 text-lg">{mockRoom.currentPrompt?.text}</p>
            </div>

            <div className="space-y-4">
              <div className="animate-pulse w-20 h-20 bg-blue-200 rounded-full mx-auto"></div>
              <p className="text-gray-600">Listen to all submissions on the main screen</p>
              <p className="text-sm text-gray-500">
                Playing submission {(mockRoom.currentSubmissionIndex || 0) + 1} of {mockRoom.submissions.length}
              </p>
            </div>
          </div>
        );
      case GameState.JUDGING:
        return (
          <JudgingComponent 
            room={mockRoom} 
            player={currentPlayer} 
            onJudgeSubmission={(index) => console.log('Judge submission:', index)}
            soundEffects={mockSoundEffects}
          />
        );
      case GameState.ROUND_RESULTS:
        return <ResultsComponent room={mockRoom} player={currentPlayer} roundWinner={mockRoundWinner} soundEffects={mockSoundEffects} />;
      case GameState.GAME_OVER:
        return <GameOverComponent room={mockRoom} player={currentPlayer} />;
      case GameState.PAUSED_FOR_DISCONNECTION:
        return (
          <PausedForDisconnectionComponent 
            room={mockRoom} 
            player={currentPlayer} 
            onAttemptReconnection={() => console.log('Attempt reconnection')}
          />
        );
      default:
        return <div>Select a view</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-4">🎵 fartnoises Debug Page</h1>
      
      {/* View Type Selection */}
      <div className="bg-gray-800 p-4 rounded-lg mb-4">
        <h2 className="text-xl mb-2">View Type</h2>
        <div className="flex gap-2 mb-3">
          <button 
            onClick={() => setViewType('main-screen')} 
            className={`px-4 py-2 rounded ${viewType === 'main-screen' ? 'bg-blue-500' : 'bg-gray-700'}`}
          >
            📺 Main Screen View
          </button>
          <button 
            onClick={() => setViewType('client')} 
            className={`px-4 py-2 rounded ${viewType === 'client' ? 'bg-green-500' : 'bg-gray-700'}`}
          >
            📱 Client/Player View
          </button>
        </div>
        
        {/* Client Player Type Selection */}
        {viewType === 'client' && (
          <div className="mt-3">
            <h3 className="text-lg mb-2">Player Type</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setClientPlayerType('regular')} 
                className={`px-3 py-1 rounded text-sm ${clientPlayerType === 'regular' ? 'bg-purple-500' : 'bg-gray-600'}`}
              >
                👤 Regular Player
              </button>
              <button 
                onClick={() => setClientPlayerType('judge')} 
                className={`px-3 py-1 rounded text-sm ${clientPlayerType === 'judge' ? 'bg-yellow-500' : 'bg-gray-600'}`}
              >
                ⚖️ Judge
              </button>
              <button 
                onClick={() => setClientPlayerType('vip')} 
                className={`px-3 py-1 rounded text-sm ${clientPlayerType === 'vip' ? 'bg-orange-500' : 'bg-gray-600'}`}
              >
                👑 VIP
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Game State Selection */}
      <div className="bg-gray-800 p-4 rounded-lg mb-4">
        <h2 className="text-xl mb-2">Select Game State</h2>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setView('WAITING')} 
            className={`px-3 py-1 rounded text-sm ${view === 'WAITING' ? 'bg-indigo-500' : 'bg-gray-700'}`}
          >
            ⏳ Waiting/Join
          </button>
          {gameStates.map(state => (
            <button 
              key={state} 
              onClick={() => setView(state)} 
              className={`px-3 py-1 rounded text-sm ${view === state ? 'bg-indigo-500' : 'bg-gray-700'}`}
            >
              {state.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Controls for Client View */}
      {viewType === 'client' && view === GameState.SOUND_SELECTION && (
        <div className="bg-gray-800 p-4 rounded-lg mb-4">
          <h2 className="text-xl mb-2">Debug Controls</h2>
          <div className="flex gap-4 items-center">
            <div>
              <label className="text-sm text-gray-300">Timer: </label>
              <input 
                type="range" 
                min="0" 
                max="60" 
                value={timeLeft} 
                onChange={(e) => setTimeLeft(parseInt(e.target.value))}
                className="ml-2"
                aria-label="Timer seconds"
                title="Adjust timer seconds"
              />
              <span className="ml-2 text-sm">{timeLeft}s</span>
            </div>
            <div>
              <label className="text-sm text-gray-300">Selected Sounds: </label>
              <span className="ml-2 text-sm text-green-400">{selectedSounds.length}/2</span>
            </div>
          </div>
        </div>
      )}

      {/* Current State Info */}
      <div className="bg-gray-800 p-4 rounded-lg mb-4">
        <h2 className="text-xl mb-2">Current State Info</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-400">View:</span>
            <span className="ml-2 text-blue-400">{viewType}</span>
          </div>
          <div>
            <span className="text-gray-400">State:</span>
            <span className="ml-2 text-green-400">{view}</span>
          </div>
          <div>
            <span className="text-gray-400">Round:</span>
            <span className="ml-2 text-yellow-400">{mockRoom.currentRound}/{mockRoom.maxRounds}</span>
          </div>
          <div>
            <span className="text-gray-400">Players:</span>
            <span className="ml-2 text-purple-400">{mockRoom.players.length}</span>
          </div>
          {viewType === 'client' && (
            <>
              <div>
                <span className="text-gray-400">Player:</span>
                <span className="ml-2 text-orange-400">{getCurrentPlayer().name}</span>
              </div>
              <div>
                <span className="text-gray-400">Type:</span>
                <span className="ml-2 text-pink-400">{clientPlayerType}</span>
              </div>
              <div>
                <span className="text-gray-400">Score:</span>
                <span className="ml-2 text-cyan-400">{getCurrentPlayer().score}</span>
              </div>
              <div>
                <span className="text-gray-400">Is Judge:</span>
                <span className="ml-2 text-red-400">{mockRoom.currentJudge === getCurrentPlayer().id ? 'Yes' : 'No'}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Render the appropriate view */}
      <div className="bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 p-8 rounded-lg">
        <div className="max-w-7xl mx-auto">
          {viewType === 'main-screen' ? renderMainScreenView() : renderClientView()}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-gray-800 p-4 rounded-lg mt-4">
        <h2 className="text-xl mb-2">🔧 Debug Help</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <h3 className="text-white font-medium mb-1">Main Screen View:</h3>
            <p>Shows what players see on the shared TV/display during gameplay. Use this to test the main screen experience.</p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">Client View:</h3>
            <p>Shows what individual players see on their phones/devices. Switch between Regular, Judge, and VIP player types to test different experiences.</p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">Game States:</h3>
            <p>Test every phase of the game from lobby through game over. Each state shows different UI and interactions.</p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">Interactive Controls:</h3>
            <p>Some states (like Sound Selection) include debug controls to simulate timer changes and player actions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
