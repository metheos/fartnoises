'use client';

import { useState, useEffect, useRef } from 'react';
import { Room, Player, SoundEffect, GameState } from '@/types/game';
import { audioSystem } from '@/utils/audioSystem';
import { getRandomSounds } from '@/utils/soundLoader';

interface ClientSoundSelectionProps {
  room: Room;
  player: Player;
  selectedSounds: string[] | null;
  onSelectSounds: (sounds: string[]) => void;
  onSubmitSounds: () => void;
  timeLeft: number;
  soundEffects: SoundEffect[];
}

export default function ClientSoundSelection({ 
  room, 
  player, 
  selectedSounds, 
  onSelectSounds, 
  onSubmitSounds, 
  timeLeft, 
  soundEffects 
}: ClientSoundSelectionProps) {
  const isJudge = player.id === room.currentJudge;
  const [selectedSoundsLocal, setSelectedSoundsLocal] = useState<string[]>([]);
  const [playerSoundSet, setPlayerSoundSet] = useState<SoundEffect[]>([]);
  const [lastClearedRound, setLastClearedRound] = useState<number>(-1);
  const [playingSounds, setPlayingSounds] = useState<Set<string>>(new Set());
  const [playingButtons, setPlayingButtons] = useState<Set<string>>(new Set());
  const justClearedRoundRef = useRef<number>(-1);

  // Helper function to play sound with button state management
  const playSoundWithFeedback = async (soundId: string, buttonId?: string) => {
    // If this specific sound is already playing, ignore the click
    if (playingSounds.has(soundId)) {
      console.log(`Sound ${soundId} is already playing, ignoring click`);
      return;
    }

    // If a buttonId is provided and it's already in a playing state, ignore
    if (buttonId && playingButtons.has(buttonId)) {
      console.log(`Button ${buttonId} is already playing, ignoring click`);
      return;
    }

    try {
      // Mark sound and button as playing
      setPlayingSounds(prev => new Set(prev).add(soundId));
      if (buttonId) {
        setPlayingButtons(prev => new Set(prev).add(buttonId));
      }

      // Play the sound and wait for it to finish
      await audioSystem.playSound(soundId);
    } catch (error) {
      console.error(`Error playing sound ${soundId}:`, error);
    } finally {
      // Clean up - remove from playing sets
      setPlayingSounds(prev => {
        const newSet = new Set(prev);
        newSet.delete(soundId);
        return newSet;
      });
      if (buttonId) {
        setPlayingButtons(prev => {
          const newSet = new Set(prev);
          newSet.delete(buttonId);
          return newSet;
        });
      }
    }
  };

  // Helper function to play sound combinations with button state management
  const playSoundCombinationWithFeedback = async (sounds: string[], buttonId: string) => {
    // If this button is already playing, ignore the click
    if (playingButtons.has(buttonId)) {
      console.log(`Button ${buttonId} is already playing combination, ignoring click`);
      return;
    }

    try {
      // Mark button as playing
      setPlayingButtons(prev => new Set(prev).add(buttonId));

      // Play the sound combination and wait for it to finish
      await audioSystem.playSoundsSequentially(sounds);
    } catch (error) {
      console.error(`Error playing sound combination:`, error);
    } finally {
      // Clean up - remove from playing set
      setPlayingButtons(prev => {
        const newSet = new Set(prev);
        newSet.delete(buttonId);
        return newSet;
      });
    }
  };

  // Generate random sound set for this player when component mounts or when entering new round
  useEffect(() => {
    console.log('🎵 SoundSelectionComponent useEffect triggered');
    console.log(`🎵 soundEffects.length: ${soundEffects.length}, gameState: ${room.gameState}, playerSoundSet.length: ${playerSoundSet.length}`);
    console.log(`🎵 player.soundSet:`, player.soundSet);
    console.log(`🎵 player.soundSet length:`, player.soundSet?.length || 0);
    console.log(`🎵 All player properties:`, Object.keys(player));
    
    if (soundEffects.length > 0 && room.gameState === GameState.SOUND_SELECTION) {
      // Check if this is a new round by seeing if we haven't submitted in this round yet
      const hasSubmittedThisRound = room.submissions.some(s => s.playerId === player.id);
      const needsNewSoundSet = playerSoundSet.length === 0;
      
      console.log(`🎵 hasSubmittedThisRound: ${hasSubmittedThisRound}, needsNewSoundSet: ${needsNewSoundSet}, currentRound: ${room.currentRound}, lastClearedRound: ${lastClearedRound}`);
      
      if (needsNewSoundSet) {
        // Priority 1: Use server-provided sound set if available
        if (player.soundSet && player.soundSet.length > 0) {
          const playerSounds = player.soundSet
            .map(soundId => soundEffects.find(s => s.id === soundId))
            .filter(sound => sound !== undefined) as SoundEffect[];
          
          if (playerSounds.length > 0) {
            console.log(`🎵 Using server-provided sound set: ${playerSounds.length} sounds`);
            setPlayerSoundSet(playerSounds);
            return; // Exit early - we have our sounds
          } else {
            console.warn(`🎵 Server-provided sound IDs not found in soundEffects. soundSet: [${player.soundSet.join(', ')}]`);
          }
        } else {
          console.warn(`🎵 No server-provided sound set available. player.soundSet: ${player.soundSet}`);
        }
        
        // Priority 2: Fallback to random generation if server set is not available
        console.warn('🎵 Falling back to random generation');
        const loadRandomSounds = async () => {
          try {
            const randomSounds = await getRandomSounds(10);
            console.log(`🎵 Generated ${randomSounds.length} random sounds`);
            setPlayerSoundSet(randomSounds);
          } catch (error) {
            console.error('Failed to load random sounds:', error);
            const shuffled = [...soundEffects].sort(() => Math.random() - 0.5);
            const fallbackSounds = shuffled.slice(0, Math.min(8, soundEffects.length));
            console.log(`🎵 Using fallback shuffled sounds: ${fallbackSounds.length} sounds`);
            setPlayerSoundSet(fallbackSounds);
          }
        };
        loadRandomSounds();
      } else {
        console.log(`🎵 Sound set already exists (${playerSoundSet.length} sounds), skipping generation`);
      }
    } else {
      console.log(`🎵 Conditions not met for sound set generation. soundEffects: ${soundEffects.length}, gameState: ${room.gameState}`);
    }
  }, [room.gameState, room.currentRound, player.id, player.soundSet, soundEffects.length, playerSoundSet.length]);
  
  // One-time clearing effect for new rounds - only clears once per round
  useEffect(() => {
    if (room.gameState === GameState.SOUND_SELECTION && room.currentRound !== lastClearedRound) {
      const hasSubmittedThisRound = room.submissions.some(s => s.playerId === player.id);
      
      // If we haven't submitted in this round, this is a fresh start - clear local selections ONCE
      if (!hasSubmittedThisRound) {
        console.log(`🎵 NEW ROUND ${room.currentRound} detected - clearing selections (was: local=[${selectedSoundsLocal.join(', ')}], parent=[${selectedSounds?.join(', ') || 'null'}])`);
        justClearedRoundRef.current = room.currentRound; // Set ref IMMEDIATELY to block sync
        setSelectedSoundsLocal([]);
        onSelectSounds([]); // Clear parent state too
        setLastClearedRound(room.currentRound); // Mark this round as cleared
      }
    }
  }, [room.gameState, room.currentRound, room.submissions.length]);
  
  useEffect(() => {
    console.log(`🎵 selectedSounds useEffect: selectedSounds changed to ${selectedSounds ? selectedSounds.join(', ') : 'null'}`);
    
    // Only sync with parent selectedSounds if:
    // 1. We don't have any local selections yet
    // 2. We haven't just cleared this round (check both ref and state)
    // 3. Parent actually has selections to sync with
    const justClearedThisRound = justClearedRoundRef.current === room.currentRound || lastClearedRound === room.currentRound;
    
    if (selectedSounds && selectedSounds.length > 0 && selectedSoundsLocal.length === 0 && !justClearedThisRound) {
      console.log(`🎵 Syncing with parent selectedSounds (local is empty): [${selectedSounds.join(', ')}]`);
      setSelectedSoundsLocal([...selectedSounds]);
    } else if (selectedSounds && justClearedThisRound) {
      console.log(`🎵 Ignoring parent selectedSounds - we just cleared this round: [${selectedSounds.join(', ')}]`);
    } else if (selectedSounds) {
      console.log(`🎵 Parent selectedSounds changed but keeping local selections: [${selectedSoundsLocal.join(', ')}]`);
    } else {
      console.log(`🎵 Parent selectedSounds is null, keeping local selections: [${selectedSoundsLocal.join(', ')}]`);
    }
  }, [selectedSounds, selectedSoundsLocal.length, room.currentRound, lastClearedRound]);

  const handleSoundSelect = (soundId: string) => {
    const currentIndex = selectedSoundsLocal.indexOf(soundId);
    let newSelectedSounds: string[];
    
    if (currentIndex !== -1) {
      // Sound is already selected, remove it
      newSelectedSounds = selectedSoundsLocal.filter(id => id !== soundId);
    } else {
      // Sound is not selected, add it
      if (selectedSoundsLocal.length < 2) {
        // Add to existing selection (max 2 sounds)
        newSelectedSounds = [...selectedSoundsLocal, soundId];
      } else {
        // Replace the first sound if we already have 2
        newSelectedSounds = [soundId, selectedSoundsLocal[1]];
      }
    }
    
    console.log(`🎵 Player ${player.name} selecting sound: ${soundId}, new local selection: [${newSelectedSounds.join(', ')}]`);
    setSelectedSoundsLocal(newSelectedSounds);
    onSelectSounds(newSelectedSounds);
  };

  const getSoundButtonStyle = (soundId: string) => {
    const index = selectedSoundsLocal.indexOf(soundId);
    if (index !== -1) {
      return 'bg-gradient-to-br from-purple-500 to-purple-600 text-white border-purple-700 shadow-lg transform scale-105';
    } else {
      return 'bg-gradient-to-br from-purple-100 to-pink-100 text-gray-800 border-purple-200 hover:from-purple-200 hover:to-pink-200 hover:scale-102';
    }
  };

  if (isJudge) {
    return (
      <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
        <p className="text-2xl font-bold text-purple-600 mb-4">Players are choosing sounds...</p>
        <div className="bg-purple-100 rounded-2xl p-6 mb-6">
          <p className="text-lg text-gray-800 font-bold" dangerouslySetInnerHTML={{ __html: room.currentPrompt?.text || '' }}></p>
        </div>
            </div>
          );
        }
        const hasSubmitted = room.submissions.some(s => s.playerId === player.id);
        const submission = hasSubmitted ? room.submissions.find(s => s.playerId === player.id) : null;
        const hasFirstSubmission = room.submissions.length > 0;

        return (
          <div className="bg-white rounded-3xl p-4 shadow-lg text-center">
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
                  <button
                    onClick={() => playSoundWithFeedback(soundId, `submission-preview-${index}`)}
                    disabled={playingSounds.has(soundId) || playingButtons.has(`submission-preview-${index}`)}
                    className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all border-2 border-gray-200 ${
                      playingSounds.has(soundId) || playingButtons.has(`submission-preview-${index}`)
                        ? 'bg-gray-300 cursor-not-allowed scale-95' 
                        : 'bg-white hover:shadow-lg hover:scale-110'
                    }`}
                    title={playingSounds.has(soundId) || playingButtons.has(`submission-preview-${index}`) ? 'Playing...' : 'Preview sound'}
                  >
                    <span className={`text-sm ${
                      playingSounds.has(soundId) || playingButtons.has(`submission-preview-${index}`)
                        ? 'text-gray-500' 
                        : 'text-gray-600'
                    }`}>
                      {playingSounds.has(soundId) || playingButtons.has(`submission-preview-${index}`) ? '🔇' : '🔊'}
                    </span>
                  </button>
                </div>
              ))}
            </div>

            {/* Preview combo button */}
            <div className="mt-6">
              <button
                onClick={() => playSoundCombinationWithFeedback(submission.sounds, 'submission-combo')}
                disabled={playingButtons.has('submission-combo')}
                className={`px-6 py-3 rounded-xl font-bold transition-all shadow-lg transform ${
                  playingButtons.has('submission-combo')
                    ? 'bg-gray-400 cursor-not-allowed scale-95 shadow-md'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 hover:shadow-xl hover:scale-105'
                }`}
              >
                {playingButtons.has('submission-combo') ? '🔇 Playing...' : '🎹 Play Your Sounds'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sound Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
            {playerSoundSet.map((sound) => (
              <div key={sound.id} className="relative">
                <button
                  onClick={() => handleSoundSelect(sound.id)}
                  className={`w-full p-4 border-2 rounded-xl font-semibold transition-all duration-200 min-h-[80px] ${getSoundButtonStyle(sound.id)}`}
                >
                  <div className="text-center">
                    <div className="text-sm font-bold mb-1">{sound.name}</div>
                    {selectedSoundsLocal.includes(sound.id) && (
                      <div className="text-xs opacity-90">
                      </div>
                    )}
                  </div>
                </button>
                
                {/* Selection order marker */}
                {selectedSoundsLocal.includes(sound.id) && (
                  <div className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-purple-600 shadow-md border border-purple-300 z-10">
                    {selectedSoundsLocal.indexOf(sound.id) === 0 ? '1st' : '2nd'}
                  </div>
                )}
                
                {/* Preview button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSoundWithFeedback(sound.id, `grid-preview-${sound.id}`);
                  }}
                  disabled={playingSounds.has(sound.id) || playingButtons.has(`grid-preview-${sound.id}`)}
                  className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all shadow-sm ${
                    playingSounds.has(sound.id) || playingButtons.has(`grid-preview-${sound.id}`)
                      ? 'bg-gray-300 bg-opacity-90 cursor-not-allowed'
                      : 'bg-white bg-opacity-90 hover:bg-opacity-100'
                  }`}
                  title={playingSounds.has(sound.id) || playingButtons.has(`grid-preview-${sound.id}`) ? 'Playing...' : 'Preview sound'}
                >
                  {playingSounds.has(sound.id) || playingButtons.has(`grid-preview-${sound.id}`) ? '🔇' : '🔊'}
                </button>
              </div>
            ))}
          </div>

          {/* Selected sounds display */}
          <div className="bg-gradient-to-br from-purple-300 to-pink-300 rounded-2xl p-3 max-w-2xl mx-auto border border-purple-100 shadow-lg">
            <div className="flex items-center justify-center gap-3 mb-4">
              <h3 className="text-xl font-bold text-gray-800">Your Sounds</h3>
            </div>
            
            <div className="flex flex-row items-center justify-center gap-6">
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
                  <button
                    onClick={() => playSoundWithFeedback(selectedSoundsLocal[0], 'selected-sound-1')}
                    disabled={playingSounds.has(selectedSoundsLocal[0]) || playingButtons.has('selected-sound-1')}
                    className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all border-2 border-purple-200 ${
                      playingSounds.has(selectedSoundsLocal[0]) || playingButtons.has('selected-sound-1')
                        ? 'bg-gray-300 cursor-not-allowed scale-95'
                        : 'bg-white hover:shadow-lg hover:scale-110'
                    }`}
                    title={playingSounds.has(selectedSoundsLocal[0]) || playingButtons.has('selected-sound-1') ? 'Playing...' : 'Preview sound'}
                  >
                    <span className={`text-sm ${
                      playingSounds.has(selectedSoundsLocal[0]) || playingButtons.has('selected-sound-1')
                        ? 'text-gray-500'
                        : 'text-purple-600'
                    }`}>
                      {playingSounds.has(selectedSoundsLocal[0]) || playingButtons.has('selected-sound-1') ? '🔇' : '🔊'}
                    </span>
                  </button>
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
                  <button
                    onClick={() => playSoundWithFeedback(selectedSoundsLocal[1], 'selected-sound-2')}
                    disabled={playingSounds.has(selectedSoundsLocal[1]) || playingButtons.has('selected-sound-2')}
                    className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all border-2 border-purple-200 ${
                      playingSounds.has(selectedSoundsLocal[1]) || playingButtons.has('selected-sound-2')
                        ? 'bg-gray-300 cursor-not-allowed scale-95'
                        : 'bg-white hover:shadow-lg hover:scale-110'
                    }`}
                    title={playingSounds.has(selectedSoundsLocal[1]) || playingButtons.has('selected-sound-2') ? 'Playing...' : 'Preview sound'}
                  >
                    <span className={`text-sm ${
                      playingSounds.has(selectedSoundsLocal[1]) || playingButtons.has('selected-sound-2')
                        ? 'text-gray-500'
                        : 'text-purple-600'
                    }`}>
                      {playingSounds.has(selectedSoundsLocal[1]) || playingButtons.has('selected-sound-2') ? '🔇' : '🔊'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>          
          {/* Submit button */}
          <button 
            onClick={() => {
              // Call the parent's onSubmitSounds but first sync our local selections
              onSelectSounds(selectedSoundsLocal);
              onSubmitSounds();
            }}
            disabled={selectedSoundsLocal.length === 0 || (hasFirstSubmission && timeLeft <= 0)}
            className="w-full max-w-md mx-auto bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-xl font-bold hover:from-green-600 hover:to-green-700 transition-all text-lg disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg"
          >
            {selectedSoundsLocal.length === 0 ? 'Select 1-2 Sounds' : `Submit ${selectedSoundsLocal.length} Sound${selectedSoundsLocal.length > 1 ? 's' : ''}! 🎵`}
          </button>
        </div>
      )}
    </div>
  );
}
