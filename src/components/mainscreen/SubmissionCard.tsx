import { SoundSubmission, SoundEffect } from '@/types/game';
import { WaveformAnimation } from '@/components/shared/WaveformAnimation';

interface SubmissionCardProps {
  submission: SoundSubmission;
  index: number;
  soundEffects: SoundEffect[];
  isCurrentlyPlaying?: boolean;
  currentPlayingSoundIndex?: number;
  revealedSounds?: Set<string>;
  showSoundNames?: boolean;
  playingMode?: 'judging' | 'playback' | 'results';
  isWinner?: boolean;
  playbackProgress?: number;
}

export function SubmissionCard({
  submission,
  index,
  soundEffects,
  isCurrentlyPlaying = false,
  currentPlayingSoundIndex = -1,
  revealedSounds = new Set(),
  showSoundNames = true,
  playingMode = 'judging',
  isWinner = false,
  playbackProgress = 0
}: SubmissionCardProps) {
  const isTripleSound = submission.sounds.length === 3;
  
  return (
    <>
      {/* Keyframe animations for the dazzling third sound effect */}
      <style jsx>{`
        @keyframes dazzle {
          0% { 
            transform: scale(0.8) rotateY(-180deg);
            opacity: 0;
            filter: hue-rotate(0deg) brightness(1);
          }
          25% { 
            transform: scale(1.1) rotateY(-90deg);
            opacity: 0.7;
            filter: hue-rotate(90deg) brightness(1.5);
          }
          50% { 
            transform: scale(1.05) rotateY(0deg);
            opacity: 1;
            filter: hue-rotate(180deg) brightness(2);
          }
          75% { 
            transform: scale(1.02) rotateY(0deg);
            opacity: 1;
            filter: hue-rotate(270deg) brightness(1.5);
          }
          100% { 
            transform: scale(1) rotateY(0deg);
            opacity: 1;
            filter: hue-rotate(360deg) brightness(1);
          }
        }
        
        @keyframes sparkle {
          0%, 100% { 
            box-shadow: 0 0 0 0 rgba(255, 215, 0, 0);
          }
          50% { 
            box-shadow: 
              0 0 20px 5px rgba(255, 215, 0, 0.8),
              0 0 40px 10px rgba(255, 105, 180, 0.6),
              0 0 60px 15px rgba(138, 43, 226, 0.4);
          }
        }
        
        @keyframes rainbow-border {
          0% { border-color: #ff0000; }
          16% { border-color: #ff8000; }
          33% { border-color: #ffff00; }
          50% { border-color: #00ff00; }
          66% { border-color: #0080ff; }
          83% { border-color: #8000ff; }
          100% { border-color: #ff0000; }
        }
      `}</style>
      
      <div 
        className={`relative rounded-3xl p-8 transition-all duration-500 ${
          isCurrentlyPlaying 
            ? 'bg-gradient-to-br from-purple-400 to-pink-500 scale-105 shadow-2xl transform -rotate-1' 
            : isWinner
              ? 'bg-gradient-to-br from-yellow-200 to-yellow-300'
              : 'bg-gradient-to-br from-gray-200 to-gray-300'
        }`}
      >
      {/* Progress Indicator for Winner */}
      {isWinner && isCurrentlyPlaying && (
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
      {isCurrentlyPlaying && (
        <>
          <div className="absolute inset-0 rounded-3xl bg-white opacity-20 animate-pulse"></div>
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-purple-400 to-pink-500 opacity-75 blur animate-pulse"></div>
        </>
      )}

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-center mb-6">
          <h5 className={`text-2xl font-bold ${
            isCurrentlyPlaying 
              ? 'text-white' 
              : isWinner 
                ? 'text-yellow-800'
                : 'text-gray-800'
          }`}>
            {isWinner 
              ? '🏆 Winner 🏆' 
              : isTripleSound
                ? `⚡ Triple Sound ${index + 1} ⚡`
                : `🎵 Submission ${index + 1} 🎵`
            }
          </h5>
          {isTripleSound && (
            <span className="ml-2 text-lg animate-bounce">💎</span>
          )}
        </div>

        <div className="space-y-4">
          {submission.sounds.map((soundId, soundIndex) => {
            const sound = soundEffects.find(s => s.id === soundId);
            const isCurrentSound = isCurrentlyPlaying && currentPlayingSoundIndex === soundIndex;
            const hasBeenRevealed = revealedSounds.has(soundId);
            const isThirdSound = soundIndex === 2 && isTripleSound;
            
            return (
              <div 
                key={soundIndex} 
                className={`px-6 py-4 rounded-xl transition-all ${
                  isThirdSound && isCurrentSound
                    ? 'duration-1000 border-4 border-solid'
                    : 'duration-300'
                } ${
                  isCurrentSound 
                    ? isThirdSound
                      ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white shadow-2xl ring-4 ring-yellow-400 scale-110' 
                      : 'bg-white bg-opacity-100 text-gray-800 shadow-lg ring-2 ring-white scale-105'
                    : isCurrentlyPlaying 
                      ? 'bg-white bg-opacity-90 text-gray-800 shadow-lg' 
                      : hasBeenRevealed || showSoundNames
                        ? 'bg-white text-gray-800 shadow-md'
                        : 'bg-white text-gray-800 shadow-md'
                }`}
                style={{
                  animation: isThirdSound && isCurrentSound 
                    ? 'dazzle 1.5s ease-out, sparkle 2s ease-in-out infinite, rainbow-border 3s linear infinite' 
                    : undefined
                }}
              >
                <div className="flex items-center justify-center space-x-3">
                  <span className={`text-2xl ${
                    isThirdSound && isCurrentSound ? 'animate-bounce' : ''
                  }`}>
                    {isCurrentSound 
                      ? isThirdSound 
                        ? '⚡🎵⚡' 
                        : '🔊' 
                      : isWinner 
                        ? '🔊' 
                        : ''
                    }
                  </span>
                  <span className={`text-xl font-bold ${
                    isCurrentSound 
                      ? isThirdSound 
                        ? 'text-yellow-200 drop-shadow-lg' 
                        : 'text-purple-600' 
                      : ''
                  }`}>
                    {/* Show sound name based on mode and reveal state */}
                    {playingMode === 'playback' 
                      ? (isCurrentSound || hasBeenRevealed ? (sound?.name || soundId) : '???')
                      : showSoundNames 
                        ? (sound?.name || soundId)
                        : '???'
                    }
                  </span>
                  {isThirdSound && (isCurrentSound || hasBeenRevealed) && (
                    <span className="text-lg animate-pulse">💎</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Waveform Animation for Playing */}
        <WaveformAnimation 
          isPlaying={isCurrentlyPlaying}
          color="bg-white"
        />
      </div>
    </div>
    </>
  );
}
