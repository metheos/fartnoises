import React from 'react';
import RoomCodeInput from './RoomCodeInput';

interface WaitingForGameScreenProps {
  onJoinRoom: () => void;
  roomCodeInput: string;
  setRoomCodeInput: (value: string) => void;
  joinError: string;
  roomCodeFromURL?: string | null;
  // Add props for room creation
  onCreateRoom?: () => void;
  isCreatingRoom?: boolean;
}

export function WaitingForGameScreen({ 
  onJoinRoom, 
  roomCodeInput, 
  setRoomCodeInput, 
  joinError,
  roomCodeFromURL,
  onCreateRoom,
  isCreatingRoom = false
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

      {/* Create New Room Section */}
      <div className="bg-gradient-to-br from-green-100 to-emerald-200 rounded-2xl p-6 mt-8">
        {/* <div className="text-center mb-6">
          <h3 className="text-3xl font-bold text-gray-900 mb-2">Create New Room</h3>
          <p className="text-lg text-gray-600">Start a fresh game and become the main screen</p>
        </div> */}
        
        <div className="relative">
          {/* Main content container with gradient background */}
          <div className="relative bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100 backdrop-blur-sm rounded-2xl p-8 border border-white border-opacity-30 shadow-xl overflow-visible">
            
            {/* Animated background overlays for depth */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-2xl opacity-40"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-lime-400 via-green-400 to-emerald-400 rounded-2xl opacity-40"></div>
            
            {/* Floating decorative elements */}
            <div className="absolute -top-6 -left-6 w-10 h-10 bg-lime-400 rounded-full opacity-60 animate-bounce z-10" style={{ animationDuration: '3s' }}></div>
            <div className="absolute -top-8 -right-4 w-6 h-6 bg-emerald-400 rounded-full opacity-70 animate-bounce delay-500 z-10" style={{ animationDuration: '4s' }}></div>
            <div className="absolute -bottom-4 -left-8 w-8 h-8 bg-teal-400 rounded-full opacity-50 animate-bounce delay-1000 z-10" style={{ animationDuration: '3.5s' }}></div>
            <div className="absolute -bottom-6 -right-6 w-12 h-12 bg-green-400 rounded-full opacity-60 animate-bounce delay-700 z-10" style={{ animationDuration: '2.8s' }}></div>
            
            <div className="relative z-20 flex justify-center">
              <button
                onClick={onCreateRoom}
                disabled={isCreatingRoom}
                className="relative overflow-hidden bg-gradient-to-r from-green-500 to-emerald-500 text-white px-12 py-6 rounded-2xl font-bold text-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
              >
                {/* Button shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 hover:opacity-20 transition-opacity duration-300 transform -skew-x-12"></div>
                <span className="relative z-10 flex items-center space-x-3">
                  {isCreatingRoom ? (
                    <>
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating Room...</span>
                    </>
                  ) : (
                    <>
                      <span>🎮</span>
                      <span>Create New Room</span>
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
        
        {/* <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Players will join your room using a 4-letter code
          </p>
          <p className="text-xs text-gray-500 mt-1">
            💡 Perfect for hosting parties or starting fresh games
          </p>
        </div> */}
      </div>
    </div>
  );
}
