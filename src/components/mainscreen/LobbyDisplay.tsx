import React, { useState, useEffect } from 'react';
import { Room } from '@/types/game';
import GameSettings from './GameSettings';
import PlayerAvatarGrid from './PlayerAvatarGrid';

interface LobbyDisplayProps {
  room: Room;
}

export default function LobbyDisplay({ room }: LobbyDisplayProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Auto-rotate carousel every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3);
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const slides = [
    // Slide 1: How to Win & Game Flow
    {
      id: 'basics',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* How to Win Section */}
          <div className="bg-gradient-to-br from-green-100 to-emerald-200 rounded-2xl p-4 border-2 border-green-300 shadow-lg">
            <div className="flex items-center mb-3">
              <span className="text-2xl mr-2">🏆</span>
              <h3 className="text-lg font-bold text-green-800">How to Win</h3>
            </div>
            <div className="text-sm text-green-700 space-y-2 text-left">
              <p><strong>Goal:</strong> Be the first to reach <span className="font-bold text-green-900">{room.maxScore} points</span>!</p>
              <p><strong>How:</strong> Get picked by the judge for your submission</p>
              <p><strong>Bonus:</strong> Earn <span className="text-pink-600 font-semibold">❤️ likes</span> from other players!</p>
            </div>
          </div>

          {/* Game Flow Section */}
          <div className="bg-gradient-to-br from-blue-100 to-sky-200 rounded-2xl p-4 border-2 border-blue-300 shadow-lg">
            <div className="flex items-center mb-3">
              <span className="text-2xl mr-2">🎮</span>
              <h3 className="text-lg font-bold text-blue-800">Game Flow</h3>
            </div>
            <div className="text-sm text-blue-700 space-y-1 text-left">
              <p>• <strong>Judge</strong> chooses a prompt</p>
              <p>• <strong>Players</strong> choose sounds to go with it</p>
              <p>• <strong>Judge</strong> listens & picks the winner</p>
              <p>• <strong>Repeat</strong> with a new judge!</p>
            </div>
          </div>
        </div>
      )
    },
    // Slide 2: Special Abilities
    {
      id: 'powerups',
      content: (
        <div className="bg-gradient-to-br from-purple-100 to-indigo-200 rounded-2xl p-4 border-2 border-purple-300 shadow-lg">
          <div className="flex items-center mb-4">
            <span className="text-2xl mr-2">⚡</span>
            <h3 className="text-lg font-bold text-purple-800">Special Abilities (One-Time Only!)</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {/* Refresh Powerup */}
            <div className="bg-white/60 rounded-xl p-3 border border-purple-200">
              <div className="flex items-center mb-2">
                <span className="text-xl mr-2">🔄</span>
                <h4 className="font-bold text-purple-800">Refresh Sounds</h4>
              </div>
              <p className="text-purple-700">
                Don't like your sound options? Get a completely new set of sounds!
              </p>
            </div>

            {/* Triple Sound Powerup */}
            <div className="bg-white/60 rounded-xl p-3 border border-purple-200">
              <div className="flex items-center mb-2">
                <span className="text-xl mr-2">🎵</span>
                <h4 className="font-bold text-purple-800">Triple Sound</h4>
              </div>
              <p className="text-purple-700">
                Submit <strong>3 sounds</strong> instead of 2 for an epic combo!
              </p>
            </div>

            {/* Nuclear Option Powerup */}
            <div className="bg-white/60 rounded-xl p-3 border border-purple-200">
              <div className="flex items-center mb-2">
                <span className="text-xl mr-2">💥</span>
                <h4 className="font-bold text-purple-800">Nuclear Option</h4>
              </div>
              <p className="text-purple-700">
                <strong>Judges only!</strong> Blow everyone's minds with a dramatic explosion effect!
              </p>
            </div>
          </div>
        </div>
      )
    },
    // Slide 3: Pro Tips
    {
      id: 'tips',
      content: (
        <div className="bg-gradient-to-br from-yellow-100 to-orange-200 rounded-2xl p-4 border-2 border-yellow-300 shadow-lg">
          <div className="flex items-center mb-3">
            <span className="text-2xl mr-2">💡</span>
            <h3 className="text-lg font-bold text-yellow-800">Pro Tips</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-yellow-700 text-left">
            <p>• <strong>Think creatively!</strong> Unexpected combos often win</p>
            <p>• <strong>Save powerups</strong> for the perfect moment</p>
            <p>• <strong>Give likes</strong> to spread the fun around</p>
            <p>• <strong>Read the room</strong> - each judge has different taste!</p>
            <p>• <strong>Timing matters!</strong> Some sounds work better together</p>
            <p>• <strong>Have fun!</strong> The best moments come from being silly</p>
          </div>
        </div>
      )
    }
  ];
  return (
    <div className="bg-white rounded-3xl p-6 text-center shadow-2xl transition-all duration-300 min-h-[75vh]">
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
      {/* <p className="text-xl text-purple-600 mb-6">
      {room.players.length < 3
        ? "Need at least 3 players to play!"
        : "VIP can start the game!"}
      </p> */}
      <PlayerAvatarGrid 
        players={room.players}
        variant="lobby"
        className="mb-8"
      />
      <div className="mt-6 max-w-4xl mx-auto">
        {/* Carousel Container */}
        <div className="relative">
          {/* Carousel Content */}
          <div className="overflow-hidden rounded-2xl">
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {slides.map((slide, index) => (
                <div key={slide.id} className="w-full flex-shrink-0 p-1">
                  {slide.content}
                </div>
              ))}
            </div>
          </div>

          {/* Carousel Navigation Dots */}
          <div className="flex justify-center mt-4 space-x-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  currentSlide === index 
                    ? 'bg-purple-600 scale-110' 
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}
