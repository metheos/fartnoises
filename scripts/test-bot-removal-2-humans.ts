import { io, Socket } from "socket.io-client";
import {
  Room,
  Player,
  GameState,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../src/types/game";

const SERVER_URL = "http://localhost:3000";

// Test the bot removal with 2+ humans
function testBotRemovalWith2Humans() {
  console.log("🧪 Testing Bot Removal with 2+ Humans...");

  const socket1: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    SERVER_URL,
    {
      path: "/api/socket",
      transports: ["polling", "websocket"],
      reconnectionAttempts: 3,
      timeout: 10000,
    }
  );

  const socket2: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    SERVER_URL,
    {
      path: "/api/socket",
      transports: ["polling", "websocket"],
      reconnectionAttempts: 3,
      timeout: 10000,
    }
  );

  let roomCode: string;
  let testsPassed = 0;
  const totalTests = 2;

  // Test 1: Single player creates room (should have 1 human + 2 bots)
  socket1.on("connect", () => {
    console.log(`🔌 Player1 connected (ID: ${socket1.id})`);
    socket1.emit("createRoom", { name: "Player1" }, (code) => {
      roomCode = code;
      console.log(`🏠 Player1 created room: ${code}`);
    });
  });

  socket1.on("roomCreated", ({ room }) => {
    console.log(`\n✅ TEST 1: Room Creation (1 Human)`);
    console.log(`👥 Players: ${room.players.length}`);
    room.players.forEach((p) => {
      console.log(`  - ${p.name} ${p.isBot ? "(BOT)" : "(HUMAN)"}`);
    });

    const humans = room.players.filter((p) => !p.isBot);
    const bots = room.players.filter((p) => p.isBot);

    if (humans.length === 1 && bots.length === 2) {
      console.log(
        `✅ Correct: 1 human + 2 bots = ${room.players.length} total`
      );
      testsPassed++;
    } else {
      console.log(
        `❌ Expected 1 human + 2 bots, got ${humans.length} humans + ${bots.length} bots`
      );
    }

    // Test 2: Second player joins (should remove all bots)
    setTimeout(() => {
      console.log(`\n🔗 Player2 joining room...`);
      socket2.emit("joinRoom", roomCode, { name: "Player2" }, (success) => {
        console.log(`Player2 join result: ${success}`);
      });
    }, 1000);
  });

  // Listen for room updates when second player joins
  socket1.on("roomUpdated", (room) => {
    const humans = room.players.filter((p) => !p.isBot);
    const bots = room.players.filter((p) => p.isBot);

    if (humans.length === 2) {
      console.log(`\n✅ TEST 2: Second Human Joined`);
      console.log(`👥 Players: ${room.players.length}`);
      room.players.forEach((p) => {
        console.log(`  - ${p.name} ${p.isBot ? "(BOT)" : "(HUMAN)"}`);
      });

      if (humans.length === 2 && bots.length === 0) {
        console.log(`✅ Correct: All bots removed with 2 humans`);
        testsPassed++;
      } else {
        console.log(
          `❌ Expected 0 bots with 2 humans, got ${bots.length} bots`
        );
      }

      // Complete test
      setTimeout(() => {
        console.log(`\n🎯 FINAL RESULTS:`);
        console.log(`✅ Passed: ${testsPassed}/${totalTests}`);
        console.log(
          `${
            testsPassed === totalTests
              ? "🎉 ALL TESTS PASSED!"
              : "❌ SOME TESTS FAILED"
          }`
        );

        socket1.disconnect();
        socket2.disconnect();
        process.exit(testsPassed === totalTests ? 0 : 1);
      }, 2000);
    }
  });

  socket2.on("connect", () => {
    console.log(`🔌 Player2 connected (ID: ${socket2.id})`);
  });

  // Error handling
  [socket1, socket2].forEach((socket, index) => {
    socket.on("error", (error) => {
      console.error(`❌ Player${index + 1} Error: ${error.message}`);
      process.exit(1);
    });
  });

  // Timeout
  setTimeout(() => {
    console.log("⏰ Test timeout reached, exiting...");
    socket1.disconnect();
    socket2.disconnect();
    process.exit(1);
  }, 15000);
}

console.log("🚀 Starting bot removal test with 2+ humans...");
testBotRemovalWith2Humans();
