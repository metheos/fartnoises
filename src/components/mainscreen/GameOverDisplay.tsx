import React from 'react';
import { Room } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';
import { PlayerScoreList } from './PlayerScoreList';

interface GameOverDisplayProps {
  room: Room;
}

export default function GameOverDisplay({ room }: GameOverDisplayProps) {
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const sortedByLikes = [...room.players].sort((a, b) => (b.likeScore || 0) - (a.likeScore || 0));
  const winner = sortedPlayers[0];
  const likeWinner = sortedByLikes[0];
  const hasLikes = sortedByLikes.some(player => (player.likeScore || 0) > 0);
  const runnerUps = sortedPlayers.slice(1);
  
  return (
    <div className="bg-white rounded-3xl p-8 shadow-2xl">
      {/* Dynamic Layout: Champion Left, Crowd Favorite Middle (if likes exist), Others Right */}
      <div className={`flex flex-col ${hasLikes ? 'lg:flex-row lg:grid lg:grid-cols-3' : 'lg:flex-row'} gap-8 items-start`}>
        
        {/* LEFT SIDE: Winner Spotlight */}
        <div className="flex-1">
          <div className="relative bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 rounded-3xl p-6 shadow-2xl transform hover:scale-105 transition-all duration-500 overflow-hidden">
            {/* Subtle shimmer effect */}
            <div className="absolute inset-0 w-[200%] h-[200%] bg-gradient-to-r from-transparent via-white/35 to-transparent animate-shimmer"></div>
            
            {/* 3D depth shadow */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-yellow-200/50 to-amber-600/50 transform translate-x-2 translate-y-2 -z-10"></div>
            
            <h4 className="text-3xl font-black text-white mb-6 drop-shadow-lg text-center relative z-10">
              CHAMPION!
            </h4>
            
            {/* Winner Avatar with Crown - Large */}
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div 
                className={`w-24 h-24 rounded-full ${getPlayerColorClass(winner.color)} flex items-center justify-center text-6xl shadow-2xl ring-6 ring-white ring-opacity-50 transform hover:rotate-12 transition-transform duration-300 relative z-10 animate-wiggle`}
              >
                {winner.emoji || winner.name[0].toUpperCase()}
              </div>
              {/* Crown overlay on top-left */}
              <div className="absolute -top-2 -left-2 text-4xl animate-bounce drop-shadow-2xl transform hover:scale-110 transition-transform duration-300 z-20">👑</div>
            </div>
            
            <p className="text-3xl font-black text-white mb-3 drop-shadow-lg text-center relative z-10">
              {winner.name}
            </p>
            
            <div className="flex items-center justify-center space-x-3 mb-4 relative z-10">
              <span className="text-4xl font-black text-white drop-shadow-lg animate-bounce">
                {winner.score}
              </span>
              <span className="text-lg font-bold text-yellow-100">Points</span>
            </div>
            
            <p className="text-lg font-bold text-yellow-100 italic text-center relative z-10">
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

        {/* MIDDLE: Crowd Favorite (only if there are likes) */}
        {hasLikes && (
          <div className="flex-1">
            <div className="relative bg-gradient-to-br from-pink-300 via-pink-400 to-rose-500 rounded-3xl p-6 shadow-2xl transform hover:scale-105 transition-all duration-500 overflow-hidden">
              {/* Subtle shimmer effect */}
              <div className="absolute inset-0 w-[200%] h-[200%] bg-gradient-to-r from-transparent via-white/35 to-transparent animate-shimmer"></div>
              
              {/* 3D depth shadow */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-pink-200/50 to-rose-600/50 transform translate-x-2 translate-y-2 -z-10"></div>
              
              <h4 className="text-2xl font-black text-white mb-6 drop-shadow-lg text-center relative z-10">
                CROWD FAVORITE!
              </h4>
              
              {/* Like Winner Avatar with Heart */}
              <div className="relative w-20 h-20 mx-auto mb-4">
                <div 
                  className={`w-20 h-20 rounded-full ${getPlayerColorClass(likeWinner.color)} flex items-center justify-center text-5xl shadow-2xl ring-6 ring-white ring-opacity-50 transform hover:rotate-12 transition-transform duration-300 relative z-10 animate-wiggle`}
                >
                  {likeWinner.emoji || likeWinner.name[0].toUpperCase()}
                </div>
                {/* Heart overlay on top-left */}
                <div className="absolute -top-1 -left-1 text-3xl animate-bounce drop-shadow-2xl transform hover:scale-110 transition-transform duration-300 z-20">❤️</div>
              </div>
              
              <p className="text-2xl font-black text-white mb-3 drop-shadow-lg text-center relative z-10">
                {likeWinner.name}
              </p>
              
              <div className="flex items-center justify-center space-x-3 mb-4 relative z-10">
                <span className="text-3xl font-black text-white drop-shadow-lg animate-bounce">
                  {likeWinner.likeScore || 0}
                </span>
                <span className="text-sm font-bold text-pink-100">Likes</span>
              </div>
              
              <p className="text-sm font-bold text-pink-100 italic text-center relative z-10">
                &quot;Most Loved by the Audience!&quot;
              </p>
            </div>
          </div>
        )}

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
          Thanks for playing Fartnoises!
        </p>
      </div>
    </div>
  );
}
