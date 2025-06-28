import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface GameTimerProps {
  /** Maximum time for this phase in seconds */
  maxTime: number;
  /** Socket instance for receiving time updates */
  socket: Socket | null;
  /** Additional className for styling */
  className?: string;
  /** Whether to show the timer (defaults to true) */
  showTimer?: boolean;
}

export default function GameTimer({ 
  maxTime, 
  socket,
  className = "", 
  showTimer = true 
}: GameTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!socket) return;
    
    const handleTimeUpdate = (data: { timeLeft?: number }) => {
      // Server sends simple { timeLeft: number } format during timed phases
      if (data.timeLeft !== undefined) {
        setTimeLeft(data.timeLeft);
      }
    };
    
    socket.on('timeUpdate', handleTimeUpdate);

    return () => {
      socket.off('timeUpdate', handleTimeUpdate);
    };
  }, [socket]);

  if (!showTimer) return null;

  return (
    <div className={`mb-6 ${className}`}>
      <div className="w-full bg-gray-200 rounded-full h-3 mx-auto">
        <div 
          className={`h-3 rounded-full transition-all duration-1000
          ${
            timeLeft !== null
              ? timeLeft <= 5 ? 'bg-red-500' : 'bg-blue-500'
              : 'bg-blue-500 opacity-50'
          }`}
          style={{
            width: timeLeft !== null 
              ? `${Math.max(0, Math.min(100, (timeLeft / maxTime) * 100))}%`
              : '100%'
          }}
        ></div>
      </div>
    </div>
  );
}
