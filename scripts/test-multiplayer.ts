import { io, Socket } from "socket.io-client";
import {
  Room,
  Player,
  GameState,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../src/types/game"; // Adjust path as needed

const SERVER_URL = "http://localhost:3000"; // Make sure this matches your running dev server port
const NUM_PLAYERS = 5;
const PLAYER_NAMES = [
  "TestBot1",
  "TestBot2",
  "TestBot3",
  "TestBot4",
  "TestBot5",
];

let roomCodeGlobal: string | null = null;
let hostSocket: Socket<ServerToClientEvents, ClientToServerEvents> | null =
  null;
let currentRoom: Room | null = null;
let availablePrompts: any[] = [];
let availableSounds: string[] = [
  "fart1",
  "fart2",
  "burp",
  "goat",
  "duck",
  "laser",
  "robot",
];

function createPlayer(index: number) {
  const playerName = PLAYER_NAMES[index] || `TestBot${index + 1}`;
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    SERVER_URL,
    {
      path: "/api/socket",
      transports: ["polling", "websocket"], // Start with polling, upgrade to websocket
      reconnectionAttempts: 3,
      timeout: 10000,
    }
  );

  socket.on("connect", () => {
    console.log(`Player ${playerName} (ID: ${socket.id}) connected.`);

    if (index === 0) {
      // First player creates the room
      hostSocket = socket;
      socket.emit("createRoom", playerName, (roomCode) => {
        console.log(`Player ${playerName} created room: ${roomCode}`);
        roomCodeGlobal = roomCode;
        // Host automatically joins, listen for roomCreated
      });
    } else {
      // Other players join the room
      if (roomCodeGlobal) {
        socket.emit("joinRoom", roomCodeGlobal, playerName, (success, room) => {
          if (success && room) {
            console.log(
              `Player ${playerName} joined room: ${roomCodeGlobal}. Current players: ${room.players
                .map((p) => p.name)
                .join(", ")}`
            );
          } else {
            console.error(
              `Player ${playerName} failed to join room: ${roomCodeGlobal}`
            );
          }
        });
      } else {
        console.warn(`Player ${playerName} waiting for room code...`);
        // Simple retry mechanism or wait for roomCodeGlobal to be set
        setTimeout(() => {
          if (roomCodeGlobal) {
            socket.emit(
              "joinRoom",
              roomCodeGlobal,
              playerName,
              (success, room) => {
                if (success && room) {
                  console.log(
                    `Player ${playerName} (retry) joined room: ${roomCodeGlobal}. Players: ${room.players.length}`
                  );
                } else {
                  console.error(
                    `Player ${playerName} (retry) failed to join room: ${roomCodeGlobal}`
                  );
                }
              }
            );
          }
        }, 2000);
      }
    }
  });

  socket.on("roomCreated", ({ room, player }) => {
    console.log(
      `[${playerName}] Event: roomCreated - Room: ${room.code}, Host: ${player.name}`
    );
    if (player.id === socket.id) {
      console.log(`[${playerName}] I am the host of room ${room.code}.`);
    }
  });

  socket.on("roomJoined", ({ room, player }) => {
    console.log(
      `[${playerName}] Event: roomJoined - Room: ${room.code}, New Player: ${player.name}`
    );
    if (player.id === socket.id) {
      console.log(`[${playerName}] I have joined room ${room.code}.`);
    }
    console.log(
      `[${playerName}] Players in room ${room.code}: ${room.players
        .map((p) => p.name)
        .join(", ")}`
    );
  });
  socket.on("roomUpdated", (room) => {
    console.log(
      `[${playerName}] Event: roomUpdated - Room: ${
        room.code
      }, Players: ${room.players.map((p) => p.name).join(", ")}, State: ${
        room.gameState
      }`
    );
    currentRoom = room;

    // If enough players and this is the host, start the game
    if (
      room.players.length >= NUM_PLAYERS &&
      socket.id === hostSocket?.id &&
      room.gameState === GameState.LOBBY
    ) {
      console.log(
        `[${playerName}] Enough players. Host is starting the game...`
      );
      socket.emit("startGame");
    }
  });

  socket.on("playerJoined", ({ room }) => {
    console.log(
      `[${playerName}] Event: playerJoined - A player joined room ${
        room.code
      }. Players: ${room.players.map((p) => p.name).join(", ")}`
    );
  });
  socket.on("gameStateChanged", (newState, data) => {
    console.log(
      `[${playerName}] Event: gameStateChanged - New State: ${newState}, Data:`,
      data
    );

    // Handle different game states with bot logic
    switch (newState) {
      case GameState.PROMPT_SELECTION:
        // If this player is the judge and prompts are available, select one
        if (currentRoom?.currentJudge === socket.id && data?.prompts) {
          availablePrompts = data.prompts;
          console.log(`[${playerName}] I'm the judge! Selecting a prompt...`);

          // Randomly select a prompt after a short delay
          setTimeout(() => {
            const randomPrompt =
              availablePrompts[
                Math.floor(Math.random() * availablePrompts.length)
              ];
            console.log(
              `[${playerName}] Judge selecting prompt: "${randomPrompt.text}"`
            );
            socket.emit("selectPrompt", randomPrompt.id);
          }, 1000 + Math.random() * 2000); // 1-3 second delay
        }
        break;

      case GameState.SOUND_SELECTION:
        // If this player is NOT the judge, select sounds
        if (currentRoom?.currentJudge !== socket.id) {
          console.log(`[${playerName}] Selecting sounds for the prompt...`);

          // Randomly select 2 different sounds after a delay
          setTimeout(() => {
            const shuffledSounds = [...availableSounds].sort(
              () => 0.5 - Math.random()
            );
            const selectedSounds: [string, string] = [
              shuffledSounds[0],
              shuffledSounds[1],
            ];
            console.log(
              `[${playerName}] Submitting sounds: [${selectedSounds.join(
                ", "
              )}]`
            );
            socket.emit("submitSounds", selectedSounds);
          }, 2000 + Math.random() * 3000); // 2-5 second delay
        } else {
          console.log(
            `[${playerName}] I'm the judge, waiting for other players to submit sounds...`
          );
        }
        break;
      case GameState.JUDGING:
        // If this player is the judge, pick a winner
        if (
          currentRoom?.currentJudge === socket.id &&
          currentRoom?.submissions?.length > 0
        ) {
          console.log(
            `[${playerName}] I'm judging ${currentRoom.submissions.length} submissions...`
          );

          // Randomly select a winner after a delay
          setTimeout(() => {
            const winnerIndex = Math.floor(
              Math.random() * currentRoom!.submissions.length
            );
            const winningSubmission = currentRoom!.submissions[winnerIndex];
            console.log(
              `[${playerName}] Judge selecting winner: Submission ${
                winnerIndex + 1
              } by ${winningSubmission.playerName}`
            );
            socket.emit("selectWinner", winnerIndex.toString());
          }, 3000 + Math.random() * 2000); // 3-5 second delay
        } else {
          console.log(`[${playerName}] Waiting for judge to pick a winner...`);
        }
        break;

      case GameState.ROUND_RESULTS:
        console.log(
          `[${playerName}] Round complete! Waiting for next round...`
        );
        break;

      case GameState.GAME_OVER:
        console.log(`[${playerName}] Game over! Final scores will be shown.`);
        break;
    }
  });

  socket.on("error", ({ message }) => {
    console.error(`[${playerName}] Event: error - Message: ${message}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`Player ${playerName} disconnected. Reason: ${reason}`);
  });

  socket.on("connect_error", (err) => {
    console.error(`Player ${playerName} connection error: ${err.message}`);
  });

  return socket;
}

console.log(
  `Attempting to simulate ${NUM_PLAYERS} players connecting to ${SERVER_URL}...`
);
console.log(`Make sure your dev server is running on ${SERVER_URL}`);

const players: Socket[] = [];
for (let i = 0; i < NUM_PLAYERS; i++) {
  // Stagger connections slightly
  setTimeout(() => {
    players.push(createPlayer(i));
  }, i * 500); // 500ms delay between each player connection
}

// Keep the script running for a while to observe events
setTimeout(() => {
  console.log("Test script finished. Disconnecting players...");
  players.forEach((socket) => socket.disconnect());
  process.exit(0);
}, 30000); // Run for 30 seconds
