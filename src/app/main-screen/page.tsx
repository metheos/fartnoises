'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Room, GameState } from '@/types/game';
import { SOUND_EFFECTS } from '@/data/gameData';

let socket: Socket;

// Helper function to convert hex colors to Tailwind classes
const getPlayerColorClass = (color: string): string => {
  const colorMap: { [key: string]: string } = {
    '#ef4444': 'bg-red-500',
    '#f97316': 'bg-orange-500',
    '#eab308': 'bg-yellow-500',
    '#22c55e': 'bg-green-500',
    '#3b82f6': 'bg-blue-500',
    '#8b5cf6': 'bg-violet-500',
    '#ec4899': 'bg-pink-500',
    '#06b6d4': 'bg-cyan-500',
  };
  return colorMap[color] || 'bg-gray-500';
};

export default function MainScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    socket = io({
      path: '/api/socket',
    });

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('requestMainScreenUpdate');
    });

    socket.on('mainScreenUpdate', ({ rooms: updatedRooms }) => {
      setRooms(updatedRooms);
      // Show the most active room or first room with players
      const activeRoom = updatedRooms.find((room: Room) => 
        room.players.length > 0 && room.gameState !== GameState.LOBBY
      ) || updatedRooms.find((room: Room) => room.players.length > 0);
      
      if (activeRoom) {
        setCurrentRoom(activeRoom);
      }
    });

    socket.on('roomUpdated', (updatedRoom) => {
      if (currentRoom && updatedRoom.code === currentRoom.code) {
        setCurrentRoom(updatedRoom);
      }
    });

    // Request updates every 5 seconds
    const interval = setInterval(() => {
      if (socket) {
        socket.emit('requestMainScreenUpdate');
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [currentRoom]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
          <div className="animate-spin w-24 h-24 border-8 border-purple-500 border-t-transparent rounded-full mx-auto mb-8"></div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Connecting to fartnoises</h2>
          <p className="text-gray-600 text-xl">Setting up the main screen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-8xl font-black text-white mb-4 transform -rotate-2 drop-shadow-lg">
            fartnoises
          </h1>
          <p className="text-white text-2xl font-bold opacity-90">
            The Silly Sound Game • Main Screen Display
          </p>
        </div>

        {currentRoom ? (
          <MainScreenGameDisplay room={currentRoom} />
        ) : (
          <WaitingForGameScreen rooms={rooms} />
        )}

        {/* Room List Footer */}
        <div className="mt-8 bg-white bg-opacity-20 rounded-3xl p-6">
          <h3 className="text-white text-xl font-bold mb-4 text-center">Active Rooms</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.length === 0 ? (
              <div className="col-span-full text-center text-white opacity-75">
                No active games. Create a room on your phone to get started!
              </div>
            ) : (
              rooms.map((room) => (
                <div 
                  key={room.code} 
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                    currentRoom?.code === room.code 
                      ? 'bg-white bg-opacity-30 scale-105' 
                      : 'bg-white bg-opacity-15 hover:bg-opacity-25'
                  }`}
                  onClick={() => setCurrentRoom(room)}
                >
                  <div className="text-white">
                    <h4 className="font-bold text-lg">{room.code}</h4>
                    <p className="text-sm opacity-90">{room.players.length} players</p>
                    <p className="text-sm opacity-75">{getGameStateDisplay(room.gameState)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WaitingForGameScreen({ rooms }: { rooms: Room[] }) {
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
      <div className="text-8xl mb-8">🎮</div>
      <h2 className="text-4xl font-bold text-gray-800 mb-6">Ready for Fun!</h2>
      <p className="text-gray-600 text-xl mb-8">
        Players can join by going to <strong>fartnoises.game</strong> on their phones
      </p>
      
      <div className="bg-gray-100 rounded-2xl p-8 mb-8">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">How to Play:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="text-center">
            <div className="text-4xl mb-2">📱</div>
            <h4 className="font-bold text-lg mb-2">1. Join on Phone</h4>
            <p className="text-gray-600">Enter your name and create or join a room</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">🎵</div>
            <h4 className="font-bold text-lg mb-2">2. Pick Sounds</h4>
            <p className="text-gray-600">Choose 2 silly sounds to match weird prompts</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">🏆</div>
            <h4 className="font-bold text-lg mb-2">3. Vote & Win</h4>
            <p className="text-gray-600">Judge picks the funniest combo and awards points</p>
          </div>
        </div>
      </div>

      {rooms.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4">Rooms Waiting for Players:</h3>
          <div className="flex justify-center space-x-4">
            {rooms.map((room) => (
              <div key={room.code} className="bg-purple-100 px-6 py-3 rounded-xl">
                <span className="font-mono font-bold text-lg">{room.code}</span>
                <span className="text-gray-600 ml-2">({room.players.length} players)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MainScreenGameDisplay({ room }: { room: Room }) {
  return (
    <div className="space-y-8">
      {/* Game Header */}
      <div className="bg-white rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-4xl font-bold text-gray-800">Room {room.code}</h2>
            <p className="text-xl text-gray-600">Round {room.currentRound} of {room.maxRounds}</p>
          </div>
          <div className="text-right">
            <p className="text-lg text-gray-600">{getGameStateDisplay(room.gameState)}</p>
            <p className="text-2xl font-bold text-purple-600">{room.players.length} Players</p>
          </div>
        </div>
      </div>

      {/* Players Display */}
      <div className="bg-white rounded-3xl p-8 shadow-2xl">
        <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Players</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {room.players.map((player) => (
            <div 
              key={player.id} 
              className={`text-center p-4 rounded-2xl transition-all duration-300 ${
                room.currentJudge === player.id 
                  ? 'bg-yellow-100 border-4 border-yellow-400 scale-110' 
                  : 'bg-gray-100'
              }`}
            >              <div 
                className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl ${getPlayerColorClass(player.color)}`}
              >
                {room.currentJudge === player.id ? '👨‍⚖️' : '🎵'}
              </div>
              <p className="font-bold text-lg">{player.name}</p>
              <p className="text-purple-600 font-bold text-xl">{player.score}</p>
              {room.currentJudge === player.id && (
                <p className="text-yellow-600 font-bold text-sm">JUDGE</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Game State Display */}
      {room.gameState === GameState.LOBBY && (
        <LobbyDisplay room={room} />
      )}

      {room.gameState === GameState.PROMPT_SELECTION && (
        <PromptSelectionDisplay room={room} />
      )}

      {room.gameState === GameState.SOUND_SELECTION && (
        <SoundSelectionDisplay room={room} />
      )}

      {room.gameState === GameState.JUDGING && (
        <JudgingDisplay room={room} />
      )}

      {room.gameState === GameState.ROUND_RESULTS && (
        <ResultsDisplay room={room} />
      )}

      {room.gameState === GameState.GAME_OVER && (
        <GameOverDisplay room={room} />
      )}
    </div>
  );
}

function LobbyDisplay({ room }: { room: Room }) {
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
      <h3 className="text-3xl font-bold text-gray-800 mb-6">Waiting for Game to Start</h3>
      <div className="text-6xl mb-6">⏳</div>
      <p className="text-xl text-gray-600 mb-6">
        Need at least 3 players to begin. Current: {room.players.length}
      </p>
      <p className="text-lg text-gray-500">
        Host can start the game when ready!
      </p>
    </div>
  );
}

function PromptSelectionDisplay({ room }: { room: Room }) {
  const judge = room.players.find(p => p.id === room.currentJudge);
  
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
      <h3 className="text-3xl font-bold text-gray-800 mb-6">Judge Selecting Prompt</h3>
      <div className="text-6xl mb-6">🤔</div>
      <p className="text-2xl text-gray-600 mb-4">
        <span className="font-bold text-purple-600">{judge?.name}</span> is choosing a weird prompt...
      </p>
      <div className="animate-pulse flex justify-center space-x-2">
        <div className="w-4 h-4 bg-purple-400 rounded-full"></div>
        <div className="w-4 h-4 bg-purple-400 rounded-full"></div>
        <div className="w-4 h-4 bg-purple-400 rounded-full"></div>
      </div>
    </div>
  );
}

function SoundSelectionDisplay({ room }: { room: Room }) {
  const otherPlayers = room.players.filter(p => p.id !== room.currentJudge);
  
  return (
    <div className="bg-white rounded-3xl p-12 shadow-2xl">
      <h3 className="text-3xl font-bold text-gray-800 mb-6 text-center">Sound Selection Time!</h3>
      
      {room.currentPrompt && (
        <div className="bg-purple-100 rounded-2xl p-6 mb-8">
          <h4 className="text-xl font-bold text-purple-800 mb-2">The Prompt:</h4>
          <p className="text-2xl text-gray-800 font-bold">&quot;{room.currentPrompt}&quot;</p>
        </div>
      )}

      <div className="text-center mb-8">
        <p className="text-xl text-gray-600 mb-4">
          Players are picking their best sound combinations...
        </p>
        <div className="text-6xl">🎵</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {otherPlayers.map((player) => (
          <div key={player.id} className="text-center p-4 bg-gray-100 rounded-2xl">            <div 
              className={`w-12 h-12 rounded-full mx-auto mb-2 ${getPlayerColorClass(player.color)}`}
            ></div>
            <p className="font-bold">{player.name}</p>
            <p className="text-sm text-gray-600">
              {room.submissions.find(s => s.playerId === player.id) ? '✅ Ready' : '⏳ Thinking...'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function JudgingDisplay({ room }: { room: Room }) {
  const judge = room.players.find(p => p.id === room.currentJudge);
  
  return (
    <div className="bg-white rounded-3xl p-12 shadow-2xl">
      <h3 className="text-3xl font-bold text-gray-800 mb-6 text-center">Judging Time!</h3>
      
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">👨‍⚖️</div>        <p className="text-2xl text-gray-600 mb-4">
          <span className="font-bold text-purple-600">{judge?.name}</span> is listening to all the submissions...
        </p>
        
        {room.currentPrompt && (
          <div className="bg-purple-100 rounded-2xl p-4 mb-6 inline-block">
            <p className="text-lg text-purple-800">
              Prompt: <span className="font-bold">&quot;{room.currentPrompt}&quot;</span>
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {room.submissions.map((submission, index) => (
          <div key={index} className="bg-gray-100 rounded-2xl p-6">
            <h4 className="text-xl font-bold text-gray-800 mb-4">Submission {index + 1}</h4>
            <div className="space-y-2">
              {submission.sounds.map((soundId, soundIndex) => {
                const sound = SOUND_EFFECTS.find(s => s.id === soundId);
                return (
                  <div key={soundIndex} className="bg-white px-4 py-2 rounded-lg">
                    <span className="font-bold">🔊 {sound?.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsDisplay({ room }: { room: Room }) {
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
      <h3 className="text-3xl font-bold text-gray-800 mb-6">Round Results!</h3>
      <div className="text-6xl mb-6">🎉</div>
      <p className="text-xl text-gray-600">
        Round {room.currentRound} complete! Getting ready for the next round...
      </p>
    </div>
  );
}

function GameOverDisplay({ room }: { room: Room }) {
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
      <h3 className="text-4xl font-bold text-gray-800 mb-8">🎊 Game Over! 🎊</h3>
      
      <div className="mb-8">
        <div className="text-8xl mb-4">🏆</div>
        <h4 className="text-3xl font-bold text-yellow-600 mb-2">Winner!</h4>
        <p className="text-4xl font-bold text-gray-800">{winner.name}</p>
        <p className="text-2xl text-gray-600">{winner.score} points</p>
      </div>

      <div className="bg-gray-100 rounded-2xl p-6">
        <h4 className="text-2xl font-bold text-gray-800 mb-4">Final Scores</h4>
        <div className="space-y-3">
          {sortedPlayers.map((player, index) => (
            <div 
              key={player.id} 
              className={`flex justify-between items-center p-4 rounded-xl ${
                index === 0 ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-white'
              }`}
            >
              <div className="flex items-center space-x-4">
                <span className="text-2xl font-bold">{index + 1}.</span>                <div 
                  className={`w-8 h-8 rounded-full ${getPlayerColorClass(player.color)}`}
                ></div>
                <span className="text-xl font-bold">{player.name}</span>
              </div>
              <span className="text-2xl font-bold text-purple-600">{player.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getGameStateDisplay(state: GameState): string {
  switch (state) {
    case GameState.LOBBY: return 'In Lobby';
    case GameState.PROMPT_SELECTION: return 'Selecting Prompt';
    case GameState.SOUND_SELECTION: return 'Picking Sounds';
    case GameState.JUDGING: return 'Judging Submissions';
    case GameState.ROUND_RESULTS: return 'Round Results';
    case GameState.GAME_OVER: return 'Game Complete';
    default: return 'Unknown';
  }
}
