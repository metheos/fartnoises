'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Room, GameState, Player, SoundSubmission, GamePrompt, SoundEffect } from '@/types/game';
import { getSoundEffects } from '@/data/gameData';
import { audioSystem } from '@/utils/audioSystem';

let socket: Socket;

// Helper function to convert hex colors to Tailwind classes
export const getPlayerColorClass = (color: string): string => {
  const colorMap: { [key: string]: string } = {
    '#FF6B6B': 'bg-red-400',
    '#4ECDC4': 'bg-teal-400', 
    '#45B7D1': 'bg-blue-400',
    '#96CEB4': 'bg-green-400',
    '#FFEAA7': 'bg-yellow-400',
    '#DDA0DD': 'bg-purple-400',
    '#98D8C8': 'bg-emerald-400',
    '#F7DC6F': 'bg-amber-400',
  };
  return colorMap[color] || 'bg-gray-400';
};

export default function MainScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  
  // Helper function to update URL with room code
  const updateURLWithRoom = (roomCode: string | null) => {
    const url = new URL(window.location.href);
    if (roomCode) {
      url.searchParams.set('room', roomCode);
      console.log('Main screen: Updating URL with room code:', roomCode);
    } else {
      url.searchParams.delete('room');
      console.log('Main screen: Removing room code from URL');
    }
    window.history.replaceState({}, '', url.toString());
  };
  
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

  // Handle URL parameters - populate input field on load and handle browser navigation
  useEffect(() => {
    const urlRoomCode = searchParams?.get('room');
    if (urlRoomCode && urlRoomCode.length === 4) {
      const upperRoomCode = urlRoomCode.toUpperCase();
      console.log('Main screen: Found room code in URL:', upperRoomCode);
      setRoomCodeInput(upperRoomCode);
      
      // If we're connected and not already in this room, auto-join
      if (socket && socket.connected && (!currentRoom || currentRoom.code !== upperRoomCode)) {
        console.log('Main screen: Auto-joining from URL change:', upperRoomCode);
        socket.emit('joinRoomAsViewer', upperRoomCode);
      }
    } else if (!urlRoomCode && currentRoom) {
      // URL was cleared but we still have a room - user navigated away
      console.log('Main screen: URL cleared, leaving current room');
      setCurrentRoom(null);
      setRoundWinner(null);
      setJoinError('');
      setRoomCodeInput('');
    }
  }, [searchParams]);

  useEffect(() => {
    // Initialize socket connection
    socket = io({
      path: '/api/socket',
    });    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Main screen connected to server');
      
      // Check for room code in URL and auto-join if present
      const urlRoomCode = searchParams?.get('room');
      if (urlRoomCode && urlRoomCode.length === 4) {
        console.log('Main screen: Auto-joining room from URL:', urlRoomCode);
        socket.emit('joinRoomAsViewer', urlRoomCode.toUpperCase());
        setRoomCodeInput(urlRoomCode.toUpperCase());
      }
      
      // If we were watching a specific room before disconnection, rejoin it
      if (currentRoom) {
        console.log('Main screen: Reconnecting to room', currentRoom.code);
        socket.emit('joinRoomAsViewer', currentRoom.code);
      }
    });    socket.on('roomUpdated', (updatedRoom) => {
      console.log('Main screen received room update:', updatedRoom);
      setCurrentRoom(prev => {
        // Only update if we're currently watching this room  
        if (prev && updatedRoom.code === prev.code) {
          console.log('Main screen updating current room from roomUpdated event:', updatedRoom);
          console.log('Previous game state:', prev.gameState, '-> New game state:', updatedRoom.gameState);
          console.log('Previous judge:', prev.currentJudge, '-> New judge:', updatedRoom.currentJudge);
          console.log('Previous round:', prev.currentRound, '-> New round:', updatedRoom.currentRound);
          
          // If we're in ROUND_RESULTS state and don't have winner data, try to extract it from room
          if (updatedRoom.gameState === GameState.ROUND_RESULTS && !roundWinner && updatedRoom.lastWinner && updatedRoom.lastWinningSubmission) {
            console.log('Main screen: Restoring round winner from room data - lastWinner:', updatedRoom.lastWinner);
            // Reconstruct winner data from room properties
            const winnerPlayer = updatedRoom.players.find((p: Player) => p.id === updatedRoom.lastWinner);
            if (winnerPlayer) {
              const reconstructedWinner = {
                winnerId: updatedRoom.lastWinner,
                winnerName: winnerPlayer.name,
                winningSubmission: updatedRoom.lastWinningSubmission,
                submissionIndex: updatedRoom.submissions.findIndex((s: SoundSubmission) => s.playerId === updatedRoom.lastWinner)
              };
              console.log('Main screen setting reconstructed winner from roomUpdated:', reconstructedWinner);
              setRoundWinner(reconstructedWinner);
            }
          }
          
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
        
        // If joining a room in ROUND_RESULTS state, restore winner data if available
        if (room.gameState === GameState.ROUND_RESULTS && room.lastWinner && room.lastWinningSubmission) {
          console.log('[MAIN SCREEN] Restoring round winner from joined room - lastWinner:', room.lastWinner);
          // Reconstruct winner data from room properties
          const winnerPlayer = room.players.find((p: Player) => p.id === room.lastWinner);
          if (winnerPlayer) {
            const reconstructedWinner = {
              winnerId: room.lastWinner,
              winnerName: winnerPlayer.name,
              winningSubmission: room.lastWinningSubmission,
              submissionIndex: room.submissions.findIndex((s: SoundSubmission) => s.playerId === room.lastWinner)
            };
            console.log('[MAIN SCREEN] Setting reconstructed winner from roomJoined:', reconstructedWinner);
            setRoundWinner(reconstructedWinner);
          }
        }
        
        // Update URL with the room code for persistence
        updateURLWithRoom(room.code);
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      setJoinError(error.message || 'Failed to connect to room');
      // If error is due to invalid room from URL, clear the URL parameter
      if (error.message && error.message.includes('Room not found')) {
        console.log('Main screen: Room from URL not found, clearing URL');
        updateURLWithRoom(null);
        setRoomCodeInput('');
      }
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

    // Handle game settings updates
    socket.on('gameSettingsUpdated', (settings: { maxRounds: number; maxScore: number }) => {
      console.log('Main screen: Game settings updated:', settings);
      // Update current room with new settings
      setCurrentRoom(prev => {
        if (prev) {
          return {
            ...prev,
            maxRounds: settings.maxRounds,
            maxScore: settings.maxScore
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
    
    // Clear URL parameter when leaving room
    updateURLWithRoom(null);
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
            onJoinRoom={joinRoom}
            roomCodeInput={roomCodeInput}
            setRoomCodeInput={setRoomCodeInput}
            joinError={joinError}
            roomCodeFromURL={searchParams?.get('room')}
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
  onJoinRoom, 
  roomCodeInput, 
  setRoomCodeInput, 
  joinError,
  roomCodeFromURL
}: { 
  onJoinRoom: () => void;
  roomCodeInput: string;
  setRoomCodeInput: (value: string) => void;
  joinError: string;
  roomCodeFromURL?: string | null;
}) {
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
              {/* Logo/Title */}
        <div className="text-center mb-12">
            <h1 className="text-6xl font-black mb-4 drop-shadow-lg bg-gradient-to-r from-purple-600 via-pink-500 to-purple-700 bg-clip-text text-transparent">
            fartnoises
            </h1>
          <p className="text-xl font-bold text-gray-800">
            The hilarious sound game!
          </p>
        </div>
      {/* <h2 className="text-4xl font-bold text-gray-800 mb-6">Ready for Fartnoises!</h2>
            <p className="text-gray-800 text-xl mb-8">
        Players can join by going to <strong>fartnoises.org</strong> on their phones
      </p> */}
      
      {/* Manual Room Entry */}      <div className="bg-purple-100 rounded-2xl p-6 mb-8">
        <div className="text-center mb-6">
          <h3 className="text-3xl font-bold text-gray-900 mb-2">Enter Room Code</h3>
          <p className="text-lg text-gray-600">Join a game as a spectator</p>
        </div>
        
        {/* URL persistence indicator */}
        {roomCodeFromURL && roomCodeFromURL.length === 4 && (
          <div className="mb-4 px-4 py-2 bg-blue-100 border border-blue-300 rounded-lg">
            <p className="text-sm text-blue-700 flex items-center justify-center space-x-2">
              <span>🔗</span>
              <span>Room code loaded from URL - page will remember this room</span>
            </p>
          </div>
        )}
        
        <div className="relative">
          {/* Main content container with gradient background */}
          <div className="relative bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 backdrop-blur-sm rounded-2xl p-8 border border-white border-opacity-30 shadow-xl overflow-visible">
            
            {/* Animated background overlays for depth */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-2xl opacity-50"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-400 via-purple-400 to-pink-400 rounded-2xl opacity-50"></div>
            
            {/* Floating decorative bokeh balls - layered on top with overflow and slower animations */}
            <div className="absolute -top-8 -left-8 w-12 h-12 bg-yellow-400 rounded-full opacity-60 animate-bounce z-10" style={{ animationDuration: '3s' }}></div>
            <div className="absolute -top-12 -right-6 w-8 h-8 bg-pink-400 rounded-full opacity-70 animate-bounce delay-500 z-10" style={{ animationDuration: '4s' }}></div>
            <div className="absolute -bottom-6 -left-10 w-10 h-10 bg-purple-400 rounded-full opacity-50 animate-bounce delay-1000 z-10" style={{ animationDuration: '3.5s' }}></div>
            <div className="absolute -bottom-10 -right-8 w-14 h-14 bg-orange-400 rounded-full opacity-60 animate-bounce delay-700 z-10" style={{ animationDuration: '2.8s' }}></div>
            
            {/* Additional mid-layer bokeh for more depth with slower pulses */}
            <div className="absolute top-1/2 -left-6 w-6 h-6 bg-blue-300 rounded-full opacity-40 animate-pulse delay-300 z-5" style={{ animationDuration: '4s' }}></div>
            <div className="absolute top-1/3 -right-4 w-5 h-5 bg-green-300 rounded-full opacity-50 animate-pulse delay-800 z-5" style={{ animationDuration: '3.2s' }}></div>
            
            {/* Extra floating balls for more visual richness */}
            <div className="absolute top-0 left-1/2 w-7 h-7 bg-indigo-300 rounded-full opacity-45 animate-bounce delay-1200 z-10" style={{ animationDuration: '3.8s' }}></div>
            <div className="absolute bottom-0 right-1/3 w-9 h-9 bg-rose-300 rounded-full opacity-55 animate-pulse delay-1500 z-5" style={{ animationDuration: '4.2s' }}></div>
            
            <div className="relative z-20 flex justify-center items-center space-x-4">
              {/*
          Focus the input when the component mounts.
          We'll use a ref and useEffect for this.
              */}
              {(() => {
          // Inline function to allow useRef/useEffect in this block
          // (React hooks can't be called conditionally, so we define a subcomponent)
          // We'll define a small subcomponent for the input+button row.
          // This keeps the main function component clean.
          function RoomCodeInputRow() {
            const inputRef = useRef<HTMLInputElement>(null);

            useEffect(() => {
              if (inputRef.current) {
          inputRef.current.focus();
              }
            }, []);

            return (
              <>
          <div className="relative">
            {/* Input field with enhanced styling */}
            <input
              ref={inputRef}
              type="text"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
          if (e.key === 'Enter' && roomCodeInput.length === 4) {
            onJoinRoom();
          }
              }}
              placeholder="ABCD"
              maxLength={4}
              className="text-3xl font-mono font-black text-center w-36 h-18 border-3 border-purple-300 rounded-2xl focus:border-purple-500 focus:ring-4 focus:ring-purple-200 focus:outline-none placeholder:text-gray-400 text-gray-900 bg-white bg-opacity-90 shadow-lg transition-all duration-300 hover:shadow-xl transform hover:scale-105"
            />
            {/* Subtle glow effect on focus */}
            <div className="absolute inset-0 rounded-2xl bg-purple-400 opacity-0 hover:opacity-10 transition-opacity duration-300 pointer-events-none"></div>
          </div>
          
          <button
            onClick={onJoinRoom}
            disabled={roomCodeInput.length !== 4}
            className="relative overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-300 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
          >
            {/* Button shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 hover:opacity-20 transition-opacity duration-300 transform -skew-x-12"></div>
            <span className="relative z-10 flex items-center space-x-2">
              <span>👀</span>
              <span>Watch Game</span>
            </span>
          </button>
              </>
            );
          }
          return <RoomCodeInputRow />;
              })()}
            </div>
          </div>
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
      {/* Game Settings Display with Main Status */}
      <div className="flex items-center justify-between mb-4">
        {/* Score to Win (Left) */}
        <div className="flex flex-col items-center">
          <div className="text-lg font-bold text-purple-600 mb-1">Score to Win</div>
          <div className="bg-purple-100 rounded-lg px-4 py-2 border-2 border-purple-300">
            <span className="text-2xl font-black text-purple-700">{room.maxScore}</span>
          </div>
        </div>

        {/* Main Status (Center) */}
        <div className="flex-1 px-8">
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

        {/* Max Rounds (Right) */}
        <div className="flex flex-col items-center">
          <div className="text-lg font-bold text-blue-600 mb-1">Max Rounds</div>
          <div className="bg-blue-100 rounded-lg px-4 py-2 border-2 border-blue-300">
            <span className="text-2xl font-black text-blue-700">{room.maxRounds}</span>
          </div>
        </div>
      </div>
      <p className="text-xl text-purple-600 mb-6">
      {room.players.length < 3
        ? "Need at least 3 players to play!"
        : "VIP can start the game!"}
      </p>
      <div className="flex justify-center flex-wrap gap-4 mb-8">
      {room.players.map((player) => (
        <div
          key={player.id}
          className={`flex flex-col items-center p-4 rounded-2xl shadow-md border-2 flex-grow max-w-50 ${getPlayerColorClass(player.color)} bg-opacity-80`}
        >
          <div className="text-4xl mb-2">{player.emoji || "🎵"}</div>
          <span className="font-bold text-lg text-white drop-shadow text-center">{player.name}</span>
        </div>
      ))}
      </div>
      <div className="mt-4 flex justify-center space-x-2 animate-pulse text-gray-600">
      <span className="text-2xl">📱</span>
      <span className="text-2xl">Get your devices out and join the fun!</span>
      <span className="text-2xl">📱</span>
      </div>
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
      {/* <h3 className="text-3xl font-bold text-gray-800 mb-6">Judge Selecting Prompt</h3> */}
      
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
      {judge ? (

            <div className="inline-block mb-6">
            <div className="relative bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-200 rounded-3xl p-3 shadow-2xl border-1 border-yellow-400 overflow-hidden">
              
              {/* Main judge content */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="bg-white bg-opacity-90 rounded-2xl p-4 shadow-lg border-1 border-yellow-300 min-w-50 text-center">
                  
                  
                  {/* Judge Title */}
                  <div className="mb-3">
                    <span className="text-xl font-black text-amber-900 drop-shadow-sm underline">The Judge</span>
                  </div>
                  
                  {/* Judge avatar - larger and more prominent */}
                  <div className="relative mb-3">
                    <div 
                      className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl ring-6 ring-yellow-300 ring-opacity-75 mx-auto ${getPlayerColorClass(judge?.color || '#gray')}`}
                    >
                      {judge?.emoji || judge?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  </div>
                  
                  {/* Judge name with emphasis */}
                  <div className="">
                    <span className="text-xl font-black text-amber-900 drop-shadow-sm">{judge?.name || 'Unknown'}</span>
                  </div>
                </div>
              </div>
              
              {/* Animated border glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 opacity-25 animate-pulse"></div>
            </div>
            </div>
      ) : (
        <p className="text-2xl text-gray-800 mb-4">Waiting for judge selection...</p>
      )}
      <p className="text-lg text-gray-600 mb-6">
        {room.currentPrompt ? (
          <span className="font-bold text-purple-600">Judge is selecting a prompt...</span>
        ) : (
          <span className="text-gray-500">Waiting for judge to select a prompt...</span>
        )}
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
  const judge = room.players.find(p => p.id === room.currentJudge);
  
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
      {/* <h3 className="text-3xl font-bold text-gray-800 mb-6 text-center">Sound Selection Time!</h3> */}
      
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
          {/* <p className="text-sm text-gray-600 mt-2">
            ⏰ Countdown started after first submission
          </p> */}
        </div>
      )}
      
      {/* Waiting for first submission message
      {!hasFirstSubmission && (
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">⏳</div>
          <div className="bg-blue-100 rounded-2xl p-6">
            <h4 className="text-2xl font-bold text-blue-800 mb-2">Waiting for First Player</h4>
            <p className=</div>"text-lg text-blue-700">
              The countdown will begin once the first player submits their sounds
            </p>
            <div className="mt-4 animate-pulse flex justify-center space-x-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
            </div>
          </div>
        </div>
      )} */}
      
      {/* Judge and Prompt Display - Side by Side */}
      {room.currentPrompt && judge && (
        <div className="flex items-center justify-center gap-6 mb-8">
          {/* Judge Display - Left Side */}
            <div className="flex-shrink-0">
            <div className="relative bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-200 rounded-3xl p-3 shadow-2xl border-1 border-yellow-400 overflow-hidden">
              
              {/* Main judge content */}
              <div className="relative z-10 flex flex-col items-center min-w-50">
                <div className="bg-white bg-opacity-90 rounded-2xl p-4 shadow-lg border-1 border-yellow-300 w-full text-center">
                  
                  
                  {/* Judge Title */}
                  <div className="mb-3">
                    <span className="text-xl font-black text-amber-900 drop-shadow-sm underline">The Judge</span>
                  </div>
                  
                  {/* Judge avatar - larger and more prominent */}
                  <div className="relative mb-3">
                    <div 
                      className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl ring-6 ring-yellow-300 ring-opacity-75 mx-auto ${getPlayerColorClass(judge?.color || '#gray')}`}
                    >
                      {judge?.emoji || judge?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  </div>
                  
                  {/* Judge name with emphasis */}
                  <div className="">
                    <span className="text-xl font-black text-amber-900 drop-shadow-sm">{judge.name}</span>
                  </div>
                </div>
              </div>
              
              {/* Animated border glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 opacity-25 animate-pulse"></div>
            </div>
            </div>
          
          {/* Prompt Display - Right Side */}
          <div className="flex-grow max-w-4xl">
            <div className="relative bg-gradient-to-br from-purple-200 via-pink-100 to-orange-100 rounded-3xl p-8 shadow-2xl border-4 border-purple-300 overflow-hidden">
              
              {/* Main prompt text */}
              <div className="relative z-10">
                <div className="bg-white bg-opacity-90 rounded-2xl p-6 shadow-lg border-2 border-purple-200">
                  <div className="flex items-center justify-center mb-2">
                  </div>
                  <p className="text-3xl text-center text-gray-800 font-bold leading-relaxed drop-shadow-sm" dangerouslySetInnerHTML={{ __html: room.currentPrompt.text }}></p>
                  <div className="flex items-center justify-center mt-2">
                  </div>
                </div>
              </div>
              
              {/* Animated border glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 opacity-20 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {/* Fallback for when no judge or prompt */}
      {room.currentPrompt && !judge && (
        <div className="bg-purple-100 rounded-2xl p-6 mb-8">
          <p className="text-2xl text-center text-gray-800 font-bold" dangerouslySetInnerHTML={{ __html: room.currentPrompt.text }}></p>
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
}) {  
  const [currentPlayingSubmission, setCurrentPlayingSubmission] = useState<SoundSubmission | null>(null);
  const [currentPlayingSoundIndex, setCurrentPlayingSoundIndex] = useState<number>(-1);
  const [revealedSounds, setRevealedSounds] = useState<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [promptPlaying, setPromptPlaying] = useState(false);
  const hasStartedPlaybackRef = useRef(false);
  const promptAudioPlayingRef = useRef(false);
  const judge = room.players.find(p => p.id === room.currentJudge);
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
    if (!socket) return;    
    const handlePlaySubmission = async (submission: SoundSubmission | null) => {
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

  const submissions = room.randomizedSubmissions || room.submissions; // Use randomized order if available
  const getPlayerById = (id: string) => room.players.find(p => p.id === id);

  return (
    <div className="bg-white rounded-3xl p-12 shadow-2xl">
      
      
      {/* Judge and Prompt Display - Side by Side */}
      {room.currentPrompt && judge && (
        <div className="flex items-center justify-center gap-6 mb-8">
          {/* Judge Display - Left Side */}
            <div className="flex-shrink-0">
            <div className="relative bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-200 rounded-3xl p-3 shadow-2xl border-1 border-yellow-400 overflow-hidden">
              
              {/* Main judge content */}
              <div className="relative z-10 flex flex-col items-center min-w-50">
                <div className="bg-white bg-opacity-90 rounded-2xl p-4 shadow-lg border-1 border-yellow-300 w-full text-center">
                  
                  
                  {/* Judge Title */}
                  <div className="mb-3">
                    <span className="text-xl font-black text-amber-900 drop-shadow-sm underline">The Judge</span>
                  </div>
                  
                  {/* Judge avatar - larger and more prominent */}
                  <div className="relative mb-3">
                    <div 
                      className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl ring-6 ring-yellow-300 ring-opacity-75 mx-auto ${getPlayerColorClass(judge?.color || '#gray')}`}
                    >
                      {judge?.emoji || judge?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  </div>
                  
                  {/* Judge name with emphasis */}
                  <div className="">
                    <span className="text-xl font-black text-amber-900 drop-shadow-sm">{judge.name}</span>
                  </div>
                </div>
              </div>
              
              {/* Animated border glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 opacity-25 animate-pulse"></div>
            </div>
            </div>
          
          {/* Prompt Display - Right Side */}
          <div className="flex-grow max-w-4xl">
            <div className="relative bg-gradient-to-br from-purple-200 via-pink-100 to-orange-100 rounded-3xl p-8 shadow-2xl border-4 border-purple-300 overflow-hidden">
              
              {/* Main prompt text */}
              <div className="relative z-10">
                <div className="bg-white bg-opacity-90 rounded-2xl p-6 shadow-lg border-2 border-purple-200">
                  <div className="flex items-center justify-center mb-2">
                  </div>
                  <p className="text-3xl text-center text-gray-800 font-bold leading-relaxed drop-shadow-sm" dangerouslySetInnerHTML={{ __html: room.currentPrompt.text }}></p>
                  <div className="flex items-center justify-center mt-2">
                  </div>
                </div>
              </div>
              
              {/* Animated border glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 opacity-20 animate-pulse"></div>
            </div>
          </div>
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
                  {`Submission ${index + 1}`}
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
                          {isCurrentSound ? '🔊' : hasBeenRevealed ? '🎵' : '🎵'}
                        </span>                        <span className={`font-semibold ${
                          isCurrentSound ? 'text-yellow-800' : ''
                        }`}>
                          {isCurrentSound || hasBeenRevealed ? (sound?.name || soundId) : '???'}
                        </span>
                        {/* {isCurrentSound && (
                          <div className="ml-auto">
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
                              <span className="text-yellow-700 text-sm font-bold">NOW PLAYING</span>
                            </div>
                          </div>
                        )} */}
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
      {/* <h3 className="text-3xl font-bold text-gray-800 mb-6 text-center">Judging Time!</h3> */}
      
      {/* Judge and Prompt Display - Side by Side */}
      {room.currentPrompt && judge && (
        <div className="flex items-center justify-center gap-6 mb-8">
          {/* Judge Display - Left Side */}
          <div className="flex-shrink-0">
            <div className="relative bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-200 rounded-3xl p-3 shadow-2xl border-1 border-yellow-400 overflow-hidden">
              
              {/* Main judge content */}
              <div className="relative z-10 flex flex-col items-center min-w-50">
                <div className="bg-white bg-opacity-90 rounded-2xl p-4 shadow-lg border-1 border-yellow-300 w-full text-center">
                  
                  {/* Judge Title */}
                  <div className="mb-3">
                    <span className="text-xl font-black text-amber-900 drop-shadow-sm underline">The Judge</span>
                  </div>
                  
                  {/* Judge avatar - larger and more prominent */}
                  <div className="relative mb-3">
                    <div 
                      className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl ring-6 ring-yellow-300 ring-opacity-75 mx-auto ${getPlayerColorClass(judge.color)}`}
                    >
                      {judge.emoji || judge.name[0].toUpperCase()}
                    </div>
                  </div>
                  
                  {/* Judge name with emphasis */}
                  <div className="">
                    <span className="text-xl font-black text-amber-900 drop-shadow-sm">{judge.name}</span>
                  </div>
                </div>
              </div>
              
              {/* Animated border glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 opacity-25 animate-pulse"></div>
            </div>
          </div>
          
          {/* Prompt Display - Right Side */}
          <div className="flex-grow max-w-4xl">
            <div className="relative bg-gradient-to-br from-purple-200 via-pink-100 to-orange-100 rounded-3xl p-8 shadow-2xl border-4 border-purple-300 overflow-hidden">
              
              {/* Main prompt text */}
              <div className="relative z-10">
                <div className="bg-white bg-opacity-90 rounded-2xl p-6 shadow-lg border-2 border-purple-200">
                  <div className="flex items-center justify-center mb-2">
                  </div>
                  <p className="text-3xl text-center text-gray-800 font-bold leading-relaxed drop-shadow-sm" dangerouslySetInnerHTML={{ __html: room.currentPrompt.text }}></p>
                  <div className="flex items-center justify-center mt-2">
                  </div>
                </div>
              </div>
              
              {/* Animated border glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 opacity-20 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {/* Fallback for when no judge or prompt */}
      {room.currentPrompt && !judge && (
        <div className="bg-purple-100 rounded-2xl p-6 mb-8">
          <p className="text-2xl text-center text-gray-800 font-bold" dangerouslySetInnerHTML={{ __html: room.currentPrompt.text }}></p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {(room.randomizedSubmissions || room.submissions).map((submission, index) => (
          <div 
            key={index} 
            className="relative rounded-3xl p-6 transition-all duration-500 bg-gray-100 hover:bg-gray-50 border-2 border-gray-200"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xl font-bold text-gray-800">
                  Submission {index + 1}
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
  const [animatedScores, setAnimatedScores] = useState<{ [playerId: string]: number }>({});
  const [showPointAnimation, setShowPointAnimation] = useState(false);
  
  // Initialize animated scores and trigger score animation when results are first shown
  useEffect(() => {
    if (roundWinner && room.players.length > 0) {
      // Reset animation state for new round
      setShowPointAnimation(false);
      
      // Reset audio completion tracking for new round
      audioCompletionSentRef.current = false;
      playbackStartedRef.current = false;
      
      // Initialize animated scores to current scores minus 1 for the winner (to animate the +1)
      const initialScores: { [playerId: string]: number } = {};
      room.players.forEach((player: Player) => {
        if (player.id === roundWinner.winnerId) {
          // For the winner, always start from current score - 1 to show the increment
          // The winner's current score should be at least 1 (they just won a point)
          initialScores[player.id] = Math.max(0, player.score - 1);
        } else {
          // For non-winners, start from current score (no change)
          initialScores[player.id] = player.score;
        }
      });
      
      console.log('[SCORE ANIMATION] Initializing animated scores:', {
        roundWinner: roundWinner.winnerId,
        initialScores,
        currentScores: room.players.reduce((acc, p) => ({ ...acc, [p.id]: p.score }), {})
      });
      
      setAnimatedScores(initialScores);
    }
  }, [roundWinner?.winnerId, room.currentRound]); // Trigger when winner changes or new round

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
          
          // Trigger score animation after audio completes
          setTimeout(() => {
            setShowPointAnimation(true);
            
            // Start score counting animation after +1PT appears - ONLY for winner
            setTimeout(() => {
              // Only animate the winner's score
              // Use the initialScores directly instead of reading from state to avoid closure issues
              const winnerPlayer = room.players.find(p => p.id === roundWinner.winnerId);
              const winnerStartScore = winnerPlayer ? Math.max(0, winnerPlayer.score - 1) : 0;
              const winnerEndScore = winnerPlayer?.score || 0;
              
              console.log('[SCORE ANIMATION] Starting winner score animation:', {
                winnerId: roundWinner.winnerId,
                startScore: winnerStartScore,
                endScore: winnerEndScore,
                playerCurrentScore: winnerPlayer?.score
              });
              
              // Animate the score increment for the winner only
              const duration = 1500; // 1.5 seconds for count-up
              const startTime = Date.now();
              
              const animateWinnerScore = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Use easing function for smooth animation
                const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                
                const winnerCurrentScore = Math.round(winnerStartScore + (winnerEndScore - winnerStartScore) * easeOutQuart);
                
                // Update only the winner's score, keep others unchanged
                setAnimatedScores(prev => ({
                  ...prev,
                  [roundWinner.winnerId]: winnerCurrentScore
                }));
                
                if (progress < 1) {
                  requestAnimationFrame(animateWinnerScore);
                }
              };
              
              animateWinnerScore();
            }, 500); // Start score counting 500ms after +1PT appears
          }, 500); // Show +1PT animation 500ms after audio ends
          
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
    <div className="bg-white rounded-3xl p-12 shadow-2xl">
      {/* <h3 className="text-3xl font-bold text-gray-800 mb-8 text-center">🎉 Round Results! 🎉</h3> */}
      
      {/* Show loading state if roundWinner is null (e.g., after page refresh) */}
      {!roundWinner ? (
        <div className="text-center">
          <div className="text-6xl mb-6">⏳</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Loading Round Results...</h3>
          <p className="text-gray-600">Reconnecting to the game state...</p>
          <div className="mt-6 animate-pulse flex justify-center space-x-2">
            <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
            <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
            <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start mb-8">
          {/* Left Column - Winning Sound Combination Card */}
          <div className="text-center">
            {roundWinner.winningSubmission && (
              <div>
                {/* <h4 className="text-2xl font-bold text-gray-800 mb-2">{roundWinner.winnerName} Wins!</h4> */}
                <p className="text-xl font-extrabold text-purple-700 mb-6 drop-shadow-lg" dangerouslySetInnerHTML={{ __html: room.currentPrompt?.text || '' }}>
                </p>
                <div className={`relative rounded-3xl p-8 transition-all duration-500 ${
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

          {/* Right Column - Scores List */}
          <div className="text-center">
          {/* <p className="text-xl font-extrabold text-purple-700 mb-6 drop-shadow-lg">&nbsp;</p> */}
          <div className="bg-gray-50 rounded-3xl p-6 shadow-inner">
            {/* <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Current Standings</h3> */}
            <ul className="space-y-3">
              {room.players
                .sort((a, b) => b.score - a.score)
                .map((p, index) => {
                  const rank = index + 1;
                  const isRoundWinner = p.id === roundWinner.winnerId;
                  
                  let rankStyles = 'bg-gray-200 text-gray-700';
                  if (rank === 1) rankStyles = 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-md'; // Gold
                  if (rank === 2) rankStyles = 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 shadow-md'; // Silver
                  if (rank === 3) rankStyles = 'bg-gradient-to-br from-orange-300 to-orange-500 text-orange-900 shadow-md'; // Bronze

                  return (
                    <li 
                      key={p.id} 
                      className={`flex items-center p-3 rounded-2xl shadow-sm transition-all duration-300 ${
                        isRoundWinner ? 'bg-green-100 border-2 border-green-400 scale-105' : 'bg-white'
                      }`}
                    >
                      <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-black text-lg mr-2 ${rankStyles}`}>
                        {rank}
                      </div>
                      { isRoundWinner ? (
                      <div 
                        className={`w-14 h-14 flex-shrink-0 rounded-full ${getPlayerColorClass(p.color)} flex items-center justify-center text-3xl mr-3`}
                      >
                        {p.emoji || p.name[0].toUpperCase()}
                      </div>
                        
                      ) : (
                      <div 
                        className={`w-10 h-10 flex-shrink-0 rounded-full ${getPlayerColorClass(p.color)} flex items-center justify-center text-2xl mr-3`}
                      >
                        {p.emoji || p.name[0].toUpperCase()}
                      </div>
                        
                  )}
                      <div className="flex-grow">
                        <p className="font-bold text-gray-900 text-lg">{p.name}</p>
                      </div>
                      {isRoundWinner ? (
                        <><div className={`absolute right-15 top-1/2 -translate-y-1/2 bg-green-500 text-white text-md font-bold px-2 py-1 rounded-full transition-all duration-700 ${
                          showPointAnimation ? 'animate-bounce scale-110' : 'scale-0 opacity-0'
                        }`}>
                          +1 PT
                        </div><div className="text-right">
                            <p className={`font-black text-2xl text-purple-600 transition-all duration-500 ${
                              showPointAnimation ? 'scale-110 text-green-600' : ''
                            }`}>
                              {animatedScores[p.id] !== undefined ? animatedScores[p.id] : p.score}
                            </p>
                            <p className="text-xs text-gray-500 uppercase">Points</p>
                          </div></>
                      ) : (
                        <div className="text-right">
                          <p className="font-black text-xl text-purple-600">
                            {animatedScores[p.id] !== undefined ? animatedScores[p.id] : p.score}
                          </p>
                          <p className="text-xs text-gray-500 uppercase">Points</p>
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
          </div>
        </div>
      )}
{/*       
      <div className="text-center">
        <p className="text-xl text-gray-800">
          Round {room.currentRound} complete! Getting ready for the next round...
        </p>
      </div> */}
    </div>
  );
}

export function GameOverDisplay({ room }: { room: Room }) {
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
            {/* Sparkle decorations with staggered animations */}
            {/* <div className="absolute -top-4 -left-4 text-3xl animate-bounce">✨</div>
            <div className="absolute -top-4 -right-4 text-3xl animate-bounce delay-500">🎉</div>
            <div className="absolute -bottom-4 -left-4 text-3xl animate-bounce delay-1000">🏆</div>
            <div className="absolute -bottom-4 -right-4 text-3xl animate-bounce delay-150">⭐</div> */}
            
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
              {/* <div className="text-2xl">🎯</div> */}
              <span className="text-4xl font-black text-yellow-900 drop-shadow-lg">
                {winner.score}
              </span>
              <span className="text-lg font-bold text-yellow-800">Points</span>
              {/* <div className="text-2xl">🎯</div> */}
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
              <h4 className="text-2xl font-bold text-gray-800 mb-4 text-center">🥈 Other Players 🥉</h4>
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {runnerUps.map((player, index) => {
                    const actualRank = index + 2; // +2 because winner is rank 1
                    let rankIcon = '🥈';
                    let rankBg = 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800';
                    
                    if (actualRank === 2) {
                      rankIcon = '🥈';
                      rankBg = 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800';
                    } else if (actualRank === 3) {
                      rankIcon = '🥉';
                      rankBg = 'bg-gradient-to-br from-orange-300 to-orange-500 text-orange-900';
                    } else {
                      rankIcon = '🏅';
                      rankBg = 'bg-gray-200 text-gray-700';
                    }
                    
                    return (
                      <div 
                        key={player.id} 
                        className="flex justify-between items-center p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-shadow duration-200"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-md ${rankBg}`}>
                            {rankIcon}
                          </div>
                          <div 
                            className={`w-10 h-10 rounded-full ${getPlayerColorClass(player.color)} flex items-center justify-center text-lg shadow-lg`}
                          >
                            {player.emoji || player.name[0].toUpperCase()}
                          </div>
                          <span className="text-lg font-bold text-gray-900">{player.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-purple-600">{player.score}</span>
                          <p className="text-xs text-gray-500 uppercase">Points</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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

export function JudgeSelectionDisplay({ room }: { room: Room }) {
  const judge = room.players.find(p => p.id === room.currentJudge);
  
  return (
    <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">     
      {/* Judge Display*/} 
      {judge ? (
            <div className="inline-block">
            <div className="relative bg-gradient-to-br from-yellow-200 via-amber-100 to-orange-200 rounded-3xl p-3 shadow-2xl border-1 border-yellow-400 overflow-hidden">
              
              {/* Main judge content */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="bg-white bg-opacity-90 rounded-2xl p-4 shadow-lg border-1 border-yellow-300 min-w-50 text-center">
                  
                  
                  {/* Judge Title */}
                  <div className="mb-3">
                    <span className="text-xl font-black text-amber-900 drop-shadow-sm underline">The Judge</span>
                  </div>
                  
                  {/* Judge avatar - larger and more prominent */}
                  <div className="relative mb-3">
                    <div 
                      className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl ring-6 ring-yellow-300 ring-opacity-75 mx-auto ${getPlayerColorClass(judge.color)}`}
                    >
                      {judge.emoji || judge.name[0].toUpperCase()}
                    </div>
                  </div>
                  
                  {/* Judge name with emphasis */}
                  <div className="">
                    <span className="text-xl font-black text-amber-900 drop-shadow-sm">{judge.name}</span>
                  </div>
                </div>
              </div>
              
              {/* Animated border glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 opacity-25 animate-pulse"></div>
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
    [GameState.PLAYBACK]: 'Listening to Submissions',
    [GameState.JUDGING]: 'Judge is Deciding',
    [GameState.ROUND_RESULTS]: 'Round Results',
    [GameState.GAME_OVER]: 'Game Over',
    [GameState.PAUSED_FOR_DISCONNECTION]: 'Game Paused - Player Disconnected',
  };
  return stateMap[gameState] || 'Unknown State';
};
