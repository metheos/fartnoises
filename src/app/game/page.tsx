'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Player, Room, GameState } from '@/types/game';
import { SOUND_EFFECTS } from '@/data/gameData';
import { audioSystem } from '@/utils/audioSystem';

let socket: Socket;

// Helper function to convert hex colors to Tailwind classes
const getPlayerColorClass = (color: string): string => {
  const colorMap: { [key: string]: string } = {
    '#ef4444': 'bg-red-500',
    '#f97316': 'bg-orange-500',
    '#eab308': 'bg-yellow-500',
    '#22c55e': 'bg-green-500',
    '#3b82f6': 'bg-blue-500',
    '#8b5cf6': 'bg-violet-500',
    '#ec4899': 'bg-pink-500',
    '#06b6d4': 'bg-cyan-500',
  };
  return colorMap[color] || 'bg-gray-500';
};

function GamePageContent() {
  const [room, setRoom] = useState<Room | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [selectedSounds, setSelectedSounds] = useState<[string, string] | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev.slice(-10), `[${timestamp}] ${message}`]);
  };
  
  const mode = searchParams?.get('mode');
  const playerName = searchParams?.get('name');
  const roomCode = searchParams?.get('room');  useEffect(() => {
    if (!playerName) {
      router.push('/');
      return;
    }

    // Initialize audio system
    const initAudio = async () => {
      try {
        await audioSystem.initialize();
        
        // Preload some common sounds
        for (const sound of SOUND_EFFECTS.slice(0, 10)) {
          await audioSystem.loadSound(sound.id, sound.fileName);
        }
      } catch (error) {
        console.warn('Audio initialization failed:', error);
        // Continue without audio
      }
    };

    initAudio();    // Initialize socket connection
    socket = io({
      path: '/api/socket',
      transports: ['polling', 'websocket'],
    });    socket.on('connect', () => {
      console.log('Socket connected successfully!', socket.id);
      addDebugLog(`Socket connected: ${socket.id}`);
      setIsConnected(true);
      
      if (mode === 'create') {
        console.log('Emitting createRoom with playerName:', playerName);
        addDebugLog(`Emitting createRoom with player: ${playerName}`);
        socket.emit('createRoom', playerName, (roomCode: string) => {
          // Room created successfully with the returned room code
          console.log('Room created callback received:', roomCode);
          addDebugLog(`CreateRoom callback received: ${roomCode}`);
        });
      } else if (mode === 'join' && roomCode) {
        console.log('Emitting joinRoom with roomCode:', roomCode, 'playerName:', playerName);
        addDebugLog(`Emitting joinRoom: ${roomCode}, player: ${playerName}`);
        socket.emit('joinRoom', roomCode, playerName, (success: boolean) => {
          if (!success) {
            setError('Failed to join room. Room may be full or not exist.');
            addDebugLog('JoinRoom failed');
          } else {
            addDebugLog('JoinRoom successful');
          }
        });
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setError(`Connection failed: ${error.message}`);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });    socket.on('roomCreated', ({ room, player }) => {
      console.log('roomCreated event received:', { room, player });
      addDebugLog(`roomCreated event received for room: ${room?.code}`);
      setRoom(room);
      setPlayer(player);
    });

    socket.on('roomJoined', ({ room, player }) => {
      console.log('roomJoined event received:', { room, player });
      setRoom(room);
      setPlayer(player);
    });

    socket.on('roomUpdated', (updatedRoom) => {
      setRoom(updatedRoom);
    });

    socket.on('playerJoined', ({ room }) => {
      setRoom(room);
    });

    socket.on('gameStateChanged', ({ room }) => {
      setRoom(room);
    });    socket.on('error', ({ message }) => {
      addDebugLog(`Error event: ${message}`);
      setError(message);
    });

    socket.on('timeUpdate', ({ timeLeft }) => {
      setTimeLeft(timeLeft);
    });

    return () => {
      socket.disconnect();
    };
  }, [mode, playerName, roomCode, router]);

  const startGame = () => {
    if (socket && room) {
      socket.emit('startGame', { roomCode: room.code });
    }
  };

  const selectSounds = (sound1: string, sound2: string) => {
    setSelectedSounds([sound1, sound2]);
  };

  const submitSounds = () => {
    if (socket && room && selectedSounds) {
      socket.emit('submitSounds', {
        roomCode: room.code,
        sounds: selectedSounds
      });
      setSelectedSounds(null);
    }
  };

  const selectPrompt = (promptId: string) => {
    if (socket && room) {
      socket.emit('selectPrompt', {
        roomCode: room.code,
        promptId
      });
    }
  };

  const judgeSubmission = (submissionIndex: number) => {
    if (socket && room) {
      socket.emit('judgeSubmission', {
        roomCode: room.code,
        winnerIndex: submissionIndex
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 text-center">
          <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Connecting to game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-400 via-pink-500 to-orange-400 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 text-center max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Oops!</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-purple-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }  if (!room || !player) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 text-center max-w-lg w-full">
          <div className="animate-pulse w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Setting up your game...</p>
          <div className="mt-4 text-sm text-left">
            <p>Socket Connected: {isConnected ? '✅' : '❌'}</p>
            <p>Mode: {mode}</p>
            <p>Player Name: {playerName}</p>
            <p>Room: {room ? 'Found' : 'None'}</p>
            <p>Player: {player ? 'Found' : 'None'}</p>
            {error && <p className="text-red-500">Error: {error}</p>}
            {debugLog.length > 0 && (
              <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
                <p className="font-bold mb-2">Debug Log:</p>
                {debugLog.map((log, index) => (
                  <p key={index} className="text-gray-600">{log}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 mb-6 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-black text-gray-800">fartnoises</h1>
              <p className="text-gray-600">Room: <span className="font-mono font-bold">{room.code}</span></p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Round {room.currentRound}/{room.maxRounds}</p>
              <p className="text-lg font-bold text-purple-600">{player.name}</p>
              <p className="text-sm text-gray-600">Score: {player.score}</p>
            </div>
          </div>
        </div>

        {/* Game State Components */}
        {room.gameState === GameState.LOBBY && (
          <LobbyComponent 
            room={room} 
            player={player} 
            onStartGame={startGame} 
          />
        )}

        {room.gameState === GameState.PROMPT_SELECTION && (
          <PromptSelectionComponent 
            room={room} 
            player={player} 
            onSelectPrompt={selectPrompt} 
          />
        )}

        {room.gameState === GameState.SOUND_SELECTION && (
          <SoundSelectionComponent 
            room={room} 
            player={player} 
            selectedSounds={selectedSounds}
            onSelectSounds={selectSounds}
            onSubmitSounds={submitSounds}
            timeLeft={timeLeft}
          />
        )}

        {room.gameState === GameState.JUDGING && (
          <JudgingComponent 
            room={room} 
            player={player} 
            onJudgeSubmission={judgeSubmission} 
          />
        )}

        {room.gameState === GameState.ROUND_RESULTS && (
          <ResultsComponent room={room} player={player} />
        )}

        {room.gameState === GameState.GAME_OVER && (
          <GameOverComponent room={room} player={player} />
        )}
      </div>
    </div>
  );
}

// Component implementations will follow...
function LobbyComponent({ room, player, onStartGame }: { 
  room: Room; 
  player: Player; 
  onStartGame: () => void; 
}) {
  const canStart = room.players.length >= 3 && player.isVIP;

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6">Waiting for Players</h2>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
        {room.players.map((p) => (
          <div 
            key={p.id} 
            className={`p-4 rounded-xl text-center ${p.isVIP ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-100'}`}
          >            <div 
              className={`w-12 h-12 rounded-full mx-auto mb-2 ${getPlayerColorClass(p.color)}`}
            ></div>
            <p className="font-bold text-sm">{p.name}</p>
            {p.isVIP && <p className="text-xs text-yellow-600">Host</p>}
          </div>
        ))}
      </div>

      <div className="text-center">
        <p className="text-gray-600 mb-4">
          {room.players.length}/8 players • Need at least 3 to start
        </p>
        
        {canStart && (
          <button
            onClick={onStartGame}
            className="bg-green-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-600 transition-colors"
          >
            🎮 Start Game!
          </button>
        )}
        
        {!canStart && player.isVIP && (
          <p className="text-yellow-600 font-bold">Need at least 3 players to start</p>
        )}
        
        {!player.isVIP && (
          <p className="text-gray-600">Waiting for host to start the game...</p>
        )}
      </div>
    </div>
  );
}

function PromptSelectionComponent({ room, player, onSelectPrompt }: {
  room: Room;
  player: Player;
  onSelectPrompt: (promptId: string) => void;
}) {
  const isJudge = room.currentJudge === player.id;

  if (!isJudge) {    return (
      <div className="bg-white rounded-3xl p-8 text-center shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Judge is Selecting Prompt</h2>
        <div className="animate-pulse w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">
          {room.players.find(p => p.id === room.currentJudge)?.name} is choosing a weird prompt...
        </p>
      </div>
    );
  }

  // Mock prompts for now - in real implementation, get from server
  const mockPrompts = [
    "The sound of someone trying to explain TikTok to their grandparents",
    "A robot learning to sneeze",
    "The noise your WiFi makes when it's having an existential crisis"
  ];

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6">👨‍⚖️ You&apos;re the Judge!</h2>
      <p className="text-center text-gray-600 mb-8">Pick the weirdest prompt for other players:</p>
      
      <div className="space-y-4">
        {mockPrompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => onSelectPrompt(`prompt-${index}`)}
            className="w-full p-6 bg-gradient-to-r from-blue-400 to-purple-500 text-white rounded-xl font-bold text-lg hover:from-blue-500 hover:to-purple-600 transition-all duration-200 transform hover:scale-105"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function SoundSelectionComponent({ room, player, selectedSounds, onSelectSounds, onSubmitSounds, timeLeft }: {
  room: Room;
  player: Player;
  selectedSounds: [string, string] | null;
  onSelectSounds: (sound1: string, sound2: string) => void;
  onSubmitSounds: () => void;
  timeLeft: number;
}) {
  const isJudge = room.currentJudge === player.id;
  const [firstSound, setFirstSound] = useState<string>('');
  const [secondSound, setSecondSound] = useState<string>('');
  const [playingSound, setPlayingSound] = useState<string>('');

  if (isJudge) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Waiting for Submissions</h2>          <p className="text-gray-600 mb-4">
            Players are selecting sounds for: <br />
            <span className="font-bold text-lg">&quot;{room.currentPrompt}&quot;</span>
          </p>
        <div className="text-3xl font-bold text-purple-600">{timeLeft}s</div>
      </div>
    );
  }
  const handleSoundSelect = (soundId: string) => {
    if (!firstSound) {
      setFirstSound(soundId);
    } else if (!secondSound && soundId !== firstSound) {
      setSecondSound(soundId);
      onSelectSounds(firstSound, soundId);
    } else if (soundId === firstSound) {
      setFirstSound('');
      setSecondSound('');
    } else if (soundId === secondSound) {
      setSecondSound('');
    }
  };

  const handleSoundPreview = async (soundId: string) => {
    const sound = SOUND_EFFECTS.find(s => s.id === soundId);
    if (!sound) return;

    // Load sound if not already loaded
    await audioSystem.loadSound(soundId, sound.fileName);
    
    // Play with visual feedback
    await audioSystem.previewSound(
      soundId,
      () => setPlayingSound(soundId),
      () => setPlayingSound('')
    );
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Pick 2 Sounds!</h2>        <p className="text-gray-600 mb-4">
          Prompt: <span className="font-bold">&quot;{room.currentPrompt}&quot;</span>
        </p>
        <div className="text-xl font-bold text-purple-600 mb-4">⏰ {timeLeft}s</div>
        
        <div className="flex justify-center space-x-4 mb-6">
          <div className={`w-20 h-20 rounded-xl flex items-center justify-center ${firstSound ? 'bg-green-200 border-2 border-green-400' : 'bg-gray-100 border-2 border-dashed border-gray-300'}`}>
            {firstSound ? '🔊' : '1'}
          </div>
          <div className={`w-20 h-20 rounded-xl flex items-center justify-center ${secondSound ? 'bg-green-200 border-2 border-green-400' : 'bg-gray-100 border-2 border-dashed border-gray-300'}`}>
            {secondSound ? '🔊' : '2'}
          </div>
        </div>
      </div>      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {SOUND_EFFECTS.map((sound) => (
          <div key={sound.id} className="bg-gray-50 rounded-xl p-3">
            <button
              onClick={() => handleSoundSelect(sound.id)}
              className={`w-full p-3 rounded-lg text-sm font-bold transition-all duration-200 mb-2 ${
                firstSound === sound.id || secondSound === sound.id
                  ? 'bg-green-500 text-white scale-105'
                  : 'bg-white hover:bg-gray-100 text-gray-700 border-2 border-gray-200'
              }`}
            >
              {sound.name}
            </button>
            <button
              onClick={() => handleSoundPreview(sound.id)}
              disabled={playingSound === sound.id}
              className={`w-full text-xs py-1 px-2 rounded transition-colors ${
                playingSound === sound.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
              }`}
            >
              {playingSound === sound.id ? '🔊 Playing...' : '▶️ Preview'}
            </button>
          </div>
        ))}
      </div>

      {selectedSounds && (
        <div className="text-center">
          <button
            onClick={onSubmitSounds}
            className="bg-purple-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-purple-600 transition-colors"
          >
            Submit My Sounds! 🎵
          </button>
        </div>
      )}
    </div>
  );
}

function JudgingComponent({ room, player, onJudgeSubmission }: {
  room: Room;
  player: Player;
  onJudgeSubmission: (index: number) => void;
}) {
  const isJudge = room.currentJudge === player.id;
  const [playingSubmission, setPlayingSubmission] = useState<number>(-1);

  const handlePlaySubmission = async (submission: { sounds: string[] }, index: number) => {
    if (playingSubmission === index) return;
    
    setPlayingSubmission(index);
    
    try {
      // Load and play the sounds in sequence
      for (const soundId of submission.sounds) {
        const sound = SOUND_EFFECTS.find(s => s.id === soundId);
        if (sound) {
          await audioSystem.loadSound(soundId, sound.fileName);
        }
      }
      
      await audioSystem.playSoundSequence(submission.sounds, 300);
    } catch (error) {
      console.error('Error playing submission:', error);
    } finally {
      setPlayingSubmission(-1);
    }
  };

  if (!isJudge) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Judge is Deciding...</h2>
        <p className="text-gray-600">
          {room.players.find(p => p.id === room.currentJudge)?.name} is listening to all the sound combinations!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6">👨‍⚖️ Time to Judge!</h2>      <p className="text-center text-gray-600 mb-8">
        Prompt: <span className="font-bold">&quot;{room.currentPrompt}&quot;</span>
      </p>

      <div className="space-y-4">
        {room.submissions.map((submission, index) => (
          <div key={index} className="border-2 border-gray-200 rounded-xl p-6">            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Submission {index + 1}</h3>
              <button 
                onClick={() => handlePlaySubmission(submission, index)}
                disabled={playingSubmission === index}
                className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                  playingSubmission === index
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {playingSubmission === index ? '🔊 Playing...' : '▶️ Play'}
              </button>
            </div>
            <div className="flex space-x-2 mb-4">
              {submission.sounds.map((soundId, soundIndex) => {
                const sound = SOUND_EFFECTS.find(s => s.id === soundId);
                return (
                  <span key={soundIndex} className="bg-gray-100 px-3 py-1 rounded-lg text-sm">
                    {sound?.name}
                  </span>
                );
              })}
            </div>
            <button
              onClick={() => onJudgeSubmission(index)}
              className="w-full bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600 transition-colors"
            >
              🏆 This One Wins!
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsComponent({ room }: { room: Room; player: Player }) {
  return (
    <div className="bg-white rounded-3xl p-8 text-center shadow-lg">
      <h2 className="text-2xl font-bold mb-6">🎉 Round Results!</h2>
      {/* Results implementation */}
      <p className="text-gray-600 mb-6">Round {room.currentRound} complete!</p>
      <div className="animate-pulse w-16 h-16 bg-green-200 rounded-full mx-auto mb-4"></div>
      <p>Next round starting soon...</p>
    </div>
  );
}

function GameOverComponent({ room }: { room: Room; player: Player }) {
  return (
    <div className="bg-white rounded-3xl p-8 text-center shadow-lg">
      <h2 className="text-3xl font-bold mb-6">🎊 Game Over!</h2>
      <p className="text-xl mb-6">Final Scores:</p>
      <div className="space-y-2 mb-8">
        {room.players
          .sort((a, b) => b.score - a.score)
          .map((p, index) => (
            <div key={p.id} className={`p-4 rounded-xl ${index === 0 ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-100'}`}>
              <span className="font-bold">{index + 1}. {p.name}</span>
              <span className="float-right font-bold">{p.score} points</span>
            </div>
          ))}
      </div>      <button
        onClick={() => window.location.href = '/'}
        className="bg-purple-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-purple-600 transition-colors"
      >
        Play Again!
      </button>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 text-center">
          <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading game...</p>
        </div>
      </div>
    }>
      <GamePageContent />
    </Suspense>
  );
}
