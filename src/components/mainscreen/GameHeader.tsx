import { Room } from '@/types/game';
import { useState, useEffect } from 'react';
import { audioSystem } from '@/utils/audioSystem';

interface GameHeaderProps {
  /** Room object containing game info */
  room: Room;
  /** Background music hook instance from parent */
  backgroundMusic: {
    currentTrack: string | null;
    isPlaying: boolean;
    isFading: boolean;
    isAudioReady: boolean;
    volume: number;
    changeMusic: (newTrack: string | null) => void;
    setVolume: (volume: number) => void;
    activateAudio: () => Promise<void>;
  };
  /** Additional CSS classes */
  className?: string;
}

export default function GameHeader({ 
  room, 
  backgroundMusic,
  className = "" 
}: GameHeaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [masterVolume, setMasterVolumeState] = useState(1.0);
  
  const { setVolume: setBackgroundMusicVolume, volume: currentMusicVolume } = backgroundMusic;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // Check initial state
    setIsFullscreen(!!document.fullscreenElement);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  // Volume control handlers
  const handleMasterVolumeChange = (volume: number) => {
    console.log('🔊 GameHeader: Master volume changing from', masterVolume, 'to', volume);
    setMasterVolumeState(volume);
    audioSystem.setMasterVolume(volume);
    console.log('🔊 GameHeader: Master volume set, current audioSystem volume:', audioSystem.getMasterVolume());
  };

  const handleMusicVolumeChange = (volume: number) => {
    console.log('🎵 GameHeader: Music volume changing from', currentMusicVolume, 'to', volume);
    console.log('🎵 GameHeader: Background music state:', {
      currentTrack: backgroundMusic.currentTrack,
      isPlaying: backgroundMusic.isPlaying,
      isAudioReady: backgroundMusic.isAudioReady
    });
    setBackgroundMusicVolume(volume);
    console.log('🎵 GameHeader: Called setBackgroundMusicVolume with:', volume);
  };

  // Initialize volume states
  useEffect(() => {
    const currentMasterVolume = audioSystem.getMasterVolume();
    console.log('🔊 GameHeader: Initializing master volume to:', currentMasterVolume);
    setMasterVolumeState(currentMasterVolume);
  }, []);

  // Debug background music state changes
  useEffect(() => {
    console.log('🎵 GameHeader: Background music state changed (using MAIN INSTANCE):', {
      currentTrack: backgroundMusic.currentTrack,
      isPlaying: backgroundMusic.isPlaying,
      isAudioReady: backgroundMusic.isAudioReady,
      volume: currentMusicVolume
    });
  }, [backgroundMusic.currentTrack, backgroundMusic.isPlaying, backgroundMusic.isAudioReady, currentMusicVolume]);

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.settings-menu') && !target.closest('.settings-button')) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettings]);

  return (
    <div className={`${className}`}>
        {/* Room code positioned fixed in bottom left of viewport */}
        <div className="fixed bottom-2 left-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl px-6 py-2 shadow-xl z-10 transform transition-transform duration-300 border-4 border-white ">
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-purple-100 opacity-80 tracking-wide">ROOM</span>
            <h2 className="text-2xl font-black text-white tracking-wider drop-shadow-lg -mt-1">
              {room.code}
            </h2>
          </div>
              </div>

        {/* Settings button positioned vertically centered with room code */}
        <div className="fixed bottom-2 left-40 z-10 flex items-center h-16">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="settings-button bg-white/20 hover:bg-white/30 rounded-xl p-3 transition-all duration-200 border border-white/30 hover:border-white/50 hover:scale-105"
            title="Settings"
            aria-label="Open settings menu"
          >
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="text-white"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>

          {/* Settings Menu */}
          {showSettings && (
            <div className="settings-menu absolute bottom-14 left-0 bg-white rounded-xl p-4 shadow-2xl border-2 border-purple-200 min-w-64">
              <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">Settings</h3>
              
              {/* Fullscreen Toggle */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Fullscreen</label>
                  <button
                    onClick={toggleFullscreen}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                      isFullscreen ? 'bg-purple-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                        isFullscreen ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Game Volume */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Game Volume ({Math.round(masterVolume * 100)}%)
                </label>              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={masterVolume}
                onChange={(e) => handleMasterVolumeChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer 
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white 
                         [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-purple-500 
                         [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
                style={{
                  background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${masterVolume * 100}%, #e5e7eb ${masterVolume * 100}%, #e5e7eb 100%)`
                }}
              />
              </div>

              {/* Music Volume */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Music Volume ({Math.round(currentMusicVolume * 100)}%)
                </label>              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentMusicVolume}
                onChange={(e) => handleMusicVolumeChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer 
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white 
                         [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-green-500 
                         [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
                style={{
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${currentMusicVolume * 100}%, #e5e7eb ${currentMusicVolume * 100}%, #e5e7eb 100%)`
                }}
              />
              </div>

              {/* Close button */}
              <button
                onClick={() => setShowSettings(false)}
                className="w-full mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Fartnoises logo positioned fixed in bottom right of viewport */}
        <div className="fixed bottom-2 right-2 bg-gradient-to-r from-green-400 to-blue-500 rounded-2xl px-4 py-2 shadow-xl z-10 transform transition-transform duration-300 border-4 border-white">
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-black text-white tracking-wide drop-shadow-lg">
              🎵💨 fartnoises
            </h1>
            <span className="text-xs font-medium text-green-100 opacity-80 tracking-wide -mt-1">
              THE GAME
            </span>
          </div>
        </div>
        
        {/* Commented out other elements */}
        {/* 
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xl text-gray-800">Round {room.currentRound} of {room.maxRounds}</p>
            </div>
            <div className="text-right">
              <p className="text-lg text-gray-800">{getGameStateDisplay(room.gameState)}</p>
              <p className="text-2xl font-bold text-purple-600">{room.players.length} Players</p>
            </div>
          </div>
        </div>
        */}
      </div>
  );
}
