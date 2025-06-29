#!/usr/bin/env ts-node

/**
 * Test the improved seed generation to verify it breaks linear patterns
 */

// Copy the new seed generation function
function generateWellMixedSeed(
  roomCode: string,
  round: number,
  timestamp: number
): number {
  // Combine multiple sources to create a well-distributed seed
  let hash = 0;

  // Mix in room code
  for (let i = 0; i < roomCode.length; i++) {
    hash = ((hash << 5) - hash + roomCode.charCodeAt(i)) & 0xffffffff;
  }

  // Mix in round number with large prime multiplier
  hash = (hash * 1009 + round * 2017) & 0xffffffff;

  // Mix in timestamp with bit manipulation to break linear patterns
  const mixedTimestamp = timestamp ^ (timestamp >>> 16) ^ (timestamp << 11);
  hash = (hash * 3001 + mixedTimestamp * 5003) & 0xffffffff;

  // Additional mixing pass using xorshift-like operations
  hash ^= hash >>> 13;
  hash = (hash * 0x85ebca6b) & 0xffffffff;
  hash ^= hash >>> 16;
  hash = (hash * 0xc2b2ae35) & 0xffffffff;
  hash ^= hash >>> 13;

  // Ensure positive result
  return Math.abs(hash);
}

// Test the 2-player shuffle with improved seeds
function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let random = seed;

  // For arrays of length 2, use a simpler approach to ensure 50/50 chance
  if (array.length === 2) {
    // Simple linear congruential generator for deterministic randomness
    random = (random * 1664525 + 1013904223) % 2 ** 32;
    const randomValue = random / 2 ** 32;

    // If random value is >= 0.5, swap the items
    if (randomValue >= 0.5) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }

    return shuffled;
  }

  return shuffled; // Simplified for 2-player focus
}

function testImprovedSeeds() {
  console.log("🔧 Testing Improved Seed Generation");
  console.log("====================================");

  const roomCode = "ABCD";
  const round = 1;
  const baseTime = Math.floor(Date.now() / 1000);
  const testArray = ["Alice", "Bob"];

  console.log("\n=== 10-MINUTE SIMULATION WITH IMPROVED SEEDS ===");
  console.log("Testing new seed generation across 10 minutes (every 30s):");
  console.log("Time(s)  Old Seed   New Seed   LCG Result  Status");
  console.log("------   --------   --------   ----------  ------");

  let improvedSwapCount = 0;
  let oldSwapCount = 0;
  const totalRounds = 20;

  for (let i = 0; i < totalRounds; i++) {
    const timeOffset = i * 30;
    const timestamp = baseTime + timeOffset;

    // Old method (problematic)
    const oldSeed = timestamp;

    // New method (improved)
    const newSeed = generateWellMixedSeed(roomCode, round, timestamp);

    // Test with new seed
    let random = newSeed;
    random = (random * 1664525 + 1013904223) % 2 ** 32;
    const randomValue = random / 2 ** 32;

    const isSwap = randomValue >= 0.5;
    const status = isSwap ? "✅ SWAP" : "❌ KEEP";

    if (isSwap) improvedSwapCount++;

    // Also test old seed for comparison
    let oldRandom = oldSeed;
    oldRandom = (oldRandom * 1664525 + 1013904223) % 2 ** 32;
    const oldRandomValue = oldRandom / 2 ** 32;
    if (oldRandomValue >= 0.5) oldSwapCount++;

    console.log(
      `+${timeOffset.toString().padStart(3)}s   ${oldSeed
        .toString()
        .padStart(8)}   ${newSeed
        .toString()
        .padStart(8)}   ${randomValue.toFixed(6)}  ${status}`
    );
  }

  console.log(`\n=== COMPARISON RESULTS ===`);
  console.log(
    `Old method swaps: ${oldSwapCount}/${totalRounds} (${(
      (oldSwapCount / totalRounds) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `New method swaps: ${improvedSwapCount}/${totalRounds} (${(
      (improvedSwapCount / totalRounds) *
      100
    ).toFixed(1)}%)`
  );

  // Test distribution quality
  const seeds: number[] = [];
  for (let i = 0; i < 100; i++) {
    const timestamp = baseTime + i * 30;
    const seed = generateWellMixedSeed(roomCode, round, timestamp);
    seeds.push(seed);
  }

  // Check for patterns in the seeds themselves
  let consecutiveDiffs: number[] = [];
  for (let i = 1; i < seeds.length; i++) {
    consecutiveDiffs.push(Math.abs(seeds[i] - seeds[i - 1]));
  }

  const avgDiff =
    consecutiveDiffs.reduce((a, b) => a + b, 0) / consecutiveDiffs.length;
  const minDiff = Math.min(...consecutiveDiffs);
  const maxDiff = Math.max(...consecutiveDiffs);

  console.log(`\n=== SEED DISTRIBUTION ANALYSIS ===`);
  console.log(
    `Average difference between consecutive seeds: ${avgDiff.toFixed(0)}`
  );
  console.log(`Min difference: ${minDiff}`);
  console.log(`Max difference: ${maxDiff}`);

  if (minDiff > 1000000) {
    console.log("✅ EXCELLENT: Large gaps between consecutive seeds");
  } else if (minDiff > 100000) {
    console.log("✅ GOOD: Reasonable gaps between consecutive seeds");
  } else {
    console.log("⚠️  WARNING: Small gaps might still show patterns");
  }

  // Test multiple room codes and rounds
  console.log(`\n=== CROSS-GAME VARIATION TEST ===`);
  const testCases = [
    { room: "ABCD", round: 1 },
    { room: "ABCD", round: 2 },
    { room: "ABCD", round: 3 },
    { room: "EFGH", round: 1 },
    { room: "XYZA", round: 1 },
  ];

  for (const testCase of testCases) {
    const seed = generateWellMixedSeed(testCase.room, testCase.round, baseTime);
    let random = seed;
    random = (random * 1664525 + 1013904223) % 2 ** 32;
    const randomValue = random / 2 ** 32;
    const status = randomValue >= 0.5 ? "SWAP" : "KEEP";

    console.log(
      `Room ${testCase.room}, Round ${testCase.round}: ${seed
        .toString()
        .padStart(10)} → ${randomValue.toFixed(6)} (${status})`
    );
  }
}

testImprovedSeeds();
