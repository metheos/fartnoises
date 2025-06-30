import React from 'react';
import RoomCodeInput from './RoomCodeInput';

interface WaitingForGameScreenProps {
  onJoinRoom: () => void;
  roomCodeInput: string;
  setRoomCodeInput: (value: string) => void;
  joinError: string;
  roomCodeFromURL?: string | null;
}

export function WaitingForGameScreen({ 
  onJoinRoom, 
  roomCodeInput, 
  setRoomCodeInput, 
  joinError,
  roomCodeFromURL
}: WaitingForGameScreenProps) {
  return (
    <div className="bg-white rounded-3xl p-6 text-center shadow-2xl transition-all duration-300 min-h-[75vh]">
      {/* Logo/Title */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-black mb-4 drop-shadow-lg bg-gradient-to-r from-purple-600 via-pink-500 to-purple-700 bg-clip-text text-transparent">
          fartnoises
        </h1>
        <p className="text-xl font-bold text-gray-800">
          The hilarious sound game!
        </p>
      </div>
      
      {/* Manual Room Entry */}      
      <RoomCodeInput 
        roomCodeInput={roomCodeInput}
        setRoomCodeInput={setRoomCodeInput}
        onJoinRoom={onJoinRoom}
        joinError={joinError}
        roomCodeFromURL={roomCodeFromURL}
      />
    </div>
  );
}
