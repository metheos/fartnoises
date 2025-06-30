import React, { useState, useEffect } from 'react';
import { Room } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';
import { Socket } from 'socket.io-client';

interface GamePausedDisplayProps {
  room: Room;
  socket: Socket | null;
}

export default function GamePausedDisplay({ room, socket }: GamePausedDisplayProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [reconnectionTimeLeft, setReconnectionTimeLeft] = useState<number | null>(null);
  const disconnectedPlayers = room.disconnectedPlayers || [];
  
  // Listen for reconnection timer updates and game resumed events
  useEffect(() => {
    if (!socket) return;
    
    const handleReconnectionTimeUpdate = (data: { timeLeft: number; phase: string; disconnectedPlayerName: string }) => {
      if (data.phase === "waiting_for_reconnection") {
        setReconnectionTimeLeft(data.timeLeft);
      }
    };
    
    const handleGameResumed = () => {
      // Clear the timer when game resumes
      setReconnectionTimeLeft(null);
    };
    
    socket.on('reconnectionTimeUpdate', handleReconnectionTimeUpdate);
    socket.on('gameResumed', handleGameResumed);
    
    return () => {
      socket.off('reconnectionTimeUpdate', handleReconnectionTimeUpdate);
      socket.off('gameResumed', handleGameResumed);
    };
  }, [socket]);
  
  // Track time since disconnection for display
  useEffect(() => {
    console.log('[MAIN SCREEN] Disconnection timestamp:', room.disconnectionTimestamp);
    if (!room.disconnectionTimestamp) {
      console.log('[MAIN SCREEN] No disconnection timestamp found, using current time');
      // Fallback: use current time if timestamp is missing
      const fallbackTimestamp = Date.now();
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - fallbackTimestamp) / 1000);
        setTimeElapsed(elapsed);
      }, 1000);
      return () => clearInterval(interval);
    }
    
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - room.disconnectionTimestamp!) / 1000);
      console.log('[MAIN SCREEN] Time elapsed:', elapsed, 'seconds');
      setTimeElapsed(elapsed);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [room.disconnectionTimestamp]);

  return (
    <div className="bg-white rounded-3xl p-6 text-center shadow-2xl transition-all duration-300 min-h-[75vh]">
      {/* Title */}
      <div className="mb-8">
        <div className="text-6xl mb-4 animate-pulse">⏸️</div>
        <h2 className="text-4xl font-bold text-orange-600 mb-4">Game Paused</h2>
        <p className="text-xl text-gray-700">
          Waiting for disconnected player{disconnectedPlayers.length > 1 ? 's' : ''} to return
        </p>
      </div>

      {/* Disconnected Players List */}
      {disconnectedPlayers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">
            Disconnected Player{disconnectedPlayers.length > 1 ? 's' : ''}:
          </h3>
          <div className="flex flex-wrap justify-center gap-4">
            {disconnectedPlayers.map((player, index) => (
              <div 
                key={index}
                className={`${getPlayerColorClass(player.color)} rounded-2xl p-4 text-white shadow-lg transform hover:scale-105 transition-all duration-300`}
              >
                <div className="text-4xl mb-2">
                  {player.emoji || player.name[0].toUpperCase()}
                </div>
                <p className="text-lg font-bold">{player.name}</p>
                <p className="text-sm opacity-90">Disconnected</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timer Display */}
      <div className="mb-8">
        <div className="bg-gray-100 rounded-2xl p-6 mb-4">
          <p className="text-lg text-gray-700 mb-2">Time since disconnection:</p>
          <div className="text-3xl font-bold text-orange-600">
            {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
          </div>
        </div>
        
        {/* Reconnection Timer */}
        {reconnectionTimeLeft !== null && reconnectionTimeLeft > 0 && (
          <div className="bg-blue-100 rounded-2xl p-6">
            <p className="text-lg text-blue-700 mb-2">⏰ Reconnection Timer:</p>
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {reconnectionTimeLeft}s
            </div>
            <div className="w-full bg-blue-200 rounded-full h-3 mx-auto">
              <div 
                className="h-3 rounded-full transition-all duration-1000 bg-blue-500"
                style={{
                  width: `${Math.max(0, Math.min(100, (reconnectionTimeLeft / 30) * 100))}%`
                }}
              ></div>
            </div>
            <p className="text-sm text-blue-600 mt-2">
              {reconnectionTimeLeft > 0 ? 'Waiting for reconnection...' : 'Starting voting process...'}
            </p>
          </div>
        )}
      </div>

      {/* Status Message */}
      {/* <div className="bg-blue-50 rounded-2xl p-6">
        <p className="text-lg text-blue-800 font-semibold mb-2">
          🔄 Automatic reconnection in progress
        </p>
        <p className="text-blue-700">
          Players have been notified and can vote to continue or wait longer
        </p>
      </div> */}

      {/* Animated Waiting Indicator */}
      <div className="mt-8 flex justify-center space-x-2">
        <div className="w-3 h-3 bg-orange-400 rounded-full animate-bounce"></div>
        <div className="w-3 h-3 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-3 h-3 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  );
}
