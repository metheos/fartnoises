import { io, Socket } from "socket.io-client";
import {
  Room,
  Player,
  GameState,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../src/types/game";

const SERVER_URL = "http://localhost:3000";

let roomCodeGlobal: string | null = null;
let testSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

// Test with just 1 human player to trigger bot addition
function testBotSystem() {
  console.log("🤖 Testing Bot System...");
  
  const playerName = "TestHuman1";
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
    path: "/api/socket",
    transports: ["polling", "websocket"],
    reconnectionAttempts: 3,
    timeout: 10000,
  });

  testSocket = socket;

  socket.on("connect", () => {
    console.log(`🔌 Human player ${playerName} (ID: ${socket.id}) connected.`);
    
    // Create the room
    socket.emit("createRoom", { name: playerName }, (roomCode) => {
      console.log(`🏠 Human player ${playerName} created room: ${roomCode}`);
      roomCodeGlobal = roomCode;
    });
  });

  socket.on("roomCreated", ({ room, player }) => {
    console.log(`🎉 Room created - Code: ${room.code}, Host: ${player.name}`);
    console.log(`👥 Players in room: ${room.players.length}`);
    room.players.forEach(p => {
      console.log(`  - ${p.name} ${p.isBot ? '(BOT)' : '(HUMAN)'} ${p.isVIP ? '(VIP)' : ''}`);
    });
  });

  socket.on("roomUpdated", (room) => {
    console.log(`📊 Room updated - Players: ${room.players.length}, State: ${room.gameState}`);
    room.players.forEach(p => {
      console.log(`  - ${p.name} ${p.isBot ? '(BOT)' : '(HUMAN)'} ${p.isVIP ? '(VIP)' : ''}`);
    });
    
    // If we have players and this is the host, start the game to test bot behavior
    if (
      room.players.length >= 3 &&
      room.gameState === GameState.LOBBY &&
      room.players.find(p => p.id === socket.id)?.isVIP
    ) {
      console.log(`🎮 Starting the game with bots...`);
      setTimeout(() => {
        socket.emit("startGame");
      }, 2000); // Give a moment to see the room state
    }
  });

  socket.on("gameStateChanged", (newState, data) => {
    console.log(`🎯 Game State: ${newState}`);
    if (data) {
      console.log(`📋 State Data:`, data);
    }

    // Auto-respond to game states to keep the flow going
    if (newState === "prompt_selection" && data?.judgeId === socket.id) {
      // If this player is the judge, select the first prompt
      setTimeout(() => {
        const prompts = (data as any)?.prompts;
        if (prompts && prompts.length > 0) {
          console.log(`🎯 Human judge selecting prompt: "${prompts[0].text}"`);
          socket.emit("selectPrompt", prompts[0].id);
        }
      }, 1000);
    }

    if (newState === "sound_selection" && data?.prompt) {
      // If this player is not the judge, select some sounds
      setTimeout(() => {
        const currentRoom = roomCodeGlobal;
        if (currentRoom) {
          // Try to use some common sound IDs that might exist
          console.log(`🎵 Human player selecting sounds...`);
          socket.emit("submitSounds", ["22001", "22002"]);
        }
      }, 2000);
    }

    if (newState === "judging") {
      // If this player is the judge, pick a winner
      setTimeout(() => {
        if (data && (data as any).judgeId === socket.id) {
          const submissions = (data as any).submissions;
          if (submissions && submissions.length > 0) {
            // Pick the first submission as winner
            console.log(`⚖️ Human judge selecting winner: ${submissions[0].playerName}`);
            socket.emit("selectWinner", submissions[0].playerId);
          }
        }
      }, 2000);
    }
  });

  socket.on("judgeSelected", (judgeId) => {
    console.log(`⚖️ Judge selected: ${judgeId}`);
  });

  socket.on("promptSelected", (prompt) => {
    console.log(`📝 Prompt selected: "${prompt.text}"`);
  });

  socket.on("soundSubmitted", (submission) => {
    console.log(`🎵 Sound submitted by ${submission.playerName}: [${submission.sounds.join(", ")}]`);
  });

  socket.on("roundComplete", (data) => {
    console.log(`🏆 Round winner: ${data.winnerName}`);
  });

  socket.on("gameComplete", (winnerId, winnerName) => {
    console.log(`🎊 GAME WINNER: ${winnerName}`);
    
    // Cleanup and exit
    setTimeout(() => {
      console.log("✅ Bot system test completed!");
      socket.disconnect();
      process.exit(0);
    }, 2000);
  });

  socket.on("error", (error) => {
    console.error(`❌ Error: ${error.message}`);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Human player ${playerName} disconnected.`);
  });

  // Timeout to exit if test takes too long
  setTimeout(() => {
    console.log("⏰ Test timeout reached, exiting...");
    socket.disconnect();
    process.exit(1);
  }, 60000); // 1 minute timeout
}

console.log("🚀 Starting bot system test...");
testBotSystem();
