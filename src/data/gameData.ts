// Game data: sound effects library
import { SoundEffect, GamePrompt } from "@/types/game";

export const SOUND_EFFECTS: SoundEffect[] = [
  // Funny/Quirky sounds
  {
    id: "fart1",
    name: "Classic Fart",
    fileName: "fart1.mp3",
    category: "bodily",
  },
  {
    id: "fart2",
    name: "Squeaky Fart",
    fileName: "fart2.mp3",
    category: "bodily",
  },
  { id: "burp", name: "Loud Burp", fileName: "burp.mp3", category: "bodily" },

  // Animal sounds
  {
    id: "goat",
    name: "Screaming Goat",
    fileName: "goat.mp3",
    category: "animals",
  },
  { id: "duck", name: "Angry Duck", fileName: "duck.mp3", category: "animals" },
  {
    id: "elephant",
    name: "Elephant Trumpet",
    fileName: "elephant.mp3",
    category: "animals",
  },
  { id: "cat", name: "Angry Cat", fileName: "cat.mp3", category: "animals" },
  {
    id: "dog",
    name: "Tiny Dog Bark",
    fileName: "dog.mp3",
    category: "animals",
  },

  // Mechanical/Tech sounds
  {
    id: "laser",
    name: "Laser Pew Pew",
    fileName: "laser.mp3",
    category: "tech",
  },
  { id: "robot", name: "Robot Voice", fileName: "robot.mp3", category: "tech" },
  { id: "beep", name: "Error Beep", fileName: "beep.mp3", category: "tech" },
  {
    id: "dial-up",
    name: "Dial-up Internet",
    fileName: "dialup.mp3",
    category: "tech",
  },

  // Musical/Sound effects
  {
    id: "trombone",
    name: "Sad Trombone",
    fileName: "trombone.mp3",
    category: "musical",
  },
  {
    id: "applause",
    name: "Applause",
    fileName: "applause.mp3",
    category: "musical",
  },
  {
    id: "boo",
    name: "Disappointed Crowd",
    fileName: "boo.mp3",
    category: "musical",
  },
  {
    id: "airhorn",
    name: "Air Horn",
    fileName: "airhorn.mp3",
    category: "musical",
  },

  // Everyday sounds
  {
    id: "sizzle",
    name: "Sizzling Bacon",
    fileName: "sizzle.mp3",
    category: "food",
  },
  {
    id: "crunch",
    name: "Loud Crunch",
    fileName: "crunch.mp3",
    category: "food",
  },
  { id: "slurp", name: "Loud Slurp", fileName: "slurp.mp3", category: "food" },
  {
    id: "microwave",
    name: "Microwave Ding",
    fileName: "microwave.mp3",
    category: "food",
  },

  // Explosive/Dramatic
  {
    id: "explosion",
    name: "Giant Explosion",
    fileName: "explosion.mp3",
    category: "dramatic",
  },
  {
    id: "scream",
    name: "Wilhelm Scream",
    fileName: "scream.mp3",
    category: "dramatic",
  },
  {
    id: "crash",
    name: "Car Crash",
    fileName: "crash.mp3",
    category: "dramatic",
  },
  {
    id: "thunder",
    name: "Thunder Clap",
    fileName: "thunder.mp3",
    category: "dramatic",
  },

  // Weird/Random
  {
    id: "squeaky-toy",
    name: "Squeaky Toy",
    fileName: "squeaky.mp3",
    category: "weird",
  },
  {
    id: "boing",
    name: "Cartoon Boing",
    fileName: "boing.mp3",
    category: "weird",
  },
  {
    id: "whoosh",
    name: "Magic Whoosh",
    fileName: "whoosh.mp3",
    category: "weird",
  },
  {
    id: "record-scratch",
    name: "Record Scratch",
    fileName: "scratch.mp3",
    category: "weird",
  },
];

export const GAME_PROMPTS: GamePrompt[] = [
  // Relationship/Dating
  { id: "first-kiss", text: "The sound of a first kiss", category: "romance" },
  { id: "bad-date", text: "The worst date ever", category: "romance" },
  { id: "breakup", text: "Getting dumped via text", category: "romance" },
  { id: "wedding", text: "A wedding gone wrong", category: "romance" },

  // Everyday situations
  { id: "monday", text: "Monday morning", category: "daily" },
  { id: "traffic", text: "Being stuck in traffic", category: "daily" },
  { id: "wifi-down", text: "When the wifi goes down", category: "daily" },
  { id: "alarm", text: "Hitting the snooze button", category: "daily" },
  { id: "cooking", text: "Attempting to cook", category: "daily" },

  // Weird/Abstract
  { id: "wombat", text: "The inside of a wombat", category: "weird" },
  { id: "alien", text: "First contact with aliens", category: "weird" },
  { id: "time-travel", text: "Traveling back in time", category: "weird" },
  { id: "dreams", text: "A fever dream", category: "weird" },
  { id: "space", text: "The sound of space", category: "weird" },

  // Life events
  { id: "birthday", text: "The worst birthday ever", category: "events" },
  {
    id: "job-interview",
    text: "A disastrous job interview",
    category: "events",
  },
  { id: "dentist", text: "Going to the dentist", category: "events" },
  { id: "exercise", text: "Trying to exercise", category: "events" },

  // Food/Eating
  { id: "spicy", text: "Eating something too spicy", category: "food" },
  { id: "expired", text: "Realizing the milk is expired", category: "food" },
  { id: "diet", text: "Starting a new diet", category: "food" },
  { id: "cooking-show", text: "A cooking show disaster", category: "food" },

  // Technology
  { id: "phone-battery", text: "Your phone dying at 1%", category: "tech" },
  { id: "password", text: "Forgetting your password", category: "tech" },
  {
    id: "video-call",
    text: "Joining a video call with your camera on",
    category: "tech",
  },
  { id: "autocorrect", text: "Autocorrect embarrassment", category: "tech" },

  // Random/Funny
  { id: "babies", text: "How babies are made", category: "random" },
  { id: "taxes", text: "Doing your taxes", category: "random" },
  { id: "elevator", text: "Awkward elevator silence", category: "random" },
  {
    id: "public-speaking",
    text: "Fear of public speaking",
    category: "random",
  },
];

// Player colors for avatars
export const PLAYER_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
  "#98D8C8", // Mint
  "#F7DC6F", // Light yellow
];

// Game configuration
export const GAME_CONFIG = {
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 8,
  DEFAULT_MAX_ROUNDS: 5,
  SOUND_SELECTION_TIME: 45, // seconds
  PROMPT_SELECTION_TIME: 15, // seconds
  ROOM_CODE_LENGTH: 4,
};
