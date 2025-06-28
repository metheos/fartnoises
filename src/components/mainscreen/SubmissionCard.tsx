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
  return (
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
            {isWinner ? '🏆 Winner 🏆' : `🎵 Submission ${index + 1} 🎵`}
          </h5>
        </div>

        <div className="space-y-4">
          {submission.sounds.map((soundId, soundIndex) => {
            const sound = soundEffects.find(s => s.id === soundId);
            const isCurrentSound = isCurrentlyPlaying && currentPlayingSoundIndex === soundIndex;
            const hasBeenRevealed = revealedSounds.has(soundId);
            
            return (
              <div 
                key={soundIndex} 
                className={`px-6 py-4 rounded-xl transition-all duration-300 ${
                  isCurrentSound 
                    ? 'bg-white bg-opacity-100 text-gray-800 shadow-lg ring-2 ring-white scale-105' 
                    : isCurrentlyPlaying 
                      ? 'bg-white bg-opacity-90 text-gray-800 shadow-lg' 
                      : hasBeenRevealed || showSoundNames
                        ? 'bg-white text-gray-800 shadow-md'
                        : 'bg-white text-gray-800 shadow-md'
                }`}
              >
                <div className="flex items-center justify-center space-x-3">
                  <span className="text-2xl">
                    {isCurrentSound ? '🔊' : isWinner ? '🔊' : ''}
                  </span>
                  <span className={`text-xl font-bold ${
                    isCurrentSound ? 'text-purple-600' : ''
                  }`}>
                    {/* Show sound name based on mode and reveal state */}
                    {playingMode === 'playback' 
                      ? (isCurrentSound || hasBeenRevealed ? (sound?.name || soundId) : '???')
                      : showSoundNames 
                        ? (sound?.name || soundId)
                        : '???'
                    }
                  </span>
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
  );
}
