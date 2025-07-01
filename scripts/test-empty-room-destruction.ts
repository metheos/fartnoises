#!/usr/bin/env ts-node
/**
 * Test script to verify that empty rooms (0 humans, 0 bots) are properly destroyed after 60 seconds
 */

import { io as Client, Socket } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";

async function testEmptyRoomDestruction() {
  console.log("🧪 Testing empty room destruction...");

  const client: Socket = Client(SERVER_URL);

  return new Promise<void>((resolve, reject) => {
    let roomCode: string;
    let roomCreated = false;

    // Connection timeout
    const timeout = setTimeout(() => {
      client.disconnect();
      reject(new Error("Test timeout"));
    }, 90000); // 90 seconds timeout

    client.on("connect", () => {
      console.log("✅ Connected to server");

      // Create a room by joining
      console.log("🏠 Creating room...");
      client.emit("joinRoom", {
        playerName: "TestPlayer",
        roomCode: "", // Empty string creates new room
        isMainScreen: false,
      });
    });

    client.on("roomCreated", (data) => {
      roomCode = data.room.code;
      roomCreated = true;
      console.log(`🎉 Room created: ${roomCode}`);
      console.log(`👤 Players in room: ${data.room.players.length}`);

      // Wait a moment then disconnect to create empty room
      setTimeout(() => {
        console.log("🚪 Disconnecting to create empty room...");
        client.disconnect();
      }, 2000);
    });

    client.on("disconnect", () => {
      if (roomCreated) {
        console.log("🔌 Disconnected from server");
        console.log("⏰ Empty room should be destroyed in 60 seconds...");
        console.log(
          "💤 Waiting for room destruction (this test takes ~60 seconds)..."
        );

        // Wait 65 seconds to allow room destruction
        setTimeout(() => {
          // Try to reconnect and join the same room to verify it's gone
          console.log("🔍 Reconnecting to verify room is destroyed...");

          const verifyClient: Socket = Client(SERVER_URL);

          verifyClient.on("connect", () => {
            console.log("✅ Reconnected to server");

            // Try to join the old room
            verifyClient.emit("joinRoom", {
              playerName: "VerifyPlayer",
              roomCode: roomCode,
              isMainScreen: false,
            });
          });

          verifyClient.on("error", (error) => {
            if (error.message === "Room not found") {
              console.log("🎉 SUCCESS: Room was properly destroyed!");
              clearTimeout(timeout);
              verifyClient.disconnect();
              resolve();
            } else {
              console.log("❌ Unexpected error:", error.message);
              clearTimeout(timeout);
              verifyClient.disconnect();
              reject(error);
            }
          });

          verifyClient.on("roomJoined", () => {
            console.log("❌ FAILURE: Room still exists!");
            clearTimeout(timeout);
            verifyClient.disconnect();
            reject(new Error("Room was not destroyed"));
          });

          // Give verification 10 seconds
          setTimeout(() => {
            console.log("❌ FAILURE: No response from server");
            clearTimeout(timeout);
            verifyClient.disconnect();
            reject(new Error("No response during verification"));
          }, 10000);
        }, 65000); // Wait 65 seconds for destruction + buffer
      }
    });

    client.on("error", (error) => {
      console.log("❌ Client error:", error);
      clearTimeout(timeout);
      client.disconnect();
      reject(error);
    });
  });
}

// Run the test
testEmptyRoomDestruction()
  .then(() => {
    console.log("✅ Test completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  });
