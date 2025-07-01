import { SoundSubmission, SoundEffect } from '@/types/game';
import { WaveformAnimation } from '@/components/shared/WaveformAnimation';

interface SubmissionCardProps {
  submission: SoundSubmission;
  index: number; // Used by parent components for React keys
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  index: _,
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
        
        @keyframes golden-shimmer {
          0% { 
            background-position: -200% 0;
            filter: brightness(1) saturate(1);
          }
          50% { 
            filter: brightness(1.3) saturate(1.2);
          }
          100% { 
            background-position: 200% 0;
            filter: brightness(1) saturate(1);
          }
        }
        
        @keyframes trophy-bounce {
          0%, 100% { 
            transform: translateY(0) scale(1);
          }
          25% { 
            transform: translateY(-4px) scale(1.05);
          }
          50% { 
            transform: translateY(-2px) scale(1.02);
          }
          75% { 
            transform: translateY(-1px) scale(1.01);
          }
        }
        
        @keyframes winner-glow {
          0%, 100% { 
            box-shadow: 
              0 0 20px rgba(255, 215, 0, 0.5),
              0 0 40px rgba(255, 193, 7, 0.3),
              0 0 60px rgba(255, 235, 59, 0.2);
          }
          50% { 
            box-shadow: 
              0 0 30px rgba(255, 215, 0, 0.8),
              0 0 60px rgba(255, 193, 7, 0.6),
              0 0 90px rgba(255, 235, 59, 0.4);
          }
        }
        
        @keyframes floating-sparkles {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-20px) rotate(180deg);
            opacity: 0;
          }
        }
      `}</style>
      
      <div 
        className={`relative rounded-3xl py-2 px-3 transition-all duration-500 min-w-[20rem] max-w-[25rem] ${
          isCurrentlyPlaying && !isWinner
            ? 'bg-gradient-to-br from-purple-400 to-pink-500 scale-105 shadow-2xl transform -rotate-1' 
            : isWinner
              ? 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 py-4 scale-110 shadow-2xl border-4 border-yellow-400 transform rotate-1'
              : 'bg-gradient-to-br from-slate-100 via-blue-100 to-purple-100 border-2 border-slate-300 shadow-lg hover:shadow-xl hover:border-purple-300 hover:from-purple-100 hover:to-blue-100'
        }`}
        style={{
          transition: 'all 0.5s ease-in-out, height 0.8s ease-in-out, min-height 0.8s ease-in-out',
          ...(isWinner && {
            background: 'linear-gradient(135deg, #ffd700 0%, #ffb347 25%, #ffd700 50%, #ffb347 75%, #ffd700 100%)',
            backgroundSize: '200% 200%',
            animation: 'golden-shimmer 3s ease-in-out infinite, winner-glow 2s ease-in-out infinite'
          })
        }}
      >
      {/* Progress Indicator for Winner */}
      {isWinner && isCurrentlyPlaying && (
        <div className="absolute -bottom-2 -right-2 w-16 h-16">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-white opacity-50"
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

      {/* Floating Sparkles for Winner */}
      {isWinner && (
        <>
          <div className="absolute -top-2 -left-2 text-yellow-400 text-2xl opacity-80 animate-pulse" style={{ animation: 'floating-sparkles 3s ease-in-out infinite' }}>✨</div>
          <div className="absolute -top-1 -right-3 text-yellow-300 text-xl opacity-70" style={{ animation: 'floating-sparkles 3s ease-in-out infinite 0.5s' }}>⭐</div>
          <div className="absolute -bottom-2 -left-3 text-amber-400 text-lg opacity-60" style={{ animation: 'floating-sparkles 3s ease-in-out infinite 1s' }}>💫</div>
          <div className="absolute -bottom-1 -right-2 text-yellow-500 text-xl opacity-75" style={{ animation: 'floating-sparkles 3s ease-in-out infinite 1.5s' }}>🌟</div>
        </>
      )}

      {/* Pulsing Animation for Playing */}
      {(isCurrentlyPlaying && !isWinner) && (
        <>
          <div className="absolute inset-0 rounded-3xl bg-white opacity-20 animate-pulse"></div>
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-purple-400 to-pink-500 opacity-75 blur animate-pulse"></div>
        </>
      )}

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center justify-center">
            <h5 className={`text-2xl font-bold ${
              isCurrentlyPlaying 
                ? 'text-white   mx-8' 
                : isWinner 
                  ? 'text-amber-900 mx-8 drop-shadow-lg'
                  : 'text-gray-800'
            }`}>
              {isWinner 
                ? (
                  <span className="flex items-center gap-2">
                    <span style={{ animation: 'trophy-bounce 2s ease-in-out infinite' }}>🏆</span>
                    <span className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 bg-clip-text text-transparent font-extrabold">
                      
                    </span>
                  </span>
                )
                :  ``
              }
            </h5>
          </div>
          
          {/* Like Count Display */}
          {(submission.likeCount || 0) > 0 ? (
            <div className={`flex items-center space-x-1 rounded-full px-3 py-1 ${
              isCurrentlyPlaying 
                ? 'bg-white bg-opacity-20 shadow-lg' 
                : isWinner 
                  ? 'bg-pink-200 text-pink-700'
                  : 'bg-pink-100 text-pink-600'
            }`}>
              <span className="text-lg">❤️</span>
              <span className="font-bold text-lg">
                {submission.likeCount}
              </span>
            </div>
          ) : (
            <div className={`flex items-center space-x-1 rounded-full px-3 py-1 ${
              isCurrentlyPlaying 
              ? 'bg-gradient-to-r from-white/30 to-white/10 backdrop-blur-sm border border-white/20 shadow-lg' 
              : isWinner 
                ? 'bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-200 text-amber-700 shadow-md'
                : 'bg-gradient-to-r from-slate-200 via-gray-100 to-slate-200 text-gray-500 shadow-sm hover:from-purple-200 hover:via-pink-100 hover:to-purple-200 hover:text-purple-600 transition-all duration-300'
            }`}>
              <span className="text-lg">💔</span>
              <span className="font-bold text-lg">
              0
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2 transition-all duration-700 ease-in-out">
          {submission.sounds.map((soundId, soundIndex) => {
            const sound = soundEffects.find(s => s.id === soundId);
            const isCurrentSound = isCurrentlyPlaying && currentPlayingSoundIndex === soundIndex;
            const hasBeenRevealed = revealedSounds.has(soundId);
            const isThirdSound = soundIndex === 2 && isTripleSound;
            
            // Debug logging for sound playback
            if (isCurrentlyPlaying) {
              console.log(`[SUBMISSION CARD] Sound ${soundIndex}: currentPlayingSoundIndex=${currentPlayingSoundIndex}, isCurrentSound=${isCurrentSound}, soundId=${soundId}`);
            }
            
            // Hide third sound slot until it's revealed or currently playing
            if (isThirdSound && !hasBeenRevealed && !isCurrentSound && playingMode === 'playback') {
              return null;
            }
            
            return (
              <div 
                key={soundIndex} 
                className={`px-3 py-2 rounded-xl transition-all ${
                  isThirdSound && isCurrentSound
                    ? 'duration-1000 border-4 border-solid'
                    : 'duration-300'
                } ${
                  isCurrentSound 
                    ? isThirdSound
                      ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white shadow-2xl ring-4 ring-yellow-400 scale-110' 
                      : isWinner
                        ? 'bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 text-amber-900 shadow-lg ring-2 ring-yellow-400 scale-105 font-bold'
                        : 'bg-white bg-opacity-100 text-gray-800 shadow-lg ring-2 ring-white scale-105'
                    : isCurrentlyPlaying 
                      ? isWinner
                        ? 'bg-gradient-to-r from-yellow-200 via-amber-200 to-yellow-200 text-amber-800 shadow-lg' 
                        : 'bg-white bg-opacity-90 text-gray-800 shadow-lg' 
                      : hasBeenRevealed || showSoundNames
                        ? isWinner
                          ? 'bg-gradient-to-r from-yellow-100 via-amber-100 to-yellow-100 text-amber-700 shadow-md'
                          : 'bg-white text-gray-800 shadow-md'
                        : isWinner
                          ? 'bg-gradient-to-r from-yellow-100 via-amber-100 to-yellow-100 text-amber-700 shadow-md'
                          : 'bg-white text-gray-800 shadow-md'
                }`}
                style={{
                  animation: isThirdSound && isCurrentSound 
                    ? 'dazzle 1.5s ease-out, sparkle 2s ease-in-out infinite, rainbow-border 3s linear infinite' 
                    : isCurrentSound && !isThirdSound
                      ? undefined //'pulse 1s ease-in-out infinite'
                      : undefined,
                  transition: isThirdSound ? 'all 0.8s ease-in-out, opacity 0.6s ease-in-out, transform 0.8s ease-in-out' : undefined
                }}
              >
                <div className="flex items-center justify-start space-x-1">
                  <span className={`text-xl ${
                    isThirdSound && isCurrentSound ? 'animate-bounce' : ''
                  }`}>
                    {isCurrentSound 
                      ? isThirdSound 
                        ? '🔊' 
                        : isWinner 
                          ? '🏆' 
                          : '🔊' 
                      : isWinner 
                        ? '🔊' 
                        : '🔊'
                    }
                  </span>
                  <span className={`text-xl font-bold ${
                    isCurrentSound 
                      ? isThirdSound 
                        ? 'text-yellow-200 drop-shadow-lg' 
                        : isWinner
                          ? 'text-amber-900 drop-shadow-md animate-pulse'
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
                    // <span className="text-lg animate-pulse">💎</span>
                    <></>
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
