'use client';

import { ReactNode } from 'react';
import { Room, Player } from '@/types/game';
import ClientGameHeader from './ClientGameHeader';

interface ClientGameLayoutProps {
  room: Room | null;
  player: Player | null;
  children: ReactNode;
  isConnected: boolean;
  error?: string;
  reconnectionVote?: {
    disconnectedPlayerName: string;
    timeLeft: number;
    showVoteDialog: boolean;
  } | null;
  gamePaused?: {
    disconnectedPlayerName: string;
    timeLeft: number;
  } | null;
  isReconnecting?: boolean;
  onVoteOnReconnection?: (continueWithoutPlayer: boolean) => void;
  onAttemptReconnection?: () => void;
  onGoHome?: () => void;
}

export default function ClientGameLayout({
  room,
  player,
  children,
  isConnected,
  error,
  reconnectionVote,
  gamePaused,
  isReconnecting,
  onVoteOnReconnection,
  onAttemptReconnection,
  onGoHome
}: ClientGameLayoutProps) {
  // Loading state when connecting
  if (!isConnected && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 text-center max-w-md w-full">
          <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-800 text-lg">Connecting to game...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-400 via-pink-500 to-orange-400 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 text-center max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Oops!</h2>
          <p className="text-gray-800 mb-6">{error}</p>
          
          <div className="space-y-3">
            {onAttemptReconnection && !isReconnecting && (
              <button
                onClick={onAttemptReconnection}
                className="w-full bg-green-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-600 transition-colors"
              >
                Try Reconnecting
              </button>
            )}
            
            {isReconnecting && (
              <div className="mb-4">
                <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-600">Attempting to reconnect...</p>
              </div>
            )}
            
            {onGoHome && (
              <button
                onClick={onGoHome}
                className="w-full bg-purple-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-600 transition-colors"
              >
                Back to Home
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loading state when waiting for room/player data
  if (!room || !player) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 text-center max-w-lg w-full">
          <div className="animate-pulse w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-800 text-lg">Setting up your game...</p>
          <div className="mt-4 text-sm text-left">
            <p>Socket Connected: {isConnected ? '✅' : '❌'}</p>
            <p>Room: {room ? `Found (${room.code})` : 'Loading...'}</p>
            <p>Player: {player ? `Found (${player.name})` : 'Loading...'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Main game layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <ClientGameHeader room={room} player={player} />
        
        {/* Main Content */}
        {children}

        {/* Reconnection Vote Dialog */}
        {reconnectionVote && reconnectionVote.showVoteDialog && onVoteOnReconnection && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
              <h2 className="text-2xl font-bold text-purple-600 mb-4 text-center">Player Disconnected</h2>
              <p className="text-gray-800 mb-4 text-center">
                <span className="font-semibold">{reconnectionVote.disconnectedPlayerName}</span> has disconnected.
              </p>
              <p className="text-gray-700 mb-6 text-center">
                Would you like to continue the game without them or wait a bit longer?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => onVoteOnReconnection(false)}
                  className="flex-1 bg-blue-500 text-white px-4 py-3 rounded-xl font-bold hover:bg-blue-600 transition-colors"
                >
                  Wait Longer
                </button>
                <button
                  onClick={() => onVoteOnReconnection(true)}
                  className="flex-1 bg-red-500 text-white px-4 py-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
                >
                  Continue Without
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Paused Overlay */}
        {gamePaused && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
              <div className="animate-pulse w-16 h-16 bg-orange-200 rounded-full mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-orange-600 mb-4">Game Paused</h2>
              <p className="text-gray-800 mb-2">
                {gamePaused.disconnectedPlayerName} has disconnected.
              </p>
              <p className="text-gray-700 mb-4">
                Waiting for them to reconnect or for a player to vote...
              </p>
              <p className="text-sm text-gray-600">
                Time remaining: {gamePaused.timeLeft}s
              </p>
            </div>
          </div>
        )}

        {/* Reconnection Attempt Dialog */}
        {isReconnecting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
              <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-purple-600 mb-4">Reconnecting...</h2>
              <p className="text-gray-800">
                Attempting to reconnect to the game...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
