'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const router = useRouter();

  // Clear any game persistence data when the home page loads
  // This ensures a fresh start when users return to the home screen
  useEffect(() => {
    // Clear localStorage data that might cause unwanted reconnection attempts
    localStorage.removeItem('originalPlayerId');
    localStorage.removeItem('lastKnownRoomCode');
    console.log('Home page loaded: Cleared game persistence data for fresh start');
  }, []);
  const handleSubmit = (selectedMode: 'create' | 'join') => {
    if (!playerName.trim()) return;
    
    // Map 'create' to 'host' for the URL parameter
    const urlMode = selectedMode === 'create' ? 'host' : 'join';
    
    const params = new URLSearchParams({
      mode: urlMode,
      playerName: playerName.trim(),
    });
    
    if (selectedMode === 'join' && roomCode.trim()) {
      params.set('roomCode', roomCode.trim().toUpperCase());
    }
    
    router.push(`/game?${params.toString()}`);
  };

  const goToMainScreen = () => {
    router.push('/main-screen');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 p-4">
      <div className="max-w-md mx-auto pt-16">
        {/* Logo/Title */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black text-white mb-4 drop-shadow-lg">
            fartnoises
          </h1>
          <p className="text-xl text-white/90 font-bold">
            The hilarious sound game!
          </p>
          <div className="text-4xl mt-4 animate-bounce">🎵💨</div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {!mode ? (
            <>
              {/* Player Name Input */}
              <div className="mb-4">
              <label className="block text-gray-700 text-lg font-bold mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name..."
                className="w-full px-6 py-4 text-lg text-gray-800 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none transition-colors placeholder:text-gray-600"
                maxLength={20}
              />
              </div>

              {/* Room Code Input */}
              <div className="mb-8">
              <label className="block text-gray-700 text-lg font-bold mb-2">
                Room Code <span className="font-normal text-gray-500">(to join)</span>
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && playerName.trim() && roomCode.trim().length === 4) {
                    handleSubmit('join');
                  }
                }}
                placeholder="4-LETTER-CODE"
                className="w-full px-6 py-4 text-lg text-gray-800 text-center font-mono tracking-widest border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors uppercase placeholder:text-gray-500"
                maxLength={4}
              />
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
              <button
                onClick={() => handleSubmit('join')}
                disabled={!playerName.trim() || roomCode.trim().length !== 4}
                className="w-full bg-gradient-to-r from-blue-400 to-blue-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-blue-500 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200"
              >
                🚀 Join Game
              </button>
              
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="flex-shrink mx-4 text-gray-500 font-semibold">OR</span>
                <div className="flex-grow border-t border-gray-300"></div>
              </div>

              <button
                onClick={() => handleSubmit('create')}
                disabled={!playerName.trim()}
                className="w-full bg-gradient-to-r from-green-400 to-green-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-green-500 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200"
              >
                🎮 Create New Room
              </button>
              </div>

              {/* Main Screen Button */}
              <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={goToMainScreen}
                className="w-full bg-gradient-to-r from-purple-400 to-purple-600 text-white py-3 px-6 rounded-xl font-bold hover:from-purple-500 hover:to-purple-700 transition-all duration-200"
              >
                📺 Main Screen Mode
              </button>
              <p className="text-sm text-gray-700 text-center mt-2">
                For TV/shared display
              </p>
              </div>
            </>
          ) : mode === 'join' ? (
            <>
              {/* Room Code Input */}
              <div className="mb-8">
                <button
                  onClick={() => setMode(null)}
                  className="text-purple-500 hover:text-purple-700 mb-4 font-bold"
                >
                  ← Back
                </button>
                <label className="block text-gray-700 text-lg font-bold mb-4">
                  Enter Room Code
                </label>                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && roomCode.trim() && roomCode.trim().length === 4) {
                      handleSubmit('join');
                    }
                  }}
                  placeholder="4-letter code..."
                  className="w-full px-6 py-4 text-lg text-gray-800 text-center font-mono border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors uppercase placeholder:text-gray-600"
                  maxLength={4}
                />
              </div>

              <button
                onClick={() => handleSubmit('join')}
                disabled={!roomCode.trim() || roomCode.trim().length !== 4}
                className="w-full bg-gradient-to-r from-blue-400 to-blue-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-blue-500 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200"
              >
                🚀 Join Game!
              </button>
            </>
          ) : (
            <>
              {/* Create Room Confirmation */}
              <div className="text-center">
                <button
                  onClick={() => setMode(null)}
                  className="text-purple-500 hover:text-purple-700 mb-6 font-bold"
                >
                  ← Back
                </button>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">
                  Ready to create a room?
                </h3>                <p className="text-gray-800 mb-8">
                  You&apos;ll become the host and get a room code to share with friends!
                </p>
                <button
                  onClick={() => handleSubmit('create')}
                  className="w-full bg-gradient-to-r from-green-400 to-green-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-green-500 hover:to-green-700 transition-all duration-200 transform hover:scale-105"
                >
                  🎉 Create Room!
                </button>
              </div>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="text-center mt-8 text-white/80">
          <p className="text-sm">
            Get 3-8 friends together for the funniest sound game ever! 🎊
          </p>
        </div>
      </div>
    </div>
  );
}