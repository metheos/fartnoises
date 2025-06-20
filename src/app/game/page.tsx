'use client';

import { useState, useEffect, Suspense, useRef, useMemo } from 'react'; // Added useMemo
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Player, Room, GameState, SoundEffect } from '@/types/game';
import { getSoundEffects } from '@/data/gameData';
import { audioSystem } from '@/utils/audioSystem';

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
  const [soundEffects, setSoundEffects] = useState<SoundEffect[]>([]);
  const [roundWinner, setRoundWinner] = useState<{
    winnerId: string;
    winnerName: string;
    winningSubmission: any;
    submissionIndex: number;
  } | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();

  const socketRef = useRef<Socket | null>(null);
  const hasAttemptedConnectionLogic = useRef(false);

  // Stabilize the URL parameters using useMemo to prevent effect re-runs
  const stableParams = useMemo(() => {
    const mode = searchParams?.get('mode');
    const playerName = searchParams?.get('playerName') || searchParams?.get('name');
    const roomCode = searchParams?.get('roomCode') || searchParams?.get('room');
    return { mode, playerName, roomCode };
  }, [searchParams]);

  const { mode, playerName, roomCode } = stableParams;
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev.slice(-10), `[${timestamp}] ${message}`]);
  };

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
  }, []);

  // Handle redirection in a separate effect to avoid dependency issues
  useEffect(() => {
    if (!playerName) {
      addDebugLog('No playerName, redirecting to home.');
      router.push('/');
    }
  }, [playerName, router]);

  useEffect(() => {
    addDebugLog(`Main effect run. Mode: ${mode}, PlayerName: ${playerName}, RoomCode: ${roomCode}, Socket Exists: ${!!socketRef.current}, Attempted Logic: ${hasAttemptedConnectionLogic.current}, InRoom: ${!!room}`);

    if (!playerName) {
      // addDebugLog('No playerName, redirecting to home.'); // Moved to separate effect
      // router.push('/'); // Moved to separate effect
      return;
    }

    // Initialize socket only if it doesn't exist or if critical params change
    // For simplicity, this example creates it if null. More complex logic could go here
    // if changing mode/playerName/roomCode should force a new socket.
    if (!socketRef.current) {
      addDebugLog('No socket instance in ref, creating new one.');
      const newSocket = io({
        path: '/api/socket',
        transports: ['polling', 'websocket'],
        // Consider adding forceNew: true if re-connection with new params is needed,
        // but this usually means the old one should be explicitly disconnected.
      });
      socketRef.current = newSocket;
      hasAttemptedConnectionLogic.current = false; // Reset for new socket instance
      addDebugLog(`New socket instance created: ${newSocket.id}`);
    }    const currentSocket = socketRef.current; // Use the stable instance

    const initAudio = async () => {
      try {
        await audioSystem.initialize();
        // Audio system will load sounds dynamically as needed
        addDebugLog('Audio system initialized.');
      } catch (audioError) {
        console.warn('Audio initialization failed:', audioError);
        addDebugLog(`Audio initialization failed: ${audioError}`);
      }
    };
    initAudio(); // Call audio initialization

    // --- Define all event handlers ---
    const handleConnect = () => {
      addDebugLog(`Socket connected: ${currentSocket.id}. Attempted Logic: ${hasAttemptedConnectionLogic.current}, Current room state: ${room ? room.code : 'null'}`);
      setIsConnected(true);

      if (!hasAttemptedConnectionLogic.current && !room) { // Check !room to ensure we are not already in a room from a previous state
        addDebugLog('Attempting connection logic (create/join).');
        hasAttemptedConnectionLogic.current = true; // Mark that we are attempting it

        if (mode === 'create' || mode === 'host') {
          addDebugLog(`Emitting createRoom for player: ${playerName} on socket ${currentSocket.id}`);
          currentSocket.emit('createRoom', playerName, (newRoomCode: string) => {
            addDebugLog(`createRoom callback for ${playerName}, room code: ${newRoomCode}. Waiting for roomCreated event.`);
            // State updates handled by 'roomCreated'
          });
        } else if (mode === 'join' && roomCode) {
          addDebugLog(`Emitting joinRoom for room: ${roomCode}, player: ${playerName} on socket ${currentSocket.id}`);
          currentSocket.emit('joinRoom', roomCode, playerName, (success: boolean, joinedRoomData?: Room) => {
            if (!success) {
              addDebugLog(`joinRoom failed for room: ${roomCode}.`);
              setError('Failed to join room. Room may be full, not exist, or game in progress.');
              hasAttemptedConnectionLogic.current = false; // Allow retry if join failed? Or handle error more gracefully.
            } else {
              addDebugLog(`joinRoom callback successful for room: ${roomCode}. Waiting for roomJoined event.`);
              // State updates handled by 'roomJoined'
            }
          });
        }
      } else {
        addDebugLog(`Socket connected, but connection logic already attempted or in room. Attempted: ${hasAttemptedConnectionLogic.current}, Room: ${room?.code}`);
      }
    };

    const handleConnectError = (err: Error) => {
      addDebugLog(`Socket connection error: ${err.message}`);
      setError(`Connection failed: ${err.message}`);
      setIsConnected(false); // Ensure connection status is false
      hasAttemptedConnectionLogic.current = false; // Allow re-attempt if connection fails before logic runs
    };

    const handleDisconnect = (reason: string) => {
      addDebugLog(`Socket disconnected: ${reason}. Socket ID: ${currentSocket.id}`);
      setIsConnected(false);
      // OLD LOGIC that could cause double emits on quick reconnect before room state is set:
      // if (!room) {
      //     hasAttemptedConnectionLogic.current = false;
      // }
      // NEW LOGIC: Do not reset hasAttemptedConnectionLogic.current here.
      // It should persist for this "session" to prevent re-emitting create/join
      // on temporary disconnects if the initial attempt was already made.
      // It's reset on unmount, connect_error, or new socket instance creation.
    };

    const handleRoomCreated = ({ room: newRoom, player: newPlayer }: { room: Room; player: Player }) => {
      addDebugLog(`roomCreated event for room: ${newRoom?.code}. Player: ${newPlayer?.name}. Socket: ${currentSocket.id}`);
      setRoom(newRoom);
      setPlayer(newPlayer);
      // router.replace(`/game?mode=join&playerName=${playerName}&roomCode=${newRoom.code}`, { scroll: false }); // Update URL
    };

    const handleRoomJoined = ({ room: newRoom, player: newPlayer }: { room: Room; player: Player }) => {
      addDebugLog(`roomJoined event for room: ${newRoom?.code}. Player: ${newPlayer?.name}. Socket: ${currentSocket.id}`);
      setRoom(newRoom);
      setPlayer(newPlayer);
    };

    const handleRoomUpdated = (updatedRoom: Room) => {
      addDebugLog(`roomUpdated event for room: ${updatedRoom?.code}, players: ${updatedRoom?.players?.length}. Socket: ${currentSocket.id}`);
      if (updatedRoom && updatedRoom.code) {
        setRoom(updatedRoom);
        const selfPlayer = updatedRoom.players.find(p => p.id === player?.id || p.id === currentSocket.id);
        if (selfPlayer) setPlayer(selfPlayer);
      } else {
        addDebugLog('roomUpdated: Received invalid room data.');
      }
    };

    const handlePlayerJoined = ({ room: updatedRoom }: { room: Room }) => {
      addDebugLog(`playerJoined event for room: ${updatedRoom?.code}, players: ${updatedRoom?.players?.length}. Socket: ${currentSocket.id}`);
      if (updatedRoom && updatedRoom.code) {
        setRoom(updatedRoom);
      } else {
        addDebugLog('playerJoined: Received invalid room data.');
      }
    };

    const handleGameStateChanged = (state: GameState, data?: any) => {
      addDebugLog(`gameStateChanged event: ${state}, data: ${JSON.stringify(data)}. Socket: ${currentSocket.id}`);
      if (state === GameState.JUDGE_SELECTION) {
        setRoundWinner(null);
      }
      setRoom((currentRoomVal) => {
        if (currentRoomVal) {
          return {
            ...currentRoomVal,
            gameState: state,
            ...(data?.prompts && { availablePrompts: data.prompts }),
            ...(data?.prompt && { currentPrompt: data.prompt }),
            ...(data?.judgeId && { currentJudge: data.judgeId }),
            ...(data?.submissions && { submissions: data.submissions }),
          };
        }
        return currentRoomVal;
      });
    };

    const handlePromptSelected = (promptText: string) => {
      addDebugLog(`promptSelected event: ${promptText}. Socket: ${currentSocket.id}`);
      setRoom((currentRoomVal) => currentRoomVal ? { ...currentRoomVal, currentPrompt: promptText } : null);
    };

    const handleJudgeSelected = (judgeId: string) => {
      addDebugLog(`judgeSelected event: ${judgeId}. Socket: ${currentSocket.id}`);
      setRoom((currentRoomVal) => currentRoomVal ? { ...currentRoomVal, currentJudge: judgeId } : null);
    };

    const handleSoundSubmitted = (submission: {playerId: string, playerName: string, sounds: [string, string]}) => {
      addDebugLog(`soundSubmitted event by ${submission.playerName}. Socket: ${currentSocket.id}`);
      setRoom((currentRoomVal) => {
        if (currentRoomVal) {
          if (currentRoomVal.submissions.find(s => s.playerId === submission.playerId)) {
            return currentRoomVal;
          }
          return {
            ...currentRoomVal,
            submissions: [...currentRoomVal.submissions, submission]
          };
        }
        return currentRoomVal;
      });
    };

    const handleRoundComplete = (winnerData: any) => {
      addDebugLog(`roundComplete event: ${JSON.stringify(winnerData)}. Socket: ${currentSocket.id}`);
      if (typeof winnerData === 'object' && winnerData.winnerId) {
        setRoundWinner(winnerData);
      }
    };

    const handleErrorEvent = ({ message }: { message: string }) => {
      addDebugLog(`Socket error event: ${message}. Socket: ${currentSocket.id}`);
      setError(message);
    };

    const handleTimeUpdate = ({ timeLeft: newTimeLeft }: { timeLeft: number }) => {
      setTimeLeft(newTimeLeft);
    };

    // --- Register event listeners ---
    // Ensure listeners are not duplicated if effect re-runs for other reasons (though deps aim to prevent this)
    // This pattern of defining handlers inside effect and using them is fine.
    addDebugLog(`Registering socket event listeners for socket: ${currentSocket.id}.`);
    currentSocket.on('connect', handleConnect);
    currentSocket.on('connect_error', handleConnectError);
    currentSocket.on('disconnect', handleDisconnect);
    currentSocket.on('roomCreated', handleRoomCreated);
    currentSocket.on('roomJoined', handleRoomJoined);
    currentSocket.on('roomUpdated', handleRoomUpdated);
    currentSocket.on('playerJoined', handlePlayerJoined);
    currentSocket.on('gameStateChanged', handleGameStateChanged);
    currentSocket.on('promptSelected', handlePromptSelected);
    currentSocket.on('judgeSelected', handleJudgeSelected);
    currentSocket.on('soundSubmitted', handleSoundSubmitted);
    currentSocket.on('roundComplete', handleRoundComplete);
    currentSocket.on('error', handleErrorEvent);
    currentSocket.on('timeUpdate', handleTimeUpdate);

    // --- Cleanup for this effect ---
    return () => {
      addDebugLog(`Cleaning up listeners for socket: ${currentSocket.id}. (Effect re-run or unmount preparation)`);
      currentSocket.off('connect', handleConnect);
      currentSocket.off('connect_error', handleConnectError);
      currentSocket.off('disconnect', handleDisconnect);
      currentSocket.off('roomCreated', handleRoomCreated);
      currentSocket.off('roomJoined', handleRoomJoined);
      currentSocket.off('roomUpdated', handleRoomUpdated);
      currentSocket.off('playerJoined', handlePlayerJoined);
      currentSocket.off('gameStateChanged', handleGameStateChanged);
      currentSocket.off('promptSelected', handlePromptSelected);
      currentSocket.off('judgeSelected', handleJudgeSelected);
      currentSocket.off('soundSubmitted', handleSoundSubmitted);
      currentSocket.off('roundComplete', handleRoundComplete);
      currentSocket.off('error', handleErrorEvent);
      currentSocket.off('timeUpdate', handleTimeUpdate);
      // DO NOT disconnect socketRef.current here. That's for the unmount effect.
    };
  }, [mode, playerName, roomCode]); // Removed 'router' from dependencies

  // Effect for actual socket disconnection on component unmount
  useEffect(() => {
    // This function is the cleanup function for the effect.
    // It runs when the component is unmounted.
    return () => {
      if (socketRef.current) {
        addDebugLog(`Component unmounting. Disconnecting socket: ${socketRef.current.id}`);
        socketRef.current.disconnect();
        socketRef.current = null;
        hasAttemptedConnectionLogic.current = false; // Reset for a completely new mount
      }
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  // Monitor room state changes
  useEffect(() => {
    addDebugLog(`Room state changed: ${room ? `${room.code} with ${room.players?.length} players, state: ${room.gameState}` : 'null'}`);
  }, [room]);

  // Monitor player state changes
  useEffect(() => {
    addDebugLog(`Player state changed: ${player ? player.name : 'null'}`);
  }, [player]);

  const startGame = () => {
    if (socketRef.current && room) {
      addDebugLog(`Emitting startGame on socket ${socketRef.current.id}`);
      socketRef.current.emit('startGame');
    }
  };

  const selectSounds = (sound1: string, sound2: string) => {
    setSelectedSounds([sound1, sound2]);
  };

  const submitSounds = () => {
    if (socketRef.current && room && selectedSounds) {
      addDebugLog(`Emitting submitSounds: ${selectedSounds.join(', ')} on socket ${socketRef.current.id}`);
      socketRef.current.emit('submitSounds', selectedSounds);
      setSelectedSounds(null);
    }
  };

  const selectPrompt = (promptId: string) => {
    if (socketRef.current && room) {
      addDebugLog(`Emitting selectPrompt: ${promptId} on socket ${socketRef.current.id}`);
      socketRef.current.emit('selectPrompt', promptId);
    }
  };

  const judgeSubmission = (submissionIndex: number) => {
    if (socketRef.current && room) {
      addDebugLog(`Emitting selectWinner: ${submissionIndex} on socket ${socketRef.current.id}`);
      socketRef.current.emit('selectWinner', submissionIndex.toString());
    }
  };

  if (!isConnected && !error) { // Show connecting screen only if not yet connected and no error
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 text-center">
          <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-800 text-lg">Connecting to game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-400 via-pink-500 to-orange-400 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 text-center max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Oops!</h2>
          <p className="text-gray-800 mb-6">{error}</p>
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
    // Add detailed debugging information
    const debugInfo = {
      hasRoom: !!room,
      hasPlayer: !!player,
      roomCode: room?.code,
      playerName: player?.name,
      mode,
      urlPlayerName: playerName,
      urlRoomCode: roomCode
    };
    
    console.log('Loading screen - Debug Info:', debugInfo);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 text-center max-w-lg w-full">          <div className="animate-pulse w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-800 text-lg">Setting up your game...</p>
          <div className="mt-4 text-sm text-left">
            <p>Socket Connected: {isConnected ? '✅' : '❌'}</p>
            <p>Mode: {mode}</p>
            <p>Player Name: {playerName}</p>
            <p>Room: {room ? `Found (${room.code})` : 'None'}</p>
            <p>Player: {player ? `Found (${player.name})` : 'None'}</p>
            {error && <p className="text-red-500">Error: {error}</p>}
            {debugLog.length > 0 && (
              <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
                <p className="font-bold mb-2 text-gray-900">Debug Log:</p>
                {debugLog.map((log, index) => (
                  <p key={index} className="text-gray-800">{log}</p>
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
          <div className="flex justify-between items-center">            <div>
              <h1 className="text-3xl font-black text-gray-900">fartnoises</h1>
              <p className="text-gray-800">Room: <span className="font-mono font-bold">{room.code}</span></p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-700">Round {room.currentRound}/{room.maxRounds}</p>
              <p className="text-lg font-bold text-purple-600">{player.name}</p>
              <p className="text-sm text-gray-700">Score: {player.score}</p>
            </div>
          </div>        </div>        {/* Debug Info */}
        <div className="bg-white rounded-xl p-4 mb-4 text-sm text-gray-900">
          <p><strong>Current Game State:</strong> {room.gameState}</p>
          <p><strong>Players:</strong> {room.players.length}</p>
          <p><strong>Current Round:</strong> {room.currentRound}</p>
          <p><strong>Is VIP:</strong> {player.isVIP ? 'Yes' : 'No'}</p>
          <p><strong>Current Judge:</strong> {room.currentJudge || 'None'}</p>
        </div>{/* Game State Components */}
        {room.gameState === GameState.LOBBY && (
          <LobbyComponent 
            room={room} 
            player={player} 
            onStartGame={startGame} 
          />
        )}

        {room.gameState === GameState.JUDGE_SELECTION && (
          <JudgeSelectionComponent 
            room={room} 
            player={player} 
          />
        )}

        {room.gameState === GameState.PROMPT_SELECTION && (
          <PromptSelectionComponent 
            room={room} 
            player={player} 
            onSelectPrompt={selectPrompt} 
          />
        )}        {room.gameState === GameState.SOUND_SELECTION && (
          <SoundSelectionComponent 
            room={room} 
            player={player} 
            selectedSounds={selectedSounds}
            onSelectSounds={selectSounds}
            onSubmitSounds={submitSounds}
            timeLeft={timeLeft}
            soundEffects={soundEffects}
          />
        )}        {room.gameState === GameState.JUDGING && (
          <JudgingComponent 
            room={room} 
            player={player} 
            onJudgeSubmission={judgeSubmission}
            soundEffects={soundEffects}
          />
        )}{room.gameState === GameState.ROUND_RESULTS && (
          <ResultsComponent room={room} player={player} roundWinner={roundWinner} soundEffects={soundEffects} />
        )}

        {room.gameState === GameState.GAME_OVER && (
          <GameOverComponent room={room} player={player} />
        )}

        {/* Fallback for unknown game states */}
        {!Object.values(GameState).includes(room.gameState as GameState) && (
          <div className="bg-white rounded-3xl p-8 shadow-lg text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Unknown Game State</h2>            <p className="text-gray-800">Current state: {room.gameState}</p>
            <p className="text-gray-800">Expected states: {Object.values(GameState).join(', ')}</p>
          </div>
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
  // Basic Lobby UI
  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg text-center">
      <h2 className="text-2xl font-bold text-purple-600 mb-4">Lobby</h2>
      <p className="text-gray-800 mb-2">Room Code: <span className="font-mono font-bold">{room.code}</span></p>
      <p className="text-gray-800 mb-4">Players in lobby: {room.players.length}</p>
      <ul className="mb-6 text-left max-w-xs mx-auto">
        {room.players.map((p) => (
          <li key={p.id} className={`p-2 rounded mb-2 flex items-center ${getPlayerColorClass(p.color)} text-white`}>
            <span className={`w-3 h-3 rounded-full mr-2 ${getPlayerColorClass(p.color)}`}></span>
            {p.name} {p.isVIP && '👑'} {p.id === player.id && '(You)'}
          </li>
        ))}
      </ul>
      {player.isVIP && room.players.length >= 1 && (
        <button 
          onClick={onStartGame} 
          className="bg-green-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-600 transition-colors text-lg"
        >
          Start Game
        </button>
      )}
      {!player.isVIP && <p className="text-gray-700">Waiting for the host ({room.players.find(p => p.isVIP)?.name || 'VIP'}) to start the game...</p>}
      {player.isVIP && room.players.length < 1 && <p className="text-gray-700">Waiting for at least 1 player to join before starting.</p>}
    </div>
  );
}

function JudgeSelectionComponent({ room, player }: { room: Room; player: Player }) {
  const judge = room.players.find(p => p.id === room.currentJudge);
  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg text-center">
      <h2 className="text-2xl font-bold text-purple-600 mb-4">Judge Selection</h2>
      {judge ? (
        <p className="text-gray-800 text-xl">The judge for this round is: <span className={`font-bold ${getPlayerColorClass(judge.color)} p-1 rounded`}>{judge.name}</span></p>
      ) : (
        <p className="text-gray-800">Waiting for judge selection...</p>
      )}
      {player.id === room.currentJudge && <p className="mt-4 text-lg text-green-600">You are the Judge!</p>}
    </div>
  );
}

function PromptSelectionComponent({ room, player, onSelectPrompt }: { 
  room: Room; 
  player: Player; 
  onSelectPrompt: (promptId: string) => void; 
}) {
  const isJudge = player.id === room.currentJudge;
  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg text-center">
      <h2 className="text-2xl font-bold text-purple-600 mb-4">Prompt Selection</h2>
      {isJudge ? (
        <>
          <p className="text-gray-800 mb-4">Choose a prompt for this round:</p>
          <div className="space-y-3">
            {room.availablePrompts?.map((prompt, index) => (
              <button 
                key={prompt.id}
                onClick={() => onSelectPrompt(prompt.id)}
                className="w-full bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors"
              >
                {prompt.text}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-gray-800">Waiting for the Judge ({room.players.find(p => p.id === room.currentJudge)?.name}) to select a prompt...</p>
      )}
    </div>
  );
}

function SoundSelectionComponent({ room, player, selectedSounds, onSelectSounds, onSubmitSounds, timeLeft, soundEffects }: { 
  room: Room; 
  player: Player; 
  selectedSounds: [string, string] | null;
  onSelectSounds: (sound1: string, sound2: string) => void;
  onSubmitSounds: () => void;
  timeLeft: number;
  soundEffects: SoundEffect[];
}) {
  const isJudge = player.id === room.currentJudge;
  const [sound1, setSound1] = useState<string>('');
  const [sound2, setSound2] = useState<string>('');

  useEffect(() => {
    if (selectedSounds) {
      setSound1(selectedSounds[0]);
      setSound2(selectedSounds[1]);
    }
  }, [selectedSounds]);

  const handleSoundChange = (index: number, soundId: string) => {
    const newSound1 = index === 0 ? soundId : sound1;
    const newSound2 = index === 1 ? soundId : sound2;
    setSound1(newSound1);
    setSound2(newSound2);
    if (newSound1 && newSound2) {
      onSelectSounds(newSound1, newSound2);
    }
  };
  
  const playSound = (soundId: string) => {
    const sound = soundEffects.find(s => s.id === soundId);
    if (sound) {
      audioSystem.playSound(sound.id);
    }
  };

  if (isJudge) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-lg text-center">
        <h2 className="text-2xl font-bold text-purple-600 mb-4">Sound Selection</h2>
        <p className="text-gray-800">Players are selecting their sounds...</p>
        <p className="text-gray-800 mt-2">Prompt: <span className="font-semibold">{room.currentPrompt}</span></p>
      </div>
    );
  }

  const hasSubmitted = room.submissions.some(s => s.playerId === player.id);

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg text-center">
      <h2 className="text-2xl font-bold text-purple-600 mb-4">Select Your Sounds!</h2>
      <p className="text-gray-800 mb-1">Prompt: <span className="font-semibold">{room.currentPrompt}</span></p>
      <p className="text-red-500 font-bold mb-4">Time Left: {timeLeft}s</p>
      
      {hasSubmitted ? (
        <p className="text-green-600 text-xl">Sounds submitted! Waiting for others...</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <label htmlFor="sound1" className="block text-sm font-medium text-gray-700 mb-1">Sound 1</label>
              <select 
                id="sound1" 
                value={sound1}
                onChange={(e) => handleSoundChange(0, e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-purple-500 focus:border-purple-500"              >
                <option value="">Select first sound</option>
                {soundEffects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {sound1 && <button onClick={() => playSound(sound1)} className="mt-2 text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">Preview</button>}
            </div>
            <div>
              <label htmlFor="sound2" className="block text-sm font-medium text-gray-700 mb-1">Sound 2</label>
              <select 
                id="sound2" 
                value={sound2}
                onChange={(e) => handleSoundChange(1, e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-purple-500 focus:border-purple-500"              >
                <option value="">Select second sound</option>
                {soundEffects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {sound2 && <button onClick={() => playSound(sound2)} className="mt-2 text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">Preview</button>}
            </div>
          </div>
          <button 
            onClick={onSubmitSounds}
            disabled={!sound1 || !sound2 || timeLeft <= 0}
            className="w-full bg-green-500 text-white px-8 py-4 rounded-xl font-bold hover:bg-green-600 transition-colors text-lg disabled:bg-gray-400"
          >
            Submit Sounds
          </button>
        </div>
      )}
    </div>
  );
}

function JudgingComponent({ room, player, onJudgeSubmission, soundEffects }: { 
  room: Room; 
  player: Player; 
  onJudgeSubmission: (submissionIndex: number) => void;
  soundEffects: SoundEffect[];
}) {
  const isJudge = player.id === room.currentJudge;
  const playSubmissionSounds = (sounds: [string, string]) => {
    const soundFile1 = soundEffects.find(s => s.id === sounds[0])?.fileName;
    const soundFile2 = soundEffects.find(s => s.id === sounds[1])?.fileName;    if (soundFile1 && soundFile2) {
      console.log(`Playing sounds: ${sounds[0]} then ${sounds[1]}`);
      // Use the proper sequence method that waits for each sound to finish
      audioSystem.playSoundSequence(sounds, 200); // 200ms delay between sounds
    }
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg text-center">
      <h2 className="text-2xl font-bold text-purple-600 mb-4">Judging Time!</h2>
      <p className="text-gray-800 mb-1">Prompt: <span className="font-semibold">{room.currentPrompt}</span></p>
      {isJudge ? (
        <p className="text-gray-800 mb-4">Listen to the submissions and pick the funniest!</p>
      ) : (
        <p className="text-gray-800 mb-4">The Judge ({room.players.find(p => p.id === room.currentJudge)?.name}) is choosing the winner...</p>
      )}
      <div className="space-y-4 mt-6">
        {room.submissions.map((submission, index) => (
          <div key={index} className="bg-gray-100 p-4 rounded-xl shadow">
            <p className="text-lg font-semibold text-gray-800">Submission {index + 1}</p>
            <div className="my-2 space-x-2">
                <span className="inline-block bg-pink-200 text-pink-800 px-3 py-1 rounded-full text-sm font-medium">{soundEffects.find(s=>s.id === submission.sounds[0])?.name || 'Sound 1'}</span>
                <span className="inline-block bg-indigo-200 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">{soundEffects.find(s=>s.id === submission.sounds[1])?.name || 'Sound 2'}</span>
            </div>
            <button 
              onClick={() => playSubmissionSounds(submission.sounds)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors mr-2"
            >
              Play Sounds
            </button>
            {isJudge && (
              <button 
                onClick={() => onJudgeSubmission(index)}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
              >
                Pick as Winner
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsComponent({ room, player, roundWinner, soundEffects }: { 
  room: Room; 
  player: Player; 
  roundWinner: { winnerId: string; winnerName: string; winningSubmission: any; submissionIndex: number } | null;
  soundEffects: SoundEffect[];
}) {
  if (!roundWinner) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-lg text-center">
        <h2 className="text-2xl font-bold text-purple-600 mb-4">Round Results</h2>
        <p className="text-gray-800">Waiting for results...</p>
      </div>
    );
  }
  const winnerPlayerDetails = room.players.find(p => p.id === roundWinner.winnerId);

  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg text-center">
      <h2 className="text-2xl font-bold text-purple-600 mb-4">Round Over!</h2>
      <p className="text-3xl font-bold mb-2">
        Winner: <span className={winnerPlayerDetails ? getPlayerColorClass(winnerPlayerDetails.color) : 'text-gray-800'}>{roundWinner.winnerName}</span>!
      </p>      <p className="text-gray-700 mb-4">With the submission: 
        <span className="font-semibold">{soundEffects.find(s=>s.id === roundWinner.winningSubmission.sounds[0])?.name || 'Sound 1'}</span> + 
        <span className="font-semibold">{soundEffects.find(s=>s.id === roundWinner.winningSubmission.sounds[1])?.name || 'Sound 2'}</span>
      </p>
      <p className="text-gray-800 mb-6">Prompt was: <span className="font-italic">{room.currentPrompt}</span></p>
      
      <h3 className="text-xl font-semibold text-gray-800 mb-3">Scores:</h3>
      <ul className="space-y-1 max-w-sm mx-auto text-left">
        {room.players.sort((a, b) => b.score - a.score).map(p => (
          <li key={p.id} className={`p-2 rounded flex justify-between items-center ${getPlayerColorClass(p.color)} text-white shadow`}>
            <span>{p.name} {p.id === roundWinner.winnerId && '🎉'}</span>
            <span className="font-bold">{p.score} pts</span>
          </li>
        ))}
      </ul>
      {/* Next round / game over will be handled by gameState change */}
    </div>
  );
}

function GameOverComponent({ room, player }: { room: Room; player: Player }) {
  const overallWinner = room.players.reduce((prev, current) => (prev.score > current.score) ? prev : current);
  return (
    <div className="bg-white rounded-3xl p-8 shadow-lg text-center">
      <h2 className="text-4xl font-black text-purple-700 mb-6">Game Over!</h2>
      {overallWinner && (
        <p className="text-2xl font-bold mb-4">
          The Grand Winner is <span className={getPlayerColorClass(overallWinner.color)}>{overallWinner.name}</span> with {overallWinner.score} points!
        </p>
      )}
      <h3 className="text-xl font-semibold text-gray-800 mb-3">Final Scores:</h3>
      <ul className="space-y-1 max-w-sm mx-auto text-left mb-8">
        {room.players.sort((a, b) => b.score - a.score).map(p => (
          <li key={p.id} className={`p-2 rounded flex justify-between items-center ${getPlayerColorClass(p.color)} text-white shadow`}>
            <span>{p.name}</span>
            <span className="font-bold">{p.score} pts</span>
          </li>
        ))}
      </ul>
      <button 
        onClick={() => window.location.href = '/'} // Simple redirect to home
        className="bg-blue-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-600 transition-colors text-lg"
      >
        Play Again?
      </button>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div>Loading Game Page...</div>}>
      <GamePageContent />
    </Suspense>
  );
}
