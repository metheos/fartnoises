// Game types and interfaces
export interface Player {
  id: string;
  name: string;
  color: string;
  score: number;
  isVIP: boolean;
  isDisconnected?: boolean; // Track disconnection status
  disconnectedAt?: number; // Timestamp when disconnected
}

export interface DisconnectedPlayer {
  id: string;
  name: string;
  color: string;
  score: number;
  isVIP: boolean;
  disconnectedAt: number;
  socketId: string; // Original socket ID for reconnection matching
}

export interface ReconnectionVote {
  voterId: string;
  voterName: string;
  continueWithoutPlayer: boolean; // true = continue, false = wait longer
  timestamp: number;
}

export interface Room {
  code: string;
  players: Player[];
  currentJudge: string | null;
  gameState: GameState;
  currentPrompt: string | null;
  currentRound: number;
  maxRounds: number;
  submissions: SoundSubmission[];
  winner: string | null;
  availablePrompts?: GamePrompt[];
  isPlayingBack?: boolean; // Flag to prevent transitions during playback
  soundSelectionTimerStarted: boolean; // Flag to track if countdown has started for sound selection  // Disconnection handling
  disconnectedPlayers?: DisconnectedPlayer[];
  pausedForDisconnection?: boolean;
  disconnectionTimestamp?: number;
  previousGameState?: GameState; // Store the game state before disconnection
  reconnectionVote?: ReconnectionVote | null;
  reconnectionVoteTimeout?: number;
}

export interface SoundSubmission {
  playerId: string;
  playerName: string;
  sounds: [string, string]; // Two sound effect IDs
}

export interface SoundEffect {
  id: string;
  name: string;
  fileName: string;
  category: string;
}

export enum GameState {
  LOBBY = "lobby",
  JUDGE_SELECTION = "judge_selection",
  PROMPT_SELECTION = "prompt_selection",
  SOUND_SELECTION = "sound_selection",
  PLAYBACK = "playback",
  JUDGING = "judging",
  ROUND_RESULTS = "round_results",
  GAME_OVER = "game_over",
  PAUSED_FOR_DISCONNECTION = "paused_for_disconnection", // New state for handling disconnections
}

export interface GamePrompt {
  id: string;
  text: string;
  category: string;
}

// Socket event types
export interface ServerToClientEvents {
  mainScreenUpdate: (data: { rooms: Room[] }) => void; // Added for main screen room list updates
  roomCreated: (data: { room: Room; player: Player }) => void;
  roomJoined: (data: { room: Room; player: Player }) => void;
  roomUpdated: (room: Room) => void;
  gameStateChanged: (state: GameState, data?: Record<string, unknown>) => void;
  playerJoined: (data: { room: Room }) => void;
  playerLeft: (playerId: string) => void;
  playerDisconnected: (data: {
    playerId: string;
    playerName: string;
    canReconnect: boolean;
  }) => void;
  playerReconnected: (data: { playerId: string; playerName: string }) => void;
  reconnectionVoteRequest: (data: {
    disconnectedPlayerName: string;
    timeLeft: number;
  }) => void;
  reconnectionVoteUpdate: (data: { vote: ReconnectionVote }) => void;
  reconnectionVoteResult: (data: {
    continueWithoutPlayer: boolean;
    disconnectedPlayerName: string;
  }) => void;
  gamePausedForDisconnection: (data: {
    disconnectedPlayerName: string;
    timeLeft: number;
  }) => void;
  gameResumed: () => void;
  error: (data: { message: string }) => void;
  soundSubmitted: (submission: SoundSubmission) => void;
  judgeSelected: (judgeId: string) => void;
  promptSelected: (prompt: string) => void;
  roundComplete: (winnerId: string, winnerName: string) => void;
  gameComplete: (winnerId: string, winnerName: string) => void;
  timeUpdate: (data: { timeLeft: number }) => void;
  submissionPlayback: (data: {
    submissionIndex: number;
    submission: SoundSubmission;
  }) => void;
  playbackProgress: (data: {
    progress: number;
    submissionIndex: number;
  }) => void;
  playbackComplete: () => void;
}

export interface ClientToServerEvents {
  createRoom: (
    playerName: string,
    callback: (roomCode: string) => void
  ) => void;
  joinRoom: (
    roomCode: string,
    playerName: string,
    callback: (success: boolean, room?: Room) => void
  ) => void;
  reconnectToRoom: (
    roomCode: string,
    playerName: string,
    originalPlayerId: string,
    callback: (success: boolean, room?: Room) => void
  ) => void;
  leaveRoom: () => void;
  startGame: () => void;
  selectPrompt: (promptId: string) => void;
  submitSounds: (sounds: [string, string]) => void;
  selectWinner: (submissionId: string) => void;
  voteOnReconnection: (continueWithoutPlayer: boolean) => void;
  restartGame: () => void;
  submissionPlaybackComplete: (submissionIndex: number) => void;
  winnerAudioComplete: () => void;
}
