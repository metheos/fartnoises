import { io, Socket } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";

// Very simple test to check join room bot removal
function testJoinRoom() {
  console.log("🧪 Testing Join Room Bot Removal...");

  const socket1 = io(SERVER_URL, {
    path: "/api/socket",
    transports: ["polling", "websocket"],
  });

  const socket2 = io(SERVER_URL, {
    path: "/api/socket",
    transports: ["polling", "websocket"],
  });

  let roomCode: string;

  socket1.on("connect", () => {
    console.log(`🔌 Player1 connected (${socket1.id})`);
    socket1.emit("createRoom", { name: "Player1" }, (code: string) => {
      roomCode = code;
      console.log(`🏠 Created room: ${code}`);

      // Immediately try to join with second player
      setTimeout(() => {
        console.log(`🔗 Player2 attempting to join room ${code}...`);
        socket2.emit(
          "joinRoom",
          roomCode,
          { name: "Player2" },
          (success: boolean) => {
            console.log(`Player2 join result: ${success}`);

            // Cleanup after a moment
            setTimeout(() => {
              socket1.disconnect();
              socket2.disconnect();
              process.exit(0);
            }, 3000);
          }
        );
      }, 1000);
    });
  });

  socket2.on("connect", () => {
    console.log(`🔌 Player2 connected (${socket2.id})`);
  });

  // Timeout
  setTimeout(() => {
    console.log("⏰ Test timeout");
    socket1.disconnect();
    socket2.disconnect();
    process.exit(1);
  }, 10000);
}

console.log("🚀 Starting join room test...");
testJoinRoom();
