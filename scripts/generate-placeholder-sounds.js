// Script to generate placeholder sound files for testing
// This creates simple beep sounds with different frequencies

const fs = require("fs");
const path = require("path");

const soundsDir = path.join(__dirname, "../public/sounds");

// Ensure sounds directory exists
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

// Sound files we need based on gameData.ts
const soundFiles = [
  "fart1.mp3",
  "fart2.mp3",
  "burp.mp3",
  "goat.mp3",
  "duck.mp3",
  "elephant.mp3",
  "cat.mp3",
  "dog.mp3",
  "laser.mp3",
  "robot.mp3",
  "beep.mp3",
  "dial.mp3",
  "alarm.mp3",
  "piano.mp3",
  "drums.mp3",
  "trombone.mp3",
  "cowbell.mp3",
  "pop.mp3",
  "crunch.mp3",
  "bubble.mp3",
  "sizzle.mp3",
  "explosion.mp3",
  "thunder.mp3",
  "crash.mp3",
  "ding.mp3",
  "boing.mp3",
  "whistle.mp3",
  "squeak.mp3",
  "honk.mp3",
  "clap.mp3",
];

console.log("🎵 Creating placeholder sound files...");
console.log(
  "Note: These are just empty files. Replace with actual audio files for production."
);

soundFiles.forEach((fileName) => {
  const filePath = path.join(soundsDir, fileName);
  if (!fs.existsSync(filePath)) {
    // Create an empty file as placeholder
    fs.writeFileSync(filePath, "");
    console.log(`✅ Created placeholder: ${fileName}`);
  } else {
    console.log(`⏭️ Already exists: ${fileName}`);
  }
});

console.log("\n🎉 Placeholder files created!");
console.log("To add real sounds:");
console.log(
  "1. Replace the empty files in public/sounds/ with actual MP3 files"
);
console.log("2. Make sure the file names match exactly");
console.log("3. Recommended: Use short sounds (1-3 seconds) for best gameplay");
