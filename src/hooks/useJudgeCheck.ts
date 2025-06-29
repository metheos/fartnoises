import { useMemo } from "react";
import { Room, Player } from "@/types/game";

interface UseJudgeCheckOptions {
  /** Size for JudgeDisplay component */
  displaySize?: "sm" | "md" | "lg";
  /** Whether to show compact judge display */
  isCompact?: boolean;
  /** Custom message to show with judge display */
  customMessage?: string;
  /** Default message when player is not judge */
  waitingMessage?: string;
}

/**
 * Custom hook for judge-related logic and display components
 * Provides consistent judge checking and display patterns across components
 */
export function useJudgeCheck(
  room: Room | null,
  player: Player | null,
  options: UseJudgeCheckOptions = {}
) {
  const {
    displaySize = "md",
    isCompact = false,
    customMessage,
    waitingMessage = "Waiting for the Judge...",
  } = options;

  const judgeInfo = useMemo(() => {
    if (!room || !player) {
      return {
        isJudge: false,
        judge: null,
        judgeId: null,
      };
    }

    const isJudge = player.id === room.currentJudge;
    const judge = room.players.find((p) => p.id === room.currentJudge) || null;

    return {
      isJudge,
      judge,
      judgeId: room.currentJudge,
    };
  }, [room, player]);

  const getJudgeDisplayProps = useMemo(() => {
    if (!judgeInfo.judge) return null;

    return {
      judge: judgeInfo.judge,
      size: displaySize,
      isCompact,
      message: customMessage,
    };
  }, [judgeInfo.judge, displaySize, isCompact, customMessage]);

  const getWaitingMessage = useMemo(() => {
    if (judgeInfo.isJudge) return null;

    return customMessage || waitingMessage;
  }, [judgeInfo.isJudge, customMessage, waitingMessage]);

  const renderJudgeStatus = useMemo(() => {
    if (judgeInfo.isJudge) {
      return { type: "judge" as const };
    }

    if (judgeInfo.judge) {
      return {
        type: "waiting" as const,
        judgeDisplayProps: getJudgeDisplayProps,
        waitingMessage: getWaitingMessage,
      };
    }

    return { type: "no-judge" as const };
  }, [
    judgeInfo.isJudge,
    judgeInfo.judge,
    getJudgeDisplayProps,
    getWaitingMessage,
  ]);

  return {
    ...judgeInfo,
    judgeDisplayProps: getJudgeDisplayProps,
    waitingMessage: getWaitingMessage,
    renderJudgeStatus,
  };
}
