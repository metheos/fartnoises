import { Room } from '@/types/game';
import { useState, useEffect } from 'react';

interface GameHeaderProps {
  /** Room object containing game info */
  room: Room;
  /** Additional CSS classes */
  className?: string;
}

export default function GameHeader({ 
  room, 
  className = "" 
}: GameHeaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // Check initial state
    setIsFullscreen(!!document.fullscreenElement);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  return (
    <div className={`${className}`}>
      {/* Room code positioned fixed in bottom left of viewport */}
      <div className="fixed bottom-2 left-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl px-6 py-2 shadow-xl z-10 transform transition-transform duration-300 border-4 border-white ">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-purple-100 opacity-80 tracking-wide">ROOM</span>
            <h2 className="text-2xl font-black text-white tracking-wider drop-shadow-lg -mt-1">
              {room.code}
            </h2>
          </div>
          
          {/* Fullscreen button - only show when not in fullscreen */}
          {!isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="bg-white/20 hover:bg-white/30 rounded-lg p-2 transition-colors duration-200 border border-white/30 hover:border-white/50"
              title="Enter fullscreen"
              aria-label="Enter fullscreen mode"
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="text-white"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Fartnoises logo positioned fixed in bottom right of viewport */}
      <div className="fixed bottom-2 right-2 bg-gradient-to-r from-green-400 to-blue-500 rounded-2xl px-4 py-2 shadow-xl z-10 transform transition-transform duration-300 border-4 border-white">
        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-black text-white tracking-wide drop-shadow-lg">
            🎵💨 fartnoises
          </h1>
          <span className="text-xs font-medium text-green-100 opacity-80 tracking-wide -mt-1">
            THE GAME
          </span>
        </div>
      </div>
      
      {/* Commented out other elements */}
      {/* 
      <div className="bg-white rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xl text-gray-800">Round {room.currentRound} of {room.maxRounds}</p>
          </div>
          <div className="text-right">
            <p className="text-lg text-gray-800">{getGameStateDisplay(room.gameState)}</p>
            <p className="text-2xl font-bold text-purple-600">{room.players.length} Players</p>
          </div>
        </div>
      </div>
      */}
    </div>
  );
}
