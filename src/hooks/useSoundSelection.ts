import { useState, useEffect, useRef, useCallback } from "react";
import { Room, Player, SoundEffect, GameState } from "@/types/game";
import { getRandomSounds } from "@/utils/soundLoader";

interface UseSoundSelectionOptions {
  room: Room;
  player: Player;
  soundEffects: SoundEffect[];
  selectedSounds: string[] | null;
  onSelectSounds: (sounds: string[]) => void;
}

interface UseSoundSelectionReturn {
  selectedSoundsLocal: string[];
  playerSoundSet: SoundEffect[];
  handleSoundSelect: (soundId: string) => void;
  hasSubmitted: boolean;
  submission: { sounds: string[]; playerId: string; playerName: string } | null;
}

/**
 * Custom hook to manage sound selection logic for players.
 * Handles local sound state, sound set generation, and selection logic.
 */
export function useSoundSelection({
  room,
  player,
  soundEffects,
  selectedSounds,
  onSelectSounds,
}: UseSoundSelectionOptions): UseSoundSelectionReturn {
  const [selectedSoundsLocal, setSelectedSoundsLocal] = useState<string[]>([]);
  const [playerSoundSet, setPlayerSoundSet] = useState<SoundEffect[]>([]);
  const [lastClearedRound, setLastClearedRound] = useState<number>(-1);
  const justClearedRoundRef = useRef<number>(-1);

  // Generate random sound set for this player when component mounts or when entering new round
  useEffect(() => {
    console.log("🎵 useSoundSelection useEffect triggered");
    console.log(
      `🎵 soundEffects.length: ${soundEffects.length}, gameState: ${room.gameState}, playerSoundSet.length: ${playerSoundSet.length}`
    );

    if (
      soundEffects.length > 0 &&
      room.gameState === GameState.SOUND_SELECTION
    ) {
      // Check if this is a new round by seeing if we haven't submitted in this round yet
      const hasSubmittedThisRound = room.submissions.some(
        (s) => s.playerId === player.id
      );
      const needsNewSoundSet = playerSoundSet.length === 0;

      console.log(
        `🎵 hasSubmittedThisRound: ${hasSubmittedThisRound}, needsNewSoundSet: ${needsNewSoundSet}, currentRound: ${room.currentRound}, lastClearedRound: ${lastClearedRound}`
      );

      // Priority 1: Always check for server-provided sound set first (handles refresh)
      if (player.soundSet && player.soundSet.length > 0) {
        // Check if the server sound set is different from what we currently have
        const currentSoundIds = playerSoundSet.map((s) => s.id).sort();
        const serverSoundIds = [...player.soundSet].sort();
        const soundSetChanged =
          currentSoundIds.length !== serverSoundIds.length ||
          currentSoundIds.some((id, index) => id !== serverSoundIds[index]);

        if (needsNewSoundSet || soundSetChanged) {
          const playerSounds = player.soundSet
            .map((soundId) => soundEffects.find((s) => s.id === soundId))
            .filter((sound) => sound !== undefined) as SoundEffect[];

          if (playerSounds.length > 0) {
            console.log(
              `🎵 Using server-provided sound set: ${playerSounds.length} sounds (changed: ${soundSetChanged})`
            );
            setPlayerSoundSet(playerSounds);
            return; // Exit early - we have our sounds
          } else {
            console.warn(
              `🎵 Server-provided sound IDs not found in soundEffects. soundSet: [${player.soundSet.join(
                ", "
              )}]`
            );
          }
        } else {
          // Sound set hasn't changed, no need to update
          return;
        }
      }

      // Priority 2: Generate new sound set only if we don't have one
      if (needsNewSoundSet) {
        console.log("🎵 Falling back to random generation");
        const loadRandomSounds = async () => {
          try {
            const randomSounds = await getRandomSounds(10);
            console.log(`🎵 Generated ${randomSounds.length} random sounds`);
            setPlayerSoundSet(randomSounds);
          } catch (error) {
            console.error("Failed to load random sounds:", error);
            const shuffled = [...soundEffects].sort(() => Math.random() - 0.5);
            const fallbackSounds = shuffled.slice(
              0,
              Math.min(8, soundEffects.length)
            );
            console.log(
              `🎵 Using fallback shuffled sounds: ${fallbackSounds.length} sounds`
            );
            setPlayerSoundSet(fallbackSounds);
          }
        };
        loadRandomSounds();
      }
    }
    // Complex dependency management for sound set generation - intentionally simplified deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    room.gameState,
    room.currentRound,
    player.id,
    player.soundSet,
    soundEffects.length,
    playerSoundSet.length,
  ]);

  // One-time clearing effect for new rounds - only clears once per round
  useEffect(() => {
    if (
      room.gameState === GameState.SOUND_SELECTION &&
      room.currentRound !== lastClearedRound
    ) {
      const hasSubmittedThisRound = room.submissions.some(
        (s) => s.playerId === player.id
      );

      // If we haven't submitted in this round, this is a fresh start - clear local selections ONCE
      if (!hasSubmittedThisRound) {
        console.log(
          `🎵 NEW ROUND ${
            room.currentRound
          } detected - clearing selections (was: local=[${selectedSoundsLocal.join(
            ", "
          )}], parent=[${selectedSounds?.join(", ") || "null"}])`
        );
        justClearedRoundRef.current = room.currentRound; // Set ref IMMEDIATELY to block sync
        setSelectedSoundsLocal([]);
        onSelectSounds([]); // Clear parent state too
        setLastClearedRound(room.currentRound); // Mark this round as cleared
      }
    }
    // Complex dependency management for round clearing logic - intentionally simplified deps to avoid clearing loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.gameState, room.currentRound, room.submissions.length]);

  // Sync with parent selectedSounds
  useEffect(() => {
    console.log(
      `🎵 selectedSounds useEffect: selectedSounds changed to ${
        selectedSounds ? selectedSounds.join(", ") : "null"
      }`
    );

    // Only sync with parent selectedSounds if:
    // 1. We don't have any local selections yet
    // 2. We haven't just cleared this round (check both ref and state)
    // 3. Parent actually has selections to sync with
    const justClearedThisRound =
      justClearedRoundRef.current === room.currentRound ||
      lastClearedRound === room.currentRound;

    if (
      selectedSounds &&
      selectedSounds.length > 0 &&
      selectedSoundsLocal.length === 0 &&
      !justClearedThisRound
    ) {
      console.log(
        `🎵 Syncing with parent selectedSounds (local is empty): [${selectedSounds.join(
          ", "
        )}]`
      );
      setSelectedSoundsLocal([...selectedSounds]);
    } else if (selectedSounds && justClearedThisRound) {
      console.log(
        `🎵 Ignoring parent selectedSounds - we just cleared this round: [${selectedSounds.join(
          ", "
        )}]`
      );
    } else if (selectedSounds) {
      console.log(
        `🎵 Parent selectedSounds changed but keeping local selections: [${selectedSoundsLocal.join(
          ", "
        )}]`
      );
    } else {
      console.log(
        `🎵 Parent selectedSounds is null, keeping local selections: [${selectedSoundsLocal.join(
          ", "
        )}]`
      );
    }
    // Complex dependency management for sound selection sync - intentionally simplified deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedSounds,
    selectedSoundsLocal.length,
    room.currentRound,
    lastClearedRound,
  ]);

  // Handle sound selection logic
  const handleSoundSelect = useCallback(
    (soundId: string) => {
      const currentIndex = selectedSoundsLocal.indexOf(soundId);
      let newSelectedSounds: string[];

      if (currentIndex !== -1) {
        // Sound is already selected, remove it
        newSelectedSounds = selectedSoundsLocal.filter((id) => id !== soundId);
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

      console.log(
        `🎵 Player ${
          player.name
        } selecting sound: ${soundId}, new local selection: [${newSelectedSounds.join(
          ", "
        )}]`
      );
      setSelectedSoundsLocal(newSelectedSounds);
      onSelectSounds(newSelectedSounds);
    },
    [selectedSoundsLocal, player.name, onSelectSounds]
  );

  // Check submission status
  const hasSubmitted = room.submissions.some((s) => s.playerId === player.id);
  const submission = hasSubmitted
    ? room.submissions.find((s) => s.playerId === player.id)
    : null;

  return {
    selectedSoundsLocal,
    playerSoundSet,
    handleSoundSelect,
    hasSubmitted,
    submission: submission || null,
  };
}
