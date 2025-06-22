'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Room, GameState, Player, SoundSubmission, GamePrompt, SoundEffect } from '@/types/game';
import { getSoundEffects } from '@/data/gameData';
import { audioSystem } from '@/utils/audioSystem';

let socket: Socket;

// Helper function to convert hex colors to Tailwind classes
export const getPlayerColorClass = (color: string): string => {
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
  const [soundEffects, setSoundEffects] = useState<SoundEffect[]>([]);
  const [roundWinner, setRoundWinner] = useState<{
    winnerId: string;
    winnerName: string;
    winningSubmission: any;
    submissionIndex: number;
  } | null>(null);
  
  // Load sound effects on component mount
  useEffect(() => {
    const loadSounds = async () => {
      try {
        const sounds = await getSoundEffects();
        setSoundEffects(sounds);
        console.log(`Loaded ${sounds.length} sound effects`);
      } catch (error) {
        console.error('Failed to load sound effects:', error);
      }
    };
    loadSounds();
  }, []);

  useEffect(() => {
    // Initialize socket connection
    socket = io({
      path: '/api/socket',
    });    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Main screen connected to server');
      // Automatically request the room list when we connect
      socket.emit('requestMainScreenUpdate');
      
      // If we were watching a specific room before disconnection, rejoin it
      if (currentRoom) {
        console.log('Main screen: Reconnecting to room', currentRoom.code);
        socket.emit('joinRoomAsViewer', currentRoom.code);
      }
    });socket.on('mainScreenUpdate', ({ rooms: updatedRooms }: { rooms: Room[] }) => {
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
        }
        return prevCurrentRoom;
      });
    });    socket.on('roomUpdated', (updatedRoom) => {
      console.log('Main screen received room update:', updatedRoom);
      setCurrentRoom(prev => {
        // Only update if we're currently watching this room  
        if (prev && updatedRoom.code === prev.code) {
          console.log('Main screen updating current room from roomUpdated event:', updatedRoom);
          console.log('Previous game state:', prev.gameState, '-> New game state:', updatedRoom.gameState);
          console.log('Previous judge:', prev.currentJudge, '-> New judge:', updatedRoom.currentJudge);
          console.log('Previous round:', prev.currentRound, '-> New round:', updatedRoom.currentRound);
          return updatedRoom;
        }
        console.log('Main screen ignoring roomUpdated for different room:', updatedRoom.code, 'current:', prev?.code);
        return prev;
      });
    });    socket.on('roomJoined', (data) => {
      console.log('[MAIN SCREEN] Room joined event received:', data);
      // Handle both formats: direct room object (from viewer join) or { room, player } object
      const room = data.room || data;
      if (room) {
        console.log('[MAIN SCREEN] Setting current room to:', room.code);
        setCurrentRoom(room);
        setJoinError('');
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      setJoinError(error.message || 'Failed to connect to room');
    });    socket.on('roundComplete', (winnerData) => {
      console.log('Main screen roundComplete event received:', winnerData);
      console.log('Setting roundWinner state to:', winnerData);
      if (typeof winnerData === 'object' && winnerData.winnerId) {
        setRoundWinner(winnerData);
      }    });socket.on('gameStateChanged', (newState: GameState, data?: any) => {
      console.log('Main screen gameStateChanged:', newState, data);
      console.log('Current room before state change:', currentRoom?.gameState, '-> New state:', newState);
      
      setCurrentRoom(prevRoom => {
        if (prevRoom) {
          const updatedData: Partial<Room> = { gameState: newState };
          
          console.log('Main screen processing gameStateChanged for room:', prevRoom.code);
          console.log('Previous state:', prevRoom.gameState, 'New state:', newState);
          
          // Merge relevant fields from data if they exist and are provided
          if (data) {
            // Map server field names to room properties
            if (data.judgeId !== undefined) {
              console.log('Setting judge from gameStateChanged:', data.judgeId);
              updatedData.currentJudge = data.judgeId;
            }
            if (data.prompt !== undefined) updatedData.currentPrompt = data.prompt;
            if (data.prompts !== undefined) updatedData.availablePrompts = data.prompts as GamePrompt[];
            if (data.submissions !== undefined) updatedData.submissions = data.submissions as SoundSubmission[];
            if (data.sounds !== undefined) {
              // Store available sounds for this phase if needed
              // Could add to room state if we extend the Room type
            }
            if (data.timeLimit !== undefined) {
              // Handle time limit if needed
            }
            // Keep existing field mappings as fallback
            if (data.currentJudge !== undefined) updatedData.currentJudge = data.currentJudge;
            if (data.currentPrompt !== undefined) updatedData.currentPrompt = data.currentPrompt;
            if (data.availablePrompts !== undefined) updatedData.availablePrompts = data.availablePrompts as GamePrompt[];
            if (data.players !== undefined) updatedData.players = data.players as Player[];
            if (data.currentRound !== undefined) updatedData.currentRound = data.currentRound;
          }
          
          const newRoom = { ...prevRoom, ...updatedData };
          console.log('Main screen final room state after gameStateChanged:', newRoom);
          
          // Play prompt audio when transitioning to sound selection
          if (newState === GameState.SOUND_SELECTION && newRoom.currentPrompt && newRoom.currentPrompt.audioFile) {
            console.log('🔊 Playing prompt audio:', newRoom.currentPrompt.audioFile);
            const audioFile = newRoom.currentPrompt.audioFile; // Ensure it's not undefined
            audioSystem.initialize().then(() => {
              audioSystem.loadAndPlayPromptAudio(audioFile);
            }).catch(error => {
              console.error('Failed to initialize audio system for prompt playback:', error);
            });
          }
          
          return newRoom;
        }
        console.log('Main screen: No current room to update for gameStateChanged');
        return prevRoom;
      });

      // Clear round winner when starting a new round or returning to lobby
      if (newState === GameState.JUDGE_SELECTION || newState === GameState.LOBBY) {
        setRoundWinner(null);
      }
    });socket.on('soundSubmitted', (submission) => {
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

    socket.on('promptSelected', (prompt: GamePrompt) => {
      console.log('Main screen received prompt selection:', prompt);
      setCurrentRoom(prev => {
        if (prev) {
          // The full prompt object is received, including audioFile
          return { ...prev, currentPrompt: prompt };
        }
        return prev;
      });
    });

    socket.on('judgeSelected', (judgeId: string) => {
      console.log('Main screen received judge selection:', judgeId);
      setCurrentRoom(prev => {
        if (prev) {
          console.log('Main screen updating currentJudge from', prev.currentJudge, 'to', judgeId);
          return { ...prev, currentJudge: judgeId };
        }
        return null;
      });
    });// Global time update handler (not phase-specific)
    socket.on('timeUpdate', (data: { timeLeft: number }) => {
      console.log('Main screen received time update:', data);
      // This will be handled by individual component useEffect hooks
    });

    // Add handler for game phase transitions that might need special handling
    socket.on('playbackStarted', (data?: any) => {
      console.log('Main screen received playback started:', data);
      // Could update room state if needed
      if (data && data.submissions) {
        setCurrentRoom(prev => prev ? { ...prev, submissions: data.submissions } : null);
      }
    });

    // Add handler for when judge makes selections
    socket.on('winnerSelected', (data: any) => {
      console.log('Main screen received winner selected:', data);
      if (data) {
        setRoundWinner(data);
      }
    });

    // Handle disconnection/reconnection events to keep UI in sync
    socket.on('gamePausedForDisconnection', (data: any) => {
      console.log('Main screen: Game paused for disconnection:', data);
      // Could show a pause overlay or message
    });

    socket.on('gameResumed', () => {
      console.log('Main screen: Game resumed');
      // Could hide pause overlay
    });    socket.on('playerReconnected', (data: any) => {
      console.log('Main screen: Player reconnected:', data);
      // Room will be updated via roomUpdated event
    });

    // Add handler to track when games start
    socket.on('gameStarted', (data: any) => {
      console.log('Main screen: Game started:', data);
      // This might be emitted by the server when a game begins
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Main screen disconnected from server');
    });

    return () => {
      socket.disconnect();
    };  }, []); // Empty dependency array - only run once on mount
  
  const joinRoom = () => {
    if (roomCodeInput.length === 4) {
      setJoinError('');
      console.log('Main screen: Joining room as viewer:', roomCodeInput.toUpperCase());
      if (socket && socket.connected) {
        socket.emit('joinRoomAsViewer', roomCodeInput.toUpperCase());
      }
    } else {
      setJoinError('Room code must be 4 letters');
    }
  };
  
  const leaveRoom = () => {
    setCurrentRoom(null);
    setRoundWinner(null);
    setJoinError('');
    setRoomCodeInput('');
    
    // Request fresh room list only when leaving a room
    if (socket && socket.connected) {
      socket.emit('requestMainScreenUpdate');
    }
  };
  
  const refreshRooms = () => {
    console.log('Main screen: Manually refreshing room list');
    if (socket && socket.connected) {
      socket.emit('requestMainScreenUpdate');
    }
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
        {/* <div className="text-center mb-8">
          <h1 className="text-8xl font-black text-white mb-4 transform -rotate-2 drop-shadow-lg">
            fartnoises
          </h1>
          <p className="text-white text-2xl font-bold opacity-90">
            The Silly Sound Game • Main Screen Display
          </p>
        </div>         */}
        {/* {currentRoom ? (
          <div className="mb-4">
            <button
              onClick={leaveRoom}
              className="bg-red-500 text-white px-6 py-2 rounded-xl hover:bg-red-600 transition-colors"
            >
              ← Leave Room {currentRoom.code}
            </button>
          </div>
        ) : null} */}

        {currentRoom ? (
          <MainScreenGameDisplay room={currentRoom} roundWinner={roundWinner} soundEffects={soundEffects} />
        ) : (          <WaitingForGameScreen 
            rooms={rooms} 
            onJoinRoom={joinRoom}
            onRefreshRooms={refreshRooms}
            roomCodeInput={roomCodeInput}
            setRoomCodeInput={setRoomCodeInput}
            joinError={joinError}
          />
        )}

        {/* Room List Footer */}        
        {/* <div className="mt-8 bg-white bg-opacity-80 rounded-3xl p-6">
          <h3 className="text-gray-800 text-xl font-bold mb-4 text-center">Active Rooms</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.length === 0 ? (              <div className="col-span-full text-center text-gray-800">
                No active games. Create a room on your phone to get started!
              </div>
            ) : (              rooms.map((room) => (                <div 
                  key={room.code} 
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                    currentRoom?.code === room.code 
                      ? 'bg-white bg-opacity-90 scale-105' 
                      : 'bg-white bg-opacity-80 hover:bg-opacity-90'
                  }`}
                  onClick={() => {
                    console.log('Main screen: Clicking to view room', room.code);
                    setCurrentRoom(room);
                    // Also join the room as viewer to get real-time updates
                    socket.emit('joinRoomAsViewer', room.code);
                  }}
                ><div className={currentRoom?.code === room.code ? "text-gray-900" : "text-gray-800"}>
                    <h4 className="font-bold text-lg">{room.code}</h4>
                    <p className="text-sm">{room.players.length} players</p>
                    <p className="text-sm">{getGameStateDisplay(room.gameState)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div> */}
      </div>
    </div>
  );
}

export function WaitingForGameScreen({ 
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
      <div className="text-8xl mb-8">🎵💨</div>
      <h2 className="text-4xl font-bold text-gray-800 mb-6">Ready for Fartnoises!</h2>
            <p className="text-gray-800 text-xl mb-8">
        Players can join by going to <strong>fartnoises.org</strong> on their phones
      </p>
      
      {/* Manual Room Entry */}      <div className="bg-purple-100 rounded-2xl p-6 mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Enter Room Code to Watch</h3>
        {/* <p className="text-gray-800 mb-4">Enter a 4-letter room code to watch that game:</p> */}
        
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
      {/* <div className="bg-gray-100 rounded-2xl p-8 mb-8">
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
      </div> */}
      {/* room list */}      
      {/* {rooms.length > 0 && (
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
      )} */}
      
      {/* <button
        onClick={onRefreshRooms}
        className="bg-gray-500 text-white px-6 py-2 rounded-xl hover:bg-gray-600 transition-colors text-sm"
      >
        🔄 Refresh Room List
      </button> */}
    </div>
  );
}

export function MainScreenGameDisplay({ 
  room, 
  roundWinner,
  soundEffects 
}: { 
  room: Room; 
  roundWinner: {
    winnerId: string;
    winnerName: string;
    winningSubmission: any;
    submissionIndex: number;
  } | null;
  soundEffects: SoundEffect[];
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
      {/* <div className="bg-white rounded-3xl p-8 shadow-2xl">
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
      </div>       */}
      {/* Game State Display */}
      {room.gameState === GameState.LOBBY && (
        <LobbyDisplay room={room} />
      )}

      {room.gameState === GameState.JUDGE_SELECTION && (
        <JudgeSelectionDisplay room={room} />
      )}

      {room.gameState === GameState.PROMPT_SELECTION && (
        <PromptSelectionDisplay room={room} />
      )}      {room.gameState === GameState.SOUND_SELECTION && (
        <SoundSelectionDisplay room={room} />
      )}      {room.gameState === GameState.PLAYBACK && (
        <PlaybackSubmissionsDisplay 
          key={`playback-${room.code}-${room.currentRound}`}
          room={room} 
          soundEffects={soundEffects} 
          socket={socket} 
        />
      )}

      {room.gameState === GameState.JUDGING && (
        <JudgingDisplay room={room} soundEffects={soundEffects} />
      )}
      
      {room.gameState === GameState.ROUND_RESULTS && (
        <ResultsDisplay room={room} roundWinner={roundWinner} soundEffects={soundEffects} />
      )}

      {room.gameState === GameState.GAME_OVER && (
        <GameOverDisplay room={room} />
      )}
    </div>
  );
}

export function LobbyDisplay({ room }: { room: Room }) {
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

export function PromptSelectionDisplay({ room }: { room: Room }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const judge = room.players.find(p => p.id === room.currentJudge);
    useEffect(() => {
    // Use the existing global socket instead of creating a new one
    if (!socket) return;
    
    const handleTimeUpdate = (data: any) => {
      // Server sends simple { timeLeft: number } format during prompt selection
      if (data.timeLeft !== undefined) {
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

export function SoundSelectionDisplay({ room }: { room: Room }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const otherPlayers = room.players.filter(p => p.id !== room.currentJudge);
  const submittedCount = room.submissions.length;
  const totalNeeded = otherPlayers.length;
  const hasFirstSubmission = submittedCount > 0;
  
  // Debug logging
  console.log('SoundSelectionDisplay render:', {
    submittedCount,
    totalNeeded,
    hasFirstSubmission,
    submissions: room.submissions,
    otherPlayers: otherPlayers.map(p => p.name)
  });
    useEffect(() => {
    // Use the existing global socket instead of creating a new one
    if (!socket) return;
    
    const handleTimeUpdate = (data: any) => {
      // Server sends simple { timeLeft: number } format during sound selection
      if (data.timeLeft !== undefined) {
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
      
      {/* Timer Display - Only show after first submission */}
      {timeLeft !== null && hasFirstSubmission && (
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
          <p className="text-sm text-gray-600 mt-2">
            ⏰ Countdown started after first submission
          </p>
        </div>
      )}
      
      {/* Waiting for first submission message */}
      {!hasFirstSubmission && (
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">⏳</div>
          <div className="bg-blue-100 rounded-2xl p-6">
            <h4 className="text-2xl font-bold text-blue-800 mb-2">Waiting for First Player</h4>
            <p className="text-lg text-blue-700">
              The countdown will begin once the first player submits their sounds
            </p>
            <div className="mt-4 animate-pulse flex justify-center space-x-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
            </div>
          </div>
        </div>
      )}
        {room.currentPrompt && (
        <div className="bg-purple-100 rounded-2xl p-6 mb-8">
          <h4 className="text-xl font-bold text-purple-800 mb-2">The Prompt:</h4>
          <p className="text-2xl text-gray-800 font-bold">{room.currentPrompt.text}</p>
        </div>
      )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {otherPlayers.map((player) => {
          const hasSubmitted = room.submissions.find(s => s.playerId === player.id);
          const isFirstSubmitter = hasSubmitted && submittedCount === 1 && room.submissions[0].playerId === player.id;
          
          return (
            <div 
              key={player.id} 
              className={`text-center p-4 rounded-2xl transition-all duration-300 ${
                hasSubmitted 
                  ? isFirstSubmitter 
                    ? 'bg-gradient-to-br from-green-200 to-blue-200 border-2 border-green-400 scale-105' 
                    : 'bg-green-100 border-2 border-green-300'
                  : hasFirstSubmission 
                    ? 'bg-yellow-100 border-2 border-yellow-300 animate-pulse'
                    : 'bg-gray-100'
              }`}
            >
              <div 
                className={`w-24 h-24 text-5xl rounded-full mx-auto mb-2 flex items-center justify-center ${getPlayerColorClass(player.color)}`}
              >
                {player.emoji || '🍑'}
              </div>
              <p className="font-bold text-2xl text-gray-900">{player.name}</p>
              <p className={`text-xl font-semibold ${
                hasSubmitted 
                  ? isFirstSubmitter 
                    ? 'text-blue-700' 
                    : 'text-green-700'
                  : hasFirstSubmission 
                    ? 'text-yellow-700' 
                    : 'text-gray-700'
              }`}>
                {hasSubmitted 
                  ? isFirstSubmitter 
                    ? '🎯 Started Timer!' 
                    : '✅ Ready'
                  : '⏳ Thinking...'
                }
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PlaybackSubmissionsDisplay({
  room,
  soundEffects,
  socket,
}: {
  room: Room;
  soundEffects: SoundEffect[];
  socket: Socket;
}) {  const [currentPlayingSubmission, setCurrentPlayingSubmission] = useState<SoundSubmission | null>(null);
  const [currentPlayingSoundIndex, setCurrentPlayingSoundIndex] = useState<number>(-1);
  const [revealedSounds, setRevealedSounds] = useState<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [promptPlaying, setPromptPlaying] = useState(false);
  const hasStartedPlaybackRef = useRef(false);
  const promptAudioPlayingRef = useRef(false);
  // This effect runs once when the component mounts for this phase to start the sequence.
  useEffect(() => {
    // Prevent this from running multiple times if the component re-renders.
    if (hasStartedPlaybackRef.current || !socket) return;
    hasStartedPlaybackRef.current = true;

    console.log('PlaybackSubmissionsDisplay: Starting playback sequence for room', room.code, 'round', room.currentRound);

    const startSequence = async () => {      // 1. Play prompt audio if it exists
      if (room.currentPrompt?.audioFile) {
        setPromptPlaying(true);
        promptAudioPlayingRef.current = true;
        console.log('Playing prompt audio:', room.currentPrompt.audioFile);
        try {
          // Use the correct method that loads from the prompt audio path
          await audioSystem.loadAndPlayPromptAudio(room.currentPrompt.audioFile);
          console.log('Prompt audio finished playing');
        } catch (error) {
          console.error('Error playing prompt audio:', error);
        }
        setPromptPlaying(false);
        promptAudioPlayingRef.current = false;
        // Add a small delay after prompt for pacing
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 2. Request the first submission from the server to begin the loop
      console.log('Prompt playback finished, requesting first submission.');
      socket.emit('requestNextSubmission', { roomCode: room.code });
    };

    startSequence();
    
  }, []); // Empty dependency array to prevent re-running


  // This effect handles playing each submission when the server sends it.
  useEffect(() => {
    if (!socket) return;    const handlePlaySubmission = async (submission: SoundSubmission | null) => {
      // A null submission from the server indicates the end of playback.
      if (!submission) {
        console.log('Received null submission, playback is complete.');
        setCurrentPlayingSubmission(null);
        setCurrentPlayingSoundIndex(-1);
        setIsPlaying(false);
        // The server will now transition the game to the JUDGING state.
        // No further action is needed on the client side here.
        return;
      }

      console.log('Main screen received playSubmission event:', submission);
      setCurrentPlayingSubmission(submission);
      setCurrentPlayingSoundIndex(-1); // Reset to -1 before starting
      setIsPlaying(true);

      try {
        // Play the two sounds for this submission sequentially with sound index tracking.
        const sounds = submission.sounds;        for (let i = 0; i < sounds.length; i++) {
          console.log(`Playing sound ${i + 1} of ${sounds.length}: ${sounds[i]}`);
          setCurrentPlayingSoundIndex(i);
          
          // Play this individual sound
          const sound = soundEffects.find(s => s.id === sounds[i]);
          if (sound) {
            const soundUrl = `/sounds/Earwax/EarwaxAudio/Audio/${sound.fileName}`;
            const audio = new Audio(soundUrl);
            audio.volume = 0.7;
            
            // Wait for this sound to complete before moving to the next
            await new Promise<void>((resolve, reject) => {
              audio.onended = () => {
                console.log(`Sound ${i + 1} finished playing`);
                // Add this sound to the revealed set so it stays visible
                setRevealedSounds(prev => new Set(prev).add(sounds[i]));
                resolve();
              };
              audio.onerror = () => {
                console.error(`Error playing sound: ${sound.name}`);
                reject(new Error(`Failed to play sound: ${sound.name}`));
              };
              audio.play().catch(reject);
            });
            
            // Small pause between sounds within the same submission
            if (i < sounds.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        }
      } catch (error) {
        console.error('Error playing submission sounds:', error);
      }      
      setCurrentPlayingSoundIndex(-1); // Reset when submission is done
      setIsPlaying(false);
      
      // Add a delay between submissions for better pacing
      console.log('Playback finished for submission, waiting before requesting next.');
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
      
      console.log('Requesting next submission after delay.');
      socket.emit('requestNextSubmission', { roomCode: room.code });
    };

    socket.on('playSubmission', handlePlaySubmission);

    return () => {
      socket.off('playSubmission', handlePlaySubmission);
    };
  }, [socket, room.code]);
  // This effect handles cleanup on unmount
  useEffect(() => {
    return () => {
      // When the component unmounts (e.g., game state changes), stop any active sounds.
      // But only if we're not currently playing the prompt audio
      if (!promptAudioPlayingRef.current) {
        console.log('Playback display unmounting. Stopping all sounds.');
        audioSystem.stopAllSounds();
      } else {
        console.log('Playback display unmounting, but prompt audio is playing. Not stopping sounds.');
      }
    };
  }, []); // Empty dependency array ensures this runs only on unmount

  const submissions = room.submissions;
  const getPlayerById = (id: string) => room.players.find(p => p.id === id);

  return (
    <div className="bg-white rounded-3xl p-12 shadow-2xl">
      <h3 className="text-3xl font-bold text-gray-800 mb-6 text-center">Playback Time!</h3>

      {room.currentPrompt && (
        <div className={`bg-purple-100 rounded-2xl p-6 mb-8 text-center transition-all duration-300 ${promptPlaying ? 'ring-4 ring-purple-500' : ''}`}>
          <h4 className="text-xl font-bold text-purple-800 mb-2">The Prompt:</h4>
          <p className="text-2xl text-gray-800 font-bold">{room.currentPrompt.text}</p>
          {promptPlaying && (
            <div className="mt-2 text-purple-600 font-semibold flex items-center justify-center space-x-2">
              <span className="animate-pulse">🔊</span>
              <span>Playing prompt...</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {submissions.map((submission, index) => {
          const player = getPlayerById(submission.playerId);
          const isCurrentlyPlaying = currentPlayingSubmission?.playerId === submission.playerId;

          return (
            <div
              key={index}
              className={`relative rounded-3xl p-6 transition-all duration-500 ${
                isCurrentlyPlaying ? 'bg-green-100 scale-105 ring-4 ring-green-400' : 'bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-bold text-gray-800">
                  {`Combo ${index + 1}`}
                </h4>
                {isCurrentlyPlaying && (
                  <div className="flex items-center space-x-2 text-green-600 font-semibold">
                    <span className="animate-pulse">▶️</span>
                    <span>Playing</span>
                  </div>
                )}
              </div>              <div className="space-y-3">
                {submission.sounds.map((soundId, soundIndex) => {
                  const sound = soundEffects.find(s => s.id === soundId);
                  const isCurrentSound = isCurrentlyPlaying && currentPlayingSoundIndex === soundIndex;
                  const hasBeenRevealed = revealedSounds.has(soundId);
                  
                  return (
                    <div
                      key={soundIndex}
                      className={`px-4 py-3 rounded-xl transition-all duration-300 ${
                        isCurrentSound 
                          ? 'bg-yellow-200 text-gray-900 shadow-lg scale-105 ring-2 ring-yellow-400' 
                          : hasBeenRevealed 
                            ? 'bg-green-100 text-gray-800 shadow-sm'
                            : 'bg-white text-gray-800 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">
                          {isCurrentSound ? '🔊' : hasBeenRevealed ? '✅' : '🎵'}
                        </span>                        <span className={`font-semibold ${
                          isCurrentSound ? 'text-yellow-800' : ''
                        }`}>
                          {isCurrentSound || hasBeenRevealed ? (sound?.name || soundId) : '???'}
                        </span>
                        {isCurrentSound && (
                          <div className="ml-auto">
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
                              <span className="text-yellow-700 text-sm font-bold">NOW PLAYING</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function JudgingDisplay({ room, soundEffects }: { room: Room; soundEffects: SoundEffect[] }) {
  const judge = room.players.find(p => p.id === room.currentJudge);
  
  return (
    <div className="bg-white rounded-3xl p-12 shadow-2xl">
      <h3 className="text-3xl font-bold text-gray-800 mb-6 text-center">Judging Time!</h3>
      
      {room.currentPrompt && (
        <div className="bg-purple-100 rounded-2xl p-6 mb-8 text-center">
          <h4 className="text-xl font-bold text-purple-800 mb-2">The Prompt:</h4>
          <p className="text-2xl text-gray-800 font-bold">{room.currentPrompt.text}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {room.submissions.map((submission, index) => (
          <div 
            key={index} 
            className="relative rounded-3xl p-6 transition-all duration-500 bg-gray-100 hover:bg-gray-50 border-2 border-gray-200"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-bold text-gray-800">
                  Combo {index + 1}
                </h4>
                
                {/* Status Indicator - waiting for judge decision */}
                <div className="w-4 h-4 rounded-full bg-purple-400 animate-pulse"></div>
              </div>

              <div className="space-y-3">
                {submission.sounds.map((soundId, soundIndex) => {
                  const sound = soundEffects.find(s => s.id === soundId);
                  
                  return (
                    <div 
                      key={soundIndex} 
                      className="px-4 py-3 rounded-xl transition-all duration-300 bg-white text-gray-800 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">🎵</span>
                        <span className="font-semibold">{sound?.name || soundId}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Judge consideration indicator */}
              <div className="mt-4 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                  <span className="text-purple-600 font-medium text-sm">UNDER REVIEW</span>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Status */}
      <div className="mt-8 text-center">
        <div className="bg-purple-100 rounded-2xl p-6">
          <div className="text-4xl mb-2">🤔</div>
          <p className="text-xl font-bold text-purple-800">Judge is deciding...</p>
          <p className="text-purple-700">Which sound combination is the funniest?</p>
        </div>
      </div>
    </div>
  );
}

export function ResultsDisplay({ 
  room, 
  roundWinner,
  soundEffects 
}: { 
  room: Room; 
  roundWinner: {
    winnerId: string;
    winnerName: string;
    winningSubmission: any;
    submissionIndex: number;
  } | null;
  soundEffects: SoundEffect[];
}) {  const [isPlayingWinner, setIsPlayingWinner] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioCompletionSentRef = useRef(false);
  const playbackStartedRef = useRef(false);

  // Reset the completion flag when a new round winner is set
  useEffect(() => {
    audioCompletionSentRef.current = false;
    playbackStartedRef.current = false;
  }, [roundWinner?.submissionIndex, room.currentRound]);

  // Clean up if game state changes away from ROUND_RESULTS while audio is playing
  useEffect(() => {
    if (room.gameState !== GameState.ROUND_RESULTS && isPlayingWinner) {
      console.log('[WINNER AUDIO] Game state changed away from ROUND_RESULTS, stopping audio');
      setIsPlayingWinner(false);
      setPlaybackProgress(0);
    }
  }, [room.gameState, isPlayingWinner]);
  
  // Automatically play the winning combination when results are shown
  useEffect(() => {
    if (roundWinner?.winningSubmission && soundEffects.length > 0 && !isPlayingWinner && !playbackStartedRef.current) {
      // Small delay to let the UI render, then start playing automatically
      console.log('[WINNER AUDIO] Scheduling winner audio playback...');
      playbackStartedRef.current = true; // Mark as started immediately to prevent duplicates
      
      const playDelay = setTimeout(() => {
        playWinningCombination();
      }, 1000); // 1 second delay for dramatic effect

      return () => clearTimeout(playDelay);
    } else if (playbackStartedRef.current) {
      console.log('[WINNER AUDIO] Playback already started for this round, skipping');
    }
  }, [roundWinner?.winningSubmission, soundEffects.length, isPlayingWinner]);

  const playWinningCombination = async () => {
    if (!roundWinner?.winningSubmission || isPlayingWinner) {
      console.log('[WINNER AUDIO] Skipping playback - already playing or no winner');
      return;
    }
    
    // Double-check that we haven't already started
    if (playbackStartedRef.current && isPlayingWinner) {
      console.log('[WINNER AUDIO] Playback already in progress, aborting duplicate');
      return;
    }
    
    console.log('[WINNER AUDIO] Starting winner audio playback');
    setIsPlayingWinner(true);
    setPlaybackProgress(0);
    
    try {
      // Create and play audio elements for the winning sounds
      const sounds = roundWinner.winningSubmission.sounds;
      const audioElements: HTMLAudioElement[] = [];
      
      // Prepare audio elements - using the same approach as PlaybackSubmissionsDisplay
      sounds.forEach((soundId: string) => {
        const sound = soundEffects.find(s => s.id === soundId);
        if (sound) {
          const soundUrl = `/sounds/Earwax/EarwaxAudio/Audio/${sound.fileName}`;
          const audio = new Audio(soundUrl);
          audio.volume = 0.7; // Same volume as main playback
          audio.preload = 'auto';
          audioElements.push(audio);
          
          // Add error handling
          audio.onerror = () => {
            console.error(`Failed to load sound: ${sound.name} (${soundUrl})`);
          };
          
          console.log(`[WINNER AUDIO] Prepared audio for ${sound.name}: ${soundUrl}`);
        }
      });

      // Play sounds sequentially with progress updates - same as main playback
      const playNextSound = (soundIndex: number) => {
        if (soundIndex >= audioElements.length) {
          console.log(`[WINNER AUDIO] All sounds finished`);
          setIsPlayingWinner(false);
          setPlaybackProgress(0);
          
          // Notify server that winner audio is complete after a brief delay
          // Only send this event once per round to prevent race conditions
          setTimeout(() => {
            if (socket && socket.connected && !audioCompletionSentRef.current) {
              console.log('[WINNER AUDIO] Notifying server: winner audio complete');
              audioCompletionSentRef.current = true; // Mark as sent
              socket.emit('winnerAudioComplete');
            } else if (audioCompletionSentRef.current) {
              console.log('[WINNER AUDIO] Audio completion already sent, skipping duplicate');
            }
          }, 2000); // 2 second pause after audio ends
          
          return;
        }

        const audio = audioElements[soundIndex];
        console.log(`[WINNER AUDIO] Playing sound ${soundIndex + 1} of ${audioElements.length}`);
        
        // Update progress based on current sound
        const updateProgress = () => {
          if (audio.duration > 0) {
            const currentSoundProgress = audio.currentTime / audio.duration;
            const overallProgress = (soundIndex + currentSoundProgress) / audioElements.length;
            setPlaybackProgress(overallProgress);
          }
        };

        // Set up progress tracking
        const progressInterval = setInterval(updateProgress, 100);
        
        // Set up event listener for when this sound ends
        const onEnded = () => {
          audio.removeEventListener('ended', onEnded);
          clearInterval(progressInterval);
          console.log(`[WINNER AUDIO] Sound ${soundIndex + 1} finished, moving to next`);
          
          // Wait a brief moment between sounds, then play the next one
          setTimeout(() => {
            playNextSound(soundIndex + 1);
          }, 300); // 300ms pause between sounds
        };
        
        audio.addEventListener('ended', onEnded);
        
        // Start playing this sound
        audio.play().catch(error => {
          console.error(`Failed to play winner audio ${soundIndex}:`, error);
          clearInterval(progressInterval);
          // If this sound fails, try the next one
          setTimeout(() => {
            playNextSound(soundIndex + 1);
          }, 500);
        });
      };

      // Start with the first sound after a brief delay
      setTimeout(() => {
        playNextSound(0);
      }, 200);
      
    } catch (error) {
      console.error('Error playing winning combination:', error);
      setIsPlayingWinner(false);
      setPlaybackProgress(0);
    }
  };
  
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
      <h3 className="text-3xl font-bold text-gray-800 mb-6">🎉 Round Results! 🎉</h3>
      
      {roundWinner && (
        <div className="mb-8">
          {/* Winning Sound Combination Card - Similar to playback style */}
          {roundWinner.winningSubmission && (
            <div className="mb-8">
              <h4 className="text-2xl font-bold text-gray-800 mb-2">{roundWinner.winnerName} Wins!</h4>
                <p className="text-2xl font-extrabold text-purple-700 mb-6 drop-shadow-lg">
                &ldquo;{room.currentPrompt?.text}&rdquo;
                </p>
                <div className={`relative rounded-3xl p-8 transition-all duration-500 max-w-md mx-auto ${
                isPlayingWinner 
                  ? 'bg-gradient-to-br from-purple-400 to-pink-500 scale-105 shadow-2xl transform -rotate-1' 
                  : 'bg-gradient-to-br from-yellow-200 to-yellow-300'
              }`}>
                
                {/* Progress Indicator */}
                {isPlayingWinner && (
                  <div className="absolute -top-2 -right-2 w-16 h-16">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-white opacity-30"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="transparent"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-white"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="transparent"
                        strokeLinecap="round"
                        strokeDasharray={`${playbackProgress * 100}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-white text-xs font-bold">
                        {Math.round(playbackProgress * 100)}%
                      </div>
                    </div>
                  </div>
                )}

                {/* Pulsing Animation for Playing */}
                {isPlayingWinner && (
                  <>
                    <div className="absolute inset-0 rounded-3xl bg-white opacity-20 animate-pulse"></div>
                    <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-purple-400 to-pink-500 opacity-75 blur animate-pulse"></div>
                  </>
                )}

                <div className="relative z-10">
                  <div className="flex items-center justify-center mb-6">
                    <h5 className={`text-2xl font-bold ${
                      isPlayingWinner ? 'text-white' : 'text-yellow-800'
                    }`}>
                      🏆 Winner 🏆
                    </h5>
                  </div>

                  <div className="space-y-4">
                    {roundWinner.winningSubmission.sounds.map((soundId: string, index: number) => {
                      const sound = soundEffects.find(s => s.id === soundId);
                      return (
                        <div 
                          key={index} 
                          className={`px-6 py-4 rounded-xl transition-all duration-300 ${
                            isPlayingWinner 
                              ? 'bg-white bg-opacity-90 text-gray-800 shadow-lg' 
                              : 'bg-white text-gray-800 shadow-md'
                          }`}
                        >
                          <div className="flex items-center justify-center space-x-3">
                            <span className="text-2xl">🔊</span>
                            <span className="text-xl font-bold">{sound?.name || soundId}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Waveform Animation for Playing */}
                  {isPlayingWinner && (
                    <div className="mt-6 flex justify-center space-x-1">
                      <div className="w-1 h-4 bg-white rounded-full animate-pulse"></div>
                      <div className="w-1 h-6 bg-white rounded-full animate-pulse"></div>
                      <div className="w-1 h-3 bg-white rounded-full animate-pulse"></div>
                      <div className="w-1 h-5 bg-white rounded-full animate-pulse"></div>
                      <div className="w-1 h-4 bg-white rounded-full animate-pulse"></div>
                      <div className="w-1 h-6 bg-white rounded-full animate-pulse"></div>
                      <div className="w-1 h-3 bg-white rounded-full animate-pulse"></div>
                      <div className="w-1 h-5 bg-white rounded-full animate-pulse"></div>
                    </div>
                  )}
                  
                  {/* Play Status */}
                  <div className="mt-6 text-center">
                    {isPlayingWinner ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
                        <span className="text-white font-bold text-lg">PLAYING NOW</span>
                        <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2 text-yellow-800">
                        <span className="text-2xl">🎵</span>
                        <span className="font-bold text-lg">Winner's Sounds</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      <p className="text-xl text-gray-800">
        Round {room.currentRound} complete! Getting ready for the next round...
      </p>
    </div>
  );
}

export function GameOverDisplay({ room }: { room: Room }) {
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
      <h3 className="text-4xl font-bold text-gray-800 mb-8">🎊 Game Over! 🎊</h3>
      
      <div className="mb-8">
        <div className="text-8xl mb-4">🏆</div>
        <h4 className="text-3xl font-bold text-yellow-600 mb-2">Winner!</h4>
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
                <span className="text-2xl text-gray-800 font-bold">{index + 1}.</span>
                <div 
                  className={`w-8 h-8 rounded-full ${getPlayerColorClass(player.color)}`}
                ></div>
                <span className="text-xl font-bold text-gray-900">{player.name}</span>
              </div>
              <span className="text-2xl font-bold text-purple-600">{player.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>  );
}

export function JudgeSelectionDisplay({ room }: { room: Room }) {
  const judge = room.players.find(p => p.id === room.currentJudge);
  
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
      <h3 className="text-3xl font-bold text-gray-800 mb-6">Judge Selection</h3>
      <div className="text-6xl mb-6">👨‍⚖️</div>
      
      {judge ? (
        <div>
          <p className="text-2xl text-gray-800 mb-4">
            This round's judge is: 
          </p>
          <div className="bg-yellow-100 rounded-2xl p-6 inline-block">
            <div 
              className={`w-16 h-16 rounded-full mx-auto mb-3 ${getPlayerColorClass(judge.color)}`}
            ></div>
            <p className="text-3xl font-bold text-gray-900">{judge.name}</p>
          </div>
        </div>
      ) : (
        <p className="text-xl text-gray-800">Selecting judge...</p>
      )}
    </div>
  );
}

// Helper to get display text for game state
export const getGameStateDisplay = (gameState: GameState): string => {
  const stateMap: { [key in GameState]: string } = {
    [GameState.LOBBY]: 'In Lobby',
    [GameState.JUDGE_SELECTION]: 'Selecting Judge',
    [GameState.PROMPT_SELECTION]: 'Judge is Choosing',
    [GameState.SOUND_SELECTION]: 'Choosing Sounds',
    [GameState.PLAYBACK]: 'Listening to Combos',
    [GameState.JUDGING]: 'Judge is Deciding',
    [GameState.ROUND_RESULTS]: 'Round Results',
    [GameState.GAME_OVER]: 'Game Over',
    [GameState.PAUSED_FOR_DISCONNECTION]: 'Game Paused - Player Disconnected',
  };
  return stateMap[gameState] || 'Unknown State';
};
