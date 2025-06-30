'use client';

import { useState } from 'react';
import { Room, Player, SoundEffect } from '@/types/game';
import { WaveformAnimation } from '@/components/shared/WaveformAnimation';
import { getPlayerColorClass } from '@/utils/gameUtils';
import { Card, Button, PlayerAvatar, SoundCard } from '@/components/ui';
import { audioSystem } from '@/utils/audioSystem';

interface ClientResultsProps {
  room: Room;
  player: Player;
  roundWinner: { 
    winnerId: string; 
    winnerName: string; 
    winningSubmission: { sounds: string[]; playerId: string; playerName: string }; 
    submissionIndex: number 
  } | null;
  soundEffects: SoundEffect[];
}

export default function ClientResults({ 
  room, 
  roundWinner, 
  soundEffects 
}: ClientResultsProps) {
  const [isPlayingWinner, setIsPlayingWinner] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const playWinningCombination = async () => {
    if (!roundWinner?.winningSubmission || isPlayingWinner) return;
    
    setIsPlayingWinner(true);
    setPlaybackProgress(0);
    
    try {
      // Initialize audio system if needed
      await audioSystem.initialize();
      
      // Get the sound IDs for the winning combination
      const sounds = roundWinner.winningSubmission.sounds;
      
      // Preload all sounds first to ensure they're available
      await audioSystem.preloadSounds(sounds);
      
      // Play sounds sequentially with progress updates
      const totalSounds = sounds.length;
      
      for (let i = 0; i < sounds.length; i++) {
        const soundId = sounds[i];
        
        // Update progress at the start of each sound
        setPlaybackProgress(i / totalSounds);
        
        // Play the sound using the audio system (this connects to the analyser)
        await audioSystem.playSound(soundId);
        
        // Brief pause between sounds
        if (i < sounds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Update progress after the sound completes
        setPlaybackProgress((i + 1) / totalSounds);
      }
      
      // Finished playing all sounds
      setIsPlayingWinner(false);
      setPlaybackProgress(0);
      
    } catch (error) {
      console.error('Error playing winning combination:', error);
      setIsPlayingWinner(false);
      setPlaybackProgress(0);
    }
  };

  if (!roundWinner) {
    return (
      <Card className="text-center">
        <h2 className="text-2xl font-bold text-purple-600 mb-4">Round Results</h2>
        <p className="text-gray-800">Waiting for results...</p>
      </Card>
    );
  }
  
  const winnerPlayerDetails = room.players.find(p => p.id === roundWinner.winnerId);

  return (
    <Card className="text-center">
      
      {/* Winner Announcement */}
      <div className="relative bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl p-8 mb-8 shadow-2xl transform transition-all duration-500 hover:scale-105">
        {/* Decorative elements */}
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-white opacity-10 rounded-full animate-pulse"></div>
        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white opacity-10 rounded-full animate-pulse delay-500"></div>

        <div className="relative z-10 text-center text-white">
          <h2 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">Round Winner!</h2>
          <p className="text-5xl font-black mb-3 drop-shadow-lg">
        {roundWinner.winnerName} 🏆
          </p>
          <div className={`inline-block px-4 py-1 rounded-full mb-4 ${winnerPlayerDetails ? getPlayerColorClass(winnerPlayerDetails.color) : 'bg-white bg-opacity-20'}`}>
        <p className="text-lg font-semibold text-white">
          +1 Point!
        </p>
          </div>
          <p className="text-md italic opacity-90 max-w-md mx-auto">
        For their take on: &quot;<span dangerouslySetInnerHTML={{ __html: room.currentPrompt?.text || '' }}/>&quot;
          </p>
        </div>
      </div>

      {/* Winning Sound Combination Card */}
      {roundWinner.winningSubmission && (
        <div className="mb-6">
          {/* <h3 className="text-xl font-bold text-gray-800 mb-4">🎵 Winning Combination 🎵</h3> */}
          
          <div className={`relative rounded-3xl p-6 transition-all duration-500 max-w-sm mx-auto ${
            isPlayingWinner 
              ? 'bg-gradient-to-br from-purple-400 to-pink-500 scale-105 shadow-2xl transform -rotate-1' 
              : 'bg-gradient-to-br from-yellow-200 to-yellow-300 hover:scale-102'
          }`}>
            
            {/* Progress Indicator */}
            {isPlayingWinner && (
              <div className="absolute -top-2 -right-2 w-12 h-12">
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
            {isPlayingWinner && (
              <>
                <div className="absolute inset-0 rounded-3xl bg-white opacity-20 animate-pulse"></div>
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-purple-400 to-pink-500 opacity-75 blur animate-pulse"></div>
              </>
            )}

            <div className="relative z-10">
              <div className="space-y-3">
                {roundWinner.winningSubmission.sounds.map((soundId: string, index: number) => {
                  const sound = soundEffects.find(s => s.id === soundId);
                  return (
                    <div 
                      key={index} 
                      className={`px-4 py-3 rounded-xl transition-all duration-300 ${
                        isPlayingWinner 
                          ? 'bg-white bg-opacity-90 text-gray-800 shadow-lg' 
                          : 'bg-white text-gray-800 shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-lg">🔊</span>
                        <span className="font-bold">{sound?.name || soundId}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Waveform Animation for Playing */}
              <WaveformAnimation 
                isPlaying={isPlayingWinner}
                color="bg-white"
                size="sm"
              />

              {/* Play Button */}
              <div className="mt-0 text-center">
                <Button
                  onClick={playWinningCombination}
                  disabled={isPlayingWinner}
                  variant={isPlayingWinner ? "secondary" : "gradient"}
                  size="md"
                  className="shadow-lg"
                >
                  {isPlayingWinner ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                      <span>PLAYING</span>
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>▶️</span>
                      <span>Play Winning Sounds</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Scores List */}
      <div className="mt-8 bg-gray-50 rounded-3xl p-6 max-w-lg mx-auto shadow-inner">
        <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Current Standings</h3>
        <ul className="space-y-3">
          {room.players
        .sort((a, b) => b.score - a.score)
        .map((p) => {
          const isRoundWinner = p.id === roundWinner.winnerId;
          
          return (
            <li 
          key={p.id} 
          className={`flex items-center p-3 rounded-2xl shadow-sm transition-all duration-300 ${isRoundWinner ? 'bg-green-100 border-2 border-green-400 scale-105' : 'bg-white'}`}
            >
          <PlayerAvatar 
            player={p}
            size="md"
            className="mr-3"
            showName={false}
          />
          <div className="flex-grow">
            <p className="font-bold text-gray-900 text-lg">{p.name}</p>
          </div>
          {isRoundWinner && (
            <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse z-10">
              +1
            </div>
          )}
          <div className="text-right">
            <p className="font-black text-xl text-purple-600">{p.score}</p>
            <p className="text-xs text-gray-500 uppercase">Points</p>
          </div>
            </li>
          );
        })}
        </ul>
      </div>
      {/* Next round / game over will be handled by gameState change */}
    </Card>
  );
}
