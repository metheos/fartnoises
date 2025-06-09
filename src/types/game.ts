// Game types and interfaces
export interface Player {
  id: string;
  name: string;
  color: string;
  score: number;
  isVIP: boolean;
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
}

export interface GamePrompt {
  id: string;
  text: string;
  category: string;
}

// Socket event types
export interface ServerToClientEvents {
  roomCreated: (data: { room: Room; player: Player }) => void;
  roomJoined: (data: { room: Room; player: Player }) => void;
  roomUpdated: (room: Room) => void;
  gameStateChanged: (state: GameState, data?: Record<string, unknown>) => void;
  playerJoined: (data: { room: Room }) => void;
  playerLeft: (playerId: string) => void;
  error: (data: { message: string }) => void;
  soundSubmitted: (submission: SoundSubmission) => void;
  judgeSelected: (judgeId: string) => void;
  promptSelected: (prompt: string) => void;
  roundComplete: (winnerId: string, winnerName: string) => void;
  gameComplete: (winnerId: string, winnerName: string) => void;
  timeUpdate: (data: { timeLeft: number }) => void;
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
  leaveRoom: () => void;
  startGame: () => void;
  selectPrompt: (promptId: string) => void;
  submitSounds: (sounds: [string, string]) => void;
  selectWinner: (submissionId: string) => void;
  restartGame: () => void;
}
