import { Player } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';

interface PlayerScoreListProps {
  players: Player[];
  roundWinnerId?: string;
  animatedScores?: { [playerId: string]: number };
  showPointAnimation?: boolean;
  isGameOver?: boolean;
}

export function PlayerScoreList({
  players,
  roundWinnerId,
  animatedScores = {},
  showPointAnimation = false,
  isGameOver = false
}: PlayerScoreListProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const hasLikes = players.some(player => (player.likeScore || 0) > 0);
  
  return (
    <div className="bg-gray-50 rounded-3xl p-6 shadow-inner">
      {/* <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Current Standings</h3> */}
      <ul className="space-y-3">
        {sortedPlayers.map((player, index) => {
          const rank = index + 1;
          const isRoundWinner = player.id === roundWinnerId;
          
          let rankStyles = 'bg-gray-200 text-gray-700';
          if (rank === 1) rankStyles = 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-md'; // Gold
          if (rank === 2) rankStyles = 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 shadow-md'; // Silver
          if (rank === 3) rankStyles = 'bg-gradient-to-br from-orange-300 to-orange-500 text-orange-900 shadow-md'; // Bronze

          return (
            <li 
              key={player.id} 
              className={`flex items-center p-3 rounded-2xl shadow-sm transition-all duration-300 ${
                isRoundWinner ? 'bg-green-100 border-2 border-green-400 scale-105' : 'bg-white'
              }`}
            >
              <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-black text-lg mr-2 ${rankStyles}`}>
                {rank}
              </div>
              
              {/* Player Avatar - bigger for round winner, special styling for game winner */}
              <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center mr-3">
                {isRoundWinner ? (
                  <div 
                    className={`w-14 h-14 rounded-full ${getPlayerColorClass(player.color)} flex items-center justify-center text-3xl`}
                  >
                    {player.emoji || player.name[0].toUpperCase()}
                  </div>
                ) : rank === 1 && isGameOver ? (
                  <div 
                    className={`w-12 h-12 rounded-full ${getPlayerColorClass(player.color)} flex items-center justify-center text-2xl ring-4 ring-yellow-400 ring-opacity-75`}
                  >
                    {player.emoji || player.name[0].toUpperCase()}
                  </div>
                ) : (
                  <div 
                    className={`w-10 h-10 rounded-full ${getPlayerColorClass(player.color)} flex items-center justify-center text-2xl`}
                  >
                    {player.emoji || player.name[0].toUpperCase()}
                  </div>
                )}
              </div>
              
              <div className="flex-grow">
                <p className={`font-bold text-gray-900 ${
                  rank === 1 && isGameOver ? 'text-xl' : 'text-lg'
                } ${
                  isRoundWinner ? 'text-2xl' : 'text-lg'
                }`}>
                  {player.name}
                  {rank === 1 && isGameOver && ' 🏆'}
                </p>
              </div>
              
              {/* Score Display */}
              {isRoundWinner ? (
                <>
                  {/* +1PT Animation */}
                    <div className={`absolute -right-8 -top-2 bg-green-500 text-white text-md font-bold px-2 py-1 rounded-full transition-all duration-700 ${
                    showPointAnimation ? 'animate-bounce scale-110' : 'scale-0 opacity-0'
                    }`}>
                    +1 PT
                    </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-3">
                      <div className="text-center">
                        <p className={`font-black text-2xl text-purple-600 transition-all duration-500 ${
                          showPointAnimation ? 'scale-110 text-green-600' : ''
                        }`}>
                          {animatedScores[player.id] !== undefined ? animatedScores[player.id] : player.score}
                        </p>
                        <p className="text-xs text-gray-500 uppercase">Points</p>
                      </div>
                      {hasLikes && (
                        <div className="text-center">
                          <p className="font-bold text-pink-600 text-lg">
                            {player.likeScore || 0}
                          </p>
                          <p className="text-xs text-gray-500 uppercase">❤️</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-right">
                  <div className="flex items-center space-x-3">
                    <div className="text-center">
                      <p className={`font-black text-purple-600 ${
                        rank === 1 && isGameOver ? 'text-2xl' : 'text-xl'
                      }`}>
                        {animatedScores[player.id] !== undefined ? animatedScores[player.id] : player.score}
                      </p>
                      <p className="text-xs text-gray-500 uppercase">Points</p>
                    </div>
                    {hasLikes && (
                      <div className="text-center">
                        <p className={`font-bold text-pink-600 ${
                          rank === 1 && isGameOver ? 'text-lg' : 'text-md'
                        }`}>
                          {player.likeScore || 0}
                        </p>
                        <p className="text-xs text-gray-500 uppercase">❤️</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
