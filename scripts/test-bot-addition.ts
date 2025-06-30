import { io, Socket } from "socket.io-client";
import {
  Room,
  Player,
  GameState,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../src/types/game";

const SERVER_URL = "http://localhost:3000";

// Simple test to verify bot addition works correctly
function testBotAddition() {
  console.log("🤖 Testing Bot Addition System...");

  const playerName = "TestHuman";
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    SERVER_URL,
    {
      path: "/api/socket",
      transports: ["polling", "websocket"],
      reconnectionAttempts: 3,
      timeout: 10000,
    }
  );

  let testsPassed = 0;
  const totalTests = 3;

  socket.on("connect", () => {
    console.log(`🔌 Connected as ${playerName} (ID: ${socket.id})`);

    // Test 1: Create room and check if bots are added
    socket.emit("createRoom", { name: playerName }, (roomCode) => {
      console.log(`🏠 Created room: ${roomCode}`);
    });
  });

  socket.on("roomCreated", ({ room, player }) => {
    console.log(`\n✅ TEST 1: Room Creation`);
    console.log(`👥 Initial players: ${room.players.length}`);

    // Check if we have 3 total players (1 human + 2 bots)
    if (room.players.length === 3) {
      console.log(`✅ Correct player count: ${room.players.length}`);
      testsPassed++;
    } else {
      console.log(`❌ Expected 3 players, got ${room.players.length}`);
    }

    // Check if we have the right mix of humans and bots
    const humans = room.players.filter((p) => !p.isBot);
    const bots = room.players.filter((p) => p.isBot);

    console.log(
      `👤 Humans: ${humans.length} (${humans.map((h) => h.name).join(", ")})`
    );
    console.log(
      `🤖 Bots: ${bots.length} (${bots.map((b) => b.name).join(", ")})`
    );

    if (humans.length === 1 && bots.length === 2) {
      console.log(`✅ Correct player mix: 1 human + 2 bots`);
      testsPassed++;
    } else {
      console.log(
        `❌ Expected 1 human + 2 bots, got ${humans.length} humans + ${bots.length} bots`
      );
    }

    // Check if bots have proper bot characteristics
    const botsHaveCorrectFlags = bots.every(
      (bot) =>
        bot.isBot === true &&
        bot.name && // Has a name
        bot.id &&
        bot.color &&
        bot.score === 0
    );

    if (botsHaveCorrectFlags) {
      console.log(`✅ Bots have correct properties`);
      testsPassed++;
    } else {
      console.log(`❌ Bots missing required properties`);
      console.log(
        `Bot details:`,
        bots.map((b) => ({
          name: b.name,
          isBot: b.isBot,
          hasId: !!b.id,
          hasColor: !!b.color,
        }))
      );
    }

    // Complete the test
    setTimeout(() => {
      console.log(`\n🎯 TEST RESULTS:`);
      console.log(`✅ Passed: ${testsPassed}/${totalTests}`);
      console.log(
        `${
          testsPassed === totalTests
            ? "🎉 ALL TESTS PASSED!"
            : "❌ SOME TESTS FAILED"
        }`
      );

      socket.disconnect();
      process.exit(testsPassed === totalTests ? 0 : 1);
    }, 1000);
  });

  socket.on("error", (error) => {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Disconnected from server`);
  });

  // Timeout to exit if test takes too long
  setTimeout(() => {
    console.log("⏰ Test timeout reached, exiting...");
    socket.disconnect();
    process.exit(1);
  }, 15000); // 15 second timeout
}

console.log("🚀 Starting bot addition test...");
testBotAddition();
