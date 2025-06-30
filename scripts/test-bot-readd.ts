import { io, Socket } from "socket.io-client";
import {
  Room,
  Player,
  GameState,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../src/types/game";

const SERVER_URL = "http://localhost:3000";

// Test what happens when players leave in the lobby (should add bots back)
function testBotReaddition() {
  console.log("🤖 Testing Bot Re-addition When Players Leave...");
  
  const socket1: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
    path: "/api/socket",
    transports: ["polling", "websocket"],
    reconnectionAttempts: 3,
    timeout: 10000,
  });

  const socket2: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
    path: "/api/socket",
    transports: ["polling", "websocket"],
    reconnectionAttempts: 3,
    timeout: 10000,
  });

  const socket3: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
    path: "/api/socket",
    transports: ["polling", "websocket"],
    reconnectionAttempts: 3,
    timeout: 10000,
  });

  let roomCode: string;
  let testsPassed = 0;
  const totalTests = 3;

  // Step 1: Player 1 creates room (should have 1 human + 2 bots = 3 total)
  socket1.on("connect", () => {
    console.log(`🔌 Player1 connected (ID: ${socket1.id})`);
    
    socket1.emit("createRoom", { name: "Player1" }, (code) => {
      roomCode = code;
      console.log(`🏠 Player1 created room: ${code}`);
    });
  });

  socket1.on("roomCreated", ({ room }) => {
    console.log(`\n✅ TEST 1: Single Player Room`);
    console.log(`👥 Players: ${room.players.length} (${room.players.map(p => `${p.name}${p.isBot ? ' (BOT)' : ''}`).join(', ')})`);
    
    if (room.players.length === 3 && room.players.filter(p => !p.isBot).length === 1) {
      console.log(`✅ Correct: 1 human + 2 bots`);
      testsPassed++;
    } else {
      console.log(`❌ Expected 1 human + 2 bots`);
    }

    // Step 2: Add two more players (should remove bots to have 3 humans)
    setTimeout(() => {
      console.log(`\n🔗 Player2 and Player3 joining...`);
      
      socket2.emit("joinRoom", roomCode, { name: "Player2" }, (success) => {
        console.log(`Player2 join result: ${success}`);
      });
      
      setTimeout(() => {
        socket3.emit("joinRoom", roomCode, { name: "Player3" }, (success) => {
          console.log(`Player3 join result: ${success}`);
        });
      }, 500);
    }, 1000);
  });

  let updateCount = 0;
  socket1.on("roomUpdated", (room) => {
    updateCount++;
    const humans = room.players.filter(p => !p.isBot);
    const bots = room.players.filter(p => p.isBot);
    
    console.log(`\n📊 Room Update ${updateCount}:`);
    console.log(`👥 Total: ${room.players.length} | 👤 Humans: ${humans.length} | 🤖 Bots: ${bots.length}`);
    console.log(`Players: ${room.players.map(p => `${p.name}${p.isBot ? ' (BOT)' : ''}`).join(', ')}`);

    // Test when we have 3 humans (bots should be removed)
    if (humans.length === 3 && bots.length === 0 && testsPassed === 1) {
      console.log(`\n✅ TEST 2: Three Humans`);
      console.log(`✅ Correct: All bots removed when 3+ humans present`);
      testsPassed++;

      // Step 3: Remove one player (should add bots back)
      setTimeout(() => {
        console.log(`\n🚪 Player3 leaving...`);
        socket3.disconnect();
      }, 2000);
    }

    // Test when we go back to 2 humans (bots should be re-added)
    if (humans.length === 2 && room.players.length >= 3 && testsPassed === 2) {
      console.log(`\n✅ TEST 3: Player Left, Bots Re-added`);
      if (bots.length > 0) {
        console.log(`✅ Correct: Bots re-added to maintain minimum player count`);
        testsPassed++;
      } else {
        console.log(`❌ Expected bots to be re-added`);
      }

      // Complete test
      setTimeout(() => {
        console.log(`\n🎯 FINAL RESULTS:`);
        console.log(`✅ Passed: ${testsPassed}/${totalTests}`);
        console.log(`${testsPassed === totalTests ? '🎉 ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'}`);
        
        socket1.disconnect();
        socket2.disconnect();
        socket3.disconnect();
        process.exit(testsPassed === totalTests ? 0 : 1);
      }, 2000);
    }
  });

  socket2.on("connect", () => {
    console.log(`🔌 Player2 connected (ID: ${socket2.id})`);
  });

  socket3.on("connect", () => {
    console.log(`🔌 Player3 connected (ID: ${socket3.id})`);
  });

  // Error handling
  [socket1, socket2, socket3].forEach((socket, index) => {
    socket.on("error", (error) => {
      console.error(`❌ Player${index + 1} Error: ${error.message}`);
    });
  });

  // Timeout
  setTimeout(() => {
    console.log("⏰ Test timeout reached, exiting...");
    socket1.disconnect();
    socket2.disconnect();
    socket3.disconnect();
    process.exit(1);
  }, 20000);
}

console.log("🚀 Starting bot re-addition test...");
testBotReaddition();
