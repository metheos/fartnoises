'use client';

import { Room, Player } from '@/types/game';

interface ClientWaitingForPlaybackProps {
  room: Room;
  player: Player;
}

export default function ClientWaitingForPlayback({ 
  room, 
  player 
}: ClientWaitingForPlaybackProps) {
  // Suppress unused parameter warnings - these props are required by the interface
  // but not currently used in the implementation
  void room;
  void player;

  return (
    <div className="min-h-screen text-white p-4">
      
      {/* Main waiting content */}
      <div className="flex flex-col items-center justify-center flex-1 space-y-8 mt-8">
        
        {/* Animated icon */}
        <div className="text-6xl animate-pulse">
          🎵
        </div>
        
        {/* Main message, Please Wait */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-white drop-shadow-lg">
            Submissions Are Playing! Please Wait...
          </h2>
          <p className="text-lg text-white/90 max-w-md mx-auto leading-relaxed">
            All submissions are now being played on the main screen for everyone to enjoy.
          </p>
        </div>
      </div>
    </div>
  );
}
