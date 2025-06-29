// Main screen specific event handlers for the fartnoises game server
import { Socket } from "socket.io";
import { SocketContext } from "../types/socketTypes";

export function setupMainScreenHandlers(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _socket: Socket,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: SocketContext
) {
  // Main screen handlers are already covered in roomHandlers.ts
  // This module is kept for potential future main screen specific functionality
  // Any future main screen specific events would go here
  // For example: special admin controls, advanced display options, etc.
}

// Export empty setup for now since main screen functionality
// is handled in roomHandlers.ts with joinRoomAsViewer and requestMainScreenUpdate
