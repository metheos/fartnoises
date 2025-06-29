#!/usr/bin/env ts-node

/**
 * Test script to validate the distribution of the shuffleWithSeed function
 * Tests with 2, 3, and 4 submissions to ensure proper randomization
 */

// Import the shuffle function (we'll copy it here to avoid import issues)
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

  // Simple linear congruential generator for deterministic randomness
  const lcg = () => {
    random = (random * 1664525 + 1013904223) % 2 ** 32;
    const result = random / 2 ** 32;
    return result;
  };

  // Fisher-Yates shuffle with seeded randomness
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomValue = lcg();
    const j = Math.floor(randomValue * (i + 1));

    if (i !== j) {
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  }

  return shuffled;
}

// Test data for different array sizes
const testData = {
  2: ["Alice", "Bob"],
  3: ["Alice", "Bob", "Charlie"],
  4: ["Alice", "Bob", "Charlie", "Diana"],
};

// Function to run distribution test
function testDistribution(arraySize: number, iterations: number = 100) {
  console.log(
    `\n=== Testing ${arraySize} submissions (${iterations} iterations) ===`
  );

  const originalArray = testData[arraySize as keyof typeof testData];
  const results: { [key: string]: number } = {};

  // Run the test iterations
  for (let i = 0; i < iterations; i++) {
    // Use more varied seeds to avoid LCG clustering
    // Mix timestamp with larger multipliers and different patterns
    const baseTime = Math.floor(Date.now() / 1000);
    const seed = (baseTime * 31 + i * 1009 + Math.pow(i, 2) * 17) % 2 ** 31;
    const shuffled = shuffleWithSeed(originalArray, seed);
    const resultKey = shuffled.join(",");

    results[resultKey] = (results[resultKey] || 0) + 1;
  }

  // Calculate and display statistics
  console.log("Results:");
  const sortedResults = Object.entries(results).sort((a, b) => b[1] - a[1]);

  let totalPermutations = 0;
  for (const [arrangement, count] of sortedResults) {
    const percentage = ((count / iterations) * 100).toFixed(1);
    console.log(
      `  ${arrangement.padEnd(25)} : ${count
        .toString()
        .padStart(3)} times (${percentage}%)`
    );
    totalPermutations++;
  }

  // Calculate expected vs actual
  const expectedPermutations = factorial(arraySize);
  const expectedPercentage = (100 / expectedPermutations).toFixed(1);

  console.log(`\nStatistics:`);
  console.log(`  Expected permutations: ${expectedPermutations}`);
  console.log(`  Actual permutations: ${totalPermutations}`);
  console.log(`  Expected percentage per arrangement: ~${expectedPercentage}%`);

  // Check if distribution is reasonably even
  const counts = Object.values(results);
  const average = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance =
    counts.reduce((acc, count) => acc + Math.pow(count - average, 2), 0) /
    counts.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = (stdDev / average) * 100;

  console.log(`  Average occurrences: ${average.toFixed(1)}`);
  console.log(`  Standard deviation: ${stdDev.toFixed(1)}`);
  console.log(
    `  Coefficient of variation: ${coefficientOfVariation.toFixed(1)}%`
  );

  // Assessment
  if (coefficientOfVariation < 30) {
    console.log(`  ✅ Distribution looks good (CV < 30%)`);
  } else if (coefficientOfVariation < 50) {
    console.log(`  ⚠️  Distribution is acceptable (CV < 50%)`);
  } else {
    console.log(`  ❌ Distribution may be problematic (CV >= 50%)`);
  }

  return {
    totalPermutations,
    expectedPermutations,
    coefficientOfVariation,
    results,
  };
}

// Helper function to calculate factorial
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

// Run the tests
async function runAllTests() {
  console.log("🎲 Testing Shuffle Distribution");
  console.log("================================");
  console.log("This test validates that our shuffleWithSeed function");
  console.log(
    "produces reasonably even distribution across all possible permutations."
  );

  const testResults: { [key: number]: any } = {};

  // Test with different array sizes
  for (const size of [2, 3, 4]) {
    testResults[size] = testDistribution(size, 100);
  }

  console.log("\n=== SUMMARY ===");
  for (const [size, result] of Object.entries(testResults)) {
    console.log(
      `${size} submissions: ${result.totalPermutations}/${
        result.expectedPermutations
      } permutations, CV: ${result.coefficientOfVariation.toFixed(1)}%`
    );
  }

  console.log("\n=== ANALYSIS ===");
  console.log("For a good shuffle algorithm:");
  console.log("- All possible permutations should appear");
  console.log(
    "- Distribution should be relatively even (low coefficient of variation)"
  );
  console.log("- With 100 iterations, expect some natural variation");

  // Special focus on 2-player case
  console.log("\n=== 2-PLAYER FOCUS ===");
  const twoPlayerResults = testResults[2].results;
  const originalOrder = testData[2].join(",");
  const swappedOrder = testData[2].slice().reverse().join(",");

  const originalCount = twoPlayerResults[originalOrder] || 0;
  const swappedCount = twoPlayerResults[swappedOrder] || 0;

  console.log(
    `Original order (${originalOrder}): ${originalCount} times (${(
      (originalCount / 100) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `Swapped order (${swappedOrder}): ${swappedCount} times (${(
      (swappedCount / 100) *
      100
    ).toFixed(1)}%)`
  );

  const difference = Math.abs(originalCount - swappedCount);
  if (difference <= 20) {
    console.log(
      `✅ 2-player distribution is balanced (difference: ${difference})`
    );
  } else {
    console.log(
      `❌ 2-player distribution may be imbalanced (difference: ${difference})`
    );
  }
}

// Run the tests
runAllTests().catch(console.error);
