import React, { useState, useEffect } from 'react';
import { Room } from '@/types/game';
import GameSettings from './GameSettings';
import PlayerAvatarGrid from './PlayerAvatarGrid';
import QRCode from 'react-qr-code';

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
                Don&apos;t like your sound options? Get a completely new set of sounds!
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
                <h4 className="font-bold text-purple-800">Indecision</h4>
              </div>
              <p className="text-purple-700">
                <strong>Judges only!</strong> Blow everyone&apos;s minds with a dramatic effect!
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
      <div className="bg-white rounded-3xl p-6 shadow-2xl transition-all duration-300 h-[85vh] max-w-7xl mx-auto flex flex-col">
        
        {/* Top Row: QR Code (left) + Game Settings (right) */}
        <div className="flex justify-between items-start gap-6">
          
          {/* Left: QR Code Section */}
          <div className="flex-shrink-0">
            <div className="">
              {/* <div className="text-sm text-purple-700 font-bold mb-2">Scan to Join!</div> */}
              <QRCode
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?room=${room.code}`}
                size={110}
                bgColor="#fff"
                fgColor="#7c3aed"
                level="M"
              />
                <div className="mt-2 text-xs text-purple-600 text-center leading-tight">
                 <span className="text-lg block">Room Code</span>
                 <span className="text-purple-800 text-2xl font-black tracking-wider block">{room.code}</span>
                </div>
            </div>
          </div>

          {/* Right: Game Settings - Condensed */}
          <div className="flex-1 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 p-3 border-2 border-purple-200">
            <GameSettings room={room} />
          </div>
        </div>

        {/* Middle: Player Status & Grid */}
        <div className="flex-1 flex flex-col justify-center text-center space-y-4">
          {/* <div>
            <p className="text-2xl text-gray-800 font-bold mb-1">
              {room.players.length < 3
                ? `${room.players.length} joined...`
                : (
                  <span className="inline-block text-3xl font-black bg-gradient-to-r from-green-500 via-blue-500 to-purple-600 bg-clip-text text-transparent transform rotate-1 drop-shadow-lg animate-pulse">
                    {`${room.players.length} players ready!`}
                  </span>
                )}
            </p>
            <p className="text-base text-gray-600">
              {room.players.length < 3
                ? "Need at least 3 players to play!"
                : "VIP can start the game!"}
            </p>
          </div> */}

          {/* Player Avatar Grid */}
          <div className="flex justify-center">
            <PlayerAvatarGrid 
              players={room.players}
              variant="lobby"
              className=""
            />
          </div>
        </div>

        {/* Bottom: Compact Tips Carousel */}
        <div className="mt-4">
          {/* Carousel Container - Compact */}
          <div className="relative">
            {/* Carousel Content */}
            <div className="overflow-hidden rounded-xl">
              <div 
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {slides.map((slide) => (
                  <div key={slide.id} className="w-full flex-shrink-0">
                    <div className="">
                      {slide.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Carousel Navigation Dots */}
            <div className="flex justify-center mt-2 space-x-1">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
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
