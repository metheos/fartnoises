import { io, Socket } from "socket.io-client";
import {
  Room,
  Player,
  GameState,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../src/types/game";

const SERVER_URL = "http://localhost:3000";

// Test bot behavior when players join and leave
function testBotDynamicManagement() {
  console.log("🤖 Testing Dynamic Bot Management...");
  
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

  let roomCode: string;
  let testsPassed = 0;
  const totalTests = 4;

  // Player 1 creates room
  socket1.on("connect", () => {
    console.log(`🔌 Player1 connected (ID: ${socket1.id})`);
    
    socket1.emit("createRoom", { name: "Player1" }, (code) => {
      roomCode = code;
      console.log(`🏠 Player1 created room: ${code}`);
    });
  });

  socket1.on("roomCreated", ({ room }) => {
    console.log(`\n✅ TEST 1: Room Creation (1 Human)`);
    console.log(`👥 Players: ${room.players.length} (${room.players.map(p => `${p.name}${p.isBot ? ' (BOT)' : ''}`).join(', ')})`);
    
    if (room.players.length === 3 && room.players.filter(p => !p.isBot).length === 1) {
      console.log(`✅ Correct: 1 human + 2 bots`);
      testsPassed++;
    } else {
      console.log(`❌ Expected 1 human + 2 bots`);
    }

    // Now connect player 2
    setTimeout(() => {
      console.log(`\n🔗 Player2 joining room...`);
      socket2.emit("joinRoom", roomCode, { name: "Player2" }, (success) => {
        console.log(`Player2 join result: ${success}`);
      });
    }, 1000);
  });

  // Listen for room updates when second player joins
  socket1.on("roomUpdated", (room) => {
    const humans = room.players.filter(p => !p.isBot);
    const bots = room.players.filter(p => p.isBot);
    
    console.log(`\n📊 Room Updated:`);
    console.log(`👥 Total: ${room.players.length} | 👤 Humans: ${humans.length} | 🤖 Bots: ${bots.length}`);
    console.log(`Players: ${room.players.map(p => `${p.name}${p.isBot ? ' (BOT)' : ''}`).join(', ')}`);

    if (humans.length === 2) {
      console.log(`\n✅ TEST 2: Second Human Joined`);
      if (room.players.length === 4 && bots.length === 2) {
        console.log(`✅ Correct: 2 humans + 2 bots (should still have bots since less than 3 humans)`);
        testsPassed++;
      } else if (room.players.length === 2 && bots.length === 0) {
        console.log(`✅ Alternative correct: 2 humans + 0 bots (if bots were removed)`);
        testsPassed++;
      } else {
        console.log(`❌ Unexpected configuration`);
      }

      // Test with 3rd player joining (should remove all bots)
      setTimeout(() => {
        const socket3 = io(SERVER_URL, {
          path: "/api/socket",
          transports: ["polling", "websocket"],
        });

        socket3.on("connect", () => {
          console.log(`\n🔗 Player3 joining room...`);
          socket3.emit("joinRoom", roomCode, { name: "Player3" }, (success) => {
            console.log(`Player3 join result: ${success}`);
          });

          socket3.on("roomUpdated", (updatedRoom) => {
            const newHumans = updatedRoom.players.filter(p => !p.isBot);
            const newBots = updatedRoom.players.filter(p => p.isBot);
            
            if (newHumans.length === 3) {
              console.log(`\n✅ TEST 3: Third Human Joined`);
              console.log(`👥 Total: ${updatedRoom.players.length} | 👤 Humans: ${newHumans.length} | 🤖 Bots: ${newBots.length}`);
              
              if (newBots.length === 0) {
                console.log(`✅ Correct: All bots removed when 3+ humans present`);
                testsPassed++;
              } else {
                console.log(`❌ Expected 0 bots with 3+ humans, got ${newBots.length}`);
              }

              // Test player leaving (should add bots back)
              setTimeout(() => {
                console.log(`\n🚪 Player3 leaving...`);
                socket3.disconnect();
              }, 1000);
            }
          });

          socket3.on("roomUpdated", (updatedRoom) => {
            const finalHumans = updatedRoom.players.filter(p => !p.isBot);
            const finalBots = updatedRoom.players.filter(p => p.isBot);
            
            if (finalHumans.length === 2 && finalBots.length > 0) {
              console.log(`\n✅ TEST 4: Player Left, Bots Re-added`);
              console.log(`👥 Total: ${updatedRoom.players.length} | 👤 Humans: ${finalHumans.length} | 🤖 Bots: ${finalBots.length}`);
              
              if (updatedRoom.players.length >= 3) {
                console.log(`✅ Correct: Bots added back to maintain minimum player count`);
                testsPassed++;
              } else {
                console.log(`❌ Expected bots to be re-added`);
              }

              // Complete test
              setTimeout(() => {
                console.log(`\n🎯 FINAL TEST RESULTS:`);
                console.log(`✅ Passed: ${testsPassed}/${totalTests}`);
                console.log(`${testsPassed === totalTests ? '🎉 ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'}`);
                
                socket1.disconnect();
                socket2.disconnect();
                socket3.disconnect();
                process.exit(testsPassed === totalTests ? 0 : 1);
              }, 1000);
            }
          });
        });
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
  }, 30000);
}

console.log("🚀 Starting dynamic bot management test...");
testBotDynamicManagement();
