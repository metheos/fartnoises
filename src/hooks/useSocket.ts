import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  Room,
  GameState,
  Player,
  SoundSubmission,
  GamePrompt,
  SoundEffect,
} from "@/types/game";
import { audioSystem } from "@/utils/audioSystem";

interface UseSocketOptions {
  soundEffects: SoundEffect[];
  isAudioReady: boolean;
  setIsAudioReady: (ready: boolean) => void;
  setCurrentPlayingSubmission: (submission: SoundSubmission | null) => void;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  currentRoom: Room | null;
  setCurrentRoom: React.Dispatch<React.SetStateAction<Room | null>>;
  roundWinner: {
    winnerId: string;
    winnerName: string;
    winningSubmission: {
      sounds: string[];
      playerId: string;
      playerName: string;
    };
    submissionIndex: number;
  } | null;
  setRoundWinner: React.Dispatch<
    React.SetStateAction<{
      winnerId: string;
      winnerName: string;
      winningSubmission: {
        sounds: string[];
        playerId: string;
        playerName: string;
      };
      submissionIndex: number;
    } | null>
  >;
  nuclearExplosion: {
    isExploding: boolean;
    judgeName: string;
  } | null;
  setNuclearExplosion: React.Dispatch<
    React.SetStateAction<{
      isExploding: boolean;
      judgeName: string;
    } | null>
  >;
  joinError: string;
  setJoinError: React.Dispatch<React.SetStateAction<string>>;
  updateURLWithRoom: (roomCode: string | null) => void;
  joinRoom: (roomCode: string) => void;
  leaveRoom: () => void;
}

export function useSocket({
  soundEffects,
  isAudioReady,
  setIsAudioReady,
  setCurrentPlayingSubmission,
}: UseSocketOptions): UseSocketReturn {
  const searchParams = useSearchParams();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [roundWinner, setRoundWinner] = useState<{
    winnerId: string;
    winnerName: string;
    winningSubmission: SoundSubmission;
    submissionIndex: number;
  } | null>(null);
  const [nuclearExplosion, setNuclearExplosion] = useState<{
    isExploding: boolean;
    judgeName: string;
  } | null>(null);
  const [joinError, setJoinError] = useState("");

  // Helper function to update URL with room code
  const updateURLWithRoom = (roomCode: string | null) => {
    const url = new URL(window.location.href);
    if (roomCode) {
      url.searchParams.set("room", roomCode);
      console.log("useSocket: Updating URL with room code:", roomCode);
    } else {
      url.searchParams.delete("room");
      console.log("useSocket: Removing room code from URL");
    }
    window.history.replaceState({}, "", url.toString());
  };

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io({
      path: "/api/socket",
    });

    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      setIsConnected(true);
      console.log("useSocket: Connected to server");

      // Check for room code in URL and auto-join if present
      const urlRoomCode = searchParams?.get("room");
      if (urlRoomCode && urlRoomCode.length === 4) {
        console.log("useSocket: Auto-joining room from URL:", urlRoomCode);
        socketInstance.emit("joinRoomAsViewer", urlRoomCode.toUpperCase());
      }

      // If we were watching a specific room before disconnection, rejoin it
      if (currentRoom) {
        console.log("useSocket: Reconnecting to room", currentRoom.code);
        socketInstance.emit("joinRoomAsViewer", currentRoom.code);
      }
    });

    socketInstance.on("roomUpdated", (updatedRoom) => {
      console.log("useSocket: Room update received:", updatedRoom);
      setCurrentRoom((prev) => {
        // Only update if we're currently watching this room
        if (prev && updatedRoom.code === prev.code) {
          console.log(
            "useSocket: Updating current room from roomUpdated event:",
            updatedRoom
          );

          // If we're in ROUND_RESULTS state and don't have winner data, try to extract it from room
          if (
            updatedRoom.gameState === GameState.ROUND_RESULTS &&
            !roundWinner &&
            updatedRoom.lastWinner &&
            updatedRoom.lastWinningSubmission
          ) {
            console.log(
              "useSocket: Restoring round winner from room data - lastWinner:",
              updatedRoom.lastWinner
            );
            const winnerPlayer = updatedRoom.players.find(
              (p: Player) => p.id === updatedRoom.lastWinner
            );
            if (winnerPlayer) {
              const reconstructedWinner = {
                winnerId: updatedRoom.lastWinner,
                winnerName: winnerPlayer.name,
                winningSubmission: updatedRoom.lastWinningSubmission,
                submissionIndex: updatedRoom.submissions.findIndex(
                  (s: SoundSubmission) => s.playerId === updatedRoom.lastWinner
                ),
              };
              console.log(
                "useSocket: Setting reconstructed winner from roomUpdated:",
                reconstructedWinner
              );
              setRoundWinner(reconstructedWinner);
            }
          }

          return updatedRoom;
        }
        return prev;
      });
    });

    socketInstance.on("roomJoined", (data) => {
      console.log("useSocket: Room joined event received:", data);
      const room = data.room || data;
      if (room) {
        console.log("useSocket: Setting current room to:", room.code);
        setCurrentRoom(room);
        setJoinError("");

        // If joining a room in ROUND_RESULTS state, restore winner data if available
        if (
          room.gameState === GameState.ROUND_RESULTS &&
          room.lastWinner &&
          room.lastWinningSubmission
        ) {
          console.log(
            "useSocket: Restoring round winner from joined room - lastWinner:",
            room.lastWinner
          );
          const winnerPlayer = room.players.find(
            (p: Player) => p.id === room.lastWinner
          );
          if (winnerPlayer) {
            const reconstructedWinner = {
              winnerId: room.lastWinner,
              winnerName: winnerPlayer.name,
              winningSubmission: room.lastWinningSubmission,
              submissionIndex: room.submissions.findIndex(
                (s: SoundSubmission) => s.playerId === room.lastWinner
              ),
            };
            console.log(
              "useSocket: Setting reconstructed winner from roomJoined:",
              reconstructedWinner
            );
            setRoundWinner(reconstructedWinner);
          }
        }

        // Update URL with the room code for persistence
        updateURLWithRoom(room.code);
      }
    });

    socketInstance.on("error", (error) => {
      console.error("useSocket: Socket error:", error);
      setJoinError(error.message || "Failed to connect to room");
      if (error.message && error.message.includes("Room not found")) {
        console.log("useSocket: Room from URL not found, clearing URL");
        updateURLWithRoom(null);
      }
    });

    socketInstance.on("roundComplete", (winnerData) => {
      console.log("useSocket: Round complete event received:", winnerData);
      if (typeof winnerData === "object" && winnerData.winnerId) {
        setRoundWinner(winnerData);
      }
    });

    // Server event data has dynamic structure that varies by game state - runtime type checking needed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socketInstance.on("gameStateChanged", (newState: GameState, data?: any) => {
      console.log("useSocket: Game state changed:", newState, data);

      setCurrentRoom((prevRoom) => {
        if (prevRoom) {
          const updatedData: Partial<Room> = { gameState: newState };

          // Merge relevant fields from data if they exist and are provided
          if (data) {
            if (data.judgeId !== undefined)
              updatedData.currentJudge = data.judgeId;
            if (data.prompt !== undefined)
              updatedData.currentPrompt = data.prompt;
            if (data.prompts !== undefined)
              updatedData.availablePrompts = data.prompts as GamePrompt[];
            if (data.submissions !== undefined)
              updatedData.submissions = data.submissions as SoundSubmission[];
            if (data.currentJudge !== undefined)
              updatedData.currentJudge = data.currentJudge;
            if (data.currentPrompt !== undefined)
              updatedData.currentPrompt = data.currentPrompt;
            if (data.availablePrompts !== undefined)
              updatedData.availablePrompts =
                data.availablePrompts as GamePrompt[];
            if (data.players !== undefined)
              updatedData.players = data.players as Player[];
            if (data.currentRound !== undefined)
              updatedData.currentRound = data.currentRound;
          }

          const newRoom = { ...prevRoom, ...updatedData };

          // Play prompt audio when transitioning to sound selection
          if (
            newState === GameState.SOUND_SELECTION &&
            newRoom.currentPrompt &&
            newRoom.currentPrompt.audioFile
          ) {
            console.log(
              "useSocket: Playing prompt audio:",
              newRoom.currentPrompt.audioFile
            );
            const audioFile = newRoom.currentPrompt.audioFile;
            audioSystem
              .initialize()
              .then(() => {
                audioSystem.loadAndPlayPromptAudio(audioFile);
              })
              .catch((error) => {
                console.error(
                  "useSocket: Failed to initialize audio system for prompt playback:",
                  error
                );
              });
          }

          return newRoom;
        }
        return prevRoom;
      });

      // Clear round winner when starting a new round or returning to lobby
      if (
        newState === GameState.JUDGE_SELECTION ||
        newState === GameState.LOBBY
      ) {
        setRoundWinner(null);
      }
    });

    socketInstance.on("soundSubmitted", (submission) => {
      console.log("useSocket: Sound submission received:", submission);
      setCurrentRoom((prev) => {
        if (prev) {
          const existingSubmission = prev.submissions.find(
            (s) => s.playerId === submission.playerId
          );
          if (existingSubmission) {
            return prev;
          }

          return {
            ...prev,
            submissions: [...prev.submissions, submission],
          };
        }
        return prev;
      });
    });

    socketInstance.on("promptSelected", (prompt: GamePrompt) => {
      console.log("useSocket: Prompt selection received:", prompt);
      setCurrentRoom((prev) => {
        if (prev) {
          return { ...prev, currentPrompt: prompt };
        }
        return prev;
      });
    });

    socketInstance.on("judgeSelected", (judgeId: string) => {
      console.log("useSocket: Judge selection received:", judgeId);
      setCurrentRoom((prev) => {
        if (prev) {
          return { ...prev, currentJudge: judgeId };
        }
        return null;
      });
    });

    socketInstance.on("timeUpdate", (data: { timeLeft: number }) => {
      console.log("useSocket: Time update received:", data);
    });

    // Server event data has optional dynamic structure - runtime type checking needed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socketInstance.on("playbackStarted", (data?: any) => {
      console.log("useSocket: Playback started:", data);
      if (data && data.submissions) {
        setCurrentRoom((prev) =>
          prev ? { ...prev, submissions: data.submissions } : null
        );
      }
    });

    // Server event data contains winner information with dynamic structure - runtime type checking needed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socketInstance.on("winnerSelected", (data: any) => {
      console.log("useSocket: Winner selected:", data);
      if (data) {
        setRoundWinner(data);
      }
    });

    // Server event data contains disconnection info with dynamic structure - runtime type checking needed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socketInstance.on("gamePausedForDisconnection", (data: any) => {
      console.log("useSocket: Game paused for disconnection:", data);
    });

    socketInstance.on("gameResumed", () => {
      console.log("useSocket: Game resumed");
    });

    socketInstance.on("roomClosed", (data: { roomCode: string }) => {
      console.log("useSocket: Room closed:", data.roomCode);
      setCurrentRoom(null);
      setRoundWinner(null);
      setJoinError("");
      updateURLWithRoom(null);
    });

    // Server event data contains reconnection info with dynamic structure - runtime type checking needed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socketInstance.on("playerReconnected", (data: any) => {
      console.log("useSocket: Player reconnected:", data);
    });

    // Server event data contains game start info with dynamic structure - runtime type checking needed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socketInstance.on("gameStarted", (data: any) => {
      console.log("useSocket: Game started:", data);
    });

    socketInstance.on(
      "gameSettingsUpdated",
      (settings: { maxRounds: number; maxScore: number }) => {
        console.log("useSocket: Game settings updated:", settings);
        setCurrentRoom((prev) => {
          if (prev) {
            return {
              ...prev,
              maxRounds: settings.maxRounds,
              maxScore: settings.maxScore,
            };
          }
          return prev;
        });
      }
    );

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
      console.log("useSocket: Disconnected from server");
    });

    // Handler for judging phase playback
    socketInstance.on(
      "playJudgingSubmission",
      // Server event contains submission data with dynamic structure - runtime type checking needed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (submission: any, submissionIndex: number) => {
        console.log(
          "🎵 useSocket: Play judging submission event:",
          submission,
          "index:",
          submissionIndex
        );

        setCurrentPlayingSubmission(submission);

        if (!isAudioReady) {
          console.log(
            "🎵 useSocket: Audio not ready, attempting to activate..."
          );
          try {
            await audioSystem.initialize();
            setIsAudioReady(true);
          } catch {
            console.error(
              "🎵 useSocket: Failed to activate audio, user interaction required"
            );
            setCurrentPlayingSubmission(null);
            return;
          }
        }

        try {
          const sounds = submission.sounds;
          console.log(
            "🎵 useSocket: Playing judging submission sounds:",
            sounds
          );

          for (let i = 0; i < sounds.length; i++) {
            console.log(
              `🎵 useSocket: Playing sound ${i + 1} of ${sounds.length}: ${
                sounds[i]
              }`
            );

            const sound = soundEffects.find(
              (s: SoundEffect) => s.id === sounds[i]
            );
            if (sound) {
              try {
                await audioSystem.loadSound(sound.id, sound.fileName);
                await audioSystem.playSound(sound.id);
                console.log(`🎵 useSocket: Sound ${i + 1} finished playing`);
              } catch (audioError) {
                console.error(
                  `🎵 useSocket: AudioSystem failed for ${sound.name}, falling back to HTML Audio:`,
                  audioError
                );

                const soundUrl = `/sounds/Earwax/EarwaxAudio/Audio/${sound.fileName}`;
                const audio = new Audio(soundUrl);
                audio.volume = 0.7;

                await new Promise<void>((resolve, reject) => {
                  audio.onended = () => {
                    console.log(
                      `🎵 useSocket: Sound ${i + 1} finished playing (fallback)`
                    );
                    resolve();
                  };
                  audio.onerror = () => {
                    console.error(
                      `🎵 useSocket: Fallback audio also failed for: ${sound.name}`
                    );
                    reject(new Error(`Failed to play sound: ${sound.name}`));
                  };
                  audio.play().catch(reject);
                });
              }

              if (i < sounds.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 300));
              }
            } else {
              console.warn(
                `🎵 useSocket: Sound effect not found for ID: ${sounds[i]}`
              );
            }
          }
          console.log("🎵 useSocket: Judging submission playback complete");
        } catch (error) {
          console.error(
            "🎵 useSocket: Error playing judging submission sounds:",
            error
          );
        } finally {
          setCurrentPlayingSubmission(null);
        }
      }
    );

    // Nuclear option handler - triggers explosion animation
    socketInstance.on(
      "nuclearOptionTriggered",
      (data: { judgeId: string; judgeName: string; roomCode: string }) => {
        console.log(
          "useSocket: Nuclear option triggered by judge:",
          data.judgeName
        );

        // Set explosion state in the main screen
        setNuclearExplosion({
          isExploding: true,
          judgeName: data.judgeName,
        });
      }
    );

    return () => {
      socketInstance.disconnect();
    };
    // Complex dependency management for socket connection - intentionally simplified deps to avoid reconnection loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    soundEffects,
    isAudioReady,
    setIsAudioReady,
    setCurrentPlayingSubmission,
  ]);

  // Handle URL parameters
  useEffect(() => {
    const urlRoomCode = searchParams?.get("room");
    if (urlRoomCode && urlRoomCode.length === 4) {
      const upperRoomCode = urlRoomCode.toUpperCase();
      console.log("useSocket: Found room code in URL:", upperRoomCode);

      // If we're connected and not already in this room, auto-join
      if (
        socket &&
        socket.connected &&
        (!currentRoom || currentRoom.code !== upperRoomCode)
      ) {
        console.log("useSocket: Auto-joining from URL change:", upperRoomCode);
        socket.emit("joinRoomAsViewer", upperRoomCode);
      }
    } else if (!urlRoomCode && currentRoom) {
      // URL was cleared but we still have a room - user navigated away
      console.log("useSocket: URL cleared, leaving current room");
      setCurrentRoom(null);
      setRoundWinner(null);
      setJoinError("");
    }
  }, [searchParams, socket, currentRoom]);

  const joinRoom = (roomCode: string) => {
    if (roomCode.length === 4) {
      setJoinError("");
      console.log("Joining room as viewer:", roomCode.toUpperCase());
      if (socket && socket.connected) {
        socket.emit("joinRoomAsViewer", roomCode.toUpperCase());
      }
    } else {
      setJoinError("Room code must be 4 letters");
    }
  };

  const leaveRoom = () => {
    setCurrentRoom(null);
    setRoundWinner(null);
    setJoinError("");
    updateURLWithRoom(null);
  };

  return {
    socket,
    isConnected,
    currentRoom,
    setCurrentRoom,
    roundWinner,
    setRoundWinner,
    nuclearExplosion,
    setNuclearExplosion,
    joinError,
    setJoinError,
    updateURLWithRoom,
    joinRoom,
    leaveRoom,
  };
}
