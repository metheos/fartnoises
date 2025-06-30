// Core game flow event handlers for the fartnoises game server
import { Socket } from "socket.io";
import { GameState, GamePrompt } from "@/types/game";
import { GAME_CONFIG, getGamePrompts } from "@/data/gameData";
import { getRandomPrompts } from "@/utils/soundLoader";
import { SocketContext } from "../types/socketTypes";
import { selectNextJudge, processAndAssignPrompt } from "../utils/roomManager";
import { startTimer, clearTimer } from "../utils/timerManager";
import { generatePlayerSoundSets } from "../utils/gameLogic";

export function setupGameHandlers(socket: Socket, context: SocketContext) {
  // Start game handler
  socket.on("startGame", async () => {
    try {
      const roomCode = context.playerRooms.get(socket.id);
      if (!roomCode) return;

      const room = context.rooms.get(roomCode);
      if (!room) return;

      const player = room.players.find((p) => p.id === socket.id);
      if (!player?.isVIP) return;
      if (room.players.length < GAME_CONFIG.MIN_PLAYERS) {
        socket.emit("error", {
          message: `Need at least ${GAME_CONFIG.MIN_PLAYERS} players to start`,
        });
        return;
      }

      room.gameState = GameState.JUDGE_SELECTION;
      room.currentJudge = selectNextJudge(room);
      room.currentRound = 1;
      room.judgeSelectionTimerStarted = false;

      // Reset hasUsedRefresh and hasUsedTripleSound for all players at the start of a new game
      room.players.forEach((player) => {
        player.hasUsedRefresh = false;
        player.hasUsedTripleSound = false;
      });

      context.io.to(roomCode).emit("roomUpdated", room);
      context.io.to(roomCode).emit("judgeSelected", room.currentJudge);
      context.io
        .to(roomCode)
        .emit("gameStateChanged", GameState.JUDGE_SELECTION, {
          judgeId: room.currentJudge,
        });

      // Auto-transition to prompt selection after a delay
      room.judgeSelectionTimerStarted = true;
      setTimeout(async () => {
        if (room.gameState === GameState.JUDGE_SELECTION) {
          room.judgeSelectionTimerStarted = false;
          room.gameState = GameState.PROMPT_SELECTION;
          console.log(
            "Generating prompts for players:",
            room.players.map((p) => p.name)
          );
          const prompts = await getRandomPrompts(
            6,
            room.usedPromptIds || [],
            room.players.map((p) => p.name),
            room.allowExplicitContent
          );
          console.log(
            "Generated prompts:",
            prompts.map((p: GamePrompt) => ({ id: p.id, text: p.text }))
          );
          room.availablePrompts = prompts;

          context.io
            .to(roomCode)
            .emit("gameStateChanged", GameState.PROMPT_SELECTION, {
              prompts,
              judgeId: room.currentJudge,
              timeLimit: GAME_CONFIG.PROMPT_SELECTION_TIME,
            });

          // Start countdown timer for prompt selection
          startTimer(
            context,
            roomCode,
            GAME_CONFIG.PROMPT_SELECTION_TIME,
            async () => {
              // Auto-select first prompt if no selection made
              if (room.gameState === GameState.PROMPT_SELECTION) {
                clearTimer(context, roomCode);

                const firstPrompt = prompts[0];
                processAndAssignPrompt(room, firstPrompt);

                // Track this prompt as used to avoid repeating in future rounds
                if (!room.usedPromptIds) {
                  room.usedPromptIds = [];
                }
                room.usedPromptIds.push(firstPrompt.id);

                room.gameState = GameState.SOUND_SELECTION;
                room.submissions = [];
                room.randomizedSubmissions = [];
                room.submissionSeed = undefined;
                room.soundSelectionTimerStarted = false;

                // Generate individual random sound sets for each non-judge player
                await generatePlayerSoundSets(room);

                context.io.to(roomCode).emit("roomUpdated", room);
                context.io.to(roomCode).emit("promptSelected", firstPrompt);
                context.io
                  .to(roomCode)
                  .emit("gameStateChanged", GameState.SOUND_SELECTION, {
                    prompt: firstPrompt,
                    timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
                  });

                // Note: Sound selection timer will start when first player submits
                console.log(
                  `[TIMER] Transitioned to sound selection, waiting for first submission to start timer`
                );
              }
            },
            (timeLeft) => {
              console.log(
                `[TIMER] Sending timeUpdate for prompt selection: ${timeLeft}s remaining in room ${roomCode}, game state: ${room.gameState}`
              );
              // Only send timeUpdate if we're still in prompt selection
              if (room.gameState === GameState.PROMPT_SELECTION) {
                context.io.to(roomCode).emit("timeUpdate", { timeLeft });
              } else {
                console.log(
                  `[TIMER] Suppressing timeUpdate for prompt selection: game state is now ${room.gameState}`
                );
              }
            }
          );
        }
      }, 3000);
    } catch (error) {
      console.error("Error starting game:", error);
    }
  });

  // Restart game handler - keeps all players connected and resets game state
  socket.on("restartGame", async () => {
    try {
      const roomCode = context.playerRooms.get(socket.id);
      if (!roomCode) return;

      const room = context.rooms.get(roomCode);
      if (!room) return;

      const player = room.players.find((p) => p.id === socket.id);
      if (!player?.isVIP) {
        socket.emit("error", {
          message: "Only the host can restart the game",
        });
        return;
      }

      if (room.gameState !== GameState.GAME_OVER) {
        socket.emit("error", {
          message: "Game can only be restarted when game is over",
        });
        return;
      }

      if (room.players.length < GAME_CONFIG.MIN_PLAYERS) {
        socket.emit("error", {
          message: `Need at least ${GAME_CONFIG.MIN_PLAYERS} players to restart the game`,
        });
        return;
      }

      console.log(
        `Host ${player.name} is restarting game in room ${roomCode} with ${room.players.length} players`
      );

      // Reset game state but keep all players and their connections
      room.gameState = GameState.LOBBY;
      room.currentRound = 0;
      room.currentJudge = null;
      room.currentPrompt = null;
      room.submissions = [];
      room.randomizedSubmissions = [];
      room.submissionSeed = undefined;
      room.promptChoices = [];
      room.usedPromptIds = [];
      room.winner = null;
      room.lastWinner = null;
      room.lastWinningSubmission = null;
      room.soundSelectionTimerStarted = false;
      room.judgeSelectionTimerStarted = false;
      room.currentSubmissionIndex = undefined;
      room.isPlayingBack = false;

      // Reset all player scores and game-specific flags but keep their basic info and connections
      room.players.forEach((p) => {
        p.score = 0;
        p.likeScore = 0;
        p.hasUsedRefresh = false;
        p.hasUsedTripleSound = false;
        p.hasActivatedTripleSound = false;
        p.soundSet = undefined;
      });

      // Clear any active timers
      clearTimer(context, roomCode);

      // Emit updated room state to all players
      context.io.to(roomCode).emit("roomUpdated", room);
      context.io.to(roomCode).emit("gameStateChanged", GameState.LOBBY);

      console.log(
        `Game restarted successfully in room ${roomCode}. All players returned to lobby.`
      );
    } catch (error) {
      console.error("Error restarting game:", error);
      socket.emit("error", { message: "Failed to restart game" });
    }
  });

  // Select prompt handler
  socket.on("selectPrompt", async (promptId) => {
    console.log(
      `🎯 SERVER: selectPrompt received from ${socket.id} with promptId: ${promptId}`
    );
    try {
      const roomCode = context.playerRooms.get(socket.id);
      console.log(`🎯 SERVER: Player room lookup - roomCode: ${roomCode}`);
      if (!roomCode) {
        console.log(`🎯 SERVER: No room found for socket ${socket.id}`);
        return;
      }

      const room = context.rooms.get(roomCode);
      console.log(`🎯 SERVER: Room lookup - room exists: ${!!room}`);
      if (!room) {
        console.log(`🎯 SERVER: Room ${roomCode} not found`);
        return;
      }

      console.log(
        `🎯 SERVER: Current judge: ${room.currentJudge}, Socket ID: ${
          socket.id
        }, Match: ${room.currentJudge === socket.id}`
      );
      if (room.currentJudge !== socket.id) {
        console.log(
          `🎯 SERVER: Judge validation failed - current judge: ${room.currentJudge}, socket: ${socket.id}`
        );
        return;
      }

      // Use available prompts from room if they exist, otherwise load dynamically
      let prompt;
      if (room.availablePrompts) {
        prompt = room.availablePrompts.find((p) => p.id === promptId);
      } else {
        const allPrompts = await getGamePrompts(
          room.players.map((p) => p.name)
        );
        prompt = allPrompts.find((p) => p.id === promptId);
      }

      console.log(
        `🎯 SERVER: Prompt lookup - found: ${!!prompt}, promptId: ${promptId}`
      );
      if (!prompt) {
        console.log(`🎯 SERVER: Prompt ${promptId} not found`);
        return;
      }

      // Clear the prompt selection timer since judge made a manual selection
      clearTimer(context, roomCode);
      console.log(
        `🎯 SERVER: All validations passed, updating room state to SOUND_SELECTION`
      );
      processAndAssignPrompt(room, prompt);

      // Track this prompt as used to avoid repeating in future rounds
      if (!room.usedPromptIds) {
        room.usedPromptIds = [];
      }
      room.usedPromptIds.push(prompt.id);

      room.gameState = GameState.SOUND_SELECTION;
      room.submissions = [];
      room.randomizedSubmissions = [];
      room.submissionSeed = undefined;
      room.soundSelectionTimerStarted = false;

      // Generate individual random sound sets for each non-judge player
      await generatePlayerSoundSets(room);

      console.log(`🎯 SERVER: Emitting room updates for ${roomCode}`);
      context.io.to(roomCode).emit("roomUpdated", room);
      context.io.to(roomCode).emit("promptSelected", prompt);
      context.io
        .to(roomCode)
        .emit("gameStateChanged", GameState.SOUND_SELECTION, {
          prompt: prompt,
          timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
          currentRound: room.currentRound,
        });

      // Note: Sound selection timer will start when first player submits
      console.log(
        `[${new Date().toISOString()}] [TIMER] Judge selected prompt, transitioned to sound selection, waiting for first submission to start timer`
      );

      console.log(`🎯 SERVER: selectPrompt completed successfully`);
    } catch (error) {
      console.error("🎯 SERVER: Error selecting prompt:", error);
    }
  });

  // Winner audio complete handler - triggers next round
  socket.on("winnerAudioComplete", () => {
    try {
      const roomCode = context.playerRooms.get(socket.id);
      if (!roomCode) return;

      // Only accept winner audio completion from primary main screen or if no main screens exist
      if (
        // Socket augmentation for custom properties - proper interface extension would require module declaration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (socket as any).isViewer &&
        context.primaryMainScreens.get(roomCode) !== socket.id
      ) {
        console.log(
          `[SECURITY] Secondary main screen ${
            socket.id
          } attempted to signal winner audio complete for room ${roomCode}. Only primary main screen ${context.primaryMainScreens.get(
            roomCode
          )} can do this. Ignoring.`
        );
        return;
      }

      const room = context.rooms.get(roomCode);
      if (!room || room.gameState !== GameState.ROUND_RESULTS) return;

      console.log(
        `Winner audio complete from ${
          // Socket augmentation for custom properties - proper interface extension would require module declaration
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (socket as any).isViewer ? "primary main screen" : "player"
        } ${socket.id}, checking if game should continue...`
      );

      // Check if the game should end before starting next round
      const maxScore = Math.max(...room.players.map((p) => p.score));
      const gameWinners = room.players.filter((p) => p.score === maxScore);
      const isEndOfRounds = room.currentRound >= room.maxRounds;
      const isScoreLimitReached = maxScore >= room.maxScore;
      const isTie = gameWinners.length > 1;

      console.log(
        `🏁 Post-audio game completion check: currentRound=${room.currentRound}, maxRounds=${room.maxRounds}, maxScore=${maxScore}, scoreThreshold=${room.maxScore}, isTie=${isTie}`
      );

      // Game ends if end condition is met AND there is a single winner.
      if ((isEndOfRounds || isScoreLimitReached) && !isTie) {
        console.log(
          `🎉 Game ending after winner audio: Round ${room.currentRound}/${room.maxRounds} or score ${maxScore} reached threshold with a single winner. Waiting 3 seconds before showing game over screen...`
        );

        // Add 3-second delay before transitioning to game over screen
        setTimeout(() => {
          room.gameState = GameState.GAME_OVER;
          room.winner = gameWinners[0].id;
          context.io.to(roomCode).emit("roomUpdated", room);
          context.io
            .to(roomCode)
            .emit("gameStateChanged", GameState.GAME_OVER, {
              winner: gameWinners[0],
              finalScores: room.players.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score,
              })),
            });
          context.io
            .to(roomCode)
            .emit("gameComplete", gameWinners[0].id, gameWinners[0].name);
        }, 3000); // 3 second delay for celebration
        return; // Exit early - don't start next round
      } else if ((isEndOfRounds || isScoreLimitReached) && isTie) {
        console.log(
          `👔 Tie detected at game end (post-audio). Entering sudden death. Players: ${gameWinners
            .map((p) => p.name)
            .join(", ")}`
        );
        context.io.to(roomCode).emit("tieBreakerRound", {
          tiedPlayers: gameWinners.map((p) => ({
            id: p.id,
            name: p.name,
          })),
        });
        // Continue to next round for tie-breaker
      }

      // Start next round after a brief pause (only if game didn't end)
      setTimeout(() => {
        startNextRound(context, roomCode);
      }, 2000); // 2 second pause after audio completes
    } catch (error) {
      console.error("Error processing winner audio completion:", error);
    }
  });
}

// Helper function to start the next round - exported for use in other handlers
export async function startNextRound(context: SocketContext, roomCode: string) {
  const room = context.rooms.get(roomCode);
  if (!room) return;

  console.log(
    `Starting next round ${
      room.currentRound + 1
    } after winner audio completion...`
  );
  room.currentRound += 1;
  room.currentJudge = selectNextJudge(room);
  room.gameState = GameState.JUDGE_SELECTION;
  room.currentPrompt = null;
  room.submissions = [];
  room.randomizedSubmissions = [];
  room.submissionSeed = undefined;
  room.soundSelectionTimerStarted = false;
  room.judgeSelectionTimerStarted = false;

  // Clear activated triple sound flags for the new round (but keep hasUsedTripleSound)
  room.players.forEach((player) => {
    player.hasActivatedTripleSound = false;
  });

  // Clear previous round winner information
  room.lastWinner = null;
  room.lastWinningSubmission = null;

  context.io.to(roomCode).emit("judgeSelected", room.currentJudge);
  context.io.to(roomCode).emit("gameStateChanged", GameState.JUDGE_SELECTION, {
    judgeId: room.currentJudge,
  });

  // Auto-transition to prompt selection
  room.judgeSelectionTimerStarted = true;
  setTimeout(async () => {
    if (room.gameState === GameState.JUDGE_SELECTION) {
      room.judgeSelectionTimerStarted = false;
      room.gameState = GameState.PROMPT_SELECTION;
      console.log(
        "Generating prompts for players:",
        room.players.map((p) => p.name)
      );
      const prompts = await getRandomPrompts(
        6,
        room.usedPromptIds || [],
        room.players.map((p) => p.name),
        room.allowExplicitContent
      );
      console.log(
        "Generated prompts:",
        prompts.map((p: GamePrompt) => ({ id: p.id, text: p.text }))
      );
      room.availablePrompts = prompts;

      context.io
        .to(roomCode)
        .emit("gameStateChanged", GameState.PROMPT_SELECTION, {
          prompts,
          judgeId: room.currentJudge,
          timeLimit: GAME_CONFIG.PROMPT_SELECTION_TIME,
        });

      // Start countdown timer for prompt selection
      startTimer(
        context,
        roomCode,
        GAME_CONFIG.PROMPT_SELECTION_TIME,
        async () => {
          // Auto-select first prompt if no selection made
          if (room.gameState === GameState.PROMPT_SELECTION) {
            const firstPrompt = prompts[0];
            processAndAssignPrompt(room, firstPrompt);

            // Track this prompt as used to avoid repeating in future rounds
            if (!room.usedPromptIds) {
              room.usedPromptIds = [];
            }
            room.usedPromptIds.push(firstPrompt.id);

            room.gameState = GameState.SOUND_SELECTION;
            room.submissions = [];
            room.randomizedSubmissions = [];
            room.submissionSeed = undefined;
            room.soundSelectionTimerStarted = false;

            // Generate individual random sound sets for each non-judge player
            await generatePlayerSoundSets(room);

            context.io.to(roomCode).emit("roomUpdated", room);
            context.io.to(roomCode).emit("promptSelected", firstPrompt);
            context.io
              .to(roomCode)
              .emit("gameStateChanged", GameState.SOUND_SELECTION, {
                prompt: firstPrompt,
                promptAudio: firstPrompt.audioFile, // Include audio file for main screen
                timeLimit: GAME_CONFIG.SOUND_SELECTION_TIME,
              });

            console.log(
              `[TIMER] Transitioned to sound selection (post-audio), waiting for first submission to start timer`
            );
          }
        },
        (timeLeft) => {
          if (room.gameState === GameState.PROMPT_SELECTION) {
            context.io.to(roomCode).emit("timeUpdate", { timeLeft });
          }
        }
      );
    }
  }, 3000);
}
