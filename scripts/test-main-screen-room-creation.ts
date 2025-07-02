/**
 * Test script to verify main screen room creation functionality
 * This tests the new createRoomAsMainScreen flow
 */

import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";

async function testMainScreenRoomCreation() {
  console.log("🧪 Testing Main Screen Room Creation...");

  // Create main screen socket
  const mainScreenSocket = io(SERVER_URL, {
    path: "/api/socket",
    transports: ["polling", "websocket"],
  });

  // Create player socket
  const playerSocket = io(SERVER_URL, {
    path: "/api/socket",
    transports: ["polling", "websocket"],
  });

  let roomCode: string;

  mainScreenSocket.on("connect", () => {
    console.log(`🖥️  Main screen connected (${mainScreenSocket.id})`);

    // Create empty room
    mainScreenSocket.emit("createRoomAsMainScreen", (code: string) => {
      roomCode = code;
      console.log(`🏠 Main screen created empty room: ${code}`);

      // Join as viewer
      mainScreenSocket.emit("joinRoomAsViewer", code);
    });
  });

  mainScreenSocket.on("roomJoined", (data) => {
    const room = data.room || data;
    console.log(`🖥️  Main screen joined room ${room.code} as viewer`);
    console.log(`📊 Room has ${room.players.length} players`);

    if (room.players.length === 0) {
      console.log(
        "✅ SUCCESS: Room is empty as expected for main screen creation"
      );

      // Now have a player join
      setTimeout(() => {
        console.log("👤 Player attempting to join...");
        playerSocket.emit(
          "joinRoom",
          roomCode,
          { name: "TestPlayer" },
          (success: boolean) => {
            if (success) {
              console.log("✅ Player joined successfully");
            } else {
              console.log("❌ Player failed to join");
            }
          }
        );
      }, 1000);
    }
  });

  playerSocket.on("connect", () => {
    console.log(`👤 Player connected (${playerSocket.id})`);
  });

  playerSocket.on("roomJoined", ({ room, player }) => {
    console.log(`👤 Player ${player.name} joined room ${room.code}`);
    console.log(`👑 Player VIP status: ${player.isVIP}`);
    console.log(`📊 Room now has ${room.players.length} players`);

    if (player.isVIP) {
      console.log("✅ SUCCESS: First player became VIP as expected");
    } else {
      console.log("❌ FAILURE: First player should be VIP");
    }

    // Test complete
    setTimeout(() => {
      console.log("🏁 Test complete - disconnecting");
      mainScreenSocket.disconnect();
      playerSocket.disconnect();
    }, 2000);
  });

  mainScreenSocket.on("error", (error) => {
    console.error("❌ Main screen error:", error);
  });

  playerSocket.on("error", (error) => {
    console.error("❌ Player error:", error);
  });
}

console.log("🚀 Starting main screen room creation test...");
testMainScreenRoomCreation().catch(console.error);
