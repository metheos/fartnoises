import { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";

interface UseTimerOptions {
  maxTime: number;
  socket?: Socket | null;
  onTimeUp?: () => void;
  onTimeUpdate?: (timeLeft: number) => void;
}

interface UseTimerReturn {
  timeLeft: number | null;
  isActive: boolean;
  progress: number; // 0-100 percentage
  isTimeUp: boolean;
  isWarning: boolean; // true when timeLeft <= 5
}

/**
 * Custom hook to manage timer state and progress.
 * Handles socket-based timer updates and provides calculated values.
 */
export function useTimer({
  maxTime,
  socket,
  onTimeUp,
  onTimeUpdate,
}: UseTimerOptions): UseTimerReturn {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const onTimeUpRef = useRef(onTimeUp);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  // Update refs to avoid stale closures
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUp, onTimeUpdate]);

  // Listen for timer updates from socket
  useEffect(() => {
    if (!socket) return;

    const handleTimeUpdate = (data: { timeLeft?: number }) => {
      if (data.timeLeft !== undefined) {
        const newTimeLeft = data.timeLeft;
        setTimeLeft(newTimeLeft);
        setIsActive(newTimeLeft > 0);

        // Call update callback
        if (onTimeUpdateRef.current) {
          onTimeUpdateRef.current(newTimeLeft);
        }

        // Call time up callback
        if (newTimeLeft <= 0 && onTimeUpRef.current) {
          onTimeUpRef.current();
        }
      }
    };

    socket.on("timeUpdate", handleTimeUpdate);

    return () => {
      socket.off("timeUpdate", handleTimeUpdate);
    };
  }, [socket]);

  // Reset when maxTime changes
  useEffect(() => {
    setTimeLeft(null);
    setIsActive(false);
  }, [maxTime]);

  // Calculate derived values
  const progress =
    timeLeft !== null
      ? Math.max(0, Math.min(100, (timeLeft / maxTime) * 100))
      : 100;
  const isTimeUp = timeLeft !== null && timeLeft <= 0;
  const isWarning = timeLeft !== null && timeLeft <= 5;

  return {
    timeLeft,
    isActive,
    progress,
    isTimeUp,
    isWarning,
  };
}
