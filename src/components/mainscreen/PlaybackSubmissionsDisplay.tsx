'use client';

import { useEffect, useRef, useState } from 'react';
import { Room, SoundEffect, SoundSubmission } from '@/types/game';
import { Socket } from 'socket.io-client';
import { audioSystem } from '@/utils/audioSystem';
import { JudgePromptDisplay } from '../shared/JudgePromptDisplay';
import { SubmissionCard } from './SubmissionCard';

interface PlaybackSubmissionsDisplayProps {
  room: Room;
  soundEffects: SoundEffect[];
  socket: Socket | null;
}

export function PlaybackSubmissionsDisplay({ 
  room, 
  soundEffects,
  socket
}: PlaybackSubmissionsDisplayProps) {
  const [currentPlayingSubmission, setCurrentPlayingSubmission] = useState<SoundSubmission | null>(null);
  const [currentPlayingSoundIndex, setCurrentPlayingSoundIndex] = useState(-1);
  const [revealedSounds, setRevealedSounds] = useState<Set<string>>(new Set());
  
  const promptAudioPlayingRef = useRef(false);
  const playbackStartedRef = useRef<string | false>(false);

  const judge = room.players.find(p => p.id === room.currentJudge);

  // Start sequence when the component mounts (when the game enters PLAYBACK state)
  useEffect(() => {
    if (!socket || !room.currentPrompt || soundEffects.length === 0) return;
    
    // Prevent multiple starts of the same playback sequence
    const sequenceKey = `${room.code}-${room.currentPrompt.id}`;
    if (playbackStartedRef.current === sequenceKey) {
      console.log('🎵 Playback sequence already started for this prompt, skipping');
      return;
    }

    console.log('🎵 Playback sequence starting!');
    playbackStartedRef.current = sequenceKey;
    
    // Reset state for new playback sequence
    setCurrentPlayingSubmission(null);
    setCurrentPlayingSoundIndex(-1);
    setRevealedSounds(new Set());

    const startSequence = async () => {
      // 1. Play the prompt audio first (if there is one)
      if (room.currentPrompt?.audioFile) {
        promptAudioPlayingRef.current = true;
        console.log('Playing prompt audio:', room.currentPrompt.audioFile);
        try {
          // Use the correct method that loads from the prompt audio path
          await audioSystem.loadAndPlayPromptAudio(room.currentPrompt.audioFile);
          console.log('Prompt audio finished playing');
        } catch (error) {
          console.error('Error playing prompt audio:', error);
        }
        promptAudioPlayingRef.current = false;
        // Add a small delay after prompt for pacing
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 2. Request the first submission from the server to begin the loop
      console.log('Prompt playback finished, requesting first submission.');
      socket.emit('requestNextSubmission', { roomCode: room.code });
    };

    startSequence();
    
  // Complex dependency management for playback sequence - intentionally simplified deps to avoid restart loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, room.code, room.currentPrompt?.id, soundEffects.length]); // Only run when these dependencies change

  // Reset the playback started flag when the prompt changes (new round)
  useEffect(() => {
    if (room.currentPrompt?.id) {
      const sequenceKey = `${room.code}-${room.currentPrompt.id}`;
      if (playbackStartedRef.current !== sequenceKey) {
        playbackStartedRef.current = false;
      }
    }
  }, [room.currentPrompt?.id, room.code]);


  // This effect handles playing each submission when the server sends it.
  useEffect(() => {
    if (!socket) return;    
    const handlePlaySubmission = async (submission: SoundSubmission | null) => {
      // A null submission from the server indicates the end of playback.
      if (!submission) {
        console.log('Received null submission, playback is complete.');
        setCurrentPlayingSubmission(null);
        setCurrentPlayingSoundIndex(-1);
        // The server will now transition the game to the JUDGING state.
        // No further action is needed on the client side here.
        return;
      }

      console.log('Main screen received playSubmission event:', submission);
      setCurrentPlayingSubmission(submission);
      setCurrentPlayingSoundIndex(-1); // Reset to -1 before starting

      try {
        // Play the two sounds for this submission sequentially with sound index tracking.
        const sounds = submission.sounds;        
        for (let i = 0; i < sounds.length; i++) {
          console.log(`Playing sound ${i + 1} of ${sounds.length}: ${sounds[i]}`);
          setCurrentPlayingSoundIndex(i);
          
          // Play this individual sound using our enhanced AudioSystem
          const soundId = sounds[i];
          try {
            await audioSystem.playSound(soundId);
            console.log(`Sound ${i + 1} finished playing`);
            // Add this sound to the revealed set so it stays visible
            setRevealedSounds(prev => new Set(prev).add(sounds[i]));
          } catch (error) {
            console.error(`Error playing sound ${soundId}:`, error);
          }
          
          // Small pause between sounds within the same submission
          if (i < sounds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      } catch (error) {
        console.error('Error playing submission sounds:', error);
      }      
      
      // Reset sound index but keep submission active until next one starts
      setCurrentPlayingSoundIndex(-1); // Reset when submission is done
      // Don't clear currentPlayingSubmission or isPlaying yet - keep for waveform animation
      
      // Add a delay between submissions for better pacing
      console.log('Playback finished for submission, waiting before requesting next.');
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
      
      // Clear playing state only right before requesting next submission
      setCurrentPlayingSubmission(null);
      console.log('Requesting next submission after delay.');
      socket.emit('requestNextSubmission', { roomCode: room.code });
    };

    socket.on('playSubmission', handlePlaySubmission);
    
    // Debug: Log when this effect runs
    console.log('🔧 Main screen: Setting up playback event handlers. Sound effects loaded:', soundEffects.length);

    return () => {
      socket.off('playSubmission', handlePlaySubmission);
    };
  }, [socket, room.code, soundEffects]);
  
  // This effect handles cleanup on unmount
  useEffect(() => {
    return () => {
      // When the component unmounts (e.g., game state changes), stop any active sounds.
      // But only if we're not currently playing the prompt audio
      if (!promptAudioPlayingRef.current) {
        console.log('Playback display unmounting. Stopping all sounds.');
        audioSystem.stopAllSounds();
      } else {
        console.log('Playback display unmounting, but prompt audio is playing. Not stopping sounds.');
      }
    };
  }, []); // Empty dependency array ensures this runs only on unmount

  const submissions = room.randomizedSubmissions || room.submissions; // Use randomized order if available

  return (
    <div className="bg-white rounded-3xl p-3 shadow-2xl transition-all duration-300 min-h-[75vh]">
      
      
      {/* Judge and Prompt Display - Side by Side */}
      {room.currentPrompt && judge && (
        <JudgePromptDisplay 
          judge={judge} 
          prompt={room.currentPrompt} 
          showPrompt={true}
        />
      )}

      {/* Timer Display */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 rounded-full h-3 mx-auto">
          <div className="h-3 rounded-full transition-all duration-1000 bg-white" style={{ width: '100%' }}></div>
        </div>
      </div>

      <div className="flex justify-center gap-8">
        {submissions.map((submission, index) => {
          const isCurrentlyPlaying = currentPlayingSubmission?.playerId === submission.playerId;

          return (
            <SubmissionCard
              key={index}
              submission={submission}
              index={index}
              soundEffects={soundEffects}
              isCurrentlyPlaying={isCurrentlyPlaying}
              currentPlayingSoundIndex={currentPlayingSoundIndex}
              revealedSounds={revealedSounds}
              showSoundNames={false}
              playingMode="playback"
            />
          );
        })}
      </div>
    </div>
  );
}
