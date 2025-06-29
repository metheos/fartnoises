// Sound submission and playback event handlers for the fartnoises game server
import { Socket } from "socket.io";
import { GameState } from "@/types/game";
import { SocketContext } from "../types/socketTypes";
import {
  startDelayedSoundSelectionTimer,
  handleAllSubmissionsComplete,
} from "../utils/gameLogic";

export function setupSubmissionHandlers(
  socket: Socket,
  context: SocketContext
) {
  // Submit sounds handler
  socket.on("submitSounds", (sounds) => {
    try {
      const roomCode = context.playerRooms.get(socket.id);
      if (!roomCode) return;

      const room = context.rooms.get(roomCode);
      if (!room || room.gameState !== GameState.SOUND_SELECTION) return;

      const player = room.players.find((p) => p.id === socket.id);
      if (!player || socket.id === room.currentJudge) return;

      // Validate that sounds array has 1-2 valid sound IDs
      if (!Array.isArray(sounds) || sounds.length < 1 || sounds.length > 2) {
        console.warn(
          `[SUBMISSION] Invalid sounds array from ${player.name}: ${sounds}`
        );
        return;
      }

      // Filter out empty strings and ensure we have valid sound IDs
      const validSounds = sounds.filter(
        (soundId) =>
          soundId && typeof soundId === "string" && soundId.trim() !== ""
      );
      if (validSounds.length < 1 || validSounds.length > 2) {
        console.warn(
          `[SUBMISSION] No valid sounds from ${player.name}: ${sounds}`
        );
        return;
      }

      // Check if player already submitted
      const existingSubmission = room.submissions.find(
        (s) => s.playerId === socket.id
      );
      if (existingSubmission) return;

      const submission = {
        playerId: socket.id,
        playerName: player.name,
        sounds: validSounds,
      };

      console.log(
        `[SUBMISSION] ${player.name} submitted ${
          validSounds.length
        } sound(s): [${validSounds.join(", ")}]`
      );

      room.submissions.push(submission);
      context.io.to(roomCode).emit("soundSubmitted", submission);

      // Check if this is the first submission and start the timer
      if (room.submissions.length === 1 && !room.soundSelectionTimerStarted) {
        console.log(
          `[${new Date().toISOString()}] [SUBMISSION] First player submitted for room ${roomCode}, starting countdown timer`
        );
        startDelayedSoundSelectionTimer(context, roomCode, room);
      }

      // Send updated room state to all clients (including main screen viewers)
      context.io.to(roomCode).emit("roomUpdated", room);

      // Check if all non-judge players have submitted
      const nonJudgePlayers = room.players.filter(
        (p) => p.id !== room.currentJudge
      );
      if (room.submissions.length === nonJudgePlayers.length) {
        handleAllSubmissionsComplete(context, roomCode, room);
      }
    } catch (error) {
      console.error("Error submitting sounds:", error);
    }
  });

  // Request next submission handler (for main screen playback control)
  socket.on("requestNextSubmission", () => {
    const roomCode = context.playerRooms.get(socket.id);
    if (!roomCode) return;

    // Security: Only the primary main screen should control playback
    // Socket augmentation for custom properties - proper interface extension would require module declaration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(socket as any).isViewer) {
      console.log(
        `[SECURITY] Player socket ${socket.id} attempted to control playback. Ignoring.`
      );
      return;
    }

    if (context.primaryMainScreens.get(roomCode) !== socket.id) {
      console.log(
        `[SECURITY] Secondary main screen ${
          socket.id
        } attempted to control playback for room ${roomCode}. Only primary main screen ${context.primaryMainScreens.get(
          roomCode
        )} can control playback. Ignoring.`
      );
      return;
    }

    const room = context.rooms.get(roomCode);
    if (!room || room.gameState !== GameState.PLAYBACK) return;

    const index = room.currentSubmissionIndex || 0;
    const submissionsToPlay = room.randomizedSubmissions || room.submissions; // Use randomized if available

    if (index < submissionsToPlay.length) {
      console.log(
        `[PLAYBACK] Primary main screen ${
          socket.id
        } playing randomized submission ${index + 1} of ${
          submissionsToPlay.length
        } for room ${roomCode} (Player: ${submissionsToPlay[index].playerName})`
      );
      context.io
        .to(roomCode)
        .emit("playSubmission", submissionsToPlay[index], index);
      room.currentSubmissionIndex = index + 1;
    } else {
      // All submissions played, add a delay before moving to judging
      console.log(
        `[PLAYBACK] All randomized submissions played for room ${roomCode}, adding delay before transitioning to JUDGING`
      );

      // Add a 2-second delay to let the final submission "breathe" before judging
      setTimeout(() => {
        console.log(
          `[PLAYBACK] Delay complete, now transitioning room ${roomCode} to JUDGING`
        );
        room.gameState = GameState.JUDGING;
        room.isPlayingBack = false; // Reset playback flag
        room.currentSubmissionIndex = 0; // Reset for next round

        context.io.to(roomCode).emit("gameStateChanged", GameState.JUDGING, {
          submissions: room.submissions, // Send original submissions
          randomizedSubmissions: room.randomizedSubmissions || room.submissions, // Send randomized submissions separately
          judgeId: room.currentJudge,
        });
        context.io.to(roomCode).emit("roomUpdated", room);
      }, 2500); // 2.5 second delay
    }
  });

  // Select winner handler
  socket.on("selectWinner", (submissionIndex) => {
    try {
      const roomCode = context.playerRooms.get(socket.id);
      if (!roomCode) return;

      const room = context.rooms.get(roomCode);
      if (
        !room ||
        room.currentJudge !== socket.id ||
        room.gameState !== GameState.JUDGING
      )
        return;

      // Use randomized submissions for winner selection
      const submissionsToUse = room.randomizedSubmissions || room.submissions;
      const winningSubmission = submissionsToUse[parseInt(submissionIndex)];
      if (!winningSubmission) return;

      const winner = room.players.find(
        (p) => p.id === winningSubmission.playerId
      );
      if (!winner) return;

      winner.score += 1;
      room.gameState = GameState.ROUND_RESULTS;

      // Store winner information in room for persistence during reconnections
      room.lastWinner = winner.id;
      room.lastWinningSubmission = winningSubmission;

      // Send comprehensive winner information to all clients
      context.io.to(roomCode).emit("roundComplete", {
        winnerId: winner.id,
        winnerName: winner.name,
        winningSubmission: winningSubmission,
        submissionIndex: parseInt(submissionIndex),
      });
      context.io.to(roomCode).emit("roomUpdated", room);

      // Check if there are main screens to handle audio playback
      const roomMainScreens = context.mainScreens.get(roomCode);
      const hasMainScreensConnected = roomMainScreens
        ? roomMainScreens.size > 0
        : false;
      if (!hasMainScreensConnected) {
        // No main screens - skip audio playback and proceed immediately
        console.log(
          `No main screens connected. Proceeding directly to next round/game end check...`
        );

        // Simulate winnerAudioComplete logic inline
        setTimeout(() => {
          handleNoMainScreenWinnerFlow(context, roomCode, room);
        }, 2000); // 2 second pause to show results
      } else {
        // Main screens present - wait for winnerAudioComplete signal
        console.log(
          `Main screens connected. Round results displayed, waiting for client audio completion before checking game end...`
        );
        // The next round (or game end) will be triggered when client emits 'winnerAudioComplete'
      }
    } catch (error) {
      console.error("Error selecting winner:", error);
    }
  });

  // Handle judging playback requests - route to main screen if available
  socket.on(
    "requestJudgingPlayback",
    (data: { submissionIndex: number; sounds: string[] }) => {
      try {
        const roomCode = context.playerRooms.get(socket.id);
        if (!roomCode) {
          socket.emit("judgingPlaybackResponse", {
            success: false,
            submissionIndex: data.submissionIndex,
          });
          return;
        }

        const room = context.rooms.get(roomCode);
        if (!room || room.gameState !== GameState.JUDGING) {
          socket.emit("judgingPlaybackResponse", {
            success: false,
            submissionIndex: data.submissionIndex,
          });
          return;
        }

        // Only allow the judge to request playback
        if (room.currentJudge !== socket.id) {
          console.log(
            `[JUDGING PLAYBACK] Non-judge ${socket.id} attempted to request playback. Ignoring.`
          );
          socket.emit("judgingPlaybackResponse", {
            success: false,
            submissionIndex: data.submissionIndex,
          });
          return;
        }

        console.log(
          `[JUDGING PLAYBACK] Judge requesting playback for submission ${data.submissionIndex} in room ${roomCode}`
        );

        // Check if we have main screens connected
        const roomMainScreens = context.mainScreens.get(roomCode);
        const hasMainScreensConnected = roomMainScreens
          ? roomMainScreens.size > 0
          : false;
        if (hasMainScreensConnected) {
          console.log(
            `[JUDGING PLAYBACK] Main screens available, routing to main screen`
          );

          // Get the submission data from the room to send to main screen
          const submissionsToShow =
            room.randomizedSubmissions || room.submissions;
          const submission = submissionsToShow[data.submissionIndex];
          if (submission) {
            // Emit the playJudgingSubmission event to main screens only
            // Get all main screen socket IDs for this room
            const roomMainScreens = context.mainScreens.get(roomCode);
            if (roomMainScreens) {
              roomMainScreens.forEach((mainScreenSocketId) => {
                const mainScreenSocket =
                  context.io.sockets.sockets.get(mainScreenSocketId);
                if (mainScreenSocket) {
                  console.log(
                    `[JUDGING PLAYBACK] Sending submission to main screen ${mainScreenSocketId}`
                  );
                  console.log(`[JUDGING PLAYBACK] Submission data:`, {
                    playerName: submission.playerName,
                    sounds: submission.sounds,
                  });
                  mainScreenSocket.emit(
                    "playJudgingSubmission",
                    submission,
                    data.submissionIndex
                  );
                }
              });
            }

            // Respond to judge that main screen playback was initiated
            socket.emit("judgingPlaybackResponse", {
              success: true,
              submissionIndex: data.submissionIndex,
            });
          } else {
            console.log(
              `[JUDGING PLAYBACK] Submission ${data.submissionIndex} not found`
            );
            socket.emit("judgingPlaybackResponse", {
              success: false,
              submissionIndex: data.submissionIndex,
            });
          }
        } else {
          console.log(
            `[JUDGING PLAYBACK] No main screens connected, requesting local fallback`
          );
          // No main screens available, tell judge to play locally
          socket.emit("judgingPlaybackResponse", {
            success: false,
            submissionIndex: data.submissionIndex,
          });
        }
      } catch (error) {
        console.error("Error handling judging playback request:", error);
        socket.emit("judgingPlaybackResponse", {
          success: false,
          submissionIndex: data.submissionIndex,
        });
      }
    }
  );
}

// Helper function to handle winner flow when no main screens are connected
function handleNoMainScreenWinnerFlow(
  context: SocketContext,
  roomCode: string,
  room: import("@/types/game").Room
) {
  if (room.gameState !== GameState.ROUND_RESULTS) return;

  // Check if the game should end before starting next round
  const maxScore = Math.max(...room.players.map((p) => p.score));
  const gameWinners = room.players.filter((p) => p.score === maxScore);
  const isEndOfRounds = room.currentRound >= room.maxRounds;
  const isScoreLimitReached = maxScore >= room.maxScore;
  const isTie = gameWinners.length > 1;

  console.log(
    `🏁 No-main-screen game completion check: currentRound=${room.currentRound}, maxRounds=${room.maxRounds}, maxScore=${maxScore}, scoreThreshold=${room.maxScore}, isTie=${isTie}`
  );

  // Game ends if end condition is met AND there is a single winner.
  if ((isEndOfRounds || isScoreLimitReached) && !isTie) {
    console.log(
      `🎉 Game ending (no main screen): Round ${room.currentRound}/${room.maxRounds} or score ${maxScore} reached threshold with a single winner.`
    );

    room.gameState = GameState.GAME_OVER;
    room.winner = gameWinners[0].id;
    context.io.to(roomCode).emit("roomUpdated", room);
    context.io.to(roomCode).emit("gameStateChanged", GameState.GAME_OVER, {
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
    return; // Exit early - don't start next round
  } else if ((isEndOfRounds || isScoreLimitReached) && isTie) {
    console.log(
      `👔 Tie detected at game end (no main screen). Entering sudden death. Players: ${gameWinners
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

  // Start next round logic would go here - this could be extracted to gameHandlers
  // For now, we'll leave this as a placeholder since it's complex
  console.log(
    `Starting next round ${room.currentRound + 1} (no main screen)...`
  );
  // TODO: Move next round logic to gameHandlers module
}
