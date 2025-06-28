import React from 'react';
import { Room } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';
import { PlayerScoreList } from './PlayerScoreList';

interface GameOverDisplayProps {
  room: Room;
}

export default function GameOverDisplay({ room }: GameOverDisplayProps) {
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  const runnerUps = sortedPlayers.slice(1);
  
  return (
    <div className="bg-white rounded-3xl p-8 shadow-2xl">
      {/* Horizontal Layout: Champion Left, Others Right */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* LEFT SIDE: Winner Spotlight */}
        <div className="flex-1 lg:max-w-md">
          <div className="relative bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 rounded-3xl p-6 shadow-2xl transform hover:scale-105 transition-all duration-500">
            {/* Crown above winner */}
            <div className="text-6xl mb-3 animate-bounce text-center">👑</div>
            
            <h4 className="text-3xl font-black text-yellow-900 mb-4 drop-shadow-lg text-center">
              CHAMPION!
            </h4>
            
            {/* Winner Avatar - Large */}
            <div 
              className={`w-24 h-24 rounded-full mx-auto mb-4 ${getPlayerColorClass(winner.color)} flex items-center justify-center text-6xl shadow-2xl ring-6 ring-white ring-opacity-50 transform hover:rotate-12 transition-transform duration-300`}
            >
              {winner.emoji || winner.name[0].toUpperCase()}
            </div>
            
            <p className="text-3xl font-black text-yellow-900 mb-3 drop-shadow-lg text-center">
              {winner.name}
            </p>
            
            <div className="flex items-center justify-center space-x-3 mb-4">
              <span className="text-4xl font-black text-yellow-900 drop-shadow-lg">
                {winner.score}
              </span>
              <span className="text-lg font-bold text-yellow-800">Points</span>
            </div>
            
            <p className="text-lg font-bold text-yellow-800 italic text-center">
              {(() => {
              const funnyTitles = [
                "Master of the Fartnoises!",
                "Supreme Sound Selector!",
                "Captain of Comedy!",
                "The Noise Whisperer!",
                "King/Queen of Chaos!",
                "Ultimate Audio Artist!",
                "Grand Wizard of Weird!",
                "The Sound Sage!",
                "Meme Machine Supreme!",
                "Lord/Lady of Laughter!",
                "The Giggle Generator!",
                "Chief of Chuckles!",
                "The Silly Sound Savant!",
                "Baron/Baroness of Bizarre!",
                "The Whoopee Wizard!",
                "Commissioner of Comedy!",
                "The Absurd Audio Ace!",
                "Duke/Duchess of Drollery!"
              ];
              
              // Use winner ID as seed for consistent title per game
              const seedIndex = winner.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
              const titleIndex = seedIndex % funnyTitles.length;
              return funnyTitles[titleIndex];
              })()}
            </p>
          </div>
        </div>

        {/* RIGHT SIDE: Runner-ups */}
        <div className="flex-1">
          {runnerUps.length > 0 ? (
            <div>
              <h4 className="text-2xl font-bold text-gray-800 mb-4 text-center">🥈 Final Standings 🥉</h4>
              <PlayerScoreList
                players={room.players}
                isGameOver={true}
              />
            </div>
          ) : (
            <div className="text-center text-gray-500 text-lg">
              No other players to display
            </div>
          )}
        </div>
      </div>

      {/* Celebration Message */}
      <div className="mt-8 text-center">
        <p className="text-xl text-gray-700 font-semibold mb-4">
          🎵 Thanks for playing Fartnoises! 🎵
        </p>
        <div className="flex justify-center space-x-4 text-3xl animate-pulse">
          <span>🎪</span>
          <span>🎭</span>
          <span>🎨</span>
          <span>🎸</span>
          <span>🎺</span>
        </div>
      </div>
    </div>
  );
}
