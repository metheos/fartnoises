'use client';

import { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Player, PlayerData, Room, GameState, SoundEffect, GamePrompt } from '@/types/game';
import { getSoundEffects } from '@/data/gameData';
import { audioSystem } from '@/utils/audioSystem';
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
  // Sound playback state management
  const [playingSounds, setPlayingSounds] = useState<Set<string>>(new Set());
  const [playingButtons, setPlayingButtons] = useState<Set<string>>(new Set());
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

  // Helper function to play sound with button state management
  const playSoundWithFeedback = async (soundId: string, buttonId?: string) => {
    // If this specific sound is already playing, ignore the click
    if (playingSounds.has(soundId)) {
      console.log(`Sound ${soundId} is already playing, ignoring click`);
      return;
    }

    // If a buttonId is provided and it's already in a playing state, ignore
    if (buttonId && playingButtons.has(buttonId)) {
      console.log(`Button ${buttonId} is already playing, ignoring click`);
      return;
    }

    try {
      // Mark sound and button as playing
      setPlayingSounds(prev => new Set(prev).add(soundId));
      if (buttonId) {
        setPlayingButtons(prev => new Set(prev).add(buttonId));
      }

      // Play the sound and wait for it to finish
      await audioSystem.playSound(soundId);
    } catch (error) {
      console.error(`Error playing sound ${soundId}:`, error);
    } finally {
      // Clean up - remove from playing sets
      setPlayingSounds(prev => {
        const newSet = new Set(prev);
        newSet.delete(soundId);
        return newSet;
      });
      if (buttonId) {
        setPlayingButtons(prev => {
          const newSet = new Set(prev);
          newSet.delete(buttonId);
          return newSet;
        });
      }
    }
  };

  // Helper function to play sound combinations with button state management
  const playSoundCombinationWithFeedback = async (sounds: string[], buttonId: string) => {
    // If this button is already playing, ignore the click
    if (playingButtons.has(buttonId)) {
      console.log(`Button ${buttonId} is already playing combination, ignoring click`);
      return;
    }

    try {
      // Mark button as playing
      setPlayingButtons(prev => new Set(prev).add(buttonId));

      // Play the sound combination and wait for it to finish
      await audioSystem.playSoundsSequentially(sounds);
    } catch (error) {
      console.error(`Error playing sound combination:`, error);
    } finally {
      // Clean up - remove from playing set
      setPlayingButtons(prev => {
        const newSet = new Set(prev);
        newSet.delete(buttonId);
        return newSet;
      });
    }
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

  const updateGameSetting = (setting: 'maxScore' | 'maxRounds' | 'allowExplicitContent', value: number | boolean) => {
    if (socketRef.current && room && player?.isVIP) {
      addDebugLog(`Updating ${setting} to ${value}`);
      const settings = {
        maxScore: setting === 'maxScore' ? value as number : room.maxScore,
        maxRounds: setting === 'maxRounds' ? value as number : room.maxRounds,
        allowExplicitContent: setting === 'allowExplicitContent' ? value as boolean : room.allowExplicitContent,
      };
      socketRef.current.emit('updateGameSettings', settings);
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
      onVoteOnReconnection={voteOnReconnection}
      onAttemptReconnection={attemptReconnection}
      onGoHome={handleGoHome}
    >
      {/* Game State Components */}
      {room?.gameState === GameState.LOBBY && (
        <ClientLobby 
          room={room} 
          player={player!} 
          onStartGame={startGame}
          onUpdateGameSetting={updateGameSetting}
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
          onSelectPrompt={selectPrompt} 
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
          onJudgeSubmission={judgeSubmission}
          soundEffects={soundEffects}
          socket={socketRef.current}
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
          onAttemptReconnection={attemptReconnection} 
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
