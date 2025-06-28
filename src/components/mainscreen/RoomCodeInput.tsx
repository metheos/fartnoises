import { useRef, useEffect } from 'react';

interface RoomCodeInputProps {
  /** Current room code value */
  roomCodeInput: string;
  /** Function to update room code */
  setRoomCodeInput: (value: string) => void;
  /** Function called when join is triggered */
  onJoinRoom: () => void;
  /** Error message to display */
  joinError: string;
  /** Room code from URL for persistence indicator */
  roomCodeFromURL?: string | null;
  /** Additional CSS classes */
  className?: string;
}

export default function RoomCodeInput({ 
  roomCodeInput, 
  setRoomCodeInput, 
  onJoinRoom, 
  joinError,
  roomCodeFromURL,
  className = "" 
}: RoomCodeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className={`bg-purple-100 rounded-2xl p-6 mb-8 ${className}`}>
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
          
          {/* Floating decorative bokeh balls - with custom animation durations */}
          <div className="absolute -top-8 -left-8 w-12 h-12 bg-yellow-400 rounded-full opacity-60 animate-bounce z-10" style={{ animationDuration: '3s' }}></div>
          <div className="absolute -top-12 -right-6 w-8 h-8 bg-pink-400 rounded-full opacity-70 animate-bounce delay-500 z-10" style={{ animationDuration: '4s' }}></div>
          <div className="absolute -bottom-6 -left-10 w-10 h-10 bg-purple-400 rounded-full opacity-50 animate-bounce delay-1000 z-10" style={{ animationDuration: '3.5s' }}></div>
          <div className="absolute -bottom-10 -right-8 w-14 h-14 bg-orange-400 rounded-full opacity-60 animate-bounce delay-700 z-10" style={{ animationDuration: '2.8s' }}></div>
          
          {/* Additional mid-layer bokeh for more depth */}
          <div className="absolute top-1/2 -left-6 w-6 h-6 bg-blue-300 rounded-full opacity-40 animate-pulse delay-300 z-5" style={{ animationDuration: '4s' }}></div>
          <div className="absolute top-1/3 -right-4 w-5 h-5 bg-green-300 rounded-full opacity-50 animate-pulse delay-800 z-5" style={{ animationDuration: '3.2s' }}></div>
          
          {/* Extra floating balls for visual richness */}
          <div className="absolute top-0 left-1/2 w-7 h-7 bg-indigo-300 rounded-full opacity-45 animate-bounce delay-1200 z-10" style={{ animationDuration: '3.8s' }}></div>
          <div className="absolute bottom-0 right-1/3 w-9 h-9 bg-rose-300 rounded-full opacity-55 animate-pulse delay-1500 z-5" style={{ animationDuration: '4.2s' }}></div>
          
          <div className="relative z-20 flex justify-center items-center space-x-4">
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
          </div>
        </div>
      </div>
      
      {joinError && (
        <p className="text-red-600 font-bold mt-4">{joinError}</p>
      )}
    </div>
  );
}
