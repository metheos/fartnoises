// Timer management utilities for the fartnoises game server
import { SocketContext } from "../types/socketTypes";

// Timer utility functions
export function startTimer(
  context: SocketContext,
  roomCode: string,
  duration: number,
  onComplete: () => void,
  onTick?: (timeLeft: number) => void
) {
  // Clear any existing timer
  clearTimer(context, roomCode);

  console.log(
    `[${new Date().toISOString()}] [TIMER] Starting timer for room ${roomCode}, duration: ${duration}s`
  );

  let timeLeft = duration;

  const timer = setInterval(() => {
    timeLeft--;

    if (onTick) {
      onTick(timeLeft);
    }

    if (timeLeft <= 0) {
      clearTimer(context, roomCode);
      onComplete();
    }
  }, 1000);

  context.roomTimers.set(roomCode, timer);

  // Send initial time
  if (onTick) {
    onTick(timeLeft);
  }
}

export function clearTimer(context: SocketContext, roomCode: string) {
  const timer = context.roomTimers.get(roomCode);
  if (timer) {
    console.log(
      `[${new Date().toISOString()}] [TIMER] Clearing timer for room ${roomCode}`
    );
    clearInterval(timer);
    context.roomTimers.delete(roomCode);
  } else {
    console.log(
      `[${new Date().toISOString()}] [TIMER] No timer found to clear for room ${roomCode}`
    );
  }
}
