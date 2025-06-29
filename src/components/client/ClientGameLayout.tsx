'use client';

import { ReactNode } from 'react';
import { Room, Player } from '@/types/game';
import ClientGameHeader from './ClientGameHeader';
import { Card, LoadingSpinner, Button, Modal } from '@/components/ui';

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
        <Card className="text-center max-w-md w-full">
          <LoadingSpinner size="xl" message="Connecting to game..." />
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-400 via-pink-500 to-orange-400 flex items-center justify-center p-4">
        <Card className="text-center max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Oops!</h2>
          <p className="text-gray-800 mb-6">{error}</p>
          
          <div className="space-y-3">
            {onAttemptReconnection && !isReconnecting && (
              <Button
                onClick={onAttemptReconnection}
                variant="success"
                className="w-full"
              >
                Try Reconnecting
              </Button>
            )}
            
            {isReconnecting && (
              <div className="mb-4">
                <LoadingSpinner variant="green" message="Attempting to reconnect..." />
              </div>
            )}
            
            {onGoHome && (
              <Button
                onClick={onGoHome}
                variant="purple"
                className="w-full"
              >
                Back to Home
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Loading state when waiting for room/player data
  if (!room || !player) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center">
        <Card className="text-center max-w-lg w-full">
          <LoadingSpinner size="xl" message="Setting up your game..." />
          <div className="mt-4 text-sm text-left">
            <p>Socket Connected: {isConnected ? '✅' : '❌'}</p>
            <p>Room: {room ? `Found (${room.code})` : 'Loading...'}</p>
            <p>Player: {player ? `Found (${player.name})` : 'Loading...'}</p>
          </div>
        </Card>
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
        <Modal
          isOpen={!!(reconnectionVote && reconnectionVote.showVoteDialog && onVoteOnReconnection)}
          title="Player Disconnected"
          onClose={() => {}} // No close handler - must choose
          size="md"
        >
          <p className="text-gray-800 mb-4">
            <span className="font-semibold">{reconnectionVote?.disconnectedPlayerName}</span> has disconnected.
          </p>
          <p className="text-gray-700 mb-6">
            Would you like to continue the game without them or wait a bit longer?
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => onVoteOnReconnection?.(false)}
              variant="primary"
              className="flex-1"
            >
              Wait Longer
            </Button>
            <Button
              onClick={() => onVoteOnReconnection?.(true)}
              variant="danger"
              className="flex-1"
            >
              Continue Without
            </Button>
          </div>
        </Modal>

        {/* Game Paused Overlay */}
        <Modal
          isOpen={!!gamePaused}
          title="Game Paused"
          onClose={() => {}} // No close handler - automatic
          size="md"
        >
          <div className="animate-pulse w-16 h-16 bg-orange-200 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-800 mb-2">
            {gamePaused?.disconnectedPlayerName} has disconnected.
          </p>
          <p className="text-gray-700 mb-4">
            Waiting for them to reconnect or for a player to vote...
          </p>
          <p className="text-sm text-gray-600">
            Time remaining: {gamePaused?.timeLeft}s
          </p>
        </Modal>

        {/* Reconnection Attempt Dialog */}
        <Modal
          isOpen={!!isReconnecting}
          title="Reconnecting..."
          onClose={() => {}} // No close handler - automatic
          size="md"
        >
          <LoadingSpinner size="xl" message="Attempting to reconnect to the game..." />
        </Modal>
      </div>
    </div>
  );
}
