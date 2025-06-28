'use client';

import { Room, Player } from '@/types/game';
import { getPlayerColorClass } from '@/utils/gameUtils';

interface ClientLobbyProps {
  room: Room;
  player: Player;
  onStartGame: () => void;
  onUpdateGameSetting: (setting: 'maxScore' | 'maxRounds' | 'allowExplicitContent', value: number | boolean) => void;
}

export default function ClientLobby({ 
  room, 
  player, 
  onStartGame, 
  onUpdateGameSetting 
}: ClientLobbyProps) {
  return (
    <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
      {/* Game Settings Display for non-VIP players */}
      {!player.isVIP && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 mb-6 max-w-sm mx-auto">
          <div className="flex justify-between items-center mb-2">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Score to Win</p>
              <p className="text-2xl font-bold text-purple-600">{room.maxScore}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Max Rounds</p>
              <p className="text-2xl font-bold text-purple-600">{room.maxRounds}</p>
            </div>
          </div>
          <div className="border-t border-purple-200 pt-2">
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600">Content Rating</p>
              <p className={`text-sm font-bold ${room.allowExplicitContent ? 'text-red-600' : 'text-green-600'}`}>
                {room.allowExplicitContent ? 'Adult Content' : 'Family Friendly'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Game Settings Controls for VIP players */}
      {player.isVIP && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-4 mb-6 max-w-sm mx-auto border border-yellow-200">
          <div className="flex justify-between items-center mb-4">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Score to Win</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <button
                  onClick={() => onUpdateGameSetting('maxScore', Math.max(1, room.maxScore - 1))}
                  className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-purple-600 transition-colors text-lg"
                  disabled={room.maxScore <= 1}
                >
                  −
                </button>
                <p className="text-2xl font-bold text-purple-600 min-w-[3rem] text-center">{room.maxScore}</p>
                <button
                  onClick={() => onUpdateGameSetting('maxScore', Math.min(10, room.maxScore + 1))}
                  className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-purple-600 transition-colors text-lg"
                  disabled={room.maxScore >= 10}
                >
                  +
                </button>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Max Rounds</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <button
                  onClick={() => onUpdateGameSetting('maxRounds', Math.max(1, room.maxRounds - 1))}
                  className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-purple-600 transition-colors text-lg"
                  disabled={room.maxRounds <= 1}
                >
                  −
                </button>
                <p className="text-2xl font-bold text-purple-600 min-w-[3rem] text-center">{room.maxRounds}</p>
                <button
                  onClick={() => onUpdateGameSetting('maxRounds', Math.min(20, room.maxRounds + 1))}
                  className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold hover:bg-purple-600 transition-colors text-lg"
                  disabled={room.maxRounds >= 20}
                >
                  +
                </button>
              </div>
            </div>
          </div>
          
          {/* Explicit Content Toggle */}
          <div className="border-t border-yellow-200 pt-4">
            <div className="flex items-center justify-center gap-3">
              <p className="text-sm font-medium text-gray-600">Allow Explicit Content</p>
              <button
                onClick={() => onUpdateGameSetting('allowExplicitContent', !room.allowExplicitContent)}
                title={`Toggle explicit content ${room.allowExplicitContent ? 'off' : 'on'}`}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  room.allowExplicitContent ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    room.allowExplicitContent ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-xs font-medium ${room.allowExplicitContent ? 'text-purple-600' : 'text-gray-400'}`}>
                {room.allowExplicitContent ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              {room.allowExplicitContent ? 'Adult content enabled' : 'Family-friendly mode'}
            </p>
          </div>
        </div>
      )}
      
      <ul className="mb-8 text-left max-w-xs mx-auto space-y-3">
        {room.players.map((p, idx) => (
          <li
        key={p.id}
        className={`
          flex items-center gap-3 p-3 rounded-2xl shadow-md transition-all duration-200
          ${getPlayerColorClass(p.color)}
          ${p.id === player.id ? 'ring-4 ring-purple-400 scale-105' : ''}
          ${p.isVIP ? 'border-2 border-yellow-300' : ''}
          text-white
        `}
        style={{
          background:
            p.isVIP
          ? 'linear-gradient(90deg, #fef08a 0%, #fde047 100%)'
          : undefined,
          color: p.isVIP ? '#92400e' : undefined,
          boxShadow: p.id === player.id ? '0 0 0 4px #a78bfa44' : undefined,
        }}
          >
        <span
          className={`
            w-8 h-8 flex items-center justify-center rounded-full font-bold text-lg mr-2
            ${getPlayerColorClass(p.color)}
            ${p.isVIP ? 'border-2 border-yellow-400' : ''}
            ${p.id === player.id ? 'ring-2 ring-purple-400' : ''}
          `}
          style={{
            background:
          p.isVIP
            ? 'radial-gradient(circle at 60% 40%, #fde047 70%, #facc15 100%)'
            : undefined,
            color: p.isVIP ? '#92400e' : undefined,
          }}
        >
          {p.emoji || p.name[0].toUpperCase()}
        </span>
        <div className="flex flex-col flex-grow">
          <span className="font-bold text-lg flex items-center gap-1">
            {p.name}
            {p.isVIP && (
          <span
            className="ml-1 text-yellow-400 text-xl animate-bounce"
            title="Host"
          >
            👑
          </span>
            )}
            {p.id === player.id && (
          <span className="ml-1 text-purple-200 text-xs font-semibold bg-purple-600 bg-opacity-60 px-2 py-0.5 rounded-full">
            You
          </span>
            )}
          </span>
          <span className="text-xs opacity-80">
            {p.isVIP ? 'Host' : 'Player'}
          </span>
        </div>
        <span className="ml-auto font-black text-lg drop-shadow">
          {p.score}
        </span>
          </li>
        ))}
      </ul>
      {player.isVIP && room.players.length >= 3 && (
        <button 
          onClick={onStartGame} 
          className="bg-green-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-600 transition-colors text-lg"
        >
          Start Game
        </button>
      )}
      {!player.isVIP && room.players.length >= 3 && <p className="text-gray-700">Waiting for the host to start the game...</p>}
      {player.isVIP && room.players.length < 3 && <p className="text-gray-700">Need at least 3 players to start the game. ({room.players.length}/3)</p>}
      {!player.isVIP && room.players.length < 3 && <p className="text-gray-700">Need at least 3 players to start. Waiting for more players to join... ({room.players.length}/3)</p>}
    </div>
  );
}
