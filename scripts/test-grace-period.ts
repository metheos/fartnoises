/**
 * Simple test for the 10-second grace period functionality
 */

import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";
const SOCKET_PATH = "/api/socket";

async function testGracePeriod() {
  console.log("🎯 Testing 10-second grace period functionality...\n");

  // Create 3 players
  const host = io(SERVER_URL, { path: SOCKET_PATH, forceNew: true });
  const player1 = io(SERVER_URL, { path: SOCKET_PATH, forceNew: true });
  const player2 = io(SERVER_URL, { path: SOCKET_PATH, forceNew: true });

  let hostConnected = false;
  let player1Connected = false;
  let player2Connected = false;
  let roomCode = "";

  // Wait for connections
  await new Promise((resolve) => {
    host.on("connect", () => {
      console.log(`✅ Host connected: ${host.id}`);
      hostConnected = true;
      checkAllConnected();
    });

    player1.on("connect", () => {
      console.log(`✅ Player1 connected: ${player1.id}`);
      player1Connected = true;
      checkAllConnected();
    });

    player2.on("connect", () => {
      console.log(`✅ Player2 connected: ${player2.id}`);
      player2Connected = true;
      checkAllConnected();
    });

    function checkAllConnected() {
      if (hostConnected && player1Connected && player2Connected) {
        resolve(void 0);
      }
    }
  });

  console.log("\n🏠 Creating room...");

  // Create room
  await new Promise((resolve) => {
    const playerData = { name: "TestHost", color: "#FF6B6B", emoji: "🎮" };
    host.emit("createRoom", playerData, (code: string) => {
      roomCode = code;
      console.log(`✅ Room created: ${roomCode}`);
      resolve(void 0);
    });
  });

  console.log("\n👥 Joining players...");

  // Join players
  await Promise.all([
    new Promise((resolve) => {
      const playerData = { name: "TestPlayer1", color: "#4ECDC4", emoji: "🎯" };
      player1.emit("joinRoom", roomCode, playerData, (success: boolean) => {
        console.log(`✅ Player1 joined: ${success}`);
        resolve(void 0);
      });
    }),
    new Promise((resolve) => {
      const playerData = { name: "TestPlayer2", color: "#45B7D1", emoji: "⚡" };
      player2.emit("joinRoom", roomCode, playerData, (success: boolean) => {
        console.log(`✅ Player2 joined: ${success}`);
        resolve(void 0);
      });
    }),
  ]);

  console.log("\n🎮 Starting game...");

  // Start game
  await new Promise((resolve) => {
    host.on("gameStateChanged", (state) => {
      if (state === "judge_selection") {
        console.log("✅ Game started - judge selection phase");
        resolve(void 0);
      }
    });
    host.emit("startGame");
  });

  // Wait for game to transition to prompt selection
  await new Promise((resolve) => {
    host.on("gameStateChanged", (state) => {
      if (state === "prompt_selection") {
        console.log("✅ Game in prompt selection phase");
        resolve(void 0);
      }
    });
  });

  console.log("\n⏰ Testing grace period...");
  console.log("📤 Host will disconnect and reconnect within 10 seconds");

  let gamePausedReceived = false;
  let playerReconnectedReceived = false;

  // Set up listeners
  player1.on("gamePausedForDisconnection", (data) => {
    gamePausedReceived = true;
    console.log(
      `❌ Game was PAUSED for disconnection: ${data.disconnectedPlayerName}`
    );
    console.log("   This should NOT happen during grace period!");
  });

  player1.on("playerReconnected", (data) => {
    playerReconnectedReceived = true;
    console.log(`✅ Player reconnected: ${data.playerName}`);
  });

  player1.on("playerDisconnected", (data) => {
    console.log(`📤 Player disconnected: ${data.playerName}`);
    console.log("   Grace period should start now (10 seconds)...");
  });

  // Disconnect host
  const originalHostId = host.id;
  console.log(`📤 Disconnecting host (${originalHostId})...`);
  host.disconnect();

  // Wait 5 seconds (within grace period)
  console.log("⏳ Waiting 5 seconds (within grace period)...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Reconnect
  console.log("🔄 Reconnecting host...");
  const newHost = io(SERVER_URL, { path: SOCKET_PATH, forceNew: true });

  await new Promise((resolve) => {
    newHost.on("connect", () => {
      console.log(`✅ New host socket connected: ${newHost.id}`);

      newHost.emit(
        "reconnectToRoom",
        roomCode,
        "TestHost",
        originalHostId,
        (success: boolean) => {
          console.log(
            `🔄 Reconnection result: ${success ? "SUCCESS" : "FAILED"}`
          );
          resolve(void 0);
        }
      );
    });
  });

  // Wait a bit more to see final results
  console.log("⏳ Waiting 3 more seconds for events...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("\n📊 TEST RESULTS:");
  console.log(
    `   Game paused during grace period: ${
      gamePausedReceived ? "❌ YES (BAD)" : "✅ NO (GOOD)"
    }`
  );
  console.log(
    `   Player reconnected successfully: ${
      playerReconnectedReceived ? "✅ YES (GOOD)" : "❌ NO (BAD)"
    }`
  );

  if (!gamePausedReceived && playerReconnectedReceived) {
    console.log("\n🎉 SUCCESS: Grace period worked correctly!");
  } else {
    console.log("\n❌ FAILED: Grace period did not work as expected");
  }

  // Cleanup
  console.log("\n🧹 Cleaning up...");
  host.disconnect();
  newHost.disconnect();
  player1.disconnect();
  player2.disconnect();
}

testGracePeriod().catch(console.error);
