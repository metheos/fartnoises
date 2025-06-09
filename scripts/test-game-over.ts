import { io } from "socket.io-client";

// Test script to verify game over transition
async function testGameOver() {
  const socket = io("http://localhost:3000");
  let roomCode = "";

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Test timeout"));
    }, 30000);

    socket.on("connect", () => {
      console.log("✅ Connected to server");
      
      // Create a room
      socket.emit("createRoom", "TestPlayer");
    });

    socket.on("roomCreated", (code: string) => {
      console.log(`✅ Room created: ${code}`);
      roomCode = code;
    });

    socket.on("roomUpdated", (room: any) => {
      console.log(`📊 Room updated - State: ${room.gameState}, Round: ${room.currentRound}/${room.maxRounds}`);
      
      if (room.gameState === "game_over") {
        console.log("🎉 GAME OVER STATE DETECTED!");
        console.log(`Winner: ${room.winner}`);
        console.log("Final scores:", room.players.map((p: any) => ({ name: p.name, score: p.score })));
        clearTimeout(timeout);
        socket.disconnect();
        resolve();
      }
    });

    socket.on("gameStateChanged", (state: string, data?: any) => {
      console.log(`🎮 Game state changed to: ${state}`);
      if (data) {
        console.log("Additional data:", data);
      }
      
      if (state === "game_over") {
        console.log("🎉 GAME_OVER state received via gameStateChanged!");
        if (data?.winner) {
          console.log(`Winner: ${data.winner.name} with ${data.winner.score} points`);
        }
        if (data?.finalScores) {
          console.log("Final scores:", data.finalScores);
        }
      }
    });

    socket.on("gameComplete", (winnerId: string, winnerName: string) => {
      console.log(`🏆 Game complete! Winner: ${winnerName} (${winnerId})`);
    });

    socket.on("error", (error: any) => {
      console.error("❌ Socket error:", error);
      clearTimeout(timeout);
      socket.disconnect();
      reject(error);
    });

    socket.on("disconnect", () => {
      console.log("🔌 Disconnected from server");
    });
  });
}

// Run the test
testGameOver()
  .then(() => {
    console.log("✅ Game over test completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Game over test failed:", error);
    process.exit(1);
  });
