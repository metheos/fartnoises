import { useState, useCallback, useRef, useEffect } from "react";
import { Socket } from "socket.io-client";
import { DisconnectedPlayerInfo, Room, Player } from "@/types/game";

interface UsePlayerClaimParams {
  socket: Socket | null;
  addDebugLog: (message: string) => void;
}

interface PlayerClaimState {
  isCheckingDisconnected: boolean;
  disconnectedPlayers: DisconnectedPlayerInfo[];
  canClaimPlayer: boolean;
  isClaiming: boolean;
  claimError: string | null;
}

/**
 * Custom hook for handling device switching and player claiming
 */
export function usePlayerClaim({ socket, addDebugLog }: UsePlayerClaimParams) {
  const [playerClaimState, setPlayerClaimState] = useState<PlayerClaimState>({
    isCheckingDisconnected: false,
    disconnectedPlayers: [],
    canClaimPlayer: false,
    isClaiming: false,
    claimError: null,
  });

  // Use refs to avoid recreating functions when socket changes
  const socketRef = useRef(socket);
  const addDebugLogRef = useRef(addDebugLog);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    addDebugLogRef.current = addDebugLog;
  }, [addDebugLog]);

  const checkDisconnectedPlayers = useCallback(
    (roomCode: string): Promise<{ success: boolean; canClaim: boolean }> => {
      return new Promise((resolve) => {
        if (!socketRef.current) {
          addDebugLogRef.current(
            "[DEVICE-SWITCH] Cannot check disconnected players - no socket connection"
          );
          resolve({ success: false, canClaim: false });
          return;
        }

        setPlayerClaimState((prev) => ({
          ...prev,
          isCheckingDisconnected: true,
          claimError: null,
        }));

        addDebugLogRef.current(
          `[DEVICE-SWITCH] Checking for disconnected players in room ${roomCode}`
        );

        socketRef.current.emit(
          "getDisconnectedPlayers",
          roomCode,
          (result: {
            success: boolean;
            disconnectedPlayers?: DisconnectedPlayerInfo[];
            canClaimPlayer?: boolean;
            error?: string;
          }) => {
            addDebugLogRef.current(
              `[DEVICE-SWITCH] Disconnected players response: ${JSON.stringify(
                result
              )}`
            );

            if (result.success) {
              setPlayerClaimState((prev) => ({
                ...prev,
                isCheckingDisconnected: false,
                disconnectedPlayers: result.disconnectedPlayers || [],
                canClaimPlayer: result.canClaimPlayer || false,
              }));
              resolve({
                success: true,
                canClaim: result.canClaimPlayer || false,
              });
            } else {
              setPlayerClaimState((prev) => ({
                ...prev,
                isCheckingDisconnected: false,
                claimError:
                  result.error || "Failed to check disconnected players",
              }));
              resolve({ success: false, canClaim: false });
            }
          }
        );
      });
    },
    [] // No dependencies since we use refs
  );

  const claimPlayer = useCallback(
    (
      roomCode: string,
      disconnectedPlayerName: string
    ): Promise<{ success: boolean; room?: Room; player?: Player }> => {
      return new Promise((resolve) => {
        if (!socketRef.current) {
          addDebugLogRef.current(
            "[DEVICE-SWITCH] Cannot claim player - no socket connection"
          );
          resolve({ success: false });
          return;
        }

        setPlayerClaimState((prev) => ({
          ...prev,
          isClaiming: true,
          claimError: null,
        }));

        addDebugLogRef.current(
          `[DEVICE-SWITCH] Attempting to claim player ${disconnectedPlayerName} in room ${roomCode}`
        );

        socketRef.current.emit(
          "claimDisconnectedPlayer",
          roomCode,
          disconnectedPlayerName,
          (result: {
            success: boolean;
            room?: Room;
            player?: Player;
            error?: string;
          }) => {
            addDebugLogRef.current(
              `[DEVICE-SWITCH] Claim player response: ${JSON.stringify(result)}`
            );

            setPlayerClaimState((prev) => ({
              ...prev,
              isClaiming: false,
            }));

            if (result.success) {
              addDebugLogRef.current(
                `[DEVICE-SWITCH] Successfully claimed player ${disconnectedPlayerName}`
              );
              resolve({
                success: true,
                room: result.room,
                player: result.player,
              });
            } else {
              const errorMsg =
                result.error || "Failed to claim player identity";
              setPlayerClaimState((prev) => ({
                ...prev,
                claimError: errorMsg,
              }));
              addDebugLogRef.current(
                `[DEVICE-SWITCH] Failed to claim player: ${errorMsg}`
              );
              resolve({ success: false });
            }
          }
        );
      });
    },
    [] // No dependencies since we use refs
  );

  const clearClaimError = useCallback(() => {
    setPlayerClaimState((prev) => ({
      ...prev,
      claimError: null,
    }));
  }, []);

  const resetClaimState = useCallback(() => {
    setPlayerClaimState({
      isCheckingDisconnected: false,
      disconnectedPlayers: [],
      canClaimPlayer: false,
      isClaiming: false,
      claimError: null,
    });
  }, []);

  return {
    playerClaimState,
    checkDisconnectedPlayers,
    claimPlayer,
    clearClaimError,
    resetClaimState,
  };
}
