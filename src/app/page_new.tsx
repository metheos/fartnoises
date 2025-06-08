'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isMainScreen, setIsMainScreen] = useState(false);
  const router = useRouter();

  const handleCreateRoom = () => {
    if (playerName.trim()) {
      router.push(`/game?mode=create&name=${encodeURIComponent(playerName.trim())}`);
    }
  };

  const handleJoinRoom = () => {
    if (playerName.trim() && roomCode.trim()) {
      router.push(`/game?mode=join&name=${encodeURIComponent(playerName.trim())}&room=${roomCode.trim().toUpperCase()}`);
    }
  };

  const handleMainScreen = () => {
    router.push('/main-screen');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 transform hover:scale-105 transition-transform duration-300">
        {/* Game Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-gray-800 mb-2 tracking-wider transform rotate-1">
            fartnoises
          </h1>
          <p className="text-gray-600 text-lg font-medium">
            The silly sound game
          </p>
          <div className="flex justify-center space-x-2 mt-4">
            <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
        </div>

        {/* Player Name Input */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 transition-colors text-lg"
            maxLength={20}
          />
        </div>

        {/* Room Code Input */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Room Code (to join existing game)
          </label>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="ABCD"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 transition-colors text-lg text-center tracking-widest font-mono"
            maxLength={4}
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleCreateRoom}
            disabled={!playerName.trim()}
            className="w-full bg-gradient-to-r from-green-400 to-emerald-500 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-green-500 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg"
          >
            🎮 Create New Game
          </button>

          <button
            onClick={handleJoinRoom}
            disabled={!playerName.trim() || !roomCode.trim()}
            className="w-full bg-gradient-to-r from-blue-400 to-indigo-500 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-blue-500 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg"
          >
            🚀 Join Game
          </button>

          <div className="border-t-2 border-gray-200 my-6 pt-6">
            <button
              onClick={handleMainScreen}
              className="w-full bg-gradient-to-r from-purple-400 to-pink-500 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-purple-500 hover:to-pink-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              📺 Main Screen Mode
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
              For the shared TV/display
            </p>
          </div>
        </div>

        {/* Game Info */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p className="mb-2">🎯 3-8 players • 🎵 Sound-based fun</p>
          <p>Pick silly sounds to match weird prompts!</p>
        </div>
      </div>
    </div>
  );
}
