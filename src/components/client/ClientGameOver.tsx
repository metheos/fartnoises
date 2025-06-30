'use client';

import { Room, Player } from '@/types/game';
import { Card, Button, PlayerAvatar } from '@/components/ui';

interface ClientGameOverProps {
  room: Room;
  player: Player;
}

export default function ClientGameOver({ room }: ClientGameOverProps) {
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const sortedByLikes = [...room.players].sort((a, b) => (b.likeScore || 0) - (a.likeScore || 0));
  const overallWinner = sortedPlayers[0];
  const likeWinner = sortedByLikes[0];
  const hasLikes = sortedByLikes.some(player => (player.likeScore || 0) > 0);
  
  return (
    <Card className="text-center">
      {/* Winner Spotlight */}
      <div className="mb-8">
        <div className="relative bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 rounded-3xl p-6 mx-auto shadow-2xl transform hover:scale-105 transition-all duration-500">
          
          {/* Crown above winner */}
          <div className="text-5xl mb-3 animate-bounce text-center">👑</div>
          
          <h4 className="text-2xl font-black text-yellow-900 mb-3 drop-shadow-lg text-center">
            CHAMPION!
          </h4>
          
          {/* Winner Avatar - Large */}
          <div className="ring-4 ring-white ring-opacity-50 rounded-full inline-block transform hover:rotate-12 transition-transform duration-300 mx-auto mb-3">
            <PlayerAvatar 
              player={overallWinner}
              size="xl"
              showName={false}
            />
          </div>
          
          <p className="text-2xl font-black text-yellow-900 mb-2 drop-shadow-lg text-center">
            {overallWinner.name}
          </p>
          
          <div className="flex items-center justify-center space-x-2 mb-3">
            <span className="text-3xl font-black text-yellow-900 drop-shadow-lg">
              {overallWinner.score}
            </span>
            <span className="text-lg font-bold text-yellow-800">Points</span>
          </div>
          
          {/* <p className="text-sm font-bold text-yellow-800 italic text-center">
            "Master of the Fartnoises!"
          </p> */}
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
              const seedIndex = overallWinner.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
              const titleIndex = seedIndex % funnyTitles.length;
              return funnyTitles[titleIndex];
              })()}
            </p>
        </div>
      </div>

      {/* Like Winner Section - Only show if there are likes */}
      {hasLikes && (
        <div className="mb-8">
          <div className="relative bg-gradient-to-br from-pink-300 via-pink-400 to-rose-500 rounded-3xl p-6 mx-auto shadow-2xl transform hover:scale-105 transition-all duration-500">
            
            {/* Heart above like winner */}
            <div className="text-4xl mb-3 animate-bounce text-center">❤️</div>
            
            <h4 className="text-xl font-black text-rose-900 mb-3 drop-shadow-lg text-center">
              CROWD FAVORITE!
            </h4>
            
            {/* Like Winner Avatar */}
            <div className="ring-4 ring-white ring-opacity-50 rounded-full inline-block transform hover:rotate-12 transition-transform duration-300 mx-auto mb-3">
              <PlayerAvatar 
                player={likeWinner}
                size="lg"
                showName={false}
              />
            </div>
            
            <p className="text-xl font-black text-rose-900 mb-2 drop-shadow-lg text-center">
              {likeWinner.name}
            </p>
            
            <div className="flex items-center justify-center space-x-2 mb-3">
              <span className="text-2xl font-black text-rose-900 drop-shadow-lg">
                {likeWinner.likeScore || 0}
              </span>
              <span className="text-sm font-bold text-rose-800">Likes</span>
            </div>
            
            <p className="text-sm font-bold text-rose-800 italic text-center">
              "Most Loved by the Audience!"
            </p>
          </div>
        </div>
      )}

      {/* Final Scores - Extra Compact Mobile Layout */}
      <div className="bg-gray-50 rounded-2xl p-3 mb-6">
        <h3 className="text-base font-bold text-gray-800 mb-2 text-center">Final Standings</h3>
        <div className="space-y-1">
          {sortedPlayers.map((p, index) => {
            const rank = index + 1;
            let rankIcon = '🏅';
            let rankBg = 'bg-gray-200 text-gray-700';
            
            if (rank === 1) {
              rankIcon = '👑';
              rankBg = 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-md';
            } else if (rank === 2) {
              rankIcon = '🥈';
              rankBg = 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 shadow-md';
            } else if (rank === 3) {
              rankIcon = '🥉';
              rankBg = 'bg-gradient-to-br from-orange-300 to-orange-500 text-orange-900 shadow-md';
            }
            
            return (
              <div 
                key={p.id} 
                className={`flex items-center justify-between p-2 rounded-lg shadow-sm transition-all duration-300 ${
                  rank === 1 ? 'bg-yellow-50 border border-yellow-400 scale-102' : 'bg-white'
                }`}
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shadow-sm ${rankBg}`}>
                    {rankIcon}
                  </div>
                  <PlayerAvatar 
                    player={p}
                    size="xs"
                    showName={false}
                  />
                  <span className={`font-bold truncate ${rank === 1 ? 'text-yellow-900 text-sm' : 'text-gray-900 text-sm'}`}>
                    {p.name}
                  </span>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <div className="text-center">
                    <span className={`font-black ${rank === 1 ? 'text-yellow-900 text-lg' : 'text-purple-600 text-base'}`}>
                      {p.score}
                    </span>
                    <p className="text-xs text-gray-500 leading-none">pts</p>
                  </div>
                  {hasLikes && (
                    <div className="text-center">
                      <span className="font-bold text-pink-600 text-sm">
                        {p.likeScore || 0}
                      </span>
                      <p className="text-xs text-gray-500 leading-none">❤️</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Celebration Message */}
      <div className="mb-6 text-center">
        <p className="text-lg text-gray-700 font-semibold mb-3">
          Thanks for playing Fartnoises!
        </p>
      </div>
      <Button
        onClick={() => {
          // Clear reconnection data when starting a new game
          localStorage.removeItem('originalPlayerId');
          localStorage.removeItem('lastKnownRoomCode');
          window.location.href = '/';
        }}
        variant="primary"
        size="lg"
        className="shadow-lg"
      >
        Play Again?
      </Button>
    </Card>
  );
}