'use client';

import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Room, Player, SoundEffect, GameState } from '@/types/game';
import { GAME_CONFIG } from '@/data/gameData';
import { audioSystem } from '@/utils/audioSystem';
import { Card, Button, SoundCard, CircularButton } from '@/components/ui';
import { JudgePromptDisplay } from '../shared/JudgePromptDisplay';
import GameTimer from '../mainscreen/GameTimer';
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
  socket: Socket | null; // Add socket prop
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
  soundEffects,
  socket 
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
        
        <JudgePromptDisplay 
          judge={undefined}
          showJudge={false}
          prompt={room.currentPrompt || undefined}
          showPrompt={true}
          size="small"
        />
        <p className="text-xl font-bold text-purple-600 mb-4">Players are choosing sounds...</p>
      </Card>
    );
  }
  
  const hasFirstSubmission = room.submissions.length > 0;

  return (
    <>
      <style jsx>{`
        @keyframes slap {
          0% { transform: translateY(-60px) rotate(45deg) scale(0.5); opacity: 0; }
          20% { transform: translateY(10px) rotate(25deg) scale(1.2); opacity: 1; }
          40% { transform: translateY(-5px) rotate(8deg) scale(1.1); }
          60% { transform: translateY(2px) rotate(15deg) scale(1.05); }
          80% { transform: translateY(-1px) rotate(10deg) scale(1.02); }
          100% { transform: translateY(0px) rotate(12deg) scale(1); }
        }
      `}</style>
      <Card className="text-center">
        <JudgePromptDisplay 
          judge={undefined}
          showJudge={false}
          prompt={room.currentPrompt || undefined}
          showPrompt={true}
          size="small"
        />
        {hasSubmitted && submission ? (
        <div className="text-center">
          {/* Enhanced submission display */}
          <div className="bg-gradient-to-br from-green-50 via-white to-emerald-50 rounded-2xl p-6 max-w-2xl mx-auto border border-green-200 shadow-lg">
            <div className="flex items-center justify-center gap-3 mb-4">
              <h4 className="text-xl font-bold text-gray-800">Your Sounds</h4>
            </div>
            
            <div className="flex flex-row items-center justify-center gap-4 relative">
              {submission.sounds.slice(0, 2).map((soundId, index) => (
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
                    {index + 1}
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

              {/* Third sound slot - positioned chaotically like in the selection view */}
              {submission.sounds.length > 2 && (
                <div className={`absolute top-2 left-1/2 transform -translate-x-1/2 rotate-12 w-40 z-10 ${
                  showThirdSoundSlap ? 'animate-bounce' : ''
                }`} style={{
                  animation: showThirdSoundSlap ? 'slap 1s ease-out' : undefined
                }}>
                  <div className="w-40 h-20 rounded-xl flex items-center justify-center shadow-2xl transform scale-110 transition-all duration-300 bg-gradient-to-br from-pink-500 to-red-500 border-2 border-pink-300 shadow-pink-500/50">
                    <div className="text-center text-white">
                      <div className="text-sm font-bold">
                        {soundEffects.find(s => s.id === submission.sounds[2])?.name || 'Sound 3'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Special number marker for third sound */}
                  <div className="absolute -top-2 -left-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg border-2 border-white animate-pulse">
                    ⚡3
                  </div>
                  
                  {/* Preview button */}
                  <CircularButton
                    icon={isPlaying(submission.sounds[2], `submission-preview-2`) ? '🔇' : '🔊'}
                    onClick={() => playSoundWithFeedback(submission.sounds[2], `submission-preview-2`)}
                    disabled={isPlaying(submission.sounds[2], `submission-preview-2`)}
                    variant="red"
                    className="absolute -top-2 -right-2 border-2 border-pink-200 shadow-md bg-gradient-to-r from-pink-500 to-red-500"
                    title={isPlaying(submission.sounds[2], `submission-preview-2`) ? 'Playing...' : 'Preview sound'}
                  />
                </div>
              )}
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
          {/* Power-up buttons - shiny and attractive */}
          <div className="flex gap-4 justify-center mb-4">
            {!player.hasUsedRefresh && (
              <div className="flex-1 max-w-[120px]">
                <Button
                  onClick={onRefreshSounds}
                  variant="secondary"
                  size="sm"
                  className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-white text-xs px-1 py-2 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border-2 border-purple-500/30"
                >
                  🔄 New Sounds
                </Button>
              </div>
            )}
            
            {!player.hasUsedTripleSound && !player.hasActivatedTripleSound && (
              <div className="flex-1 max-w-[120px]">
                <Button
                  onClick={onActivateTripleSound}
                  variant="secondary"
                  size="sm"
                  className="w-full bg-gradient-to-r from-purple-400 to-pink-500 hover:from-purple-500 hover:to-pink-600 text-white text-xs px-1 py-2 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border-2 border-purple-500/30"
                >
                  🎵×3 Triple
                </Button>
              </div>
            )}
            
          {player.hasActivatedTripleSound && (
          <div className="flex-1 max-w-[120px]">
              <span className="flex items-center justify-center w-full h-full text-xs text-white bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 rounded-full font-bold shadow-md animate-pulse">
                ⚡ ×3 Active
              </span>
          </div>
          )}
          </div>


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
                className=""
              />
            ))}
          </div>
            
        {/* Timer Display - Only show after first submission */}
        {hasFirstSubmission && (
          <GameTimer 
            maxTime={GAME_CONFIG.SOUND_SELECTION_TIME}
            socket={socket}
            className="mb-4"
          />
        )}

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
                      <div className="text-xs font-bold">
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
                    1
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
                      <div className="text-xs font-bold">
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
                    2
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
                <div className={`absolute top-2 left-1/2 -translate-x-1/2 w-40 z-10 ${
                  showThirdSoundSlap ? '' : 'rotate-12'
                }`} style={{
                  animation: showThirdSoundSlap ? 'slap 1s ease-out' : undefined
                }}>
                  <div className={`w-full h-20 rounded-xl border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
                    selectedSoundsLocal.length > 2 
                      ? 'border-pink-400 bg-gradient-to-br from-pink-500 to-red-500 shadow-2xl transform scale-110 shadow-pink-500/50' 
                      : 'border-pink-300 bg-pink-50/30 hover:border-pink-400 hover:bg-pink-100/50'
                  }`}>
                    {selectedSoundsLocal.length > 2 ? (
                      <div className="text-center text-white">
                        <div className="text-xs font-bold">
                          {playerSoundSet.find(s => s.id === selectedSoundsLocal[2])?.name || 'Unknown'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-pink-600/70">
                        <div className="text-xs mt-1">⚡⚡⚡</div>
                      </div>
                    )}
                  </div>
                  {/* Number marker for selected sound */}
                  {selectedSoundsLocal.length > 2 && (
                    <div className="absolute -top-2 -left-2 w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-md font-bold text-white shadow-lg border-2 border-white">
                      3
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
              `Submit ${selectedSoundsLocal.length} Sound${selectedSoundsLocal.length > 1 ? 's' : ''}!`
            }
          </Button>
        </div>
      )}
    </Card>
    </>
  );
}
