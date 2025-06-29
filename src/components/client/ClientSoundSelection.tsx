'use client';

import { useState, useEffect, useRef } from 'react';
import { Room, Player, SoundEffect, GameState } from '@/types/game';
import { audioSystem } from '@/utils/audioSystem';
import { Card, Button, SoundCard, CircularButton } from '@/components/ui';
import { JudgePromptDisplay } from '../shared/JudgePromptDisplay';
import { useSoundSelection, useAudioPlaybackEnhanced } from '@/hooks';

interface ClientSoundSelectionProps {
  room: Room;
  player: Player;
  selectedSounds: string[] | null;
  onSelectSounds: (sounds: string[]) => void;
  onSubmitSounds: () => void;
  onRefreshSounds: () => void; // New refresh sounds callback
  onActivateTripleSound: () => void; // New triple sound activation callback
  timeLeft: number;
  soundEffects: SoundEffect[];
}

export default function ClientSoundSelection({ 
  room, 
  player, 
  selectedSounds, 
  onSelectSounds, 
  onSubmitSounds, 
  onRefreshSounds,
  onActivateTripleSound,
  timeLeft, 
  soundEffects 
}: ClientSoundSelectionProps) {
  const isJudge = player.id === room.currentJudge;
  const [showThirdSoundSlap, setShowThirdSoundSlap] = useState(false);
  
  // Use our custom hooks
  const {
    selectedSoundsLocal,
    playerSoundSet,
    handleSoundSelect,
    hasSubmitted,
    submission
  } = useSoundSelection({
    room,
    player,
    soundEffects,
    selectedSounds,
    onSelectSounds
  });

  const {
    playingSounds,
    playingButtons,
    isPlaying,
    playSoundWithFeedback,
    playSoundCombinationWithFeedback
  } = useAudioPlaybackEnhanced();

  // Trigger slap animation when third sound is selected
  useEffect(() => {
    if (selectedSoundsLocal.length === 3 && player.hasActivatedTripleSound) {
      setShowThirdSoundSlap(true);
      // Remove animation class after animation completes
      const timer = setTimeout(() => setShowThirdSoundSlap(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedSoundsLocal.length, player.hasActivatedTripleSound]);

  if (isJudge) {
    return (
      <Card className="text-center">
        <p className="text-2xl font-bold text-purple-600 mb-4">Players are choosing sounds...</p>
        <div className="bg-purple-100 rounded-2xl p-6 mb-6">
          <p className="text-lg text-gray-800 font-bold" dangerouslySetInnerHTML={{ __html: room.currentPrompt?.text || '' }}></p>
        </div>
      </Card>
    );
  }
  
  const hasFirstSubmission = room.submissions.length > 0;

  return (
    <>
      <style jsx>{`
        @keyframes slap {
          0% { transform: translateX(-50%) translateY(-60px) rotate(45deg) scale(0.5); opacity: 0; }
          20% { transform: translateX(-50%) translateY(10px) rotate(25deg) scale(1.2); opacity: 1; }
          40% { transform: translateX(-50%) translateY(-5px) rotate(8deg) scale(1.1); }
          60% { transform: translateX(-50%) translateY(2px) rotate(15deg) scale(1.05); }
          80% { transform: translateX(-50%) translateY(-1px) rotate(10deg) scale(1.02); }
          100% { transform: translateX(-50%) translateY(0px) rotate(12deg) scale(1); }
        }
      `}</style>
      <Card className="text-center">
            <div className="bg-purple-100 rounded-2xl p-6 mb-6">
        <p className="text-lg text-gray-800 font-bold" dangerouslySetInnerHTML={{ __html: room.currentPrompt?.text || '' }}></p>
            </div>
            
      {/* Only show timer after first submission */}
      {hasFirstSubmission ? (
        <p className="text-red-500 font-bold mb-4">Time Left: {timeLeft}s</p>
      ) : (
        <></>
      )}
        {hasSubmitted && submission ? (
        <div className="text-center">
          {/* Enhanced submission display */}
          <div className="bg-gradient-to-br from-green-50 via-white to-emerald-50 rounded-2xl p-6 max-w-2xl mx-auto border border-green-200 shadow-lg">
            <div className="flex items-center justify-center gap-3 mb-4">
              <h4 className="text-xl font-bold text-gray-800">Your Sounds</h4>
            </div>
            
            <div className="flex flex-row items-center justify-center gap-4">
              {submission.sounds.map((soundId, index) => (
                <div key={soundId} className="relative">
                  <div className={`w-40 h-20 rounded-xl flex items-center justify-center shadow-lg transform scale-105 transition-all duration-300 bg-gradient-to-br from-purple-500 to-purple-600 border-2 border-purple-300`}>
                    <div className="text-center text-white">
                      <div className="text-sm font-bold">
                        {soundEffects.find(s => s.id === soundId)?.name || `Sound ${index + 1}`}
                      </div>
                    </div>
                  </div>
                  
                  {/* Number marker */}
                  <div className="absolute -top-2 -left-2 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-purple-600 shadow-md border border-purple-300">
                    {index === 0 ? '1st' : '2nd'}
                  </div>
                  
                  {/* Preview button */}
                  <CircularButton
                    icon={isPlaying(soundId, `submission-preview-${index}`) ? '🔇' : '🔊'}
                    onClick={() => playSoundWithFeedback(soundId, `submission-preview-${index}`)}
                    disabled={isPlaying(soundId, `submission-preview-${index}`)}
                    variant="blue"
                    className="absolute -top-2 -right-2 border-2 border-gray-200 shadow-md"
                    title={isPlaying(soundId, `submission-preview-${index}`) ? 'Playing...' : 'Preview sound'}
                  />
                </div>
              ))}
            </div>

            {/* Preview combo button */}
            <div className="mt-6">
              <Button
                onClick={() => playSoundCombinationWithFeedback(submission.sounds, 'submission-combo')}
                disabled={isPlaying(undefined, 'submission-combo')}
                variant="success"
                size="md"
                className="shadow-lg"
              >
                {isPlaying(undefined, 'submission-combo') ? '🔇 Playing...' : '🎹 Play Your Sounds'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Refresh sounds section - only show if player hasn't used refresh and hasn't submitted */}
          {!player.hasUsedRefresh && (
            <div className="text-center">
              <Button
                onClick={onRefreshSounds}
                variant="secondary"
                size="md"
                className="mb-4 shadow-lg border-2 border-yellow-300 bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
              >
                🔄 Get New Sounds (1x per game)
              </Button>
              <p className="text-sm text-gray-600 mb-2">
                Don't like these sounds? Use your one-time refresh to get a new set!
              </p>
            </div>
          )}

          {player.hasUsedRefresh && (
            <div className="text-center mb-4">
              <p className="text-sm text-gray-500 italic">
                ✅ You've used your sound refresh for this game
              </p>
            </div>
          )}

          {/* Triple sound section - only show if player hasn't used triple sound and hasn't submitted */}
          {!player.hasUsedTripleSound && !player.hasActivatedTripleSound && (
            <div className="text-center">
              <Button
                onClick={onActivateTripleSound}
                variant="secondary"
                size="md"
                className="mb-4 shadow-lg border-2 border-purple-300 bg-gradient-to-r from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 text-purple-800 font-bold"
              >
                🎵🎵🎵 Triple Sound Power! (1x per game)
              </Button>
              <p className="text-sm text-gray-600 mb-2">
                Go big or go home! Activate your triple sound power to submit 3 sounds instead of 2!
              </p>
            </div>
          )}

          {player.hasActivatedTripleSound && (
            <div className="text-center mb-4">
              <p className="text-sm text-purple-600 italic font-semibold">
                ⚡ Triple Sound Mode Active! You can select up to 3 sounds!
              </p>
            </div>
          )}

          {/* Sound Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
            {playerSoundSet.map((sound) => (
              <SoundCard
                key={sound.id}
                sound={sound}
                isSelected={selectedSoundsLocal.includes(sound.id)}
                selectionIndex={selectedSoundsLocal.includes(sound.id) ? selectedSoundsLocal.indexOf(sound.id) + 1 : undefined}
                onSelect={handleSoundSelect}
                onPreview={(soundId) => playSoundWithFeedback(soundId, `grid-preview-${soundId}`)}
                isPlaying={isPlaying(sound.id, `grid-preview-${sound.id}`)}
                previewDisabled={isPlaying(sound.id, `grid-preview-${sound.id}`)}
                className="min-h-[80px]"
              />
            ))}
          </div>

          {/* Selected sounds display */}
          <div className="bg-gradient-to-br from-purple-300 to-pink-300 rounded-2xl p-3 max-w-2xl mx-auto border border-purple-100 shadow-lg">
            <div className="flex items-center justify-center gap-3 mb-4">
              <h3 className="text-xl font-bold text-gray-800">Your Sounds</h3>
            </div>
            
            <div className="flex flex-row items-center justify-center gap-6 relative">
              {/* Sound 1 Slot */}
              <div className="relative flex-1 max-w-xs">
                <div className={`w-full h-20 rounded-xl border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
                  selectedSoundsLocal.length > 0 
                    ? 'border-purple-400 bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg transform scale-105' 
                    : 'border-purple-300 bg-purple-50 hover:border-purple-400 hover:bg-purple-100'
                }`}>
                  {selectedSoundsLocal.length > 0 ? (
                    <div className="text-center text-white">
                      <div className="text-sm font-bold">
                        {playerSoundSet.find(s => s.id === selectedSoundsLocal[0])?.name || 'Unknown'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-purple-600">
                    </div>
                  )}
                </div>
                {/* Number marker for selected sound */}
                {selectedSoundsLocal.length > 0 && (
                  <div className="absolute -top-2 -left-2 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-purple-600 shadow-md border border-purple-300">
                    1st
                  </div>
                )}
                {selectedSoundsLocal.length > 0 && (
                  <CircularButton
                    icon={isPlaying(selectedSoundsLocal[0], 'selected-sound-1') ? '🔇' : '🔊'}
                    onClick={() => playSoundWithFeedback(selectedSoundsLocal[0], 'selected-sound-1')}
                    disabled={isPlaying(selectedSoundsLocal[0], 'selected-sound-1')}
                    variant="purple"
                    className="absolute -top-2 -right-2 border-2 border-purple-200 shadow-md"
                    title={isPlaying(selectedSoundsLocal[0], 'selected-sound-1') ? 'Playing...' : 'Preview sound'}
                  />
                )}
              </div>

              {/* Sound 2 Slot */}
              <div className="relative flex-1 max-w-xs">
                <div className={`w-full h-20 rounded-xl border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
                  selectedSoundsLocal.length > 1 
                    ? 'border-purple-400 bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg transform scale-105' 
                    : 'border-purple-300 bg-purple-50 hover:border-purple-400 hover:bg-purple-100'
                }`}>
                  {selectedSoundsLocal.length > 1 ? (
                    <div className="text-center text-white">
                      <div className="text-sm font-bold">
                        {playerSoundSet.find(s => s.id === selectedSoundsLocal[1])?.name || 'Unknown'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-purple-600">
                      <div className="text-xs opacity-75 mt-1">(Optional)</div>
                    </div>
                  )}
                </div>
                {/* Number marker for selected sound */}
                {selectedSoundsLocal.length > 1 && (
                  <div className="absolute -top-2 -left-2 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-purple-600 shadow-md border border-purple-300">
                    2nd
                  </div>
                )}
                {selectedSoundsLocal.length > 1 && (
                  <CircularButton
                    icon={isPlaying(selectedSoundsLocal[1], 'selected-sound-2') ? '🔇' : '🔊'}
                    onClick={() => playSoundWithFeedback(selectedSoundsLocal[1], 'selected-sound-2')}
                    disabled={isPlaying(selectedSoundsLocal[1], 'selected-sound-2')}
                    variant="purple"
                    className="absolute -top-2 -right-2 border-2 border-purple-200 shadow-md"
                    title={isPlaying(selectedSoundsLocal[1], 'selected-sound-2') ? 'Playing...' : 'Preview sound'}
                  />
                )}
              </div>

              {/* Sound 3 Slot - Only visible when triple sound is active and positioned chaotically */}
              {player.hasActivatedTripleSound && (
                <div className={`absolute top-2 left-1/2 transform -translate-x-1/2 rotate-12 flex-1 max-w-xs z-10 ${
                  showThirdSoundSlap ? 'animate-bounce' : ''
                }`} style={{
                  animation: showThirdSoundSlap ? 'slap 1s ease-out' : undefined
                }}>
                  <div className={`w-full h-20 rounded-xl border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
                    selectedSoundsLocal.length > 2 
                      ? 'border-pink-400 bg-gradient-to-br from-pink-500 to-red-500 shadow-2xl transform scale-110 shadow-pink-500/50' 
                      : 'border-pink-300 bg-pink-50 hover:border-pink-400 hover:bg-pink-100'
                  }`}>
                    {selectedSoundsLocal.length > 2 ? (
                      <div className="text-center text-white">
                        <div className="text-sm font-bold">
                          {playerSoundSet.find(s => s.id === selectedSoundsLocal[2])?.name || 'Unknown'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-pink-600">
                        <div className="text-xs opacity-75 mt-1">BONUS!</div>
                      </div>
                    )}
                  </div>
                  {/* Number marker for selected sound */}
                  {selectedSoundsLocal.length > 2 && (
                    <div className="absolute -top-2 -left-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg border-2 border-white animate-pulse">
                      ⚡3rd
                    </div>
                  )}
                  {selectedSoundsLocal.length > 2 && (
                    <CircularButton
                      icon={isPlaying(selectedSoundsLocal[2], 'selected-sound-3') ? '🔇' : '🔊'}
                      onClick={() => playSoundWithFeedback(selectedSoundsLocal[2], 'selected-sound-3')}
                      disabled={isPlaying(selectedSoundsLocal[2], 'selected-sound-3')}
                      variant="red"
                      className="absolute -top-2 -right-2 border-2 border-pink-200 shadow-md bg-gradient-to-r from-pink-500 to-red-500"
                      title={isPlaying(selectedSoundsLocal[2], 'selected-sound-3') ? 'Playing...' : 'Preview sound'}
                    />
                  )}
                </div>
              )}
            </div>
          </div>          
          {/* Submit button */}
          <Button 
            onClick={() => {
              // Call the parent's onSubmitSounds but first sync our local selections
              onSelectSounds(selectedSoundsLocal);
              onSubmitSounds();
            }}
            disabled={selectedSoundsLocal.length === 0 || (hasFirstSubmission && timeLeft <= 0)}
            variant="success"
            size="lg"
            className="w-full max-w-md mx-auto shadow-lg"
          >
            {selectedSoundsLocal.length === 0 ? 
              (player.hasActivatedTripleSound ? 'Select 1-3 Sounds' : 'Select 1-2 Sounds') : 
              `Submit ${selectedSoundsLocal.length} Sound${selectedSoundsLocal.length > 1 ? 's' : ''}! 🎵`
            }
          </Button>
        </div>
      )}
    </Card>
    </>
  );
}
