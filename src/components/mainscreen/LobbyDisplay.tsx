import React from 'react';
import { Room } from '@/types/game';
import GameSettings from './GameSettings';
import PlayerAvatarGrid from './PlayerAvatarGrid';

interface LobbyDisplayProps {
  room: Room;
}

export default function LobbyDisplay({ room }: LobbyDisplayProps) {
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl transition-all duration-300">
      {/* Game Settings and Main Status */}
      <div className="space-y-4 mb-6">
        {/* Game Settings Row */}
        <GameSettings room={room} />
        
        {/* Main Status Row */}
        <div className="text-center">
          <p className="text-2xl text-gray-800 font-bold">
            {room.players.length < 3
              ? `Only ${room.players.length} joined...`
              : (
                <span className="inline-block text-4xl font-black bg-gradient-to-r from-green-500 via-blue-500 to-purple-600 bg-clip-text text-transparent transform rotate-3 drop-shadow-lg animate-pulse">
                  {`${room.players.length} players ready!`}
                </span>
              )}
          </p>
        </div>
      </div>
      <p className="text-xl text-purple-600 mb-6">
      {room.players.length < 3
        ? "Need at least 3 players to play!"
        : "VIP can start the game!"}
      </p>
      <PlayerAvatarGrid 
        players={room.players}
        variant="lobby"
        className="mb-8"
      />
      <div className="mt-4 flex justify-center space-x-2 animate-pulse text-gray-600">
      <span className="text-2xl">📱</span>
      <span className="text-xl font-semibold bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">
        {room.players.length < 3 
          ? "Grab your devices and join the fun!" 
          : "Ready to make some noise? Let's go!"}
      </span>
      <span className="text-2xl">📱</span>
      </div>
    </div>
  );
}
