'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PLAYER_COLORS, PLAYER_EMOJIS, getRandomColor, getRandomEmoji, getSoundEffects } from '@/data/gameData';
import { getPlayerColorClass } from '@/utils/gameUtils';
import { useAudioSystem } from '@/utils/audioSystem';
import { Button } from '@/components/ui';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [playerColor, setPlayerColor] = useState('');
  const [playerEmoji, setPlayerEmoji] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const { audioSystem } = useAudioSystem();

  // Set client flag after hydration to prevent SSR/client mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load player data from localStorage on component mount (client-side only)
  useEffect(() => {
    if (!isClient) return;
    
    const savedPlayerData = localStorage.getItem('playerCustomization');
    if (savedPlayerData) {
      try {
        const { name, color, emoji } = JSON.parse(savedPlayerData);
        setPlayerName(name || '');
        setPlayerColor(color || getRandomColor());
        setPlayerEmoji(emoji || getRandomEmoji());
        // Don't auto-expand editing if we have saved data
        setIsEditingProfile(false);
      } catch (error) {
        console.error('Failed to parse saved player data:', error);
        // Initialize with random values if parsing fails
        setPlayerColor(getRandomColor());
        setPlayerEmoji(getRandomEmoji());
        setIsEditingProfile(true); // Show full interface if no valid saved data
      }
    } else {
      // No saved data, initialize with random values and show full interface
      setPlayerColor(getRandomColor());
      setPlayerEmoji(getRandomEmoji());
      setIsEditingProfile(true);
    }
  }, [isClient]);

  // Save player data to localStorage whenever it changes (client-side only)
  useEffect(() => {
    if (!isClient || !playerColor || !playerEmoji) return;
    
    const playerData = {
      name: playerName,
      color: playerColor,
      emoji: playerEmoji
    };
    localStorage.setItem('playerCustomization', JSON.stringify(playerData));
  }, [isClient, playerName, playerColor, playerEmoji]);

  // Clear any game persistence data when the home page loads
  // This ensures a fresh start when users return to the home screen
  useEffect(() => {
    // Clear localStorage data that might cause unwanted reconnection attempts
    // localStorage.removeItem('originalPlayerId');
    // localStorage.removeItem('lastKnownRoomCode');
    // console.log('Home page loaded: Cleared game persistence data for fresh start');
  }, []);

  // Function to play a random fart sound
  // Note: Chrome requires AudioContext to be initialized after a user gesture
  // https://developer.chrome.com/blog/autoplay/#web_audio
  const playRandomFartSound = async () => {
    if (isPlayingSound) return;

    setIsPlayingSound(true);
    
    try {
      // Ensure audio system is available
      if (!audioSystem) {
        console.log('Audio system not available');
        return;
      }

      console.log('🎵 Initializing audio system...');
      
      // Initialize audio context (this handles Chrome's user gesture requirement)
      await audioSystem.initialize();

      console.log('🔍 Loading sound effects...');
      
      // Get all sound effects (including explicit content for preview)
      const allSounds = await getSoundEffects(true);
      
      // Filter for sounds with "fart" in the name or in "bodily functions" category
      const fartSounds = allSounds.filter(sound => 
        sound.name.toLowerCase().includes('fart') || 
        sound.category.toLowerCase().includes('bodily functions')
      );

      console.log(`Found ${fartSounds.length} fart sounds`);

      if (fartSounds.length > 0) {
        // Pick a random fart sound
        const randomFartSound = fartSounds[Math.floor(Math.random() * fartSounds.length)];
        console.log(`🎵💨 Playing random fart sound: ${randomFartSound.name}`);
        
        // Play the sound
        await audioSystem.playSound(randomFartSound.id);
        console.log('✅ Sound played successfully!');
      } else {
        console.log('No fart sounds found! 😢');
      }
    } catch (error) {
      console.error('❌ Error playing fart sound:', error);
      
      // Show user-friendly error message
      if (error instanceof Error && error.message.includes('AudioContext')) {
        console.log('💡 Audio initialization failed - this is normal on first click in some browsers');
      }
    } finally {
      setIsPlayingSound(false);
    }
  };
  const handleSubmit = (selectedMode: 'create' | 'join') => {
    if (!playerName.trim()) return;
    
    // Map 'create' to 'host' for the URL parameter
    const urlMode = selectedMode === 'create' ? 'host' : 'join';
    
    const params = new URLSearchParams({
      mode: urlMode,
      playerName: playerName.trim(),
      playerColor: playerColor,
      playerEmoji: playerEmoji,
    });
    
    if (selectedMode === 'join' && roomCode.trim()) {
      params.set('roomCode', roomCode.trim().toUpperCase());
    }
    
    router.push(`/game?${params.toString()}`);
  };

  const goToMainScreen = () => {
    router.push('/main-screen');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-orange-400 px-4 py-1">
      <div className="max-w-md mx-auto pt-8">
        {/* Logo/Title */}
        <div className="text-center mb-6">
          <h1 className="text-6xl font-black text-white mb-4 drop-shadow-lg">
            fartnoises
          </h1>
          <p className="text-xl text-white/90 font-bold">
            The hilarious sound game!
          </p>
          <div 
            className={`text-4xl mt-4 cursor-pointer transition-all duration-200 select-none ${
              isPlayingSound 
                ? 'animate-pulse scale-125 text-yellow-300' 
                : 'animate-bounce hover:scale-110'
            }`}
            onClick={playRandomFartSound}
            title="Click me for a surprise! 🎵💨"
          >
            🎵💨
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-3xl p-4 shadow-2xl">
          {!mode ? (
            <>
              {/* Player Name Input */}
              {(!playerName.trim() || isEditingProfile) ? (
                <div className="mb-4">
                  <label className="block text-gray-700 text-lg font-bold mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name..."
                    className="w-full px-6 py-4 text-lg text-gray-800 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none transition-colors placeholder:text-gray-600"
                    maxLength={20}
                  />
                </div>
              ) : (
                <div className="mb-4">
                  <label className="block text-gray-700 text-lg font-bold mb-2">
                    Welcome back!
                  </label>
                  <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-full ${getPlayerColorClass(playerColor)} flex items-center justify-center text-xl shadow-md`}>
                        {playerEmoji}
                      </div>
                      <span className="text-lg font-semibold text-gray-800">{playerName}</span>
                    </div>
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-2 rounded-lg font-medium transition-colors text-sm"
                    >
                      ✏️ Edit
                    </button>
                  </div>
                </div>
              )}

              {/* Player Customization - Show only when editing */}
              {(!playerName.trim() || isEditingProfile) && (
                <div className="mb-6">
                  <label className="block text-gray-700 text-lg font-bold mb-3">
                    Your Avatar
                  </label>
                  
                  {/* Current Selection Preview */}
                  <div className="flex items-center justify-center mb-4">
                    <div className={`w-20 h-20 rounded-full ${getPlayerColorClass(playerColor)} flex items-center justify-center text-3xl shadow-lg`}>
                      {playerEmoji}
                    </div>
                  </div>

                  {/* Color Selection */}
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-600 mb-2">Choose your color:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {PLAYER_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setPlayerColor(color)}
                          className={`w-8 h-8 rounded-full ${getPlayerColorClass(color)} border-2 transition-all duration-200 hover:scale-110 ${
                            playerColor === color ? 'border-gray-800 ring-2 ring-gray-400' : 'border-gray-300'
                          }`}
                          title={`Select ${color}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Emoji Selection */}
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-600 mb-2">Choose your emoji:</p>
                    <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {PLAYER_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setPlayerEmoji(emoji)}
                          className={`w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors ${
                            playerEmoji === emoji ? 'bg-purple-100 ring-2 ring-purple-400' : ''
                          }`}
                          title={`Select ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Random Button */}
                  <div className="text-center mb-4">
                    <button
                      onClick={() => {
                        setPlayerColor(getRandomColor());
                        setPlayerEmoji(getRandomEmoji());
                      }}
                      className="text-sm bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full text-gray-700 font-medium transition-colors"
                    >
                      🎲 Randomize
                    </button>
                  </div>

                  {/* Done Editing Button - Only show if we're editing existing profile */}
                  {playerName.trim() && isEditingProfile && (
                    <div className="text-center">
                      <button
                        onClick={() => setIsEditingProfile(false)}
                        className="bg-green-100 hover:bg-green-200 text-green-700 px-6 py-2 rounded-full font-medium transition-colors"
                      >
                        💾 Save
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Room Code Input and Game Actions - Hide when editing profile */}
              {!isEditingProfile && (
                <>
                  {/* Room Code Input */}
                  <div className="mb-8">
                    <label className="block text-gray-700 text-lg font-bold mb-2">
                      Room Code <span className="font-normal text-gray-500">(to join)</span>
                    </label>
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && playerName.trim() && roomCode.trim().length === 4) {
                          handleSubmit('join');
                        }
                      }}
                      placeholder="4-LETTER-CODE"
                      className="w-full px-6 py-4 text-lg text-gray-800 text-center font-mono tracking-widest border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors uppercase placeholder:text-gray-500"
                      maxLength={4}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-4">
                    <Button
                      onClick={() => handleSubmit('join')}
                      disabled={!playerName.trim() || roomCode.trim().length !== 4}
                      variant="primary"
                      size="lg"
                      className="w-full"
                    >
                      🚀 Join Game
                    </Button>
                    
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-gray-300"></div>
                      <span className="flex-shrink mx-4 text-gray-500 font-semibold">OR</span>
                      <div className="flex-grow border-t border-gray-300"></div>
                    </div>

                    <Button
                      onClick={() => handleSubmit('create')}
                      disabled={!playerName.trim()}
                      variant="success"
                      size="lg"
                      className="w-full"
                    >
                      🎮 Create New Room
                    </Button>
                  </div>

                </>
              )}

              {/* Main Screen Button - Always available */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <Button
                  onClick={goToMainScreen}
                  variant="purple"
                  className="w-full"
                >
                  📺 Main Screen Mode
                </Button>
                <p className="text-sm text-gray-700 text-center mt-2">
                  For TV/shared display
                </p>
              </div>
            </>
          ) : mode === 'join' ? (
            <>
              {/* Room Code Input */}
              <div className="mb-8">
                <button
                  onClick={() => setMode(null)}
                  className="text-purple-500 hover:text-purple-700 mb-4 font-bold"
                >
                  ← Back
                </button>
                <label className="block text-gray-700 text-lg font-bold mb-4">
                  Enter Room Code
                </label>                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && roomCode.trim() && roomCode.trim().length === 4) {
                      handleSubmit('join');
                    }
                  }}
                  placeholder="4-letter code..."
                  className="w-full px-6 py-4 text-lg text-gray-800 text-center font-mono border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors uppercase placeholder:text-gray-600"
                  maxLength={4}
                />
              </div>

              <button
                onClick={() => handleSubmit('join')}
                disabled={!roomCode.trim() || roomCode.trim().length !== 4}
                className="w-full bg-gradient-to-r from-blue-400 to-blue-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-blue-500 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200"
              >
                🚀 Join Game!
              </button>
            </>
          ) : (
            <>
              {/* Create Room Confirmation */}
              <div className="text-center">
                <button
                  onClick={() => setMode(null)}
                  className="text-purple-500 hover:text-purple-700 mb-6 font-bold"
                >
                  ← Back
                </button>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">
                  Ready to create a room?
                </h3>                <p className="text-gray-800 mb-8">
                  You&apos;ll become the host and get a room code to share with friends!
                </p>
                <button
                  onClick={() => handleSubmit('create')}
                  className="w-full bg-gradient-to-r from-green-400 to-green-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-green-500 hover:to-green-700 transition-all duration-200 transform hover:scale-105"
                >
                  🎉 Create Room!
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}