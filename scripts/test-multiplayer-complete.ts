import { io, Socket } from "socket.io-client";
import {
  Room,
  Player,
  GameState,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../src/types/game";

const SERVER_URL = "http://localhost:3000";
const NUM_PLAYERS = 4; // Use 4 players for faster testing
const PLAYER_NAMES = ["TestBot1", "TestBot2", "TestBot3", "TestBot4"];

let roomCodeGlobal: string | null = null;
let hostSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null =
  null;
let currentRoom: Room | null = null;
let availablePrompts: any[] = [];
let availableSounds: string[] = [
  "fart1",
  "fart2",
  "burp",
  "goat",
  "duck",
  "laser",
  "robot",
];
let gameStartTime: number = 0;
let roundResults: { round: number; winner: string; prompt: string }[] = [];
let gameComplete = false;

function createPlayer(index: number) {
  const playerName = PLAYER_NAMES[index] || `TestBot${index + 1}`;
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    SERVER_URL,
    {
      path: "/api/socket",
      transports: ["polling", "websocket"],
      reconnectionAttempts: 3,
      timeout: 10000,
    }
  );

  socket.on("connect", () => {
    console.log(`🔌 Player ${playerName} (ID: ${socket.id}) connected.`);

    if (index === 0) {
      // First player creates the room
      hostSocket = socket;
      socket.emit("createRoom", playerName, (roomCode) => {
        console.log(`🏠 Player ${playerName} created room: ${roomCode}`);
        roomCodeGlobal = roomCode;
      });
    } else {
      // Other players join the room
      if (roomCodeGlobal) {
        socket.emit("joinRoom", roomCodeGlobal, playerName, (success, room) => {
          if (success && room) {
            console.log(
              `👥 Player ${playerName} joined room: ${roomCodeGlobal}. Players: ${room.players
                .map((p) => p.name)
                .join(", ")}`
            );
          } else {
            console.error(
              `❌ Player ${playerName} failed to join room: ${roomCodeGlobal}`
            );
          }
        });
      } else {
        console.warn(`⏳ Player ${playerName} waiting for room code...`);
        // Retry mechanism
        setTimeout(() => {
          if (roomCodeGlobal) {
            socket.emit(
              "joinRoom",
              roomCodeGlobal,
              playerName,
              (success, room) => {
                if (success && room) {
                  console.log(
                    `👥 Player ${playerName} (retry) joined room: ${roomCodeGlobal}. Players: ${room.players.length}`
                  );
                } else {
                  console.error(
                    `❌ Player ${playerName} (retry) failed to join room: ${roomCodeGlobal}`
                  );
                }
              }
            );
          }
        }, 2000);
      }
    }
  });

  socket.on("roomCreated", ({ room, player }) => {
    console.log(
      `🎉 [${playerName}] Room created - Code: ${room.code}, Host: ${player.name}`
    );
    if (player.id === socket.id) {
      console.log(`👑 [${playerName}] I am the host of room ${room.code}.`);
    }
  });

  socket.on("roomJoined", ({ room, player }) => {
    console.log(
      `🚪 [${playerName}] Player joined - ${player.name} joined room ${room.code}`
    );
    if (player.id === socket.id) {
      console.log(`✅ [${playerName}] I have joined room ${room.code}.`);
    }
  });

  socket.on("roomUpdated", (room) => {
    console.log(
      `📊 [${playerName}] Room updated - Players: [${room.players
        .map((p) => p.name)
        .join(", ")}], State: ${room.gameState}`
    );
    currentRoom = room;

    // If enough players and this is the host, start the game
    if (
      room.players.length >= NUM_PLAYERS &&
      socket.id === hostSocket?.id &&
      room.gameState === GameState.LOBBY
    ) {
      console.log(
        `🎮 [${playerName}] Enough players (${room.players.length}). Host is starting the game...`
      );
      socket.emit("startGame");
    }
  });

  socket.on("playerJoined", ({ room }) => {
    console.log(
      `👤 [${playerName}] Player joined event - Room now has: ${room.players
        .map((p) => p.name)
        .join(", ")}`
    );
  });
  socket.on("gameStateChanged", (newState, data) => {
    console.log(`🎯 [${playerName}] Game State: ${newState}`);
    if (data) {
      console.log(`📋 [${playerName}] State Data:`, data);
    }

    // Track game start time
    if (newState === GameState.JUDGE_SELECTION && gameStartTime === 0) {
      gameStartTime = Date.now();
      console.log(`🎮 [${playerName}] Game started! Recording start time...`);
    }

    // Handle different game states with bot logic
    switch (newState) {
      case GameState.JUDGE_SELECTION:
        if (data?.judgeId === socket.id) {
          console.log(`⚖️ [${playerName}] I have been selected as the judge!`);
        } else {
          console.log(`👀 [${playerName}] Waiting for judge selection...`);
        }
        break;
      case GameState.PROMPT_SELECTION:
        // If this player is the judge and prompts are available, select one
        if (data?.judgeId === socket.id && data?.prompts) {
          availablePrompts = Array.isArray(data.prompts) ? data.prompts : [];
          console.log(
            `🧠 [${playerName}] I'm the judge! Available prompts: ${availablePrompts.length}`
          );
          availablePrompts.forEach((prompt: any, i: number) => {
            console.log(`   ${i + 1}. "${prompt.text}"`);
          });

          // Randomly select a prompt after a short delay
          setTimeout(() => {
            if (availablePrompts.length > 0) {
              const randomPrompt =
                availablePrompts[
                  Math.floor(Math.random() * availablePrompts.length)
                ];
              console.log(
                `✨ [${playerName}] Judge selecting prompt: "${randomPrompt.text}"`
              );
              socket.emit("selectPrompt", randomPrompt.id);
            }
          }, 1500 + Math.random() * 1500); // 1.5-3 second delay
        } else if (!data?.judgeId || data.judgeId !== socket.id) {
          console.log(
            `⏳ [${playerName}] Waiting for judge to select a prompt...`
          );
        }
        break;
      case GameState.SOUND_SELECTION:
        // If this player is NOT the judge, select sounds
        if (data?.judgeId !== socket.id) {
          console.log(
            `🔊 [${playerName}] Time to select sounds for the prompt!`
          );
          if (data?.prompt) {
            console.log(`📝 [${playerName}] Prompt: "${data.prompt}"`);
          }

          // Randomly select 2 different sounds after a delay
          setTimeout(() => {
            const shuffledSounds = [...availableSounds].sort(
              () => 0.5 - Math.random()
            );
            const selectedSounds: [string, string] = [
              shuffledSounds[0],
              shuffledSounds[1],
            ];
            console.log(
              `🎵 [${playerName}] Submitting sounds: [${selectedSounds.join(
                ", "
              )}]`
            );
            socket.emit("submitSounds", selectedSounds);
          }, 2000 + Math.random() * 2000); // 2-4 second delay
        } else {
          console.log(
            `⏳ [${playerName}] I'm the judge, waiting for other players to submit sounds...`
          );
        }
        break;
      case GameState.PLAYBACK:
        console.log(`🎵 [${playerName}] Playing back all sound submissions...`);
        if (data?.submissions && Array.isArray(data.submissions)) {
          console.log(
            `📻 [${playerName}] ${data.submissions.length} submissions to play back`
          );
        }
        break;
      case GameState.JUDGING:
        // If this player is the judge, pick a winner
        if (
          data?.judgeId === socket.id &&
          data?.submissions &&
          Array.isArray(data.submissions) &&
          data.submissions.length > 0
        ) {
          console.log(
            `⚖️ [${playerName}] Time to judge! ${data.submissions.length} submissions:`
          );
          data.submissions.forEach((sub: any, i: number) => {
            console.log(
              `   ${i + 1}. ${sub.playerName}: [${sub.sounds.join(", ")}]`
            );
          });

          // Randomly select a winner after a delay
          setTimeout(() => {
            if (
              data &&
              data.submissions &&
              Array.isArray(data.submissions) &&
              data.submissions.length > 0
            ) {
              const winnerIndex = Math.floor(
                Math.random() * data.submissions.length
              );
              const winningSubmission = data.submissions[winnerIndex];
              console.log(
                `🏆 [${playerName}] Judge selecting winner: ${
                  winningSubmission.playerName
                } (submission ${winnerIndex + 1})`
              );
              socket.emit("selectWinner", winnerIndex.toString());
            }
          }, 3000 + Math.random() * 2000); // 3-5 second delay
        } else {
          console.log(
            `⏳ [${playerName}] Waiting for judge to pick a winner...`
          );
        }
        break;

      case GameState.ROUND_RESULTS:
        console.log(
          `📊 [${playerName}] Round complete! Waiting for next round or game end...`
        );
        break;

      case GameState.GAME_OVER:
        console.log(
          `🎉 [${playerName}] Game over! Final results:`,
          currentRoom?.players.map((p) => `${p.name}: ${p.score}`)
        );
        break;
    }
  });
  // Additional event listeners for better tracking
  socket.on("judgeSelected", (judgeId) => {
    console.log(
      `⚖️ [${playerName}] Judge selected: ${
        judgeId === socket.id ? "ME!" : judgeId
      }`
    );
  });

  socket.on("promptSelected", (prompt) => {
    console.log(`📝 [${playerName}] Prompt selected: "${prompt}"`);
  });

  socket.on("soundSubmitted", (submission) => {
    console.log(
      `🎵 [${playerName}] Sound submitted by ${
        submission.playerName
      }: [${submission.sounds.join(", ")}]`
    );
  });

  socket.on("roundComplete", (winnerId, winnerName) => {
    console.log(
      `🏆 [${playerName}] Round winner: ${winnerName} (${
        winnerId === socket.id ? "ME!" : winnerId
      })`
    );

    // Track round results (only do this once per round)
    if (socket.id === hostSocket?.id && currentRoom) {
      roundResults.push({
        round: currentRoom.currentRound,
        winner: winnerName,
        prompt: currentRoom.currentPrompt || "Unknown prompt",
      });

      console.log(`\n📈 === ROUND ${currentRoom.currentRound} COMPLETE ===`);
      console.log(`🏆 Winner: ${winnerName}`);
      console.log(`📝 Prompt: "${currentRoom.currentPrompt}"`);
      console.log(`📊 Current Scores:`);
      currentRoom.players.forEach((p) => {
        console.log(
          `   ${p.name}: ${p.score} point${p.score !== 1 ? "s" : ""}`
        );
      });
      console.log(
        `⏱️ Game time: ${((Date.now() - gameStartTime) / 1000).toFixed(1)}s\n`
      );
    }
  });

  socket.on("gameComplete", (winnerId, winnerName) => {
    console.log(
      `🎊 [${playerName}] GAME WINNER: ${winnerName} (${
        winnerId === socket.id ? "ME!" : winnerId
      })`
    );

    // Print final game summary (only once)
    if (socket.id === hostSocket?.id && currentRoom && !gameComplete) {
      gameComplete = true;
      const totalTime = ((Date.now() - gameStartTime) / 1000).toFixed(1);

      console.log(
        `\n🎊 ==================== GAME COMPLETE ====================`
      );
      console.log(`🏆 OVERALL WINNER: ${winnerName}`);
      console.log(`⏱️ Total game time: ${totalTime} seconds`);
      console.log(`🔢 Total rounds played: ${roundResults.length}`);

      console.log(`\n📊 FINAL SCORES:`);
      const sortedPlayers = [...currentRoom.players].sort(
        (a, b) => b.score - a.score
      );
      sortedPlayers.forEach((p, i) => {
        const trophy = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  ";
        console.log(
          `${trophy} ${p.name}: ${p.score} point${p.score !== 1 ? "s" : ""}`
        );
      });

      console.log(`\n📋 ROUND-BY-ROUND RESULTS:`);
      roundResults.forEach((result) => {
        console.log(
          `   Round ${result.round}: ${result.winner} won with "${result.prompt}"`
        );
      });

      console.log(`\n🎯 Game successfully completed all rounds!`);
      console.log(`🎮 Fartnoises multiplayer test: SUCCESS! 🎉\n`);

      // Disconnect after a short delay to show results
      setTimeout(() => {
        console.log("🔚 Test complete. Disconnecting all players...");
        players.forEach((sock) => sock.disconnect());
        process.exit(0);
      }, 5000);
    }
  });

  socket.on("error", ({ message }) => {
    console.error(`❌ [${playerName}] Error: ${message}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`🔌 Player ${playerName} disconnected. Reason: ${reason}`);
  });

  socket.on("connect_error", (err) => {
    console.error(`❌ Player ${playerName} connection error: ${err.message}`);
  });

  return socket;
}

console.log("🚀 Starting Fartnoises Multiplayer Test");
console.log(`🎯 Target: ${SERVER_URL}`);
console.log(`👥 Players: ${NUM_PLAYERS}`);
console.log("📝 Make sure your dev server is running!\n");

const players: Socket[] = [];
for (let i = 0; i < NUM_PLAYERS; i++) {
  // Stagger connections slightly
  setTimeout(() => {
    players.push(createPlayer(i));
  }, i * 500); // 500ms delay between each player connection
}

// Keep the script running for a while to observe complete game flow
setTimeout(() => {
  console.log("\n⏰ Test script finished. Disconnecting players...");
  players.forEach((socket) => socket.disconnect());
  process.exit(0);
}, 300000); // Run for 5 minutes to allow full game completion

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT. Disconnecting players...");
  players.forEach((socket) => socket.disconnect());
  process.exit(0);
});
