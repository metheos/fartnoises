// Game types and interfaces
export interface Player {
  id: string;
  name: string;
  color: string;
  emoji?: string; // Player's selected emoji
  score: number;
  likeScore: number; // Track total likes received across all rounds
  isVIP: boolean;
  isBot?: boolean; // Flag to indicate if this is a bot player
  isDisconnected?: boolean; // Track disconnection status
  disconnectedAt?: number; // Timestamp when disconnected
  soundSet?: string[]; // Player's available sound IDs for current round
  hasUsedRefresh?: boolean; // Track if player has used their one-time refresh this game
  hasUsedTripleSound?: boolean; // Track if player has used their one-time triple sound ability this game (submitted 3 sounds)
  hasActivatedTripleSound?: boolean; // Track if player has activated triple sound for the current round
  hasUsedNuclearOption?: boolean; // Track if player has used their one-time nuclear option as judge
}

export interface DisconnectedPlayer {
  id: string;
  name: string;
  color: string;
  emoji?: string; // Player's selected emoji
  score: number;
  likeScore: number; // Track total likes received across all rounds
  isVIP: boolean;
  disconnectedAt: number;
  socketId: string; // Original socket ID for reconnection matching
  soundSet?: string[]; // Player's available sound IDs for current round
  hasUsedRefresh?: boolean; // Track if player has used their one-time refresh this game
  hasUsedTripleSound?: boolean; // Track if player has used their one-time triple sound ability this game (submitted 3 sounds)
  hasActivatedTripleSound?: boolean; // Track if player has activated triple sound for the current round
  hasUsedNuclearOption?: boolean; // Track if player has used their one-time nuclear option as judge
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
  gameState: GameState;
  currentRound: number;
  maxRounds: number;
  maxScore: number; // Added configurable max score
  allowExplicitContent: boolean; // Host setting for explicit content filtering
  currentJudge: string | null;
  currentPrompt: GamePrompt | null;
  promptChoices: GamePrompt[];
  availablePrompts?: GamePrompt[];
  submissions: SoundSubmission[];
  randomizedSubmissions?: SoundSubmission[]; // Randomized order for playback/judging
  submissionSeed?: string; // Seed for deterministic randomization
  lastWinner: string | null;
  lastWinningSubmission: SoundSubmission | null;
  winner: string | null;
  currentSubmissionIndex?: number;
  usedPromptIds?: string[];
  soundSelectionTimerStarted?: boolean;
  judgeSelectionTimerStarted?: boolean;
  isPlayingBack?: boolean;
  disconnectedPlayers?: DisconnectedPlayer[];
  pausedForDisconnection?: boolean;
  previousGameState?: GameState;
  disconnectionTimestamp?: number;
  reconnectionVote?: ReconnectionVote | null;
  mainScreenCount?: number; // Number of connected main screens for this room
}

export interface SoundSubmission {
  playerId: string;
  playerName: string;
  sounds: string[]; // One or two sound effect IDs (1-2 sounds allowed)
  likes?: SubmissionLike[]; // Track likes for this submission
  likeCount?: number; // Cached count for easy access
}

export interface SubmissionLike {
  playerId: string;
  playerName: string;
  timestamp: number;
  roundNumber: number;
  prompt: string;
  submittedSounds: string[];
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
  audioFile?: string; // Optional audio file for prompt playback
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
  roomClosed: (data: { roomCode: string }) => void;
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
  reconnectionTimeUpdate: (data: {
    timeLeft: number;
    phase: string;
    disconnectedPlayerName: string;
  }) => void;
  gameResumed: () => void;
  error: (data: { message: string }) => void;
  soundSubmitted: (submission: SoundSubmission) => void;
  judgeSelected: (judgeId: string) => void;
  promptSelected: (prompt: GamePrompt) => void;
  soundsRefreshed: (data: { playerId: string; newSounds: string[] }) => void; // Notify when player gets new sounds
  tripleSoundActivated: (data: { playerId: string }) => void; // Notify when player activates triple sound ability
  roundComplete: (data: {
    winnerId: string;
    winnerName: string;
    winningSubmission: SoundSubmission;
    submissionIndex: number;
  }) => void;
  gameComplete: (winnerId: string, winnerName: string) => void;
  tieBreakerRound: (data: {
    tiedPlayers: { id: string; name: string }[];
  }) => void;
  gameSettingsUpdated: (settings: {
    maxRounds: number;
    maxScore: number;
    allowExplicitContent: boolean;
  }) => void; // Added for game settings updates
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
  judgingPlaybackResponse: (response: {
    success: boolean;
    submissionIndex: number;
  }) => void;
  playSubmission: (submission: SoundSubmission, index: number) => void;
  playJudgingSubmission: (submission: SoundSubmission, index: number) => void;
  submissionLiked: (data: {
    submissionIndex: number;
    likedBy: string;
    likedByName: string;
    totalLikes: number;
  }) => void;
  nuclearOptionTriggered: (data: {
    judgeId: string;
    judgeName: string;
    roomCode: string;
  }) => void;
}

// Player data for socket events
export interface PlayerData {
  name: string;
  color?: string;
  emoji?: string;
}

export interface ClientToServerEvents {
  createRoom: (
    playerData: PlayerData,
    callback: (roomCode: string) => void
  ) => void;
  createRoomAsMainScreen: (callback: (roomCode: string) => void) => void;
  joinRoom: (
    roomCode: string,
    playerData: PlayerData,
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
  updateGameSettings: (settings: {
    maxRounds: number;
    maxScore: number;
    allowExplicitContent: boolean;
  }) => void; // Added for VIP to update game settings
  selectPrompt: (promptId: string) => void;
  submitSounds: (sounds: string[]) => void;
  refreshSounds: () => void; // Request new sound set (once per game per player)
  activateTripleSound: () => void; // Activate triple sound ability (once per game per player)
  selectWinner: (submissionId: string) => void;
  voteOnReconnection: (continueWithoutPlayer: boolean) => void;
  restartGame: () => void; // Request to restart game with current players
  submissionPlaybackComplete: (submissionIndex: number) => void;
  winnerAudioComplete: () => void;
  requestJudgingPlayback: (data: {
    submissionIndex: number;
    sounds: string[];
  }) => void;
  likeSubmission: (submissionIndex: number) => void;
  judgeNuclearOption: (data: {
    roomCode: string;
    judgeId: string;
    judgeName: string;
  }) => void;
}
