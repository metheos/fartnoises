'use client';

import { useState, useEffect, Suspense, useRef, useMemo } from 'react'; // Added useMemo
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Player, PlayerData, Room, GameState, SoundEffect, GamePrompt } from '@/types/game';
import { getSoundEffects } from '@/data/gameData';
import { getRandomSounds } from '@/utils/soundLoader';
import { audioSystem } from '@/utils/audioSystem';

// Helper function to convert hex colors to Tailwind classes
const getPlayerColorClass = (color: string): string => {
  const colorMap: { [key: string]: string } = {
    '#FF6B6B': 'bg-red-400',
    '#4ECDC4': 'bg-teal-400', 
    '#45B7D1': 'bg-blue-400',
    '#96CEB4': 'bg-green-400',
    '#FFEAA7': 'bg-yellow-400',
    '#DDA0DD': 'bg-purple-400',
    '#98D8C8': 'bg-emerald-400',
    '#F7DC6F': 'bg-amber-400',
  };
  return colorMap[color] || 'bg-gray-400';
};

function GamePageContent() {
  const [room, setRoom] = useState<Room | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [selectedSounds, setSelectedSounds] = useState<string[] | null>(null);
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
  const [lastRoundNumber, setLastRoundNumber] = useState<number>(0);
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const socketRef = useRef<Socket | null>(null);
  const hasAttemptedConnectionLogic = useRef(false);

  // Stabilize the URL parameters using useMemo to prevent effect re-runs
  const stableParams = useMemo(() => {
    const mode = searchParams?.get('mode');
    const playerName = searchParams?.get('playerName') || searchParams?.get('name');
    const roomCode = searchParams?.get('roomCode') || searchParams?.get('room');
    const playerColor = searchParams?.get('playerColor');
    const playerEmoji = searchParams?.get('playerEmoji');
    return { mode, playerName, roomCode, playerColor, playerEmoji };
  }, [searchParams]);

  const { mode, playerName, roomCode, playerColor, playerEmoji } = stableParams;
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
      setIsConnected(true);      if (!hasAttemptedConnectionLogic.current && !room) { // Check !room to ensure we are not already in a room from a previous state
        addDebugLog('Attempting connection logic (create/join).');
        hasAttemptedConnectionLogic.current = true; // Mark that we are attempting it

        // Check if this might be a reconnection attempt (only for join mode)
        // For create/host mode, we always want to create a fresh room
        const originalPlayerId = localStorage.getItem('originalPlayerId');
        const lastKnownRoomCode = localStorage.getItem('lastKnownRoomCode');
        const hasReconnectionData = originalPlayerId && originalPlayerId !== currentSocket.id && lastKnownRoomCode;
        const shouldAttemptReconnection = hasReconnectionData && mode === 'join';

        if (shouldAttemptReconnection) {
          // Only try reconnection for join mode
          addDebugLog(`Attempting reconnection for room: ${lastKnownRoomCode}, player: ${playerName}, originalId: ${originalPlayerId}`);
          currentSocket.emit('reconnectToRoom', lastKnownRoomCode, playerName, originalPlayerId, (success: boolean, reconnectedRoom?: Room) => {
            if (success && reconnectedRoom) {
              addDebugLog(`Reconnection successful for room: ${lastKnownRoomCode}`);
              // State updates handled by 'roomJoined' event that should follow
              return;
            } else {
              addDebugLog(`Reconnection failed, proceeding with original mode: ${mode}`);
              // Fall back to original logic based on mode
              proceedWithOriginalMode();
            }
          });
        } else {
          // No reconnection attempt needed (create/host mode) or no reconnection data
          if (hasReconnectionData && (mode === 'create' || mode === 'host')) {
            addDebugLog(`Create/host mode detected, clearing old reconnection data and creating fresh room`);
            // Clear old reconnection data since we're explicitly creating a new room
            localStorage.removeItem('originalPlayerId');
            localStorage.removeItem('lastKnownRoomCode');
          }
          proceedWithOriginalMode();
        }

        function proceedWithOriginalMode() {
          if (mode === 'create' || mode === 'host') {
            addDebugLog(`Emitting createRoom for player: ${playerName} on socket ${currentSocket.id}`);
            const playerData = {
              name: playerName,
              color: playerColor || undefined,
              emoji: playerEmoji || undefined
            };
            currentSocket.emit('createRoom', playerData, (newRoomCode: string) => {
              addDebugLog(`createRoom callback for ${playerName}, room code: ${newRoomCode}. Waiting for roomCreated event.`);
              // State updates handled by 'roomCreated'
            });
          } else if (mode === 'join' && roomCode) {
            addDebugLog(`Emitting joinRoom for room: ${roomCode}, player: ${playerName} on socket ${currentSocket.id}`);
            const playerData = {
              name: playerName,
              color: playerColor || undefined,
              emoji: playerEmoji || undefined
            };
            currentSocket.emit('joinRoom', roomCode, playerData, (success: boolean, joinedRoomData?: Room) => {
              if (!success) {
                addDebugLog(`joinRoom failed for room: ${roomCode}.`);
                setError('Failed to join room. Room may be full, not exist, or game in progress.');
                hasAttemptedConnectionLogic.current = false;
              } else {
                addDebugLog(`joinRoom callback successful for room: ${roomCode}. Waiting for roomJoined event.`);
                // State updates handled by 'roomJoined'
              }
            });
          }
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
      // Store room code for future reconnection attempts
      localStorage.setItem('lastKnownRoomCode', newRoom.code);
      // Update URL to change from mode=host to mode=join with room code
      // This prevents issues when the host refreshes the page
      router.replace(`/game?mode=join&playerName=${playerName}&roomCode=${newRoom.code}`, { scroll: false });
    };

    const handleRoomJoined = ({ room: newRoom, player: newPlayer }: { room: Room; player: Player }) => {
      addDebugLog(`roomJoined event for room: ${newRoom?.code}. Player: ${newPlayer?.name}. Socket: ${currentSocket.id}`);
      setRoom(newRoom);
      setPlayer(newPlayer);
      setLastRoundNumber(newRoom.currentRound || 0);
      // Store room code for future reconnection attempts
      localStorage.setItem('lastKnownRoomCode', newRoom.code);
    };

    const handleRoomUpdated = (updatedRoom: Room) => {
      addDebugLog(`🏠 roomUpdated event for room: ${updatedRoom?.code}, players: ${updatedRoom?.players?.length}. Socket: ${currentSocket.id}`);
      addDebugLog(`🏠 Current selectedSounds: ${selectedSounds ? selectedSounds.join(', ') : 'null'}`);
      if (updatedRoom && updatedRoom.code) {
        setRoom((prevRoom) => {
          const roundChanged = !prevRoom || prevRoom.currentRound !== updatedRoom.currentRound;
          addDebugLog(`🏠 Room update - prevRound: ${prevRoom?.currentRound}, newRound: ${updatedRoom.currentRound}, roundChanged: ${roundChanged}`);
          if (roundChanged) {
            setLastRoundNumber(updatedRoom.currentRound || 0);
            addDebugLog(`🏠 Updated lastRoundNumber to: ${updatedRoom.currentRound || 0}`);
          }
          return updatedRoom;
        });
        const selfPlayer = updatedRoom.players.find(p => p.id === player?.id || p.id === currentSocket.id);
        if (selfPlayer) setPlayer(selfPlayer);
      } else {
        addDebugLog('🏠 roomUpdated: Received invalid room data.');
      }
    };

    const handlePlayerJoined = ({ room: updatedRoom }: { room: Room }) => {
      addDebugLog(`playerJoined event for room: ${updatedRoom?.code}, players: ${updatedRoom?.players?.length}. Socket: ${currentSocket.id}`);
      if (updatedRoom && updatedRoom.code) {
        setRoom(updatedRoom);
      } else {
        addDebugLog('playerJoined: Received invalid room data.');
      }
    };    const handleGameStateChanged = (state: GameState, data?: any) => {
      addDebugLog(`🎯 gameStateChanged event: ${state}, data: ${JSON.stringify(data)}. Socket: ${currentSocket.id}`);
      addDebugLog(`🎯 Current selectedSounds before processing: ${selectedSounds ? selectedSounds.join(', ') : 'null'}`);
      
      // Detailed logging of what we're receiving
      console.log(`🎯 RAW DATA RECEIVED:`, data);
      console.log(`🎯 data.submissions:`, data?.submissions);
      console.log(`🎯 data.randomizedSubmissions:`, data?.randomizedSubmissions);
      
      if (data?.submissions) {
        addDebugLog(`🎯 Received ${data.submissions.length} submissions`);
      }
      if (data?.randomizedSubmissions) {
        addDebugLog(`🎯 Received ${data.randomizedSubmissions.length} randomized submissions`);
      } else {
        addDebugLog(`🎯 NO randomizedSubmissions in data! Keys: ${Object.keys(data || {}).join(', ')}`);
      }
      
      if (state === GameState.JUDGE_SELECTION) {
        setRoundWinner(null);
      }
      // Only reset sound selection when starting a NEW sound selection phase (new round)
      // Don't reset if we're just updating the timer or other data within the same round
      setRoom((currentRoomVal) => {
        if (currentRoomVal) {
          // More precise check: only reset if we're transitioning TO SOUND_SELECTION 
          // from a different state AND the round has actually changed
          const isActualNewRound = state === GameState.SOUND_SELECTION && 
                                 currentRoomVal.gameState !== GameState.SOUND_SELECTION &&
                                 (data?.currentRound !== undefined ? data.currentRound !== lastRoundNumber : true);
          
          addDebugLog(`🎯 Round check: state=${state}, currentGameState=${currentRoomVal.gameState}, dataRound=${data?.currentRound}, lastRound=${lastRoundNumber}, isNewRound=${isActualNewRound}`);
          
          if (isActualNewRound) {
            setSelectedSounds(null);
            const newRoundNumber = data?.currentRound || currentRoomVal.currentRound;
            setLastRoundNumber(newRoundNumber);
            addDebugLog(`🎯 RESET selectedSounds for actual new round ${newRoundNumber} (prev state: ${currentRoomVal.gameState} -> ${state})`);
          } else {
            addDebugLog(`🎯 NOT resetting selectedSounds - state: ${currentRoomVal.gameState} -> ${state}, round: ${currentRoomVal.currentRound}, lastRound: ${lastRoundNumber}`);
          }
          
          return {
            ...currentRoomVal,
            gameState: state,
            ...(data?.prompts && { availablePrompts: data.prompts }),
            ...(data?.prompt && { currentPrompt: data.prompt }),
            ...(data?.judgeId && { currentJudge: data.judgeId }),
            ...(data?.submissions && { submissions: data.submissions }),
            ...(data?.randomizedSubmissions && { randomizedSubmissions: data.randomizedSubmissions }),
            ...(data?.currentRound !== undefined && { currentRound: data.currentRound }),
          };
        }
        return currentRoomVal;
      });
    };

    const handlePromptSelected = (prompt: GamePrompt) => {
      addDebugLog(`promptSelected event: ${prompt.text}. Socket: ${currentSocket.id}`);
      setRoom((currentRoomVal) => currentRoomVal ? { ...currentRoomVal, currentPrompt: prompt } : null);
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

    const handlePlayerDisconnected = ({ playerId, playerName, canReconnect }: { playerId: string; playerName: string; canReconnect: boolean }) => {
      addDebugLog(`Player disconnected: ${playerName} (${playerId}), can reconnect: ${canReconnect}`);
    };

    const handlePlayerReconnected = ({ playerId, playerName }: { playerId: string; playerName: string }) => {
      addDebugLog(`Player reconnected: ${playerName} (${playerId})`);
      setIsReconnecting(false);
    };

    const handleReconnectionVoteRequest = ({ disconnectedPlayerName, timeLeft }: { disconnectedPlayerName: string; timeLeft: number }) => {
      addDebugLog(`Reconnection vote requested for ${disconnectedPlayerName}`);
      setReconnectionVote({
        disconnectedPlayerName,
        timeLeft,
        showVoteDialog: true
      });
    };

    const handleReconnectionVoteUpdate = ({ vote }: { vote: any }) => {
      addDebugLog(`Reconnection vote update: ${vote.voterName} voted ${vote.continueWithoutPlayer ? 'continue' : 'wait'}`);
    };

    const handleReconnectionVoteResult = ({ continueWithoutPlayer, disconnectedPlayerName }: { continueWithoutPlayer: boolean; disconnectedPlayerName: string }) => {
      addDebugLog(`Reconnection vote result: ${continueWithoutPlayer ? 'continue' : 'wait'} for ${disconnectedPlayerName}`);
      setReconnectionVote(null);
      if (continueWithoutPlayer) {
        setGamePaused(null);
      }
    };

    const handleGamePausedForDisconnection = ({ disconnectedPlayerName, timeLeft }: { disconnectedPlayerName: string; timeLeft: number }) => {
      addDebugLog(`Game paused for disconnection: ${disconnectedPlayerName}`);
      setGamePaused({
        disconnectedPlayerName,
        timeLeft
      });
    };

    const handleGameResumed = () => {
      addDebugLog('Game resumed after disconnection');
      setGamePaused(null);
      setReconnectionVote(null);
    };

    const handleGameSettingsUpdated = ({ maxRounds, maxScore }: { maxRounds: number; maxScore: number }) => {
      addDebugLog(`Game settings updated: maxRounds=${maxRounds}, maxScore=${maxScore}`);
      setRoom((currentRoomVal) => {
        if (currentRoomVal) {
          return {
            ...currentRoomVal,
            maxRounds,
            maxScore
          };
        }
        return currentRoomVal;
      });
    };    // --- Register event listeners ---
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
    currentSocket.on('playerDisconnected', handlePlayerDisconnected);
    currentSocket.on('playerReconnected', handlePlayerReconnected);
    currentSocket.on('reconnectionVoteRequest', handleReconnectionVoteRequest);
    currentSocket.on('reconnectionVoteUpdate', handleReconnectionVoteUpdate);
    currentSocket.on('reconnectionVoteResult', handleReconnectionVoteResult);
    currentSocket.on('gamePausedForDisconnection', handleGamePausedForDisconnection);
    currentSocket.on('gameResumed', handleGameResumed);
    currentSocket.on('gameSettingsUpdated', handleGameSettingsUpdated);
    currentSocket.on('gameStateChanged', handleGameStateChanged);
    currentSocket.on('promptSelected', handlePromptSelected);
    currentSocket.on('judgeSelected', handleJudgeSelected);
    currentSocket.on('soundSubmitted', handleSoundSubmitted);    currentSocket.on('roundComplete', handleRoundComplete);
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
      currentSocket.off('playerDisconnected', handlePlayerDisconnected);
      currentSocket.off('playerReconnected', handlePlayerReconnected);
      currentSocket.off('reconnectionVoteRequest', handleReconnectionVoteRequest);
      currentSocket.off('reconnectionVoteUpdate', handleReconnectionVoteUpdate);
      currentSocket.off('reconnectionVoteResult', handleReconnectionVoteResult);
      currentSocket.off('gamePausedForDisconnection', handleGamePausedForDisconnection);
      currentSocket.off('gameResumed', handleGameResumed);
      currentSocket.off('gameSettingsUpdated', handleGameSettingsUpdated);
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
    // Store original player ID for reconnection purposes
    if (player && socketRef.current?.id) {
      localStorage.setItem('originalPlayerId', socketRef.current.id);
    }
  }, [player]);

  const startGame = () => {
    if (socketRef.current && room) {
      addDebugLog(`Emitting startGame on socket ${socketRef.current.id}`);
      socketRef.current.emit('startGame');
    }
  };  const selectSounds = (sounds: string[]) => {
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
    if (socketRef.current && room && selectedSounds) {
      addDebugLog(`🔊 Emitting submitSounds: ${selectedSounds.join(', ')} on socket ${socketRef.current.id}`);
      socketRef.current.emit('submitSounds', selectedSounds);
      addDebugLog(`🔊 Clearing MY selectedSounds after submission (socket ${socketRef.current.id})`);
      // Note: Don't call setSelectedSounds(null) here as it affects all players
      // The SoundSelectionComponent will handle its own state
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

  const voteOnReconnection = (continueWithoutPlayer: boolean) => {
    if (socketRef.current && room) {
      addDebugLog(`Voting on reconnection: ${continueWithoutPlayer ? 'continue' : 'wait'}`);
      socketRef.current.emit('voteOnReconnection', continueWithoutPlayer);
      setReconnectionVote(null);
    }
  };

  const attemptReconnection = () => {
    if (!playerName || !roomCode) return;
    
    setIsReconnecting(true);
    addDebugLog('Attempting to reconnect...');
    
    // Try to get the original player ID from localStorage or use current socket ID
    const originalPlayerId = localStorage.getItem('originalPlayerId') || socketRef.current?.id || '';
    
    if (socketRef.current) {
      socketRef.current.emit('reconnectToRoom', roomCode, playerName, originalPlayerId, (success: boolean, reconnectedRoom?: Room) => {
        if (success && reconnectedRoom) {
          addDebugLog('Reconnection successful');
          setRoom(reconnectedRoom);
          const reconnectedPlayer = reconnectedRoom.players.find(p => p.name === playerName);
          if (reconnectedPlayer) {
            setPlayer(reconnectedPlayer);
          }
          setIsReconnecting(false);
          setError('');
        } else {
          addDebugLog('Reconnection failed');
          setIsReconnecting(false);
          setError('Failed to reconnect. The game may have continued without you.');
        }
      });
    }
  };

  const updateGameSetting = (setting: 'maxScore' | 'maxRounds', value: number) => {
    if (socketRef.current && room && player?.isVIP) {
      addDebugLog(`Updating ${setting} to ${value}`);
      const settings = {
        maxScore: setting === 'maxScore' ? value : room.maxScore,
        maxRounds: setting === 'maxRounds' ? value : room.maxRounds,
      };
      socketRef.current.emit('updateGameSettings', settings);
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
    // Check if this might be a reconnection scenario
    const couldBeReconnection = roomCode && playerName && localStorage.getItem('originalPlayerId');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-400 via-pink-500 to-orange-400 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 text-center max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Oops!</h2>
          <p className="text-gray-800 mb-6">{error}</p>
          
          <div className="space-y-3">
            {couldBeReconnection && !isReconnecting && (
              <button
                onClick={attemptReconnection}
                className="w-full bg-green-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-600 transition-colors"
              >
                Try Reconnecting
              </button>
            )}
            
            {isReconnecting && (
              <div className="mb-4">
                <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-600">Attempting to reconnect...</p>
              </div>
            )}
            
            <button
              onClick={() => {
                // Clear reconnection data when going back to home
                localStorage.removeItem('originalPlayerId');
                localStorage.removeItem('lastKnownRoomCode');
                router.push('/');
              }}
              className="w-full bg-purple-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-600 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }if (!room || !player) {
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
        <div className="bg-white rounded-3xl p-4 mb-6 shadow-lg">
          <div className="flex justify-between items-center">            
            <div>
              <h1 className="text-2xl font-black text-gray-900 leading-tight">fartnoises</h1>
              <p className="text-sm text-gray-800">Room: <span className="font-mono font-bold">{room.code}</span></p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-700">Round {room.currentRound}/{room.maxRounds}</p>
              <p className="text-base font-bold text-purple-600 leading-tight">{player.name}</p>
              <p className="text-xs text-gray-700">Score: {player.score}/{room.maxScore}</p>
            </div>
          </div>        
        </div>        
          {/* Debug Info
        <div className="bg-white rounded-xl p-4 mb-4 text-sm text-gray-900">
          <p><strong>Current Game State:</strong> {room.gameState}</p>
          <p><strong>Players:</strong> {room.players.length}</p>
          <p><strong>Current Round:</strong> {room.currentRound}</p>
          <p><strong>Is VIP:</strong> {player.isVIP ? 'Yes' : 'No'}</p>
          <p><strong>Current Judge:</strong> {room.currentJudge || 'None'}</p>
        </div> */}
        {/* Game State Components */}
        {room.gameState === GameState.LOBBY && (
          <LobbyComponent 
            room={room} 
            player={player} 
            onStartGame={startGame}
            onUpdateGameSetting={updateGameSetting}
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

        {room.gameState === GameState.PAUSED_FOR_DISCONNECTION && (
          <PausedForDisconnectionComponent room={room} player={player} onAttemptReconnection={attemptReconnection} />
        )}        {/* Fallback for unknown game states */}
        {!Object.values(GameState).includes(room.gameState as GameState) && (
          <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Unknown Game State</h2>
            <p className="text-gray-800">Current state: {room.gameState}</p>
            <p className="text-gray-800">Expected states: {Object.values(GameState).join(', ')}</p>
          </div>
        )}

        {/* Reconnection Vote Dialog */}
        {reconnectionVote && reconnectionVote.showVoteDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
              <h2 className="text-2xl font-bold text-purple-600 mb-4 text-center">Player Disconnected</h2>
              <p className="text-gray-800 mb-4 text-center">
                <span className="font-semibold">{reconnectionVote.disconnectedPlayerName}</span> has disconnected.
              </p>
              <p className="text-gray-700 mb-6 text-center">
                Would you like to continue the game without them or wait a bit longer?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => voteOnReconnection(false)}
                  className="flex-1 bg-blue-500 text-white px-4 py-3 rounded-xl font-bold hover:bg-blue-600 transition-colors"
                >
                  Wait Longer
                </button>
                <button
                  onClick={() => voteOnReconnection(true)}
                  className="flex-1 bg-red-500 text-white px-4 py-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
                >
                  Continue Without
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Paused Overlay */}
        {gamePaused && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
              <div className="animate-pulse w-16 h-16 bg-orange-200 rounded-full mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-orange-600 mb-4">Game Paused</h2>
              <p className="text-gray-800 mb-2">
                <span className="font-semibold">{gamePaused.disconnectedPlayerName}</span> has disconnected.
              </p>
              <p className="text-gray-700 mb-4">
                Waiting for them to reconnect or for a player to vote...
              </p>
              <p className="text-sm text-gray-600">
                Time remaining: {gamePaused.timeLeft}s
              </p>
            </div>
          </div>
        )}

        {/* Reconnection Attempt Dialog */}
        {isReconnecting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
              <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-purple-600 mb-4">Reconnecting...</h2>
              <p className="text-gray-800">
                Attempting to reconnect to the game...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Component implementations will follow...
export function LobbyComponent({ room, player, onStartGame, onUpdateGameSetting }: { 
  room: Room; 
  player: Player; 
  onStartGame: () => void;
  onUpdateGameSetting: (setting: 'maxScore' | 'maxRounds', value: number) => void;
}) {
  // Basic Lobby UI
  return (
    <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
      {/* <h2 className="text-2xl font-bold text-purple-600 mb-4">Lobby</h2> */}
      {/* <p className="text-gray-800 mb-2">Room Code: <span className="font-mono font-bold">{room.code}</span></p> */}
      {/* <p className="text-gray-800 mb-4">Players in lobby: {room.players.length}</p> */}
      
      {/* Game Settings Display for non-VIP players */}
      {!player.isVIP && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 mb-6 max-w-sm mx-auto">
          <div className="flex justify-between items-center">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Score to Win</p>
              <p className="text-2xl font-bold text-purple-600">{room.maxScore}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Max Rounds</p>
              <p className="text-2xl font-bold text-purple-600">{room.maxRounds}</p>
            </div>
          </div>
        </div>
      )}

      {/* Game Settings Controls for VIP players */}
      {player.isVIP && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-4 mb-6 max-w-sm mx-auto border border-yellow-200">
          <div className="flex justify-between items-center">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Score to Win</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <button
                  onClick={() => onUpdateGameSetting('maxScore', Math.max(1, room.maxScore - 1))}
                  className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-purple-600 transition-colors text-lg"
                  disabled={room.maxScore <= 1}
                >
                  −
                </button>
                <p className="text-2xl font-bold text-purple-600 min-w-[3rem] text-center">{room.maxScore}</p>
                <button
                  onClick={() => onUpdateGameSetting('maxScore', Math.min(10, room.maxScore + 1))}
                  className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-purple-600 transition-colors text-lg"
                  disabled={room.maxScore >= 10}
                >
                  +
                </button>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Max Rounds</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <button
                  onClick={() => onUpdateGameSetting('maxRounds', Math.max(1, room.maxRounds - 1))}
                  className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-purple-600 transition-colors text-lg"
                  disabled={room.maxRounds <= 1}
                >
                  −
                </button>
                <p className="text-2xl font-bold text-purple-600 min-w-[3rem] text-center">{room.maxRounds}</p>
                <button
                  onClick={() => onUpdateGameSetting('maxRounds', Math.min(20, room.maxRounds + 1))}
                  className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-purple-600 transition-colors text-lg"
                  disabled={room.maxRounds >= 20}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <ul className="mb-8 text-left max-w-xs mx-auto space-y-3">
        {room.players.map((p, idx) => (
          <li
        key={p.id}
        className={`
          flex items-center gap-3 p-3 rounded-2xl shadow-md transition-all duration-200
          ${getPlayerColorClass(p.color)}
          ${p.id === player.id ? 'ring-4 ring-purple-400 scale-105' : ''}
          ${p.isVIP ? 'border-2 border-yellow-300' : ''}
          text-white
        `}
        style={{
          background:
            p.isVIP
          ? 'linear-gradient(90deg, #fef08a 0%, #fde047 100%)'
          : undefined,
          color: p.isVIP ? '#92400e' : undefined,
          boxShadow: p.id === player.id ? '0 0 0 4px #a78bfa44' : undefined,
        }}
          >
        <span
          className={`
            w-8 h-8 flex items-center justify-center rounded-full font-bold text-lg mr-2
            ${getPlayerColorClass(p.color)}
            ${p.isVIP ? 'border-2 border-yellow-400' : ''}
            ${p.id === player.id ? 'ring-2 ring-purple-400' : ''}
          `}
          style={{
            background:
          p.isVIP
            ? 'radial-gradient(circle at 60% 40%, #fde047 70%, #facc15 100%)'
            : undefined,
            color: p.isVIP ? '#92400e' : undefined,
          }}
        >
          {p.emoji || p.name[0].toUpperCase()}
        </span>
        <div className="flex flex-col flex-grow">
          <span className="font-bold text-lg flex items-center gap-1">
            {p.name}
            {p.isVIP && (
          <span
            className="ml-1 text-yellow-400 text-xl animate-bounce"
            title="Host"
          >
            👑
          </span>
            )}
            {p.id === player.id && (
          <span className="ml-1 text-purple-200 text-xs font-semibold bg-purple-600 bg-opacity-60 px-2 py-0.5 rounded-full">
            You
          </span>
            )}
          </span>
          <span className="text-xs opacity-80">
            {p.isVIP ? 'Host' : 'Player'}
          </span>
        </div>
        <span className="ml-auto font-black text-lg drop-shadow">
          {p.score}
        </span>
          </li>
        ))}
      </ul>
      {player.isVIP && room.players.length >= 3 && (
        <button 
          onClick={onStartGame} 
          className="bg-green-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-600 transition-colors text-lg"
        >
          Start Game
        </button>
      )}
      {!player.isVIP && room.players.length >= 3 && <p className="text-gray-700">Waiting for the host to start the game...</p>}
      {player.isVIP && room.players.length < 3 && <p className="text-gray-700">Need at least 3 players to start the game. ({room.players.length}/3)</p>}
      {!player.isVIP && room.players.length < 3 && <p className="text-gray-700">Need at least 3 players to start. Waiting for more players to join... ({room.players.length}/3)</p>}
    </div>
  );
}

export function JudgeSelectionComponent({ room, player }: { room: Room; player: Player }) {
  const judge = room.players.find(p => p.id === room.currentJudge);
  return (
    <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
      <h2 className="text-2xl font-bold text-purple-600 mb-4">Judge Selection</h2>
      {judge ? (
        <div className="flex flex-col items-center">
          <p className="text-gray-800 text-xl mb-4">The judge for this round is:</p>
          <div className="flex flex-col items-center">
            <div 
              className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-2 ${getPlayerColorClass(judge.color)}`}
            >
              {judge.emoji || judge.name[0].toUpperCase()}
            </div>
            <span className="font-semibold text-lg">{judge.name}</span>
          </div>
        </div>
      ) : (
        <p className="text-gray-800">Waiting for judge selection...</p>
      )}
      {player.id === room.currentJudge && <p className="mt-4 text-lg text-green-600">You are the Judge!</p>}
    </div>
  );
}

export function PromptSelectionComponent({ room, player, onSelectPrompt }: { 
  room: Room; 
  player: Player; 
  onSelectPrompt: (promptId: string) => void;
}) {
  const isJudge = player.id === room.currentJudge;
  
  // Debug logging to see what prompts we're receiving
  console.log('PromptSelectionComponent - Available prompts:', room.availablePrompts);
  
  return (
    <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
      <h2 className="text-2xl font-bold text-purple-600 mb-4">Prompt Selection</h2>
      {isJudge ? (
        <>
          <p className="text-gray-800 mb-4">Choose a prompt for this round:</p>
          <div className="space-y-3">
            {room.availablePrompts?.map((prompt) => (
              <button 
                key={prompt.id}
                onClick={() => onSelectPrompt(prompt.id)}
                className="w-full bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors"
                aria-label={`Select prompt: ${prompt.text.replace(/<[^>]*>/g, '')}`}
                dangerouslySetInnerHTML={{ __html: prompt.text }}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="text-gray-800">
          <p className="mb-4">Waiting for the Judge to select a prompt...</p>
          {(() => {
            const judge = room.players.find(p => p.id === room.currentJudge);
            return judge ? (
              <div className="flex flex-col items-center">
                <div 
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-2 ${getPlayerColorClass(judge.color)}`}
                >
                  {judge.emoji || judge.name[0].toUpperCase()}
                </div>
                <span className="font-semibold text-lg">{judge.name}</span>
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

export function SoundSelectionComponent({ room, player, selectedSounds, onSelectSounds, onSubmitSounds, timeLeft, soundEffects }: { 
  room: Room; 
  player: Player; 
  selectedSounds: string[] | null;
  onSelectSounds: (sounds: string[]) => void;
  onSubmitSounds: () => void;
  timeLeft: number;
  soundEffects: SoundEffect[];
}) {
  const isJudge = player.id === room.currentJudge;
  const [selectedSoundsLocal, setSelectedSoundsLocal] = useState<string[]>([]);
  const [playerSoundSet, setPlayerSoundSet] = useState<SoundEffect[]>([]);
  const [lastClearedRound, setLastClearedRound] = useState<number>(-1);
  const justClearedRoundRef = useRef<number>(-1);

  // Generate random sound set for this player when component mounts or when entering new round
  useEffect(() => {
    console.log('🎵 SoundSelectionComponent useEffect triggered');
    console.log(`🎵 soundEffects.length: ${soundEffects.length}, gameState: ${room.gameState}, playerSoundSet.length: ${playerSoundSet.length}`);
    
    if (soundEffects.length > 0 && room.gameState === GameState.SOUND_SELECTION && player.soundSet) {
      // Check if this is a new round by seeing if we haven't submitted in this round yet
      const hasSubmittedThisRound = room.submissions.some(s => s.playerId === player.id);
      const needsNewSoundSet = playerSoundSet.length === 0;
      
      console.log(`🎵 hasSubmittedThisRound: ${hasSubmittedThisRound}, needsNewSoundSet: ${needsNewSoundSet}, currentRound: ${room.currentRound}, lastClearedRound: ${lastClearedRound}`);
      
      if (needsNewSoundSet) {
        // Use the server-provided sound set instead of generating random sounds
        const playerSounds = player.soundSet
          .map(soundId => soundEffects.find(s => s.id === soundId))
          .filter(sound => sound !== undefined) as SoundEffect[];
        
        if (playerSounds.length > 0) {
          console.log(`🎵 Using server-provided sound set: ${playerSounds.length} sounds`);
          setPlayerSoundSet(playerSounds);
        } else {
          console.warn('🎵 Server-provided sound set is empty, falling back to random generation');
          // Fallback to client-side random generation if server set is invalid
          const loadRandomSounds = async () => {
            try {
              const randomSounds = await getRandomSounds(10);
              setPlayerSoundSet(randomSounds);
            } catch (error) {
              console.error('Failed to load random sounds:', error);
              const shuffled = [...soundEffects].sort(() => Math.random() - 0.5);
              const fallbackSounds = shuffled.slice(0, Math.min(8, soundEffects.length));
              setPlayerSoundSet(fallbackSounds);
            }
          };
          loadRandomSounds();
        }
      }
    }
  }, [room.gameState, room.currentRound, player.id, player.soundSet, soundEffects.length]);
  
  // One-time clearing effect for new rounds - only clears once per round
  useEffect(() => {
    if (room.gameState === GameState.SOUND_SELECTION && room.currentRound !== lastClearedRound) {
      const hasSubmittedThisRound = room.submissions.some(s => s.playerId === player.id);
      
      // If we haven't submitted in this round, this is a fresh start - clear local selections ONCE
      if (!hasSubmittedThisRound) {
        console.log(`🎵 NEW ROUND ${room.currentRound} detected - clearing selections (was: local=[${selectedSoundsLocal.join(', ')}], parent=[${selectedSounds?.join(', ') || 'null'}])`);
        justClearedRoundRef.current = room.currentRound; // Set ref IMMEDIATELY to block sync
        setSelectedSoundsLocal([]);
        onSelectSounds([]); // Clear parent state too
        setLastClearedRound(room.currentRound); // Mark this round as cleared
      }
    }
  }, [room.gameState, room.currentRound, room.submissions.length]);
  
  useEffect(() => {
    console.log(`🎵 selectedSounds useEffect: selectedSounds changed to ${selectedSounds ? selectedSounds.join(', ') : 'null'}`);
    
    // Only sync with parent selectedSounds if:
    // 1. We don't have any local selections yet
    // 2. We haven't just cleared this round (check both ref and state)
    // 3. Parent actually has selections to sync with
    const justClearedThisRound = justClearedRoundRef.current === room.currentRound || lastClearedRound === room.currentRound;
    
    if (selectedSounds && selectedSounds.length > 0 && selectedSoundsLocal.length === 0 && !justClearedThisRound) {
      console.log(`🎵 Syncing with parent selectedSounds (local is empty): [${selectedSounds.join(', ')}]`);
      setSelectedSoundsLocal([...selectedSounds]);
    } else if (selectedSounds && justClearedThisRound) {
      console.log(`🎵 Ignoring parent selectedSounds - we just cleared this round: [${selectedSounds.join(', ')}]`);
    } else if (selectedSounds) {
      console.log(`🎵 Parent selectedSounds changed but keeping local selections: [${selectedSoundsLocal.join(', ')}]`);
    } else {
      console.log(`🎵 Parent selectedSounds is null, keeping local selections: [${selectedSoundsLocal.join(', ')}]`);
    }
  }, [selectedSounds, selectedSoundsLocal.length, room.currentRound, lastClearedRound]);

  const handleSoundSelect = (soundId: string) => {
    const currentIndex = selectedSoundsLocal.indexOf(soundId);
    let newSelectedSounds: string[];
    
    if (currentIndex !== -1) {
      // Sound is already selected, remove it
      newSelectedSounds = selectedSoundsLocal.filter(id => id !== soundId);
    } else {
      // Sound is not selected, add it
      if (selectedSoundsLocal.length < 2) {
        // Add to existing selection (max 2 sounds)
        newSelectedSounds = [...selectedSoundsLocal, soundId];
      } else {
        // Replace the first sound if we already have 2
        newSelectedSounds = [soundId, selectedSoundsLocal[1]];
      }
    }
    
    console.log(`🎵 Player ${player.name} selecting sound: ${soundId}, new local selection: [${newSelectedSounds.join(', ')}]`);
    setSelectedSoundsLocal(newSelectedSounds);
    onSelectSounds(newSelectedSounds);
  };
  
  const playSound = (soundId: string) => {
    const sound = soundEffects.find(s => s.id === soundId);
    if (sound) {
      audioSystem.playSound(sound.id);
    }
  };

  const getSoundButtonStyle = (soundId: string) => {
    const index = selectedSoundsLocal.indexOf(soundId);
    if (index === 0) {
      return 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-700 shadow-lg transform scale-105';
    } else if (index === 1) {
      return 'bg-gradient-to-br from-green-500 to-green-600 text-white border-green-700 shadow-lg transform scale-105';
    } else {
      return 'bg-gradient-to-br from-purple-100 to-pink-100 text-gray-800 border-purple-200 hover:from-purple-200 hover:to-pink-200 hover:scale-102';
    }
  };

  if (isJudge) {
    return (
      <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
        {/* <h2 className="text-2xl font-bold text-purple-600 mb-4">Sound Selection</h2> */}
        <p className="text-2xl font-bold text-purple-600 mb-4">Players are choosing sounds...</p>
        <div className="bg-purple-100 rounded-2xl p-6 mb-6">
          <p className="text-lg text-gray-800 font-bold" dangerouslySetInnerHTML={{ __html: room.currentPrompt?.text || '' }}></p>
        </div>
            </div>
          );
        }
        const hasSubmitted = room.submissions.some(s => s.playerId === player.id);
        const submission = hasSubmitted ? room.submissions.find(s => s.playerId === player.id) : null;
        const hasFirstSubmission = room.submissions.length > 0;

        return (
          <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
            {/* <h2 className="text-2xl font-bold text-purple-600 mb-4">Select Your Sounds!</h2> */}
            <div className="bg-purple-100 rounded-2xl p-6 mb-6">
        <p className="text-lg text-gray-800 font-bold" dangerouslySetInnerHTML={{ __html: room.currentPrompt?.text || '' }}></p>
            </div>
            
      {/* Only show timer after first submission */}
      {hasFirstSubmission ? (
        <p className="text-red-500 font-bold mb-4">Time Left: {timeLeft}s</p>
      ) : (
        <></>
        // <p className="text-blue-600 font-semibold mb-4">⏳ Timer will start when first player submits</p>
      )}
        {hasSubmitted && submission ? (
        <div className="text-center">
          {/* Success message with animation */}
          {/* <div className="mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
              <span className="text-3xl text-white">✅</span>
            </div>
            <h3 className="text-2xl font-bold text-green-600 mb-2">Sounds Submitted!</h3>
            <p className="text-gray-600">Waiting for other players to finish...</p>
          </div> */}

          {/* Enhanced submission display */}
          <div className="bg-gradient-to-br from-green-50 via-white to-emerald-50 rounded-2xl p-6 max-w-2xl mx-auto border border-green-200 shadow-lg">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">🎵</span>
              </div>
              <h4 className="text-xl font-bold text-gray-800">Your Sound Combo</h4>
            </div>
            
            <div className="flex flex-row items-center justify-center gap-4">
              {submission.sounds.map((soundId, index) => (
                <div key={soundId} className="relative">
                  <div className={`w-40 h-20 rounded-xl flex items-center justify-center shadow-lg transform scale-105 transition-all duration-300 ${
                    index === 0 
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-blue-300' 
                      : 'bg-gradient-to-br from-green-500 to-green-600 border-2 border-green-300'
                  }`}>
                    <div className="text-center text-white">
                      <div className="text-sm font-bold">
                        {soundEffects.find(s => s.id === soundId)?.name || `Sound ${index + 1}`}
                      </div>
                    </div>
                  </div>
                  
                  {/* Preview button */}
                  <button
                    onClick={() => playSound(soundId)}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all hover:scale-110 border-2 border-gray-200"
                    title="Preview sound"
                  >
                    <span className="text-gray-600 text-sm">🔊</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Preview combo button */}
            <div className="mt-6">
              <button
                onClick={() => {
                  // Play submitted sounds in sequence using the proper audio system method
                  audioSystem.playSoundsSequentially(submission.sounds);
                }}
                className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-xl font-bold hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                🎧 Play Your Combo
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Instructions */}
          {/* <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 max-w-2xl mx-auto"> */}
            {/* <p className="text-gray-800 text-center">
              <span className="font-semibold">Choose 1-2 sounds</span>
            </p> */}
            {/* <div className="flex gap-4 justify-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span>Sound 1</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>Sound 2</span>
              </div>
            </div> */}
          {/* </div> */}

          {/* Sound Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
            {playerSoundSet.map((sound) => (
              <div key={sound.id} className="relative">
                <button
                  onClick={() => handleSoundSelect(sound.id)}
                  className={`w-full p-4 border-2 rounded-xl font-semibold transition-all duration-200 min-h-[80px] ${getSoundButtonStyle(sound.id)}`}
                >
                  <div className="text-center">
                    <div className="text-sm font-bold mb-1">{sound.name}</div>
                    {selectedSoundsLocal.includes(sound.id) && (
                      <div className="text-xs opacity-90">
                        {/* {selectedSoundsLocal.indexOf(sound.id) === 0 ? '🔵 Sound 1' : '🟢 Sound 2'} */}
                      </div>
                    )}
                  </div>
                </button>
                
                {/* Preview button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSound(sound.id);
                  }}
                  className="absolute top-1 right-1 w-6 h-6 bg-white bg-opacity-90 rounded-full flex items-center justify-center text-xs hover:bg-opacity-100 transition-all shadow-sm"
                  title="Preview sound"
                >
                  🔊
                </button>
              </div>
            ))}
          </div>

          {/* Selected sounds display */}
          <div className="bg-gradient-to-br from-purple-50 via-white to-pink-50 rounded-2xl p-6 max-w-2xl mx-auto border border-purple-100 shadow-lg">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">🎵</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800">Your Sounds</h3>
            </div>
            
            <div className="flex flex-row items-center justify-center gap-4">
              {/* Sound 1 Slot */}
              <div className="relative">
                <div className={`w-38 h-20 rounded-xl border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
                  selectedSoundsLocal.length > 0 
                    ? 'border-blue-400 bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg transform scale-105' 
                    : 'border-blue-300 bg-blue-50 hover:border-blue-400 hover:bg-blue-100'
                }`}>
                  {selectedSoundsLocal.length > 0 ? (
                    <div className="text-center text-white">
                      {/* <div className="text-sm font-bold opacity-90 mb-1">🔵 SOUND 1</div> */}
                      <div className="text-sm font-bold">
                        {playerSoundSet.find(s => s.id === selectedSoundsLocal[0])?.name || 'Unknown'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-blue-600">
                      <div className="text-2xl mb-1">🔵</div>
                      <div className="text-sm font-semibold">Select First Sound</div>
                    </div>
                  )}
                </div>
                {selectedSoundsLocal.length > 0 && (
                  <button
                    onClick={() => playSound(selectedSoundsLocal[0])}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all hover:scale-110 border-2 border-blue-200"
                    title="Preview sound"
                  >
                    <span className="text-blue-600 text-sm">🔊</span>
                  </button>
                )}
              </div>

              {/* Sound 2 Slot */}
              <div className="relative">
                <div className={`w-38 h-20 rounded-xl border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
                  selectedSoundsLocal.length > 1 
                    ? 'border-green-400 bg-gradient-to-br from-green-500 to-green-600 shadow-lg transform scale-105' 
                    : 'border-green-300 bg-green-50 hover:border-green-400 hover:bg-green-100'
                }`}>
                  {selectedSoundsLocal.length > 1 ? (
                    <div className="text-center text-white">
                      {/* <div className="text-sm font-bold opacity-90 mb-1">🟢 SOUND 2</div> */}
                      <div className="text-sm font-bold">
                        {playerSoundSet.find(s => s.id === selectedSoundsLocal[1])?.name || 'Unknown'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-green-600">
                      <div className="text-2xl mb-1">🟢</div>
                      <div className="text-sm font-semibold">
                        {selectedSoundsLocal.length === 0 ? 'Select Second Sound' : 'Add Second Sound'}
                      </div>
                      <div className="text-xs opacity-75 mt-1">(Optional)</div>
                    </div>
                  )}
                </div>
                {selectedSoundsLocal.length > 1 && (
                  <button
                    onClick={() => playSound(selectedSoundsLocal[1])}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all hover:scale-110 border-2 border-green-200"
                    title="Preview sound"
                  >
                    <span className="text-green-600 text-sm">🔊</span>
                  </button>
                )}
              </div>
            </div>

            {/* Preview Combo Button
            {selectedSoundsLocal.length > 0 && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    // Play both selected sounds in sequence using the proper audio system method
                    audioSystem.playSoundsSequentially(selectedSoundsLocal);
                  }}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-bold hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  🎧 Preview Your Combo
                </button>
              </div>
            )} */}
          </div>          
          {/* Submit button */}
          <button 
            onClick={() => {
              // Call the parent's onSubmitSounds but first sync our local selections
              onSelectSounds(selectedSoundsLocal);
              onSubmitSounds();
            }}
            disabled={selectedSoundsLocal.length === 0 || (hasFirstSubmission && timeLeft <= 0)}
            className="w-full max-w-md mx-auto bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-xl font-bold hover:from-green-600 hover:to-green-700 transition-all text-lg disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg"
          >
            {selectedSoundsLocal.length === 0 ? 'Select 1-2 Sounds' : `Submit ${selectedSoundsLocal.length} Sound${selectedSoundsLocal.length > 1 ? 's' : ''}! 🎵`}
          </button>
        </div>
      )}
    </div>
  );
}

export function JudgingComponent({ room, player, onJudgeSubmission, soundEffects }: { 
  room: Room; 
  player: Player; 
  onJudgeSubmission: (submissionIndex: number) => void;
  soundEffects: SoundEffect[];
}) {
  const isJudge = player.id === room.currentJudge;
  
  // Debug logging for submissions
  console.log(`[JUDGING] Component render - Player: ${player.name}, isJudge: ${isJudge}`);
  console.log(`[JUDGING] Room submissions: ${room.submissions.length}`);
  console.log(`[JUDGING] Room randomizedSubmissions: ${room.randomizedSubmissions?.length || 0}`);
  console.log(`[JUDGING] Room randomizedSubmissions data:`, room.randomizedSubmissions);
  const submissionsToShow = room.randomizedSubmissions || room.submissions;
  console.log(`[JUDGING] Submissions to show: ${submissionsToShow.length}`);
  submissionsToShow.forEach((sub, index) => {
    console.log(`[JUDGING] Submission ${index}: ${sub.playerName} - [${sub.sounds.join(', ')}]`);
  });
  
  const playSubmissionSounds = (sounds: string[]) => {
    if (sounds.length === 0) return;
    
    // Filter out any invalid sounds and get filenames
    const validSounds = sounds
      .map(soundId => soundEffects.find(s => s.id === soundId))
      .filter(sound => sound !== undefined);
    
    if (validSounds.length > 0) {
      console.log(`Playing ${validSounds.length} sound(s): [${sounds.join(', ')}]`);
      // Use the proper sequence method that waits for each sound to finish
      audioSystem.playSoundSequence(sounds, 200); // 200ms delay between sounds
    }
  };

  return (
    <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
      {/* <h2 className="text-2xl font-bold text-purple-600 mb-4">Judging Time!</h2> */}
      
      {/* Styled Prompt Display */}
      <div className="bg-purple-100 rounded-2xl p-6 mb-6">
        {/* <h4 className="text-xl font-bold text-purple-800 mb-2">The Prompt:</h4> */}
        <p className="text-lg text-gray-800 font-bold" dangerouslySetInnerHTML={{ __html: room.currentPrompt?.text || '' }}></p>
      </div>
      
      {isJudge ? (
        <p className="text-gray-800 mb-4">Choose the winner!</p>
      ) : (
        <div className="flex items-center justify-center gap-2 mb-4">
          {(() => {
            const judge = room.players.find(p => p.id === room.currentJudge);
            return judge ? (
              <>
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${getPlayerColorClass(judge.color)}`}
                >
                  {judge.emoji || judge.name[0].toUpperCase()}
                </div>
                <p className="text-gray-800">
                  <span className="font-semibold">{judge.name}</span> is choosing the winner...
                </p>
              </>
            ) : (
              <p className="text-gray-800">The judge is choosing the winner...</p>
            );
          })()}
        </div>
      )}
      
      {submissionsToShow.length === 0 ? (
        <div className="bg-yellow-100 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-yellow-800 mb-4">No Submissions Found!</h3>
          <p className="text-yellow-700 text-lg">
            There seems to be an issue - no sound submissions are available for judging.
          </p>
          <div className="mt-4 text-sm text-yellow-600">
            <p>Debug Info:</p>
            <p>Regular submissions: {room.submissions.length}</p>
            <p>Randomized submissions: {room.randomizedSubmissions?.length || 0}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {submissionsToShow.map((submission, index) => (
          <div 
            key={index} 
            className="relative rounded-3xl p-6 transition-all duration-500 bg-gray-100 hover:bg-gray-50 border-2 border-gray-200"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-bold text-gray-800">
                  Submission {index + 1}
                </h4>
                
                {/* Status Indicator */}
                {isJudge ? (
                  <div className="w-4 h-4 rounded-full bg-green-400 animate-pulse"></div>
                ) : (
                  <div className="w-4 h-4 rounded-full bg-purple-400 animate-pulse"></div>
                )}
              </div>

              <div className="space-y-3 mb-4">
                {submission.sounds.map((soundId, soundIndex) => {
                  const sound = soundEffects.find(s => s.id === soundId);
                  
                  return (
                    <div 
                      key={soundIndex} 
                      className="px-4 py-3 rounded-xl transition-all duration-300 bg-white text-gray-800 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">🎵</span>
                        <span className="font-semibold">{sound?.name || soundId}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button 
                  onClick={() => playSubmissionSounds(submission.sounds)}
                  className="w-full bg-blue-500 text-white px-4 py-3 rounded-xl hover:bg-blue-600 transition-colors font-semibold"
                >
                  🔊 Play Sounds
                </button>
                {isJudge && (
                  <button 
                    onClick={() => onJudgeSubmission(index)}
                    className="w-full bg-green-500 text-white px-4 py-3 rounded-xl hover:bg-green-600 transition-colors font-semibold"
                  >
                    🏆 Pick as Winner
                  </button>
                )}
              </div>

              {/* Judge consideration indicator for non-judges */}
              {!isJudge && (
                <div className="mt-4 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <span className="text-purple-600 font-medium text-sm">UNDER REVIEW</span>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
}

export function ResultsComponent({ room, player, roundWinner, soundEffects }: { 
  room: Room; 
  player: Player; 
  roundWinner: { winnerId: string; winnerName: string; winningSubmission: any; submissionIndex: number } | null;
  soundEffects: SoundEffect[];
}) {
  const [isPlayingWinner, setIsPlayingWinner] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const playWinningCombination = async () => {
    if (!roundWinner?.winningSubmission || isPlayingWinner) return;
    
    setIsPlayingWinner(true);
    setPlaybackProgress(0);
    
    try {
      // Create and play audio elements for the winning sounds
      const sounds = roundWinner.winningSubmission.sounds;
      const audioElements: HTMLAudioElement[] = [];
      
      // Prepare audio elements
      sounds.forEach((soundId: string) => {
        const sound = soundEffects.find(s => s.id === soundId);
        if (sound) {
          const soundUrl = `/sounds/Earwax/EarwaxAudio/Audio/${sound.fileName}`;
          const audio = new Audio(soundUrl);
          audio.volume = 0.8;
          audioElements.push(audio);
        }
      });

      // Play sounds sequentially with progress updates
      const playNextSound = async (soundIndex: number) => {
        if (soundIndex >= audioElements.length) {
          setIsPlayingWinner(false);
          setPlaybackProgress(0);
          return;
        }

        const audio = audioElements[soundIndex];
        const progressTimer = setInterval(() => {
          if (audio.duration) {
            const progress = audio.currentTime / audio.duration;
            setPlaybackProgress((soundIndex + progress) / audioElements.length);
          }
        }, 100);

        return new Promise<void>((resolve) => {
          audio.onended = () => {
            clearInterval(progressTimer);
            setTimeout(() => {
              playNextSound(soundIndex + 1).then(resolve);
            }, 300); // Brief pause between sounds
          };
          
          audio.onerror = () => {
            clearInterval(progressTimer);
            console.error(`Failed to play sound ${soundIndex}`);
            setTimeout(() => {
              playNextSound(soundIndex + 1).then(resolve);
            }, 300);
          };
          
          audio.play().catch(console.error);
        });
      };

      await playNextSound(0);
    } catch (error) {
      console.error('Error playing winning combination:', error);
      setIsPlayingWinner(false);
      setPlaybackProgress(0);
    }
  };

  if (!roundWinner) {
    return (
      <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
        <h2 className="text-2xl font-bold text-purple-600 mb-4">Round Results</h2>
        <p className="text-gray-800">Waiting for results...</p>
      </div>
    );
  }
  
  const winnerPlayerDetails = room.players.find(p => p.id === roundWinner.winnerId);

  return (
    <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
      {/* <h2 className="text-2xl font-bold text-purple-600 mb-6">🎉 Round Over! 🎉</h2> */}
      
      {/* Winner Announcement */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl p-8 mb-8 shadow-2xl transform transition-all duration-500 hover:scale-105">
        {/* Decorative elements */}
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-white opacity-10 rounded-full animate-pulse"></div>
        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white opacity-10 rounded-full animate-pulse delay-500"></div>

        <div className="relative z-10 text-center text-white">
          <h2 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">Round Winner!</h2>
          <p className="text-5xl font-black mb-3 drop-shadow-lg">
        {roundWinner.winnerName} 🏆
          </p>
          <div className={`inline-block px-4 py-1 rounded-full mb-4 ${winnerPlayerDetails ? getPlayerColorClass(winnerPlayerDetails.color) : 'bg-white bg-opacity-20'}`}>
        <p className="text-lg font-semibold text-white">
          +1 Point!
        </p>
          </div>
          <p className="text-md italic opacity-90 max-w-md mx-auto">
        For their take on: &quot;<span dangerouslySetInnerHTML={{ __html: room.currentPrompt?.text || '' }}/>&quot;
          </p>
        </div>
      </div>

      {/* Winning Sound Combination Card */}
      {roundWinner.winningSubmission && (
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">🎵 Winning Combination 🎵</h3>
          
          <div className={`relative rounded-3xl p-6 transition-all duration-500 max-w-sm mx-auto ${
            isPlayingWinner 
              ? 'bg-gradient-to-br from-purple-400 to-pink-500 scale-105 shadow-2xl transform -rotate-1' 
              : 'bg-gradient-to-br from-yellow-200 to-yellow-300 hover:scale-102 cursor-pointer'
          }`}
          onClick={playWinningCombination}>
            
            {/* Progress Indicator */}
            {isPlayingWinner && (
              <div className="absolute -top-2 -right-2 w-12 h-12">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-white opacity-30"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-white"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    strokeLinecap="round"
                    strokeDasharray={`${playbackProgress * 100}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-white text-xs font-bold">
                    {Math.round(playbackProgress * 100)}%
                  </div>
                </div>
              </div>
            )}

            {/* Pulsing Animation for Playing */}
            {isPlayingWinner && (
              <>
                <div className="absolute inset-0 rounded-3xl bg-white opacity-20 animate-pulse"></div>
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-purple-400 to-pink-500 opacity-75 blur animate-pulse"></div>
              </>
            )}

            <div className="relative z-10">
              <div className="space-y-3">
                {roundWinner.winningSubmission.sounds.map((soundId: string, index: number) => {
                  const sound = soundEffects.find(s => s.id === soundId);
                  return (
                    <div 
                      key={index} 
                      className={`px-4 py-3 rounded-xl transition-all duration-300 ${
                        isPlayingWinner 
                          ? 'bg-white bg-opacity-90 text-gray-800 shadow-lg' 
                          : 'bg-white text-gray-800 shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-lg">🔊</span>
                        <span className="font-bold">{sound?.name || soundId}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Waveform Animation for Playing */}
              {isPlayingWinner && (
                <div className="mt-4 flex justify-center space-x-1">
                  <div className="w-1 h-3 bg-white rounded-full animate-pulse"></div>
                  <div className="w-1 h-4 bg-white rounded-full animate-pulse"></div>
                  <div className="w-1 h-2 bg-white rounded-full animate-pulse"></div>
                  <div className="w-1 h-4 bg-white rounded-full animate-pulse"></div>
                  <div className="w-1 h-3 bg-white rounded-full animate-pulse"></div>
                  <div className="w-1 h-4 bg-white rounded-full animate-pulse"></div>
                  <div className="w-1 h-2 bg-white rounded-full animate-pulse"></div>
                  <div className="w-1 h-4 bg-white rounded-full animate-pulse"></div>
                </div>
              )}

              {/* Play Button/Status */}
              <div className="mt-4 text-center">
                {isPlayingWinner ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                    <span className="text-white font-bold text-sm">PLAYING</span>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2 text-yellow-800">
                    <span className="text-lg">▶️</span>
                    <span className="font-semibold">Tap to Play</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Scores List */}
      <div className="mt-8 bg-gray-50 rounded-3xl p-6 max-w-lg mx-auto shadow-inner">
        <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Current Standings</h3>
        <ul className="space-y-3">
          {room.players
        .sort((a, b) => b.score - a.score)
        .map((p, index) => {
          const rank = index + 1;
          const isRoundWinner = p.id === roundWinner.winnerId;
          
          let rankIcon = '🏅';
          let rankStyles = 'bg-gray-200 text-gray-700';
          if (rank === 1) {
            rankIcon = '👑';
            rankStyles = 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-md';
          }
          if (rank === 2) {
            rankIcon = '🥈';
            rankStyles = 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 shadow-md';
          }
          if (rank === 3) {
            rankIcon = '🥉';
            rankStyles = 'bg-gradient-to-br from-orange-300 to-orange-500 text-orange-900 shadow-md';
          }

          return (
            <li 
          key={p.id} 
          className={`flex items-center p-3 rounded-2xl shadow-sm transition-all duration-300 ${isRoundWinner ? 'bg-green-100 border-2 border-green-400 scale-105' : 'bg-white'}`}
            >
          <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-black text-sm shadow-md mr-3 ${rankStyles}`}>
            {rankIcon}
          </div>
          <div 
            className={`w-10 h-10 flex-shrink-0 rounded-full ${getPlayerColorClass(p.color)} flex items-center justify-center text-lg shadow-lg mr-3`}
          >
            {p.emoji || p.name[0].toUpperCase()}
          </div>
          <div className="flex-grow">
            <p className="font-bold text-gray-900 text-lg">{p.name}</p>
          </div>
          {isRoundWinner && (
            <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse z-10">
              +1
            </div>
          )}
          <div className="text-right">
            <p className="font-black text-xl text-purple-600">{p.score}</p>
            <p className="text-xs text-gray-500 uppercase">Points</p>
          </div>
            </li>
          );
        })}
        </ul>
      </div>
      {/* Next round / game over will be handled by gameState change */}
    </div>
  );
}

export function GameOverComponent({ room, player }: { room: Room; player: Player }) {
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const overallWinner = sortedPlayers[0];
  const runnerUps = sortedPlayers.slice(1);
  
  return (
    <div className="bg-white rounded-3xl p-6 shadow-lg text-center">
      {/* Winner Spotlight */}
      <div className="mb-8">
        <div className="relative bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 rounded-3xl p-6 mx-auto shadow-2xl transform hover:scale-105 transition-all duration-500">
          {/* Sparkle decorations with staggered animations */}
          {/* <div className="absolute -top-3 -left-3 text-2xl animate-bounce">✨</div>
          <div className="absolute -top-3 -right-3 text-2xl animate-bounce delay-500">🎉</div>
          <div className="absolute -bottom-3 -left-3 text-2xl animate-bounce delay-1000">🏆</div>
          <div className="absolute -bottom-3 -right-3 text-2xl animate-bounce delay-150">⭐</div> */}
          
          {/* Crown above winner */}
          <div className="text-5xl mb-3 animate-bounce text-center">👑</div>
          
          <h4 className="text-2xl font-black text-yellow-900 mb-3 drop-shadow-lg text-center">
            CHAMPION!
          </h4>
          
          {/* Winner Avatar - Large */}
          <div 
            className={`w-20 h-20 rounded-full mx-auto mb-3 ${getPlayerColorClass(overallWinner.color)} flex items-center justify-center text-3xl shadow-2xl ring-4 ring-white ring-opacity-50 transform hover:rotate-12 transition-transform duration-300`}
          >
            {overallWinner.emoji || overallWinner.name[0].toUpperCase()}
          </div>
          
          <p className="text-2xl font-black text-yellow-900 mb-2 drop-shadow-lg text-center">
            {overallWinner.name}
          </p>
          
          <div className="flex items-center justify-center space-x-2 mb-3">
            {/* <div className="text-xl">🎯</div> */}
            <span className="text-3xl font-black text-yellow-900 drop-shadow-lg">
              {overallWinner.score}
            </span>
            <span className="text-lg font-bold text-yellow-800">Points</span>
            {/* <div className="text-xl">🎯</div> */}
          </div>
          
          {/* <p className="text-sm font-bold text-yellow-800 italic text-center">
            "Master of the Fartnoises!"
          </p> */}
                      <p className="text-lg font-bold text-yellow-800 italic text-center">
              {(() => {
              const funnyTitles = [
                "Master of the Fartnoises!",
                "Supreme Sound Selector!",
                "Captain of Comedy!",
                "The Noise Whisperer!",
                "King/Queen of Chaos!",
                "Ultimate Audio Artist!",
                "Grand Wizard of Weird!",
                "The Sound Sage!",
                "Meme Machine Supreme!",
                "Lord/Lady of Laughter!",
                "The Giggle Generator!",
                "Chief of Chuckles!",
                "The Silly Sound Savant!",
                "Baron/Baroness of Bizarre!",
                "The Whoopee Wizard!",
                "Commissioner of Comedy!",
                "The Absurd Audio Ace!",
                "Duke/Duchess of Drollery!"
              ];
              
              // Use winner ID as seed for consistent title per game
              const seedIndex = overallWinner.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
              const titleIndex = seedIndex % funnyTitles.length;
              return funnyTitles[titleIndex];
              })()}
            </p>
        </div>
      </div>

      {/* Final Scores - Compact Mobile Layout */}
      <div className="bg-gray-50 rounded-2xl p-4 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3 text-center">Final Standings</h3>
        <div className="space-y-2">
          {sortedPlayers.map((p, index) => {
            const rank = index + 1;
            let rankIcon = '🏅';
            let rankBg = 'bg-gray-200 text-gray-700';
            
            if (rank === 1) {
              rankIcon = '👑';
              rankBg = 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-md';
            } else if (rank === 2) {
              rankIcon = '🥈';
              rankBg = 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 shadow-md';
            } else if (rank === 3) {
              rankIcon = '🥉';
              rankBg = 'bg-gradient-to-br from-orange-300 to-orange-500 text-orange-900 shadow-md';
            }
            
            return (
              <div 
                key={p.id} 
                className={`flex items-center justify-between p-3 rounded-xl shadow-sm transition-all duration-300 ${
                  rank === 1 ? 'bg-yellow-50 border-2 border-yellow-400 scale-105' : 'bg-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-md ${rankBg}`}>
                    {rankIcon}
                  </div>
                  <div 
                    className={`w-8 h-8 rounded-full ${getPlayerColorClass(p.color)} flex items-center justify-center text-sm shadow-lg`}
                  >
                    {p.emoji || p.name[0].toUpperCase()}
                  </div>
                  <span className={`font-bold ${rank === 1 ? 'text-yellow-900 text-lg' : 'text-gray-900'}`}>
                    {p.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`font-black ${rank === 1 ? 'text-yellow-900 text-xl' : 'text-purple-600 text-lg'}`}>
                    {p.score}
                  </span>
                  <p className="text-xs text-gray-500 uppercase">Points</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Celebration Message */}
      <div className="mb-6 text-center">
        <p className="text-lg text-gray-700 font-semibold mb-3">
          🎵 Thanks for playing Fartnoises! 🎵
        </p>
        <div className="flex justify-center space-x-3 text-2xl animate-pulse">
          <span>🎪</span>
          <span>🎭</span>
          <span>🎨</span>
          <span>🎸</span>
          <span>🎺</span>
        </div>
      </div>
      <button 
        onClick={() => {
          // Clear reconnection data when starting a new game
          localStorage.removeItem('originalPlayerId');
          localStorage.removeItem('lastKnownRoomCode');
          window.location.href = '/';
        }}
        className="bg-blue-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-600 transition-colors text-lg"
      >
        Play Again?
      </button>
    </div>
  );
}

export function PausedForDisconnectionComponent({ room, player, onAttemptReconnection }: { 
  room: Room; 
  player: Player; 
  onAttemptReconnection: () => void;
}) {
  const disconnectedPlayers = room.disconnectedPlayers || [];
  const timeSinceDisconnection = room.disconnectionTimestamp ? 
    Math.floor((Date.now() - room.disconnectionTimestamp) / 1000) : 0;

  return (
    <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
      <h2 className="text-2xl font-bold text-orange-600 mb-4">Game Paused</h2>
      <div className="animate-pulse w-16 h-16 bg-orange-200 rounded-full mx-auto mb-4"></div>
      
      {disconnectedPlayers.length > 0 && (
        <div className="mb-6">
          <p className="text-gray-800 mb-2">Players who disconnected:</p>
          <ul className="space-y-1 max-w-xs mx-auto">
            {disconnectedPlayers.map((p, index) => (
              <li key={index} className={`p-2 rounded ${getPlayerColorClass(p.color)} text-white shadow`}>
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <p className="text-gray-700 mb-4">
        The game is paused while we wait for disconnected players to return.
      </p>
      
      <p className="text-sm text-gray-600 mb-6">
        Time since disconnection: {timeSinceDisconnection}s
      </p>

      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          If you were disconnected, you can try to reconnect:
        </p>
        <button
          onClick={onAttemptReconnection}
          className="bg-green-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-600 transition-colors"
        >
          Attempt Reconnection
        </button>
      </div>
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
