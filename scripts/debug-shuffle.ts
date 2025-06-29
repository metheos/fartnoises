#!/usr/bin/env ts-node

/**
 * Debug script to investigate the shuffle seeding issue
 */

function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let random = seed;

  console.log(`Input: [${array.join(",")}], Seed: ${seed}`);

  // For arrays of length 2, use a simpler approach to ensure 50/50 chance
  if (array.length === 2) {
    // Simple linear congruential generator for deterministic randomness
    random = (random * 1664525 + 1013904223) % 2 ** 32;
    const randomValue = random / 2 ** 32;
    console.log(`  LCG result: ${random}, Random value: ${randomValue}`);

    // If random value is >= 0.5, swap the items
    if (randomValue >= 0.5) {
      console.log(`  Random >= 0.5, swapping`);
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    } else {
      console.log(`  Random < 0.5, keeping original`);
    }

    console.log(`  Result: [${shuffled.join(",")}]`);
    return shuffled;
  }

  return shuffled; // Simplified for debugging
}

// Test with a few different seeds
console.log("Testing 2-player shuffle with different seeds:");
console.log("==============================================");

const testArray = ["Alice", "Bob"];
const currentTime = Math.floor(Date.now() / 1000);

for (let i = 0; i < 10; i++) {
  const seed = currentTime + i;
  console.log(`\nTest ${i + 1}:`);
  shuffleWithSeed(testArray, seed);
}

console.log("\n\nTesting with more varied seeds:");
console.log("===============================");

const variedSeeds = [
  1751163581, // Your example seed
  1000000000,
  2000000000,
  123456789,
  987654321,
  42,
  999999999,
  1234567890,
  555555555,
  777777777,
];

for (let i = 0; i < variedSeeds.length; i++) {
  console.log(`\nVaried seed test ${i + 1}:`);
  shuffleWithSeed(testArray, variedSeeds[i]);
}
