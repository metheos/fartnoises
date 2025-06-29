'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SoundSubmission } from '@/types/game';
import ConnectionStatus from '@/components/mainscreen/ConnectionStatus';
import { WaitingForGameScreen } from '@/components/mainscreen/WaitingForGameScreen';
import { MainScreenGameDisplay } from '@/components/mainscreen/MainScreenGameDisplay';
import { useSocket } from '@/hooks/useSocket';
import { useAudio } from '@/hooks/useAudio';

function MainScreenContent() {
  const searchParams = useSearchParams();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [currentPlayingSubmission, setCurrentPlayingSubmission] = useState<SoundSubmission | null>(null);
  
  // Use custom hooks for audio and socket management
  const { soundEffects, isAudioReady, setIsAudioReady, activateAudio } = useAudio();
  const { 
    socket, 
    isConnected, 
    currentRoom, 
    roundWinner, 
    joinError, 
    joinRoom
  } = useSocket({ 
    soundEffects, 
    isAudioReady, 
    setIsAudioReady, 
    setCurrentPlayingSubmission 
  });

  // Handle URL parameters - populate input field on load and handle browser navigation
  useEffect(() => {
    const urlRoomCode = searchParams?.get('room');
    if (urlRoomCode && urlRoomCode.length === 4) {
      const upperRoomCode = urlRoomCode.toUpperCase();
      console.log('Main screen: Found room code in URL:', upperRoomCode);
      setRoomCodeInput(upperRoomCode);
    } else if (!urlRoomCode && currentRoom) {
      // URL was cleared but we still have a room - user navigated away
      console.log('Main screen: URL cleared, leaving current room');
      setRoomCodeInput('');
    }
  }, [searchParams, currentRoom]);
  
  // Wrapper function to match WaitingForGameScreen's expected interface
  const handleJoinRoom = () => {
    joinRoom(roomCodeInput);
  };

  if (!isConnected) {
    return <ConnectionStatus isConnected={isConnected} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 p-2">
      <div className="max-w-7xl mx-auto">

        {currentRoom ? (
          <MainScreenGameDisplay 
            room={currentRoom} 
            roundWinner={roundWinner} 
            soundEffects={soundEffects}
            isAudioReady={isAudioReady}
            onActivateAudio={activateAudio}
            currentPlayingSubmission={currentPlayingSubmission}
            socket={socket}
          />
        ) : (          
        <WaitingForGameScreen 
            onJoinRoom={handleJoinRoom}
            roomCodeInput={roomCodeInput}
            setRoomCodeInput={setRoomCodeInput}
            joinError={joinError}
            roomCodeFromURL={searchParams?.get('room')}
          />
        )}

      </div>
    </div>
  );
}

export default function MainScreen() {
  return (
    <Suspense fallback={<div>Loading Main Screen...</div>}>
      <MainScreenContent />
    </Suspense>
  );
}

