'use client';

import { useState, useEffect } from 'react';
import { Room, GameState, Player, SoundSubmission, GamePrompt, SoundEffect } from '@/types/game';
import { getSoundEffects, getGamePrompts } from '@/data/gameData';
import { WaveformAnimation } from '@/components/shared/WaveformAnimation';
import { audioSystem } from '@/utils/audioSystem';

// Import Main Screen Components
import LobbyDisplay from '@/components/mainscreen/LobbyDisplay';
import JudgeSelectionDisplay from '@/components/mainscreen/JudgeSelectionDisplay';
import PromptSelectionDisplay from '@/components/mainscreen/PromptSelectionDisplay';
import SoundSelectionDisplay from '@/components/mainscreen/SoundSelectionDisplay';
import { PlaybackSubmissionsDisplay } from '@/components/mainscreen/PlaybackSubmissionsDisplay';
import { JudgingDisplay } from '@/components/mainscreen/JudgingDisplay';
import { ResultsDisplay } from '@/components/mainscreen/ResultsDisplay';
import GameOverDisplay from '@/components/mainscreen/GameOverDisplay';
import { WaitingForGameScreen } from '@/components/mainscreen/WaitingForGameScreen';

// Import client/player components directly from game page
import ClientLobbyComponent from '@/components/client/ClientLobby';
import ClientJudgeSelectionComponent from '@/components/client/ClientJudgeSelection';
import ClientPromptSelectionComponent from '@/components/client/ClientPromptSelection';
import ClientSoundSelectionComponent from '@/components/client/ClientSoundSelection';
import ClientJudgingComponent from '@/components/client/ClientJudging';
import ClientResultsComponent from '@/components/client/ClientResults';
import ClientGameOverComponent from '@/components/client/ClientGameOver';
import ClientPausedForDisconnectionComponent from '@/components/client/ClientPausedForDisconnection';


// Mock Data
const mockPlayers: Player[] = [
  { id: 'player1', name: 'Alice', color: '#FF6B6B', emoji: '😂', score: 1, isVIP: true, isDisconnected: false },
  { id: 'player2', name: 'Bob', color: '#4ECDC4', emoji: '🎵', score: 2, isVIP: false, isDisconnected: false },
  { id: 'player3', name: 'Charlie', color: '#45B7D1', emoji: '🤪', score: 0, isVIP: false, isDisconnected: false },
  { id: 'player4', name: 'Diana', color: '#96CEB4', emoji: '🎸', score: 3, isVIP: false, isDisconnected: false },
];

const mockPlayerView = mockPlayers[1]; // Bob's view (non-VIP, non-judge)
const mockJudgeView = mockPlayers[0]; // Alice's view (VIP, judge)

// Fallback mock data in case real data fails to load
const fallbackSoundEffects: SoundEffect[] = [
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

const fallbackPrompts: GamePrompt[] = [
  { id: 'p1', text: 'The sound of a robot trying to love.', category: 'Modern Life' },
  { id: 'p2', text: 'What a cat really thinks about you.', category: 'Animals' },
  { id: 'p3', text: 'The noise that finally breaks the internet.', category: 'Absurd' },
  { id: 'p4', text: 'Your morning routine but make it dramatic.', category: 'Daily Life' },
  { id: 'p5', text: 'The secret language of houseplants.', category: 'Nature' },
  { id: 'p6', text: 'What happens when WiFi gets jealous.', category: 'Technology' },
];

// Default submissions using fallback sound IDs
const mockSubmissions: SoundSubmission[] = [
  { playerId: 'player2', playerName: 'Bob', sounds: ['sound1', 'sound3'] },
  { playerId: 'player3', playerName: 'Charlie', sounds: ['sound2', 'sound4'] },
  { playerId: 'player4', playerName: 'Diana', sounds: ['sound5', 'sound6'] },
];

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
  
  // State for real game data
  const [realSoundEffects, setRealSoundEffects] = useState<SoundEffect[]>([]);
  const [realPrompts, setRealPrompts] = useState<GamePrompt[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [useRealData, setUseRealData] = useState(true);

  // Get currently used data (real or fallback)
  const mockSoundEffects = useRealData && realSoundEffects.length > 0 ? realSoundEffects.slice(0, 10) : fallbackSoundEffects;
  const mockAvailablePrompts = useRealData && realPrompts.length > 0 ? realPrompts.slice(0, 6) : fallbackPrompts;

  // Load real game data on component mount
  useEffect(() => {
    const loadGameData = async () => {
      setIsLoadingData(true);
      try {
        console.log('🎮 Debug Page: Loading real game data...');
        
        // Load real sound effects and prompts
        const [sounds, prompts] = await Promise.all([
          getSoundEffects(),
          getGamePrompts(['Alice', 'Bob', 'Charlie', 'Diana']) // Process prompts with player names
        ]);
        
        console.log(`🎮 Debug Page: Loaded ${sounds.length} sound effects and ${prompts.length} prompts`);
        
        setRealSoundEffects(sounds);
        setRealPrompts(prompts);
        
        // Update selected sounds to use real sound IDs if available
        if (sounds.length >= 2) {
          setSelectedSounds([sounds[0].id, sounds[1].id]);
        }
      } catch (error) {
        console.error('🎮 Debug Page: Failed to load real game data:', error);
        // Will fall back to mock data
      } finally {
        setIsLoadingData(false);
      }
    };

    loadGameData();
  }, []);

  const baseMockRoom: Omit<Room, 'gameState'> = {
    code: 'DBUG',
    players: mockPlayers,
    currentJudge: 'player1',
    currentPrompt: mockAvailablePrompts.length > 0 ? mockAvailablePrompts[0] : fallbackPrompts[0],
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
    allowExplicitContent: false
  };

  // Update submissions to use real sound IDs when available
  const mockSubmissionsWithRealSounds: SoundSubmission[] = [
    { playerId: 'player2', playerName: 'Bob', sounds: mockSoundEffects.length >= 4 ? [mockSoundEffects[0].id, mockSoundEffects[2].id] : ['sound1', 'sound3'] },
    { playerId: 'player3', playerName: 'Charlie', sounds: mockSoundEffects.length >= 4 ? [mockSoundEffects[1].id, mockSoundEffects[3].id] : ['sound2', 'sound4'] },
    { playerId: 'player4', playerName: 'Diana', sounds: mockSoundEffects.length >= 6 ? [mockSoundEffects[4].id, mockSoundEffects[5].id] : ['sound5', 'sound6'] },
  ];

  const mockRoundWinner = {
    winnerId: 'player2',
    winnerName: 'Bob',
    winningSubmission: mockSubmissionsWithRealSounds[0],
    submissionIndex: 0,
  };

  const getMockRoomForState = (state: GameState | 'WAITING'): Room => {
    switch (state) {
      case GameState.LOBBY:
        return { ...baseMockRoom, gameState: GameState.LOBBY, currentJudge: null, currentPrompt: null, submissions: [] };
      case GameState.JUDGE_SELECTION:
        return { ...baseMockRoom, gameState: GameState.JUDGE_SELECTION, currentPrompt: null, submissions: [] };
      case GameState.PROMPT_SELECTION:
        return { ...baseMockRoom, gameState: GameState.PROMPT_SELECTION, currentPrompt: null, submissions: [] };
      case GameState.SOUND_SELECTION:
        return { ...baseMockRoom, gameState: GameState.SOUND_SELECTION, submissions: mockSubmissionsWithRealSounds.slice(0, 1) };
      case GameState.PLAYBACK:
        return { ...baseMockRoom, gameState: GameState.PLAYBACK, submissions: mockSubmissionsWithRealSounds, currentSubmissionIndex: 1 };
      case GameState.JUDGING:
        return { ...baseMockRoom, gameState: GameState.JUDGING, submissions: mockSubmissionsWithRealSounds, randomizedSubmissions: mockSubmissionsWithRealSounds };
      case GameState.ROUND_RESULTS:
        return { ...baseMockRoom, gameState: GameState.ROUND_RESULTS, submissions: mockSubmissionsWithRealSounds };
      case GameState.GAME_OVER:
        return { ...baseMockRoom, gameState: GameState.GAME_OVER, submissions: mockSubmissionsWithRealSounds, winner: 'player4' };
      case GameState.PAUSED_FOR_DISCONNECTION:
        return { 
          ...baseMockRoom, 
          gameState: GameState.PAUSED_FOR_DISCONNECTION, 
          submissions: mockSubmissionsWithRealSounds,
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

  // Create a more sophisticated mock socket for playback testing
  const createMockSocket = () => {
    const eventHandlers: { [key: string]: Function[] } = {};
    let currentSubmissionIndex = 0;
    let isPlaybackActive = false;
    
    const mockSocket = {
      on: (event: string, handler: Function) => {
        if (!eventHandlers[event]) {
          eventHandlers[event] = [];
        }
        eventHandlers[event].push(handler);
        console.log(`🔌 Mock Socket: Registered handler for event: ${event}`);
      },
      off: (event: string, handler: Function) => {
        if (eventHandlers[event]) {
          eventHandlers[event] = eventHandlers[event].filter(h => h !== handler);
          console.log(`🔌 Mock Socket: Removed handler for event: ${event}`);
        }
      },
      emit: (event: string, ...args: any[]) => {
        console.log(`🔌 Mock Socket: Emitting event: ${event}`, args);
        
        if (event === 'requestNextSubmission') {
          // If this is the first request, reset the index
          if (!isPlaybackActive) {
            currentSubmissionIndex = 0;
            isPlaybackActive = true;
            console.log(`🔌 Mock Socket: Starting new playback cycle`);
          }
          
          // Simulate server response with next submission
          setTimeout(() => {
            const submissions = mockSubmissionsWithRealSounds;
            console.log(`🔌 Mock Socket: Processing request for submission ${currentSubmissionIndex + 1}/${submissions.length}`);
            
            if (currentSubmissionIndex < submissions.length) {
              const submission = submissions[currentSubmissionIndex];
              console.log(`🔌 Mock Socket: 🎵 Sending submission ${currentSubmissionIndex + 1}/${submissions.length} (${submission.playerName}):`, submission);
              console.log(`🎵 Playing sounds: ${submission.sounds.map(soundId => {
                const sound = mockSoundEffects.find(s => s.id === soundId);
                return sound ? sound.name : soundId;
              }).join(' + ')}`);
              
              // Trigger playSubmission event
              if (eventHandlers['playSubmission']) {
                eventHandlers['playSubmission'].forEach(handler => {
                  handler(submission, currentSubmissionIndex);
                });
              }
              currentSubmissionIndex++;
            } else {
              console.log('🔌 Mock Socket: ✅ All submissions played, sending null to indicate completion');
              // Send null submission to indicate playback is complete
              if (eventHandlers['playSubmission']) {
                eventHandlers['playSubmission'].forEach(handler => {
                  handler(null); // Null indicates end of playback
                });
              }
              // Reset state for next playback cycle
              currentSubmissionIndex = 0;
              isPlaybackActive = false;
              console.log('🔌 Mock Socket: Playback cycle complete, ready for next cycle');
            }
          }, 300); // Slightly faster response for better debug experience
        }
      },
      disconnect: () => {
        console.log('🔌 Mock Socket: Disconnect called');
        isPlaybackActive = false;
        currentSubmissionIndex = 0;
      },
      connect: () => {
        console.log('🔌 Mock Socket: Connect called');
      },
      connected: true
    };
    
    return mockSocket;
  };

  const renderMainScreenView = () => {
    switch (view) {
      case 'WAITING':
        return <WaitingForGameScreen onJoinRoom={() => {}} roomCodeInput="" setRoomCodeInput={() => {}} joinError="" />;
      case GameState.LOBBY:
        return <LobbyDisplay room={mockRoom} />;
      case GameState.JUDGE_SELECTION:
        return <JudgeSelectionDisplay room={mockRoom} />;
      case GameState.PROMPT_SELECTION:
        return <PromptSelectionDisplay room={mockRoom} socket={null} />;
      case GameState.SOUND_SELECTION:
        return <SoundSelectionDisplay room={mockRoom} socket={null} />;
      case GameState.PLAYBACK:
        return <PlaybackSubmissionsDisplay room={mockRoom} soundEffects={mockSoundEffects} socket={createMockSocket() as any} />;
      case GameState.JUDGING:
        return <JudgingDisplay room={mockRoom} soundEffects={mockSoundEffects} currentPlayingSubmission={null} />;
      case GameState.ROUND_RESULTS:
        return <ResultsDisplay room={mockRoom} roundWinner={mockRoundWinner} soundEffects={mockSoundEffects} socket={null} />;
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
          <ClientLobbyComponent 
            room={mockRoom} 
            player={currentPlayer} 
            onStartGame={() => console.log('Start game')}
            onUpdateGameSetting={(setting, value) => console.log('Update setting:', setting, value)}
          />
        );
      case GameState.JUDGE_SELECTION:
        return <ClientJudgeSelectionComponent room={mockRoom} player={currentPlayer} />;
      case GameState.PROMPT_SELECTION:
        return (
          <ClientPromptSelectionComponent 
            room={mockRoom} 
            player={currentPlayer} 
            onSelectPrompt={(id) => console.log('Select prompt:', id)} 
          />
        );
      case GameState.SOUND_SELECTION:
        return (
          <ClientSoundSelectionComponent 
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
          <ClientJudgingComponent 
            room={mockRoom} 
            player={currentPlayer} 
            onJudgeSubmission={(index) => console.log('Judge submission:', index)}
            soundEffects={mockSoundEffects}
            socket={createMockSocket() as any}
            playSoundCombinationWithFeedback={async (sounds: string[], buttonId: string) => {
              console.log('🔊 Debug: Playing sound combination:', sounds, 'for button:', buttonId);
              // Mock implementation for debug - just log the sounds being played
              const soundNames = sounds.map(soundId => {
                const sound = mockSoundEffects.find(s => s.id === soundId);
                return sound ? sound.name : soundId;
              }).join(' + ');
              console.log(`🎵 Mock playing: ${soundNames}`);
              return Promise.resolve();
            }}
          />
        );
      case GameState.ROUND_RESULTS:
        return <ClientResultsComponent room={mockRoom} player={currentPlayer} roundWinner={mockRoundWinner} soundEffects={mockSoundEffects} />;
      case GameState.GAME_OVER:
        return <ClientGameOverComponent room={mockRoom} player={currentPlayer} />;
      case GameState.PAUSED_FOR_DISCONNECTION:
        return (
          <ClientPausedForDisconnectionComponent 
            room={mockRoom} 
            player={currentPlayer} 
            onAttemptReconnection={() => console.log('Attempt reconnection')}
          />
        );
      default:
        return <div>Select a view</div>;
    }
  };

  // Audio Test Component for debugging our new waveform
  function AudioTestComponent() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [availableSounds, setAvailableSounds] = useState<SoundEffect[]>([]);

    useEffect(() => {
      // Load some sounds for testing
      getSoundEffects().then(sounds => {
        setAvailableSounds(sounds.slice(0, 5)); // Just get first 5 for testing
      });
    }, []);

    const playTestSound = async () => {
      if (availableSounds.length === 0) return;
      
      setIsPlaying(true);
      try {
        await audioSystem.initialize();
        const randomSound = availableSounds[Math.floor(Math.random() * availableSounds.length)];
        await audioSystem.playSound(randomSound.id);
      } catch (error) {
        console.error('Error playing sound:', error);
      } finally {
        setIsPlaying(false);
      }
    };

    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-white text-xl mb-4">🎵 Audio Waveform Test</h3>
        <button 
          onClick={playTestSound}
          disabled={isPlaying || availableSounds.length === 0}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white px-4 py-2 rounded mb-4"
        >
          {isPlaying ? 'Playing...' : 'Play Random Sound'}
        </button>
        <p className="text-gray-300 mb-4">Watch the waveform react to real audio frequency data!</p>
        
        {/* Different sizes of our new waveform */}
        <div className="space-y-4">
          <div>
            <p className="text-white text-sm mb-2">Small Waveform:</p>
            <WaveformAnimation isPlaying={isPlaying} size="sm" color="bg-green-400" />
          </div>
          <div>
            <p className="text-white text-sm mb-2">Medium Waveform:</p>
            <WaveformAnimation isPlaying={isPlaying} size="md" color="bg-blue-400" />
          </div>
          <div>
            <p className="text-white text-sm mb-2">Large Waveform:</p>
            <WaveformAnimation isPlaying={isPlaying} size="lg" color="bg-purple-400" />
          </div>
        </div>
      </div>
    );
  }

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
        
        {/* Data Source Selection */}
        <div className="mt-3">
          <h3 className="text-lg mb-2">Data Source</h3>
          <div className="flex gap-2 items-center">
            <button 
              onClick={() => setUseRealData(true)} 
              className={`px-3 py-1 rounded text-sm ${useRealData ? 'bg-blue-500' : 'bg-gray-600'}`}
            >
              🎵 Real Game Data
            </button>
            <button 
              onClick={() => setUseRealData(false)} 
              className={`px-3 py-1 rounded text-sm ${!useRealData ? 'bg-orange-500' : 'bg-gray-600'}`}
            >
              🧪 Fallback Mock Data
            </button>
            {isLoadingData && <span className="text-yellow-400 text-sm">⏳ Loading...</span>}
            {useRealData && realSoundEffects.length > 0 && (
              <span className="text-green-400 text-sm">
                ✅ {realSoundEffects.length} sounds, {realPrompts.length} prompts
              </span>
            )}
          </div>
        </div>
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
          <div>
            <span className="text-gray-400">Data Source:</span>
            <span className="ml-2 text-indigo-400">{useRealData ? 'Real' : 'Mock'}</span>
          </div>
          <div>
            <span className="text-gray-400">Sounds:</span>
            <span className="ml-2 text-teal-400">{mockSoundEffects.length}</span>
          </div>
          <div>
            <span className="text-gray-400">Prompts:</span>
            <span className="ml-2 text-emerald-400">{mockAvailablePrompts.length}</span>
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

      {/* Audio Test Section */}
      <AudioTestComponent />

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
            <h3 className="text-white font-medium mb-1">Real vs Mock Data:</h3>
            <p>Toggle between real game data loaded from EarwaxAudio.jet and EarwaxPrompts.jet files, or fallback mock data for testing when real data isn't available.</p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">Interactive Controls:</h3>
            <p>Some states (like Sound Selection) include debug controls to simulate timer changes and player actions. Real data provides authentic sound names and prompts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
