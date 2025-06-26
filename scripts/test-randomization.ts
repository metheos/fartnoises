// Test script to validate randomization functionality
import {
  shuffleWithSeed,
  seededRandom,
  generateSubmissionSeed,
} from "../src/pages/api/socket";

interface TestSubmission {
  playerId: string;
  playerName: string;
  sounds: [string, string];
}

// Mock submissions for testing
const testSubmissions: TestSubmission[] = [
  { playerId: "1", playerName: "Alice", sounds: ["sound1", "sound2"] },
  { playerId: "2", playerName: "Bob", sounds: ["sound3", "sound4"] },
  { playerId: "3", playerName: "Charlie", sounds: ["sound5", "sound6"] },
  { playerId: "4", playerName: "Diana", sounds: ["sound7", "sound8"] },
];

// Test deterministic randomization
function testRandomization() {
  console.log("Testing submission randomization...");

  const roomCode = "TEST";
  const round = 1;
  const seed = generateSubmissionSeed(roomCode, round);

  console.log("Seed:", seed);
  console.log(
    "Original order:",
    testSubmissions.map((s) => s.playerName).join(", ")
  );

  // Test that the same seed produces the same result
  const randomized1 = shuffleWithSeed(testSubmissions, seed);
  const randomized2 = shuffleWithSeed(testSubmissions, seed);

  console.log(
    "First randomization:",
    randomized1.map((s) => s.playerName).join(", ")
  );
  console.log(
    "Second randomization:",
    randomized2.map((s) => s.playerName).join(", ")
  );

  // Verify they are the same (deterministic)
  const sameOrder = randomized1.every(
    (sub, index) => sub.playerId === randomized2[index].playerId
  );
  console.log("Same order with same seed:", sameOrder);

  // Test that different seeds produce different results
  const differentSeed = generateSubmissionSeed(roomCode, round + 1);
  const randomized3 = shuffleWithSeed(testSubmissions, differentSeed);
  console.log(
    "Different seed randomization:",
    randomized3.map((s) => s.playerName).join(", ")
  );

  const differentOrder = !randomized1.every(
    (sub, index) => sub.playerId === randomized3[index].playerId
  );
  console.log("Different order with different seed:", differentOrder);

  return sameOrder && differentOrder;
}

// Run the test
if (testRandomization()) {
  console.log("✅ Randomization test passed!");
} else {
  console.log("❌ Randomization test failed!");
}
