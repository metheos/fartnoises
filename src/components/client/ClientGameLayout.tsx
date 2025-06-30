'use client';

import { ReactNode, useState, useEffect } from 'react';
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
  // Local countdown timer for voting dialog
  const [voteTimeLeft, setVoteTimeLeft] = useState<number | null>(null);

  // Update vote countdown when reconnectionVote changes
  useEffect(() => {
    if (reconnectionVote && reconnectionVote.showVoteDialog) {
      setVoteTimeLeft(reconnectionVote.timeLeft);
      
      const interval = setInterval(() => {
        setVoteTimeLeft((current) => {
          if (current === null || current <= 0) {
            clearInterval(interval);
            return 0;
          }
          return current - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setVoteTimeLeft(null);
    }
  }, [reconnectionVote]);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 px-4 py-2">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <ClientGameHeader room={room} player={player} />
        
        {/* Main Content */}
        {children}

        {/* Reconnection Vote Dialog - Custom Positioned Overlay */}
        {reconnectionVote && reconnectionVote.showVoteDialog && onVoteOnReconnection && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] overflow-y-auto">
            <div className="min-h-screen px-4 py-8 flex flex-col justify-center">
              <div className="bg-white rounded-3xl p-6 mx-auto w-full max-w-lg shadow-2xl">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-purple-600 mb-4">
                    🗳️ Player Disconnected - Your Vote Needed
                  </h2>
                  
                  <div className="bg-red-100 rounded-xl p-4 mb-4">
                    <p className="text-lg text-gray-800 mb-2">
                      <span className="font-bold text-red-600">{reconnectionVote.disconnectedPlayerName}</span> has disconnected from the game.
                    </p>
                    <p className="text-gray-700">
                      As a connected player, you get to decide what happens next.
                    </p>
                  </div>
                  
                  <div className={`rounded-xl p-4 mb-4 ${voteTimeLeft !== null && voteTimeLeft <= 5 ? 'bg-red-200 animate-pulse' : 'bg-orange-100'}`}>
                    <p className={`text-lg font-bold mb-2 ${voteTimeLeft !== null && voteTimeLeft <= 5 ? 'text-red-700' : 'text-orange-600'}`}>
                      ⏰ Time remaining: {voteTimeLeft !== null ? voteTimeLeft : reconnectionVote.timeLeft}s
                    </p>
                    <p className={`text-sm ${voteTimeLeft !== null && voteTimeLeft <= 5 ? 'text-red-600' : 'text-orange-700'}`}>
                      {voteTimeLeft !== null && voteTimeLeft <= 5 ? 'Hurry! Time is running out!' : 'If you don\'t vote, the game will continue without them.'}
                    </p>
                  </div>
                  
                  <p className="text-xl font-semibold text-gray-800 mb-6">
                    What would you like to do?
                  </p>
                  
                  <div className="space-y-3">
                    <Button
                      onClick={() => onVoteOnReconnection(false)}
                      variant="primary"
                      className="w-full text-lg py-4 bg-blue-600 hover:bg-blue-700"
                    >
                      🕒 Wait 30 More Seconds
                    </Button>
                    <Button
                      onClick={() => onVoteOnReconnection(true)}
                      variant="danger"
                      className="w-full text-lg py-4 bg-red-600 hover:bg-red-700"
                    >
                      ▶️ Continue Without Them
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Game Paused Overlay - Only show if NOT voting */}
        <Modal
          isOpen={!!(gamePaused && !(reconnectionVote?.showVoteDialog))}
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
