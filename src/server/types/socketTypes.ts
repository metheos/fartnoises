// Socket server types and interfaces for the fartnoises game
import { Server as NetServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { ServerToClientEvents, ClientToServerEvents } from "@/types/game";

export interface SocketServer extends NetServer {
  io?: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
}

export interface SocketApiResponse {
  socket: {
    server: SocketServer;
  };
  json: (data: unknown) => void;
  status: (code: number) => SocketApiResponse;
  end: () => void;
}

// Socket context interface for handlers
export interface SocketContext {
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  rooms: Map<string, import("@/types/game").Room>;
  playerRooms: Map<string, string>; // socketId -> roomCode
  roomTimers: Map<string, NodeJS.Timeout>; // roomCode -> timer
  disconnectionTimers: Map<string, NodeJS.Timeout>; // roomCode -> disconnection timer
  reconnectionVoteTimers: Map<string, NodeJS.Timeout>; // roomCode -> vote timer
  mainScreens: Map<string, Set<string>>; // roomCode -> Set of main screen socket IDs
  primaryMainScreens: Map<string, string>; // roomCode -> primary main screen socket ID
}

// Constants for disconnection handling
export const RECONNECTION_GRACE_PERIOD = 30000; // 30 seconds
export const RECONNECTION_VOTE_TIMEOUT = 20000; // 20 seconds to vote
