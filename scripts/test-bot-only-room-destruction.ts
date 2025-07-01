import { io, Socket } from "socket.io-client";
import {
  Room,
  Player,
  GameState,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../src/types/game";

const SERVER_URL = "http://localhost:3000";

// Test the bot-only room destruction feature
function testBotOnlyRoomDestruction() {
  console.log("🧪 Testing Bot-Only Room Destruction Feature...");

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

  let roomCode: string;
  let testPhase = "create";

  socket.on("connect", () => {
    console.log(`🔌 Connected as ${playerName} (ID: ${socket.id})`);

    // Phase 1: Create room (should have 1 human + 2 bots)
    socket.emit("createRoom", { name: playerName }, (code) => {
      roomCode = code;
      console.log(`🏠 Created room: ${code}`);
    });
  });

  socket.on("roomCreated", ({ room, player }) => {
    console.log(`\n✅ PHASE 1: Room Creation`);
    console.log(`👥 Players: ${room.players.length}`);
    room.players.forEach((p) => {
      console.log(
        `  - ${p.name} ${p.isBot ? "(BOT)" : "(HUMAN)"} ${
          p.isVIP ? "(VIP)" : ""
        }`
      );
    });

    if (testPhase === "create") {
      // Phase 2: Leave room to trigger bot-only state
      setTimeout(() => {
        console.log(`\n🚪 PHASE 2: Human player leaving room...`);
        testPhase = "left";
        socket.emit("leaveRoom");
      }, 2000);
    }
  });

  socket.on("roomUpdated", (room) => {
    if (testPhase === "left") {
      console.log(`\n📊 Room state after human left:`);
      console.log(`👥 Players: ${room.players.length}`);
      room.players.forEach((p) => {
        console.log(
          `  - ${p.name} ${p.isBot ? "(BOT)" : "(HUMAN)"} ${
            p.isVIP ? "(VIP)" : ""
          }`
        );
      });

      const humanPlayers = room.players.filter((p) => !p.isBot);
      if (humanPlayers.length === 0 && room.players.length > 0) {
        console.log(
          `✅ SUCCESS: Room now only has bots. Bot-only destruction timer should be active.`
        );
        console.log(
          `⏰ Room should be destroyed in 60 seconds if no humans rejoin.`
        );

        // Phase 3: Wait a bit, then rejoin to test timer cancellation
        setTimeout(() => {
          console.log(
            `\n🔄 PHASE 3: Human player rejoining to test timer cancellation...`
          );
          testPhase = "rejoined";
          socket.emit("joinRoom", roomCode, { name: playerName }, (success) => {
            if (success) {
              console.log(`✅ Successfully rejoined room ${roomCode}`);
            } else {
              console.log(`❌ Failed to rejoin room ${roomCode}`);
            }
          });
        }, 5000); // Wait 5 seconds before rejoining
      }
    } else if (testPhase === "rejoined") {
      console.log(`\n📊 Room state after human rejoined:`);
      console.log(`👥 Players: ${room.players.length}`);
      room.players.forEach((p) => {
        console.log(
          `  - ${p.name} ${p.isBot ? "(BOT)" : "(HUMAN)"} ${
            p.isVIP ? "(VIP)" : ""
          }`
        );
      });

      const humanPlayers = room.players.filter((p) => !p.isBot);
      if (humanPlayers.length > 0) {
        console.log(
          `✅ SUCCESS: Human rejoined room. Bot-only destruction timer should be canceled.`
        );

        // Phase 4: Leave again to test actual destruction
        setTimeout(() => {
          console.log(
            `\n🚪 PHASE 4: Human player leaving again for full destruction test...`
          );
          testPhase = "final_test";
          socket.emit("leaveRoom");

          // Wait for room to be destroyed (60 seconds + buffer)
          setTimeout(() => {
            console.log(
              `\n⏰ 65 seconds have passed. Room should be destroyed by now.`
            );
            console.log(
              `🧪 Test completed. Check server logs for destruction confirmation.`
            );
            socket.disconnect();
            process.exit(0);
          }, 65000);
        }, 2000);
      }
    }
  });

  socket.on("roomClosed", ({ roomCode: closedRoomCode }) => {
    console.log(`\n🗑️ ROOM DESTROYED: Room ${closedRoomCode} was closed`);
    console.log(
      `✅ SUCCESS: Bot-only room destruction feature working correctly!`
    );
    socket.disconnect();
    process.exit(0);
  });

  socket.on("error", (error) => {
    console.error(`❌ Error: ${error.message}`);
    socket.disconnect();
    process.exit(1);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Disconnected from server`);
  });

  // Overall timeout
  setTimeout(() => {
    console.log("⏰ Test timeout reached, exiting...");
    socket.disconnect();
    process.exit(1);
  }, 120000); // 2 minutes total timeout
}

console.log("🚀 Starting bot-only room destruction test...");
testBotOnlyRoomDestruction();
