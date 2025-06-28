'use client';

import { Room, Player } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';

interface ClientPausedForDisconnectionProps {
  room: Room;
  player: Player;
  onAttemptReconnection: () => void;
}

export default function ClientPausedForDisconnection({ 
  room, 
  player, 
  onAttemptReconnection 
}: ClientPausedForDisconnectionProps) {
  const disconnectedPlayers = room.disconnectedPlayers || [];
  const timeSinceDisconnection = room.disconnectionTimestamp ? 
    Math.floor((Date.now() - room.disconnectionTimestamp) / 1000) : 0;

  return (
    <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
      <h2 className="text-2xl font-bold text-orange-600 mb-4">Game Paused</h2>
      <div className="animate-pulse w-16 h-16 bg-orange-200 rounded-full mx-auto mb-4"></div>
      
      {disconnectedPlayers.length > 0 && (
        <div className="mb-6">
          <p className="text-gray-800 mb-2">Players who disconnected:</p>
          <ul className="space-y-1 max-w-xs mx-auto">
            {disconnectedPlayers.map((p, index) => (
              <li key={index} className={`p-2 rounded ${getPlayerColorClass(p.color)} text-white shadow`}>
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <p className="text-gray-700 mb-4">
        The game is paused while we wait for disconnected players to return.
      </p>
      
      <p className="text-sm text-gray-600 mb-6">
        Time since disconnection: {timeSinceDisconnection}s
      </p>

      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          If you were disconnected, you can try to reconnect:
        </p>
        <button
          onClick={onAttemptReconnection}
          className="bg-green-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-600 transition-colors"
        >
          Attempt Reconnection
        </button>
      </div>
    </div>
  );
}
