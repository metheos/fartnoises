'use client';

import { Room, Player } from '@/types/game';
import ClientGameHeader from './ClientGameHeader';

interface ClientWaitingForPlaybackProps {
  room: Room;
  player: Player;
}

export default function ClientWaitingForPlayback({ 
  room, 
  player 
}: ClientWaitingForPlaybackProps) {
  const judge = room.players.find(p => p.id === room.currentJudge);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 text-white p-4">
      
      {/* Main waiting content */}
      <div className="flex flex-col items-center justify-center flex-1 space-y-8 mt-8">
        
        {/* Animated icon */}
        <div className="text-8xl animate-pulse">
          🎵
        </div>
        
        {/* Main message, Please Wait */}
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold text-white drop-shadow-lg">
            Submissions Are Playing! Please Wait...
          </h2>
          <p className="text-xl text-white/90 max-w-md mx-auto leading-relaxed">
            All submissions are now being played on the main screen for everyone to enjoy.
          </p>
        </div>
      </div>
    </div>
  );
}
