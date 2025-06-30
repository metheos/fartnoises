import {
  useEffect,
  useRef,
  useCallback,
  Dispatch,
  SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  Room,
  Player,
  GameState,
  GamePrompt,
  SoundSubmission,
} from "@/types/game";
import { audioSystem } from "@/utils/audioSystem";

interface UseSocketManagerParams {
  mode: string | null;
  playerName: string | null;
  roomCode: string | null;
  playerColor: string | null;
  playerEmoji: string | null;
  addDebugLog: (message: string) => void;
  room: Room | null;
  selectedSounds: string[] | null;
  lastRoundNumber: number;
}

interface SocketManagerState {
  isConnected: boolean;
  socket: Socket | null;
}

interface SocketManagerActions {
  setRoom: Dispatch<SetStateAction<Room | null>>;
  setPlayer: Dispatch<SetStateAction<Player | null>>;
  setError: (error: string) => void;
  setLastRoundNumber: (round: number) => void;
  setSelectedSounds: (sounds: string[] | null) => void;
  setRoundWinner: (
    winner: {
      winnerId: string;
      winnerName: string;
      winningSubmission: {
        sounds: string[];
        playerId: string;
        playerName: string;
      };
      submissionIndex: number;
    } | null
  ) => void;
  setTimeLeft: (time: number) => void;
  setIsReconnecting: (reconnecting: boolean) => void;
  setReconnectionVote: (
    vote: {
      disconnectedPlayerName: string;
      timeLeft: number;
      showVoteDialog: boolean;
    } | null
  ) => void;
  setGamePaused: (
    paused: { disconnectedPlayerName: string; timeLeft: number } | null
  ) => void;
}

/**
 * Comprehensive socket management hook for the game client
 * Handles connection, reconnection, event listeners, and lifecycle
 */
export function useSocketManager(
  params: UseSocketManagerParams,
  actions: SocketManagerActions
): SocketManagerState {
  const {
    mode,
    playerName,
    roomCode,
    playerColor,
    playerEmoji,
    addDebugLog,
    room,
    selectedSounds,
    lastRoundNumber,
  } = params;

  const {
    setRoom,
    setPlayer,
    setError,
    setLastRoundNumber,
    setSelectedSounds,
    setRoundWinner,
    setTimeLeft,
    setIsReconnecting,
    setReconnectionVote,
    setGamePaused,
  } = actions;

  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const hasAttemptedConnectionLogic = useRef(false);

  // Initialize audio system
  const initAudio = useCallback(async () => {
    try {
      await audioSystem.initialize();
      addDebugLog("Audio system initialized.");
    } catch (audioError) {
      console.warn("Audio initialization failed:", audioError);
      addDebugLog(`Audio initialization failed: ${audioError}`);
    }
  }, [addDebugLog]);

  // Socket event handlers
  const createEventHandlers = useCallback(
    (currentSocket: Socket) => {
      const handleConnect = () => {
        addDebugLog(
          `Socket connected: ${currentSocket.id}. Attempted Logic: ${
            hasAttemptedConnectionLogic.current
          }, Current room state: ${room ? room.code : "null"}`
        );

        if (!hasAttemptedConnectionLogic.current && !room) {
          addDebugLog("Attempting connection logic (create/join).");
          hasAttemptedConnectionLogic.current = true;

          // Check if this might be a reconnection attempt (only for join mode)
          const originalPlayerId = localStorage.getItem("originalPlayerId");
          const lastKnownRoomCode = localStorage.getItem("lastKnownRoomCode");
          const hasReconnectionData =
            originalPlayerId &&
            originalPlayerId !== currentSocket.id &&
            lastKnownRoomCode;
          const shouldAttemptReconnection =
            hasReconnectionData && mode === "join";

          if (shouldAttemptReconnection) {
            addDebugLog(
              `Attempting reconnection for room: ${lastKnownRoomCode}, player: ${playerName}, originalId: ${originalPlayerId}`
            );
            currentSocket.emit(
              "reconnectToRoom",
              lastKnownRoomCode,
              playerName,
              originalPlayerId,
              (success: boolean, reconnectedRoom?: Room) => {
                if (success && reconnectedRoom) {
                  addDebugLog(
                    `Reconnection successful for room: ${lastKnownRoomCode}`
                  );
                  return;
                } else {
                  addDebugLog(
                    `Reconnection failed, proceeding with original mode: ${mode}`
                  );
                  proceedWithOriginalMode();
                }
              }
            );
          } else {
            if (hasReconnectionData && (mode === "create" || mode === "host")) {
              addDebugLog(
                `Create/host mode detected, clearing old reconnection data and creating fresh room`
              );
              localStorage.removeItem("originalPlayerId");
              localStorage.removeItem("lastKnownRoomCode");
            }
            proceedWithOriginalMode();
          }

          function proceedWithOriginalMode() {
            if (mode === "create" || mode === "host") {
              addDebugLog(
                `Emitting createRoom for player: ${playerName} on socket ${currentSocket.id}`
              );
              const playerData = {
                name: playerName,
                color: playerColor || undefined,
                emoji: playerEmoji || undefined,
              };
              currentSocket.emit(
                "createRoom",
                playerData,
                (newRoomCode: string) => {
                  addDebugLog(
                    `createRoom callback for ${playerName}, room code: ${newRoomCode}. Waiting for roomCreated event.`
                  );
                }
              );
            } else if (mode === "join" && roomCode) {
              addDebugLog(
                `Emitting joinRoom for room: ${roomCode}, player: ${playerName} on socket ${currentSocket.id}`
              );
              const playerData = {
                name: playerName,
                color: playerColor || undefined,
                emoji: playerEmoji || undefined,
              };
              currentSocket.emit(
                "joinRoom",
                roomCode,
                playerData,
                (success: boolean) => {
                  if (!success) {
                    addDebugLog(`joinRoom failed for room: ${roomCode}.`);
                    setError(
                      "Failed to join room. Room may be full, not exist, or game in progress."
                    );
                    hasAttemptedConnectionLogic.current = false;
                  } else {
                    addDebugLog(
                      `joinRoom callback successful for room: ${roomCode}. Waiting for roomJoined event.`
                    );
                  }
                }
              );
            }
          }
        } else {
          addDebugLog(
            `Socket connected, but connection logic already attempted or in room. Attempted: ${hasAttemptedConnectionLogic.current}, Room: ${room?.code}`
          );
        }
      };

      const handleConnectError = (err: Error) => {
        addDebugLog(`Socket connection error: ${err.message}`);
        setError(`Connection failed: ${err.message}`);
        hasAttemptedConnectionLogic.current = false;
      };

      const handleDisconnect = (reason: string) => {
        addDebugLog(
          `Socket disconnected: ${reason}. Socket ID: ${currentSocket.id}`
        );
      };

      const handleRoomCreated = ({
        room: newRoom,
        player: newPlayer,
      }: {
        room: Room;
        player: Player;
      }) => {
        addDebugLog(
          `roomCreated event for room: ${newRoom?.code}. Player: ${newPlayer?.name}. Socket: ${currentSocket.id}`
        );
        setRoom(newRoom);
        setPlayer(newPlayer);
        localStorage.setItem("lastKnownRoomCode", newRoom.code);
        router.replace(
          `/game?mode=join&playerName=${playerName}&roomCode=${newRoom.code}`,
          { scroll: false }
        );
      };

      const handleRoomJoined = ({
        room: newRoom,
        player: newPlayer,
      }: {
        room: Room;
        player: Player;
      }) => {
        addDebugLog(
          `roomJoined event for room: ${newRoom?.code}. Player: ${newPlayer?.name}. Socket: ${currentSocket.id}`
        );
        setRoom(newRoom);
        setPlayer(newPlayer);
        setLastRoundNumber(newRoom.currentRound || 0);
        localStorage.setItem("lastKnownRoomCode", newRoom.code);
      };

      const handleRoomUpdated = (updatedRoom: Room) => {
        addDebugLog(
          `🏠 roomUpdated event for room: ${updatedRoom?.code}, players: ${updatedRoom?.players?.length}. Socket: ${currentSocket.id}`
        );
        addDebugLog(
          `🏠 Current selectedSounds: ${
            selectedSounds ? selectedSounds.join(", ") : "null"
          }`
        );
        if (updatedRoom && updatedRoom.code) {
          setRoom((prevRoom) => {
            const roundChanged =
              !prevRoom || prevRoom.currentRound !== updatedRoom.currentRound;
            addDebugLog(
              `🏠 Room update - prevRound: ${prevRoom?.currentRound}, newRound: ${updatedRoom.currentRound}, roundChanged: ${roundChanged}`
            );
            if (roundChanged) {
              setLastRoundNumber(updatedRoom.currentRound || 0);
              addDebugLog(
                `🏠 Updated lastRoundNumber to: ${
                  updatedRoom.currentRound || 0
                }`
              );
            }
            return updatedRoom;
          });
          const selfPlayer = updatedRoom.players.find(
            (p) =>
              p.id ===
                room?.players?.find((player) => player.id === currentSocket.id)
                  ?.id || p.id === currentSocket.id
          );
          if (selfPlayer) setPlayer(selfPlayer);
        } else {
          addDebugLog("🏠 roomUpdated: Received invalid room data.");
        }
      };

      const handlePlayerJoined = ({ room: updatedRoom }: { room: Room }) => {
        addDebugLog(
          `playerJoined event for room: ${updatedRoom?.code}, players: ${updatedRoom?.players?.length}. Socket: ${currentSocket.id}`
        );
        if (updatedRoom && updatedRoom.code) {
          setRoom(updatedRoom);
        } else {
          addDebugLog("playerJoined: Received invalid room data.");
        }
      };

      const handleGameStateChanged = (
        state: GameState,
        data?: {
          prompts?: GamePrompt[];
          prompt?: GamePrompt;
          judgeId?: string;
          submissions?: SoundSubmission[];
          randomizedSubmissions?: SoundSubmission[];
          currentRound?: number;
        }
      ) => {
        addDebugLog(
          `🎯 gameStateChanged event: ${state}, data: ${JSON.stringify(
            data
          )}. Socket: ${currentSocket.id}`
        );
        addDebugLog(
          `🎯 Current selectedSounds before processing: ${
            selectedSounds ? selectedSounds.join(", ") : "null"
          }`
        );

        console.log(`🎯 RAW DATA RECEIVED:`, data);
        console.log(`🎯 data.submissions:`, data?.submissions);
        console.log(
          `🎯 data.randomizedSubmissions:`,
          data?.randomizedSubmissions
        );

        if (data?.submissions) {
          addDebugLog(`🎯 Received ${data.submissions.length} submissions`);
        }
        if (data?.randomizedSubmissions) {
          addDebugLog(
            `🎯 Received ${data.randomizedSubmissions.length} randomized submissions`
          );
        } else {
          addDebugLog(
            `🎯 NO randomizedSubmissions in data! Keys: ${Object.keys(
              data || {}
            ).join(", ")}`
          );
        }

        if (state === GameState.JUDGE_SELECTION) {
          setRoundWinner(null);
        }

        setRoom((currentRoomVal) => {
          if (currentRoomVal) {
            const isActualNewRound =
              state === GameState.SOUND_SELECTION &&
              currentRoomVal.gameState !== GameState.SOUND_SELECTION &&
              (data?.currentRound !== undefined
                ? data.currentRound !== lastRoundNumber
                : true);

            addDebugLog(
              `🎯 Round check: state=${state}, currentGameState=${currentRoomVal.gameState}, dataRound=${data?.currentRound}, lastRound=${lastRoundNumber}, isNewRound=${isActualNewRound}`
            );

            if (isActualNewRound) {
              setSelectedSounds(null);
              const newRoundNumber =
                data?.currentRound || currentRoomVal.currentRound;
              setLastRoundNumber(newRoundNumber);
              addDebugLog(
                `🎯 RESET selectedSounds for actual new round ${newRoundNumber} (prev state: ${currentRoomVal.gameState} -> ${state})`
              );
            } else {
              addDebugLog(
                `🎯 NOT resetting selectedSounds - state: ${currentRoomVal.gameState} -> ${state}, round: ${currentRoomVal.currentRound}, lastRound: ${lastRoundNumber}`
              );
            }

            return {
              ...currentRoomVal,
              gameState: state,
              ...(data?.prompts && { availablePrompts: data.prompts }),
              ...(data?.prompt && { currentPrompt: data.prompt }),
              ...(data?.judgeId && { currentJudge: data.judgeId }),
              ...(data?.submissions && { submissions: data.submissions }),
              ...(data?.randomizedSubmissions && {
                randomizedSubmissions: data.randomizedSubmissions,
              }),
              ...(data?.currentRound !== undefined && {
                currentRound: data.currentRound,
              }),
            };
          }
          return currentRoomVal;
        });
      };

      const handlePromptSelected = (prompt: GamePrompt) => {
        addDebugLog(
          `promptSelected event: ${prompt.text}. Socket: ${currentSocket.id}`
        );
        setRoom((currentRoomVal) =>
          currentRoomVal ? { ...currentRoomVal, currentPrompt: prompt } : null
        );
      };

      const handleJudgeSelected = (judgeId: string) => {
        addDebugLog(
          `judgeSelected event: ${judgeId}. Socket: ${currentSocket.id}`
        );
        setRoom((currentRoomVal) =>
          currentRoomVal ? { ...currentRoomVal, currentJudge: judgeId } : null
        );
      };

      const handleSoundSubmitted = (submission: {
        playerId: string;
        playerName: string;
        sounds: [string, string];
      }) => {
        addDebugLog(
          `soundSubmitted event by ${submission.playerName}. Socket: ${currentSocket.id}`
        );
        setRoom((currentRoomVal) => {
          if (currentRoomVal) {
            if (
              currentRoomVal.submissions.find(
                (s) => s.playerId === submission.playerId
              )
            ) {
              return currentRoomVal;
            }
            return {
              ...currentRoomVal,
              submissions: [...currentRoomVal.submissions, submission],
            };
          }
          return currentRoomVal;
        });
      };

      const handleRoundComplete = (winnerData: {
        winnerId: string;
        winnerName: string;
        winningSubmission: {
          sounds: string[];
          playerId: string;
          playerName: string;
        };
        submissionIndex: number;
      }) => {
        addDebugLog(
          `roundComplete event: ${JSON.stringify(winnerData)}. Socket: ${
            currentSocket.id
          }`
        );
        if (typeof winnerData === "object" && winnerData.winnerId) {
          setRoundWinner(winnerData);
        }
      };

      const handleErrorEvent = ({ message }: { message: string }) => {
        addDebugLog(
          `Socket error event: ${message}. Socket: ${currentSocket.id}`
        );
        setError(message);
      };

      const handleTimeUpdate = ({
        timeLeft: newTimeLeft,
      }: {
        timeLeft: number;
      }) => {
        setTimeLeft(newTimeLeft);
      };

      const handlePlayerDisconnected = ({
        playerId,
        playerName,
        canReconnect,
      }: {
        playerId: string;
        playerName: string;
        canReconnect: boolean;
      }) => {
        addDebugLog(
          `Player disconnected: ${playerName} (${playerId}), can reconnect: ${canReconnect}`
        );
      };

      const handlePlayerReconnected = ({
        playerId,
        playerName,
      }: {
        playerId: string;
        playerName: string;
      }) => {
        addDebugLog(`Player reconnected: ${playerName} (${playerId})`);
        setIsReconnecting(false);
      };

      const handleReconnectionVoteRequest = ({
        disconnectedPlayerName,
        timeLeft,
      }: {
        disconnectedPlayerName: string;
        timeLeft: number;
      }) => {
        addDebugLog(
          `🗳️ Reconnection vote requested for ${disconnectedPlayerName}, timeLeft: ${timeLeft}s`
        );
        console.log(
          `[CLIENT] Received reconnectionVoteRequest for ${disconnectedPlayerName}, showing vote dialog`
        );

        // Add to global window for debugging - any cast needed for window object extension
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).lastVoteRequest = {
          disconnectedPlayerName,
          timeLeft,
          timestamp: Date.now(),
        };

        setReconnectionVote({
          disconnectedPlayerName,
          timeLeft,
          showVoteDialog: true,
        });
      };

      const handleReconnectionVoteUpdate = ({
        vote,
      }: {
        vote: {
          voterName: string;
          continueWithoutPlayer: boolean;
        };
      }) => {
        addDebugLog(
          `Reconnection vote update: ${vote.voterName} voted ${
            vote.continueWithoutPlayer ? "continue" : "wait"
          }`
        );
      };

      const handleReconnectionVoteResult = ({
        continueWithoutPlayer,
        disconnectedPlayerName,
      }: {
        continueWithoutPlayer: boolean;
        disconnectedPlayerName: string;
      }) => {
        addDebugLog(
          `Reconnection vote result: ${
            continueWithoutPlayer ? "continue" : "wait"
          } for ${disconnectedPlayerName}`
        );
        setReconnectionVote(null);
        if (continueWithoutPlayer) {
          setGamePaused(null);
        }
      };

      const handleGamePausedForDisconnection = ({
        disconnectedPlayerName,
        timeLeft,
      }: {
        disconnectedPlayerName: string;
        timeLeft: number;
      }) => {
        addDebugLog(`Game paused for disconnection: ${disconnectedPlayerName}`);
        setGamePaused({
          disconnectedPlayerName,
          timeLeft,
        });
      };

      const handleReconnectionTimeUpdate = ({
        timeLeft,
        phase,
        disconnectedPlayerName,
      }: {
        timeLeft: number;
        phase: string;
        disconnectedPlayerName: string;
      }) => {
        if (phase === "waiting_for_reconnection") {
          addDebugLog(`Reconnection timer update: ${timeLeft}s remaining`);
          setGamePaused({
            disconnectedPlayerName,
            timeLeft,
          });
        }
      };

      const handleGameResumed = () => {
        addDebugLog("Game resumed after disconnection");
        setGamePaused(null);
        setReconnectionVote(null);
      };

      const handleGameSettingsUpdated = ({
        maxRounds,
        maxScore,
      }: {
        maxRounds: number;
        maxScore: number;
      }) => {
        addDebugLog(
          `Game settings updated: maxRounds=${maxRounds}, maxScore=${maxScore}`
        );
        setRoom((currentRoomVal) => {
          if (currentRoomVal) {
            return {
              ...currentRoomVal,
              maxRounds,
              maxScore,
            };
          }
          return currentRoomVal;
        });
      };

      const handleSoundsRefreshed = ({
        playerId,
        newSounds,
      }: {
        playerId: string;
        newSounds: string[];
      }) => {
        addDebugLog(
          `🔄 Sounds refreshed for player ${playerId}: ${newSounds.length} new sounds`
        );
        console.log(`🔄 Sound IDs: [${newSounds.join(", ")}]`);
        // The room will be updated via the roomUpdated event that follows this event
        // This handler is mainly for logging and potential UI feedback
      };

      const handleTripleSoundActivated = ({
        playerId,
      }: {
        playerId: string;
      }) => {
        addDebugLog(`🎵🎵🎵 Triple sound activated for player ${playerId}`);
        // The room will be updated via the roomUpdated event that follows this event
        // This handler is mainly for logging and potential UI feedback
      };

      return {
        handleConnect,
        handleConnectError,
        handleDisconnect,
        handleRoomCreated,
        handleRoomJoined,
        handleRoomUpdated,
        handlePlayerJoined,
        handleGameStateChanged,
        handlePromptSelected,
        handleJudgeSelected,
        handleSoundSubmitted,
        handleSoundsRefreshed,
        handleTripleSoundActivated,
        handleRoundComplete,
        handleErrorEvent,
        handleTimeUpdate,
        handlePlayerDisconnected,
        handlePlayerReconnected,
        handleReconnectionVoteRequest,
        handleReconnectionVoteUpdate,
        handleReconnectionVoteResult,
        handleGamePausedForDisconnection,
        handleReconnectionTimeUpdate,
        handleGameResumed,
        handleGameSettingsUpdated,
      };
    },
    [
      addDebugLog,
      setRoom,
      setPlayer,
      setError,
      setLastRoundNumber,
      setSelectedSounds,
      setRoundWinner,
      setTimeLeft,
      setIsReconnecting,
      setReconnectionVote,
      setGamePaused,
      room,
      selectedSounds,
      lastRoundNumber,
      mode,
      playerName,
      roomCode,
      playerColor,
      playerEmoji,
      router,
    ]
  );

  // Main socket management effect
  useEffect(() => {
    addDebugLog(
      `Main effect run. Mode: ${mode}, PlayerName: ${playerName}, RoomCode: ${roomCode}, Socket Exists: ${!!socketRef.current}, Attempted Logic: ${
        hasAttemptedConnectionLogic.current
      }, InRoom: ${!!room}`
    );

    if (!playerName) {
      return;
    }

    // Initialize socket if it doesn't exist
    if (!socketRef.current) {
      addDebugLog("No socket instance in ref, creating new one.");
      const newSocket = io({
        path: "/api/socket",
        transports: ["polling", "websocket"],
      });
      socketRef.current = newSocket;
      hasAttemptedConnectionLogic.current = false;
      addDebugLog(`New socket instance created: ${newSocket.id}`);
    }

    const currentSocket = socketRef.current;

    // Initialize audio
    initAudio();

    // Create and register event handlers
    const handlers = createEventHandlers(currentSocket);

    addDebugLog(
      `Registering socket event listeners for socket: ${currentSocket.id}.`
    );

    // Register all event listeners
    currentSocket.on("connect", handlers.handleConnect);
    currentSocket.on("connect_error", handlers.handleConnectError);
    currentSocket.on("disconnect", handlers.handleDisconnect);
    currentSocket.on("roomCreated", handlers.handleRoomCreated);
    currentSocket.on("roomJoined", handlers.handleRoomJoined);
    currentSocket.on("roomUpdated", handlers.handleRoomUpdated);
    currentSocket.on("playerJoined", handlers.handlePlayerJoined);
    currentSocket.on("playerDisconnected", handlers.handlePlayerDisconnected);
    currentSocket.on("playerReconnected", handlers.handlePlayerReconnected);
    currentSocket.on(
      "reconnectionVoteRequest",
      handlers.handleReconnectionVoteRequest
    );
    currentSocket.on(
      "reconnectionVoteUpdate",
      handlers.handleReconnectionVoteUpdate
    );
    currentSocket.on(
      "reconnectionVoteResult",
      handlers.handleReconnectionVoteResult
    );
    currentSocket.on(
      "gamePausedForDisconnection",
      handlers.handleGamePausedForDisconnection
    );
    currentSocket.on(
      "reconnectionTimeUpdate",
      handlers.handleReconnectionTimeUpdate
    );
    currentSocket.on("gameResumed", handlers.handleGameResumed);
    currentSocket.on("gameSettingsUpdated", handlers.handleGameSettingsUpdated);
    currentSocket.on("gameStateChanged", handlers.handleGameStateChanged);
    currentSocket.on("promptSelected", handlers.handlePromptSelected);
    currentSocket.on("judgeSelected", handlers.handleJudgeSelected);
    currentSocket.on("soundSubmitted", handlers.handleSoundSubmitted);
    currentSocket.on("soundsRefreshed", handlers.handleSoundsRefreshed);
    currentSocket.on(
      "tripleSoundActivated",
      handlers.handleTripleSoundActivated
    );
    currentSocket.on("roundComplete", handlers.handleRoundComplete);
    currentSocket.on("error", handlers.handleErrorEvent);
    currentSocket.on("timeUpdate", handlers.handleTimeUpdate);

    // Cleanup function
    return () => {
      addDebugLog(
        `Cleaning up listeners for socket: ${currentSocket.id}. (Effect re-run or unmount preparation)`
      );

      // Remove all event listeners
      currentSocket.off("connect", handlers.handleConnect);
      currentSocket.off("connect_error", handlers.handleConnectError);
      currentSocket.off("disconnect", handlers.handleDisconnect);
      currentSocket.off("roomCreated", handlers.handleRoomCreated);
      currentSocket.off("roomJoined", handlers.handleRoomJoined);
      currentSocket.off("roomUpdated", handlers.handleRoomUpdated);
      currentSocket.off("playerJoined", handlers.handlePlayerJoined);
      currentSocket.off("gameStateChanged", handlers.handleGameStateChanged);
      currentSocket.off("promptSelected", handlers.handlePromptSelected);
      currentSocket.off("judgeSelected", handlers.handleJudgeSelected);
      currentSocket.off("soundSubmitted", handlers.handleSoundSubmitted);
      currentSocket.off("soundsRefreshed", handlers.handleSoundsRefreshed);
      currentSocket.off(
        "tripleSoundActivated",
        handlers.handleTripleSoundActivated
      );
      currentSocket.off("roundComplete", handlers.handleRoundComplete);
      currentSocket.off("error", handlers.handleErrorEvent);
      currentSocket.off("timeUpdate", handlers.handleTimeUpdate);
      currentSocket.off(
        "playerDisconnected",
        handlers.handlePlayerDisconnected
      );
      currentSocket.off("playerReconnected", handlers.handlePlayerReconnected);
      currentSocket.off(
        "reconnectionVoteRequest",
        handlers.handleReconnectionVoteRequest
      );
      currentSocket.off(
        "reconnectionVoteUpdate",
        handlers.handleReconnectionVoteUpdate
      );
      currentSocket.off(
        "reconnectionVoteResult",
        handlers.handleReconnectionVoteResult
      );
      currentSocket.off(
        "gamePausedForDisconnection",
        handlers.handleGamePausedForDisconnection
      );
      currentSocket.off(
        "reconnectionTimeUpdate",
        handlers.handleReconnectionTimeUpdate
      );
      currentSocket.off("gameResumed", handlers.handleGameResumed);
      currentSocket.off(
        "gameSettingsUpdated",
        handlers.handleGameSettingsUpdated
      );
    };
  }, [
    mode,
    playerName,
    roomCode,
    createEventHandlers,
    initAudio,
    addDebugLog,
    room,
  ]);

  // Socket disconnection on component unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        addDebugLog(
          `Component unmounting. Disconnecting socket: ${socketRef.current.id}`
        );
        socketRef.current.disconnect();
        socketRef.current = null;
        hasAttemptedConnectionLogic.current = false;
      }
    };
  }, [addDebugLog]);

  return {
    isConnected: socketRef.current?.connected || false,
    socket: socketRef.current,
  };
}
