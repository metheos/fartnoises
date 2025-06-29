import { useCallback } from "react";
import { Socket } from "socket.io-client";
import { Room, Player } from "@/types/game";

interface UseGameActionsParams {
  socket: Socket | null;
  room: Room | null;
  player: Player | null;
  addDebugLog: (message: string) => void;
}

/**
 * Custom hook for game action handlers
 */
export function useGameActions({
  socket,
  room,
  player,
  addDebugLog,
}: UseGameActionsParams) {
  const startGame = useCallback(() => {
    if (socket && room) {
      addDebugLog(`Emitting startGame on socket ${socket.id}`);
      socket.emit("startGame");
    }
  }, [socket, room, addDebugLog]);

  const selectPrompt = useCallback(
    (promptId: string) => {
      if (socket && room) {
        addDebugLog(
          `Emitting selectPrompt: ${promptId} on socket ${socket.id}`
        );
        socket.emit("selectPrompt", promptId);
      }
    },
    [socket, room, addDebugLog]
  );

  const submitSounds = useCallback(
    (selectedSounds: string[]) => {
      if (socket && room && selectedSounds) {
        addDebugLog(
          `🔊 Emitting submitSounds: ${selectedSounds.join(", ")} on socket ${
            socket.id
          }`
        );
        socket.emit("submitSounds", selectedSounds);
        addDebugLog(
          `🔊 Clearing MY selectedSounds after submission (socket ${socket.id})`
        );
      }
    },
    [socket, room, addDebugLog]
  );

  const judgeSubmission = useCallback(
    (submissionIndex: number) => {
      if (socket && room) {
        addDebugLog(
          `Emitting selectWinner: ${submissionIndex} on socket ${socket.id}`
        );
        socket.emit("selectWinner", submissionIndex.toString());
      }
    },
    [socket, room, addDebugLog]
  );

  const voteOnReconnection = useCallback(
    (continueWithoutPlayer: boolean) => {
      if (socket && room) {
        addDebugLog(
          `Voting on reconnection: ${
            continueWithoutPlayer ? "continue" : "wait"
          }`
        );
        socket.emit("voteOnReconnection", continueWithoutPlayer);
      }
    },
    [socket, room, addDebugLog]
  );

  const attemptReconnection = useCallback(
    (
      playerName: string,
      roomCode: string,
      setIsReconnecting: (value: boolean) => void,
      setRoom: (room: Room | null) => void,
      setPlayer: (player: Player | null) => void,
      setError: (error: string) => void
    ) => {
      if (!playerName || !roomCode) return;

      setIsReconnecting(true);
      addDebugLog("Attempting to reconnect...");

      // Try to get the original player ID from localStorage or use current socket ID
      const originalPlayerId =
        localStorage.getItem("originalPlayerId") || socket?.id || "";

      if (socket) {
        socket.emit(
          "reconnectToRoom",
          roomCode,
          playerName,
          originalPlayerId,
          (success: boolean, reconnectedRoom?: Room) => {
            if (success && reconnectedRoom) {
              addDebugLog("Reconnection successful");
              setRoom(reconnectedRoom);
              const reconnectedPlayer = reconnectedRoom.players.find(
                (p) => p.name === playerName
              );
              if (reconnectedPlayer) {
                setPlayer(reconnectedPlayer);
              }
              setIsReconnecting(false);
              setError("");
            } else {
              addDebugLog("Reconnection failed");
              setIsReconnecting(false);
              setError(
                "Failed to reconnect. The game may have continued without you."
              );
            }
          }
        );
      }
    },
    [socket, addDebugLog]
  );

  const voteOnReconnectionWithCleanup = useCallback(
    (
      continueWithoutPlayer: boolean,
      setReconnectionVote: (
        vote: {
          disconnectedPlayerName: string;
          timeLeft: number;
          showVoteDialog: boolean;
        } | null
      ) => void
    ) => {
      if (socket && room) {
        addDebugLog(
          `Voting on reconnection: ${
            continueWithoutPlayer ? "continue" : "wait"
          }`
        );
        socket.emit("voteOnReconnection", continueWithoutPlayer);
        setReconnectionVote(null);
      }
    },
    [socket, room, addDebugLog]
  );

  const updateGameSetting = useCallback(
    (
      setting: "maxScore" | "maxRounds" | "allowExplicitContent",
      value: number | boolean
    ) => {
      if (socket && room && player?.isVIP) {
        addDebugLog(`Updating ${setting} to ${value}`);
        const settings = {
          maxScore: setting === "maxScore" ? (value as number) : room.maxScore,
          maxRounds:
            setting === "maxRounds" ? (value as number) : room.maxRounds,
          allowExplicitContent:
            setting === "allowExplicitContent"
              ? (value as boolean)
              : room.allowExplicitContent,
        };
        socket.emit("updateGameSettings", settings);
      }
    },
    [socket, room, player, addDebugLog]
  );

  const refreshSounds = useCallback(() => {
    if (socket && room && player) {
      addDebugLog(`🔄 Requesting new sound set for ${player.name}`);
      socket.emit("refreshSounds");
    }
  }, [socket, room, player, addDebugLog]);

  const activateTripleSound = useCallback(() => {
    if (socket && room && player) {
      addDebugLog(`🎵🎵🎵 Activating triple sound ability for ${player.name}`);
      socket.emit("activateTripleSound");
    }
  }, [socket, room, player, addDebugLog]);

  return {
    startGame,
    selectPrompt,
    submitSounds,
    refreshSounds,
    activateTripleSound,
    judgeSubmission,
    voteOnReconnection,
    voteOnReconnectionWithCleanup,
    attemptReconnection,
    updateGameSetting,
  };
}
