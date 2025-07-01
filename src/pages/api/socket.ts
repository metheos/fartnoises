// Refactored Socket server setup for Next.js API routes
import { NextApiRequest } from "next";
import { Server as SocketIOServer } from "socket.io";
import { Room } from "@/types/game";
import {
  SocketServer,
  SocketApiResponse,
  SocketContext,
} from "@/server/types/socketTypes";

// Import all handler modules
import {
  setupRoomHandlers,
  setupGameHandlers,
  setupSubmissionHandlers,
  setupReconnectionHandlers,
  setupMainScreenHandlers,
} from "@/server/handlers";

// Import utility functions
import { broadcastRoomListUpdate } from "@/server/utils";

export default function SocketHandler(
  req: NextApiRequest,
  res: SocketApiResponse
) {
  if (res.socket.server.io) {
    console.log("Socket.io already running");
    res.end();
    return;
  }

  console.log("Starting Socket.io server...");
  const io = new SocketIOServer(res.socket.server as SocketServer, {
    path: "/api/socket",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  res.socket.server.io = io;

  // Initialize shared context for all handlers
  const context: SocketContext = {
    io,
    rooms: new Map<string, Room>(),
    playerRooms: new Map<string, string>(), // socketId -> roomCode
    roomTimers: new Map<string, NodeJS.Timeout>(), // roomCode -> timer
    gracePeriodTimers: new Map<string, NodeJS.Timeout>(), // roomCode -> initial grace period timer
    disconnectionTimers: new Map<string, NodeJS.Timeout>(), // roomCode -> disconnection timer
    reconnectionVoteTimers: new Map<string, NodeJS.Timeout>(), // roomCode -> vote timer
    botOnlyRoomTimers: new Map<string, NodeJS.Timeout>(), // roomCode -> bot-only room destruction timer
    mainScreens: new Map<string, Set<string>>(), // roomCode -> Set of main screen socket IDs
    primaryMainScreens: new Map<string, string>(), // roomCode -> primary main screen socket ID
  };

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Send current room list to newly connected client
    broadcastRoomListUpdate(context);

    // Setup all event handlers
    setupRoomHandlers(socket, context);
    setupGameHandlers(socket, context);
    setupSubmissionHandlers(socket, context);
    setupReconnectionHandlers(socket, context);
    setupMainScreenHandlers(socket, context);
  });

  console.log("Socket.io server started successfully");
  res.end();
}
