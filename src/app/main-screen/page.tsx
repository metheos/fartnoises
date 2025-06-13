'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Room, GameState, Player, SoundSubmission, GamePrompt } from '@/types/game';
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
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [roundWinner, setRoundWinner] = useState<{
    winnerId: string;
    winnerName: string;
    winningSubmission: any;
    submissionIndex: number;
  } | null>(null);
  useEffect(() => {
    // Initialize socket connection
    socket = io({
      path: '/api/socket',
    });    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Main screen connected to server');
      // Automatically request the room list when we connect
      socket.emit('requestMainScreenUpdate');
    });    socket.on('mainScreenUpdate', ({ rooms: updatedRooms }: { rooms: Room[] }) => {
      console.log('Main screen received room list update:', updatedRooms);
      setRooms(updatedRooms); // Update the list of all available rooms

      // If the main screen is currently displaying a specific room,
      // try to find its updated state in the new list of rooms.
      setCurrentRoom(prevCurrentRoom => {
        if (prevCurrentRoom) {
          const refreshedCurrentRoom = updatedRooms.find(r => r.code === prevCurrentRoom.code);
          if (refreshedCurrentRoom) {
            console.log('Main screen updating current room from room list:', refreshedCurrentRoom);
            return refreshedCurrentRoom; // Update currentRoom with the latest from the global list
          }
          // If the room no longer exists in the list, keep current room for now
          console.log('Main screen current room not found in updated list, keeping current room');
        } else {
          // If not currently watching a room and there's exactly one active room, 
          // automatically join it as viewer for better UX
          if (updatedRooms.length === 1) {
            console.log('Main screen auto-joining the only active room:', updatedRooms[0].code);
            socket.emit('joinRoomAsViewer', updatedRooms[0].code);
          }
        }
        return prevCurrentRoom;
      });
    });socket.on('roomUpdated', (updatedRoom) => {
      console.log('Main screen received room update:', updatedRoom);
      setCurrentRoom(prev => {
        // Only update if we're currently watching this room
        if (prev && updatedRoom.code === prev.code) {
          console.log('Main screen updating current room from roomUpdated event:', updatedRoom);
          return updatedRoom;
        }
        console.log('Main screen ignoring roomUpdated for different room:', updatedRoom.code, 'current:', prev?.code);
        return prev;
      });
    });

    socket.on('roomJoined', (room) => {
      console.log('Main screen joined room:', room);
      setCurrentRoom(room);
      setJoinError('');
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      setJoinError(error.message || 'Failed to connect to room');
    });

    socket.on('roundComplete', (winnerData) => {
      console.log('Main screen roundComplete event received:', winnerData);
      if (typeof winnerData === 'object' && winnerData.winnerId) {
        setRoundWinner(winnerData);
      }
    });
    socket.on('gameStateChanged', (newState: GameState, data?: any) => {
      console.log('Main screen gameStateChanged:', newState, data);
      setCurrentRoom(prevRoom => {
        if (prevRoom) {
          const updatedData: Partial<Room> = { gameState: newState };
          // Merge relevant fields from data if they exist and are provided
          if (data) {
            if (data.currentJudge !== undefined) updatedData.currentJudge = data.currentJudge;
            if (data.currentPrompt !== undefined) updatedData.currentPrompt = data.currentPrompt;
            if (data.availablePrompts !== undefined) updatedData.availablePrompts = data.availablePrompts as GamePrompt[];
            if (data.submissions !== undefined) updatedData.submissions = data.submissions as SoundSubmission[];
            if (data.players !== undefined) updatedData.players = data.players as Player[]; // If players list comes with this event
            if (data.currentRound !== undefined) updatedData.currentRound = data.currentRound;
            // Add any other fields that might be relevant from the 'data' payload
          }
          return { ...prevRoom, ...updatedData };
        }
        return prevRoom;
      });

      // Clear round winner when starting a new round or returning to lobby
      if (newState === GameState.JUDGE_SELECTION || newState === GameState.LOBBY) {
        setRoundWinner(null);
      }
    });
    socket.on('soundSubmitted', (submission) => {
      console.log('Main screen received sound submission:', submission);
      // Update currentRoom state with the new submission
      setCurrentRoom(prev => {
        if (prev) {
          // Check if this submission already exists to avoid duplicates
          const existingSubmission = prev.submissions.find(s => s.playerId === submission.playerId);
          if (existingSubmission) {
            return prev; // Don't update if submission already exists
          }
          
          // Add the new submission to the room state
          return {
            ...prev,
            submissions: [...prev.submissions, submission]
          };
        }
        return prev;
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Main screen disconnected from server');
    });

    return () => {
      socket.disconnect();
    };
  }, []); // Empty dependency array - only run once on mount

  const joinRoom = () => {
    if (roomCodeInput.length === 4) {
      setJoinError('');
      socket.emit('joinRoomAsViewer', roomCodeInput.toUpperCase());
    } else {
      setJoinError('Room code must be 4 letters');
    }
  };
  const leaveRoom = () => {
    setCurrentRoom(null);
    setRoundWinner(null);
    setJoinError('');
    setRoomCodeInput('');    // Request fresh room list only when leaving a room
    socket.emit('requestMainScreenUpdate');
  };

  const refreshRooms = () => {
    socket.emit('requestMainScreenUpdate');
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
          <div className="animate-spin w-24 h-24 border-8 border-purple-500 border-t-transparent rounded-full mx-auto mb-8"></div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Connecting to fartnoises</h2>
          <p className="text-gray-800 text-xl">Setting up the main screen...</p>
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
        </div>        {currentRoom ? (
          <div className="mb-4">
            <button
              onClick={leaveRoom}
              className="bg-red-500 text-white px-6 py-2 rounded-xl hover:bg-red-600 transition-colors"
            >
              ← Leave Room {currentRoom.code}
            </button>
          </div>
        ) : null}

        {currentRoom ? (
          <MainScreenGameDisplay room={currentRoom} roundWinner={roundWinner} />
        ) : (          <WaitingForGameScreen 
            rooms={rooms} 
            onJoinRoom={joinRoom}
            onRefreshRooms={refreshRooms}
            roomCodeInput={roomCodeInput}
            setRoomCodeInput={setRoomCodeInput}
            joinError={joinError}
          />
        )}

        {/* Room List Footer */}        <div className="mt-8 bg-white bg-opacity-80 rounded-3xl p-6">
          <h3 className="text-gray-800 text-xl font-bold mb-4 text-center">Active Rooms</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.length === 0 ? (              <div className="col-span-full text-center text-gray-800">
                No active games. Create a room on your phone to get started!
              </div>
            ) : (              rooms.map((room) => (
                <div 
                  key={room.code} 
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                    currentRoom?.code === room.code 
                      ? 'bg-white bg-opacity-90 scale-105' 
                      : 'bg-white bg-opacity-80 hover:bg-opacity-90'
                  }`}
                  onClick={() => setCurrentRoom(room)}
                >                  <div className={currentRoom?.code === room.code ? "text-gray-900" : "text-gray-800"}>
                    <h4 className="font-bold text-lg">{room.code}</h4>
                    <p className="text-sm">{room.players.length} players</p>
                    <p className="text-sm">{getGameStateDisplay(room.gameState)}</p>
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

function WaitingForGameScreen({ 
  rooms, 
  onJoinRoom, 
  onRefreshRooms,
  roomCodeInput, 
  setRoomCodeInput, 
  joinError 
}: { 
  rooms: Room[];
  onJoinRoom: () => void;
  onRefreshRooms: () => void;
  roomCodeInput: string;
  setRoomCodeInput: (value: string) => void;
  joinError: string;
}) {
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
      <div className="text-8xl mb-8">🎮</div>
      <h2 className="text-4xl font-bold text-gray-800 mb-6">Ready for Fun!</h2>      <p className="text-gray-800 text-xl mb-8">
        Players can join by going to <strong>fartnoises.game</strong> on their phones
      </p>
      
      {/* Manual Room Entry */}      <div className="bg-purple-100 rounded-2xl p-6 mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Join a Specific Game</h3>
        <p className="text-gray-800 mb-4">Enter a 4-letter room code to watch that game:</p>
        
        <div className="flex justify-center items-center space-x-4">          <input
            type="text"
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
            placeholder="ABCD"
            maxLength={4}
            className="text-2xl font-mono font-bold text-center w-32 h-16 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:outline-none placeholder:text-gray-700 text-gray-900 bg-white"
          />
          <button
            onClick={onJoinRoom}
            disabled={roomCodeInput.length !== 4}
            className="bg-purple-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-purple-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Watch Game
          </button>
        </div>
        
        {joinError && (
          <p className="text-red-600 font-bold mt-4">{joinError}</p>
        )}
      </div>
        <div className="bg-gray-100 rounded-2xl p-8 mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">How to Play:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="text-center">
            <div className="text-4xl mb-2">📱</div>
            <h4 className="font-bold text-lg mb-2 text-gray-900">1. Join on Phone</h4>
            <p className="text-gray-800">Enter your name and create or join a room</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">🎵</div>
            <h4 className="font-bold text-lg mb-2 text-gray-900">2. Pick Sounds</h4>
            <p className="text-gray-800">Choose 2 silly sounds to match weird prompts</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">🏆</div>
            <h4 className="font-bold text-lg mb-2 text-gray-900">3. Vote & Win</h4>
            <p className="text-gray-800">Judge picks the funniest combo and awards points</p>
          </div>
        </div>
      </div>{/* Only show room list if user manually requests it */}      {rooms.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">Active Rooms (for reference):</h3>
          <div className="flex justify-center space-x-4 mb-4">
            {rooms.slice(0, 5).map((room) => (
              <div key={room.code} className="bg-purple-100 px-6 py-3 rounded-xl">
                <span className="font-mono font-bold text-lg text-gray-900">{room.code}</span>
                <span className="text-gray-700 ml-2">({room.players.length} players)</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <button
        onClick={onRefreshRooms}
        className="bg-gray-500 text-white px-6 py-2 rounded-xl hover:bg-gray-600 transition-colors text-sm"
      >
        🔄 Refresh Room List
      </button>
    </div>
  );
}

function MainScreenGameDisplay({ 
  room, 
  roundWinner 
}: { 
  room: Room; 
  roundWinner: {
    winnerId: string;
    winnerName: string;
    winningSubmission: any;
    submissionIndex: number;
  } | null;
}) {
  return (
    <div className="space-y-8">
      {/* Game Header */}
      <div className="bg-white rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-4xl font-bold text-gray-800">Room {room.code}</h2>
            <p className="text-xl text-gray-800">Round {room.currentRound} of {room.maxRounds}</p>
          </div>
          <div className="text-right">
            <p className="text-lg text-gray-800">{getGameStateDisplay(room.gameState)}</p>
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
              </div>              <p className="font-bold text-lg text-gray-900">{player.name}</p>
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
      )}      {room.gameState === GameState.ROUND_RESULTS && (
        <ResultsDisplay room={room} roundWinner={roundWinner} />
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
      <h3 className="text-3xl font-bold text-gray-900 mb-6">Waiting for Game to Start</h3>
      <div className="text-6xl mb-6">⏳</div>
      <p className="text-xl text-gray-800 mb-6">
        Need at least 3 players to begin. Current: {room.players.length}
      </p>
      <p className="text-lg text-gray-700">
        Host can start the game when ready!
      </p>
    </div>
  );
}

function PromptSelectionDisplay({ room }: { room: Room }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const judge = room.players.find(p => p.id === room.currentJudge);
  
  useEffect(() => {
    // Use the existing global socket instead of creating a new one
    if (!socket) return;
    
    const handleTimeUpdate = (data: any) => {
      if (data.phase === 'prompt-selection') {
        setTimeLeft(data.timeLeft);
      }
    };
    
    socket.on('timeUpdate', handleTimeUpdate);

    return () => {
      socket.off('timeUpdate', handleTimeUpdate);
    };
  }, []);
  
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
      <h3 className="text-3xl font-bold text-gray-800 mb-6">Judge Selecting Prompt</h3>
      
      {/* Timer Display */}
      {timeLeft !== null && (
        <div className="mb-6">
          <div className={`text-4xl font-bold mb-2 ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}>
            {timeLeft}s
          </div>
          <div className="w-32 bg-gray-200 rounded-full h-3 mx-auto">
            <div 
              className={`h-3 rounded-full transition-all duration-1000 ${
                timeLeft <= 5 ? 'bg-red-500' : 'bg-blue-500'
              } ${
                timeLeft <= 15 ? (timeLeft <= 12 ? (timeLeft <= 9 ? (timeLeft <= 6 ? (timeLeft <= 3 ? 'w-1/5' : 'w-2/5') : 'w-3/5') : 'w-4/5') : 'w-4/5') : 'w-full'
              }`}
            ></div>
          </div>
        </div>
      )}
        <div className="text-6xl mb-6">🤔</div>
      <p className="text-2xl text-gray-800 mb-4">
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
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const otherPlayers = room.players.filter(p => p.id !== room.currentJudge);
  const submittedCount = room.submissions.length;
  const totalNeeded = otherPlayers.length;
  
  // Debug logging
  console.log('SoundSelectionDisplay render:', {
    submittedCount,
    totalNeeded,
    submissions: room.submissions,
    otherPlayers: otherPlayers.map(p => p.name)
  });
  
  useEffect(() => {
    // Use the existing global socket instead of creating a new one
    if (!socket) return;
    
    const handleTimeUpdate = (data: any) => {
      if (data.phase === 'sound-selection') {
        setTimeLeft(data.timeLeft);
      }
    };
    
    socket.on('timeUpdate', handleTimeUpdate);

    return () => {
      socket.off('timeUpdate', handleTimeUpdate);
    };
  }, []);
  
  return (
    <div className="bg-white rounded-3xl p-12 shadow-2xl">
      <h3 className="text-3xl font-bold text-gray-800 mb-6 text-center">Sound Selection Time!</h3>
      
      {/* Timer Display */}
      {timeLeft !== null && (
        <div className="text-center mb-6">
          <div className={`text-6xl font-bold mb-2 ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>
            {timeLeft}s
          </div>
          <div className="w-64 bg-gray-200 rounded-full h-4 mx-auto">
            <div 
              className={`h-4 rounded-full transition-all duration-1000 ${
                timeLeft <= 10 ? 'bg-red-500' : 'bg-green-500'
              } ${
                timeLeft <= 30 ? (timeLeft <= 25 ? (timeLeft <= 20 ? (timeLeft <= 15 ? (timeLeft <= 10 ? 'w-1/6' : 'w-2/6') : 'w-3/6') : 'w-4/6') : 'w-5/6') : 'w-full'
              }`}
            ></div>
          </div>
        </div>
      )}
      
      {room.currentPrompt && (
        <div className="bg-purple-100 rounded-2xl p-6 mb-8">
          <h4 className="text-xl font-bold text-purple-800 mb-2">The Prompt:</h4>
          <p className="text-2xl text-gray-800 font-bold">&quot;{room.currentPrompt}&quot;</p>
        </div>
      )}      <div className="text-center mb-8">
        <p className="text-xl text-gray-800 mb-4">
          Players are picking their best sound combinations...
        </p>
        <p className="text-lg text-gray-700 mb-4">
          {submittedCount} of {totalNeeded} players have submitted
        </p>
        <div className="text-6xl">🎵</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {otherPlayers.map((player) => (          <div key={player.id} className="text-center p-4 bg-gray-100 rounded-2xl">            <div 
              className={`w-12 h-12 rounded-full mx-auto mb-2 ${getPlayerColorClass(player.color)}`}
            ></div>
            <p className="font-bold text-gray-900">{player.name}</p>
            <p className="text-sm text-gray-700">
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
        <div className="text-6xl mb-4">👨‍⚖️</div>        <p className="text-2xl text-gray-800 mb-4">
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

function ResultsDisplay({ 
  room, 
  roundWinner 
}: { 
  room: Room; 
  roundWinner: {
    winnerId: string;
    winnerName: string;
    winningSubmission: any;
    submissionIndex: number;
  } | null;
}) {
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
      <h3 className="text-3xl font-bold text-gray-800 mb-6">Round Results!</h3>
      <div className="text-6xl mb-6">🎉</div>
      
      {roundWinner && (
        <div className="mb-8">
          <div className="bg-yellow-100 border-4 border-yellow-400 rounded-2xl p-8 mb-6">
            <h4 className="text-4xl font-bold text-yellow-800 mb-4">
              🏆 {roundWinner.winnerName} Wins!
            </h4>
            {roundWinner.winningSubmission && (
              <div className="text-lg text-yellow-700">
                <p className="mb-4 font-semibold">Winning Combination:</p>
                <div className="flex justify-center space-x-4">
                  {roundWinner.winningSubmission.sounds.map((soundId: string, index: number) => {
                    const sound = SOUND_EFFECTS.find(s => s.id === soundId);
                    return (
                      <div key={index} className="bg-yellow-50 px-6 py-3 rounded-xl border-2 border-yellow-300">
                        <div className="text-xl font-bold">{sound ? sound.name : soundId}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        <p className="text-xl text-gray-800">
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
        <div className="text-8xl mb-4">🏆</div>        <h4 className="text-3xl font-bold text-yellow-600 mb-2">Winner!</h4>
        <p className="text-4xl font-bold text-gray-900">{winner.name}</p>
        <p className="text-2xl text-gray-800">{winner.score} points</p>
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
                <span className="text-xl font-bold text-gray-900">{player.name}</span>
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
