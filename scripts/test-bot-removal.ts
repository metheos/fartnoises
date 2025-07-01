import { io, Socket } from "socket.io-client";
import {
  Room,
  Player,
  GameState,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../src/types/game";

const SERVER_URL = "http://localhost:3000";

// Simple test to check bot removal when 3rd human joins
function testBotRemoval() {
  console.log("🧪 Testing Bot Removal When 3rd Human Joins...");

  const socket1: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    SERVER_URL,
    {
      path: "/api/socket",
      transports: ["polling", "websocket"],
    }
  );

  const socket2: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    SERVER_URL,
    {
      path: "/api/socket",
      transports: ["polling", "websocket"],
    }
  );

  const socket3: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    SERVER_URL,
    {
      path: "/api/socket",
      transports: ["polling", "websocket"],
    }
  );

  let roomCode: string;

  socket1.on("connect", () => {
    console.log(`🔌 Player1 connected`);
    socket1.emit("createRoom", { name: "Player1" }, (code: string) => {
      roomCode = code;
      console.log(`🏠 Created room: ${code}`);
    });
  });

  socket1.on("roomCreated", ({ room }: { room: Room }) => {
    console.log(`\n✅ Room created with ${room.players.length} players`);

    // Wait then add second player
    setTimeout(() => {
      socket2.emit(
        "joinRoom",
        roomCode,
        { name: "Player2" },
        (success: boolean) => {
          console.log(`Player2 join result: ${success}`);
        }
      );
    }, 1000);
  });

  let joinCount = 0;
  socket1.on("roomUpdated", (room: Room) => {
    joinCount++;
    const humans = room.players.filter((p) => !p.isBot);
    const bots = room.players.filter((p) => p.isBot);

    console.log(`\n📊 Room Update ${joinCount}:`);
    console.log(
      `👥 Total: ${room.players.length} | 👤 Humans: ${humans.length} | 🤖 Bots: ${bots.length}`
    );

    if (joinCount === 2 && humans.length === 2) {
      // Add third player
      setTimeout(() => {
        console.log(`\n🔗 Adding 3rd human player...`);
        socket3.emit(
          "joinRoom",
          roomCode,
          { name: "Player3" },
          (success: boolean) => {
            console.log(`Player3 join result: ${success}`);
          }
        );
      }, 1000);
    } else if (joinCount >= 3) {
      console.log(
        `\n🎯 Final state: ${humans.length} humans, ${bots.length} bots`
      );
      if (humans.length >= 3 && bots.length === 0) {
        console.log(`✅ SUCCESS: Bots correctly removed when 3+ humans`);
      } else {
        console.log(`❌ FAILURE: Expected 0 bots with 3+ humans`);
      }

      // Cleanup
      setTimeout(() => {
        socket1.disconnect();
        socket2.disconnect();
        socket3.disconnect();
        process.exit(0);
      }, 2000);
    }
  });

  // Timeout
  setTimeout(() => {
    console.log("⏰ Test timeout");
    socket1.disconnect();
    socket2.disconnect();
    socket3.disconnect();
    process.exit(1);
  }, 15000);
}

console.log("🚀 Starting bot removal test...");
testBotRemoval();
