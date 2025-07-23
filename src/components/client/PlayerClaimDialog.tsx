'use client';

import { useState } from 'react';
import { DisconnectedPlayerInfo } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';
import { Card, Button, PlayerAvatar } from '@/components/ui';

interface PlayerClaimDialogProps {
  disconnectedPlayers: DisconnectedPlayerInfo[];
  isLoading: boolean;
  error: string | null;
  onClaimPlayer: (playerName: string) => void;
  onCancel: () => void;
}

export default function PlayerClaimDialog({ 
  disconnectedPlayers, 
  isLoading, 
  error, 
  onClaimPlayer,
  onCancel 
}: PlayerClaimDialogProps) {
  console.log('[DEBUG] PlayerClaimDialog MOUNTING with:', { disconnectedPlayers, isLoading, error });
  console.log('[DEBUG] PlayerClaimDialog disconnectedPlayers:', disconnectedPlayers);
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);

  const handleClaim = () => {
    if (selectedPlayerName) {
      onClaimPlayer(selectedPlayerName);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <Card className="max-w-md w-full text-center space-y-4">
        <div className="space-y-2">
          <div className="text-3xl">🔄</div>
          <h2 className="text-xl font-bold text-gray-800">
            Device Switch Detected
          </h2>
          <p className="text-gray-600 text-sm">
            We found disconnected players in this room. If your device crashed or you switched devices, 
            you can reclaim your player identity below:
          </p>
          <div className="text-xs text-gray-400">
            Debug: disconnectedPlayers length = {disconnectedPlayers?.length || 0}
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <h3 className="font-semibold text-gray-700">Select Your Player:</h3>
          
          {disconnectedPlayers && disconnectedPlayers.length > 0 ? (
            disconnectedPlayers.map((player) => (
              <div
                key={player.socketId}
                className={`border-2 rounded-xl p-3 cursor-pointer transition-all ${
                  selectedPlayerName === player.name
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedPlayerName(player.name)}
              >
                <div className="flex items-center space-x-3">
                  <PlayerAvatar 
                    player={{
                      id: player.socketId,
                      name: player.name,
                      color: player.color,
                      emoji: player.emoji,
                      score: 0,
                      likeScore: 0,
                      isVIP: false,
                    }}
                    size="sm"
                    showName={false}
                  />
                  <div className="flex-grow text-left">
                    <div className="font-semibold text-gray-800">
                      {player.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      Disconnected {Math.round((Date.now() - player.disconnectedAt) / 1000)}s ago
                    </div>
                  </div>
                  {selectedPlayerName === player.name && (
                    <div className="text-blue-500">
                      <span className="text-lg">✓</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-gray-500 italic">
              No disconnected players found. Props: {JSON.stringify({ disconnectedPlayers, length: disconnectedPlayers?.length })}
            </div>
          )}
        </div>

        <div className="flex space-x-2 pt-2">
          <Button
            onClick={onCancel}
            variant="secondary"
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleClaim}
            disabled={isLoading || !selectedPlayerName}
            className="flex-1"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Claiming...</span>
              </div>
            ) : (
              'Claim Player'
            )}
          </Button>
        </div>

        <div className="text-xs text-gray-500 pt-2 border-t">
          If you're a new player, close this dialog and create a new player instead.
        </div>
      </Card>
    </div>
  );
}
