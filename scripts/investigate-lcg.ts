#!/usr/bin/env ts-node

/**
 * Test script to verify the LCG can produce values > 0.5
 */

function testLCG() {
  console.log(
    "Testing LCG with various seeds to check if values > 0.5 are possible:"
  );
  console.log(
    "================================================================="
  );

  const testSeeds = [
    1751163581, // Your original seed that showed 0.932...
    Math.floor(Date.now() / 1000), // Current timestamp
    1000000000,
    2000000000,
    123456789,
    987654321,
    42,
    999999999,
    1234567890,
    555555555,
    777777777,
    1,
    100,
    1000,
    10000,
    100000,
  ];

  let countOver05 = 0;
  let countUnder05 = 0;
  const results: Array<{ seed: number; random: number; result: number }> = [];

  for (const seed of testSeeds) {
    let random = seed;
    // Apply the LCG formula exactly as in gameLogic.ts
    random = (random * 1664525 + 1013904223) % 2 ** 32;
    const result = random / 2 ** 32;

    results.push({ seed, random, result });

    if (result >= 0.5) {
      countOver05++;
    } else {
      countUnder05++;
    }
  }

  // Display results
  for (const { seed, random, result } of results) {
    const status = result >= 0.5 ? "✅ SWAP" : "❌ KEEP";
    console.log(
      `Seed: ${seed.toString().padStart(10)} → LCG: ${random
        .toString()
        .padStart(10)} → Result: ${result.toFixed(6)} ${status}`
    );
  }

  console.log("\n=== SUMMARY ===");
  console.log(
    `Values >= 0.5 (would swap): ${countOver05}/${testSeeds.length} (${(
      (countOver05 / testSeeds.length) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `Values < 0.5 (would keep):  ${countUnder05}/${testSeeds.length} (${(
      (countUnder05 / testSeeds.length) *
      100
    ).toFixed(1)}%)`
  );

  if (countOver05 > 0) {
    console.log("\n✅ SUCCESS: LCG can produce values > 0.5");
  } else {
    console.log("\n❌ PROBLEM: LCG never produces values > 0.5");
  }

  // Test what happens with consecutive seeds (like timestamp-based)
  console.log("\n=== CONSECUTIVE SEED TEST ===");
  console.log(
    "Testing with consecutive seeds (simulating timestamp progression):"
  );

  const baseTime = Math.floor(Date.now() / 1000);
  let consecutiveOver05 = 0;

  for (let i = 0; i < 20; i++) {
    const seed = baseTime + i;
    let random = seed;
    random = (random * 1664525 + 1013904223) % 2 ** 32;
    const result = random / 2 ** 32;

    const status = result >= 0.5 ? "✅ SWAP" : "❌ KEEP";
    console.log(
      `${baseTime} + ${i.toString().padStart(2)} = ${seed} → ${result.toFixed(
        6
      )} ${status}`
    );

    if (result >= 0.5) consecutiveOver05++;
  }

  console.log(
    `\nConsecutive seeds >= 0.5: ${consecutiveOver05}/20 (${(
      (consecutiveOver05 / 20) *
      100
    ).toFixed(1)}%)`
  );

  if (consecutiveOver05 === 0) {
    console.log(
      "⚠️  WARNING: Consecutive timestamp-based seeds might cluster in < 0.5 range"
    );
  }

  // Test 10-minute period simulation
  console.log("\n=== 10-MINUTE GAMEPLAY SIMULATION ===");
  console.log(
    "Testing seeds across a 10-minute period (realistic for game rounds):"
  );

  const startTime = Math.floor(Date.now() / 1000);
  const tenMinutes = 10 * 60; // 600 seconds
  const roundInterval = 30; // Assume rounds happen every 30 seconds
  const totalRounds = Math.floor(tenMinutes / roundInterval);

  let gameplayOver05 = 0;
  const gameplayResults: Array<{
    time: number;
    result: number;
    status: string;
  }> = [];

  console.log(
    `Simulating ${totalRounds} rounds over ${
      tenMinutes / 60
    } minutes (every ${roundInterval}s):`
  );
  console.log("Time(s)  Seed       LCG Result  Status");
  console.log("------   ---------- ----------  ------");

  for (let round = 0; round < totalRounds; round++) {
    const timeOffset = round * roundInterval;
    const seed = startTime + timeOffset;
    let random = seed;
    random = (random * 1664525 + 1013904223) % 2 ** 32;
    const result = random / 2 ** 32;

    const status = result >= 0.5 ? "✅ SWAP" : "❌ KEEP";
    gameplayResults.push({ time: timeOffset, result, status });

    console.log(
      `+${timeOffset.toString().padStart(3)}s   ${seed}  ${result.toFixed(
        6
      )}  ${status}`
    );

    if (result >= 0.5) gameplayOver05++;
  }

  console.log(`\n10-minute gameplay results:`);
  console.log(
    `Rounds with swaps: ${gameplayOver05}/${totalRounds} (${(
      (gameplayOver05 / totalRounds) *
      100
    ).toFixed(1)}%)`
  );

  // Check for clustering
  const clusters: number[] = [];
  let currentCluster = 0;
  let lastWasSwap = gameplayResults[0]?.result >= 0.5;

  for (let i = 1; i < gameplayResults.length; i++) {
    const isSwap = gameplayResults[i].result >= 0.5;
    if (isSwap === lastWasSwap) {
      currentCluster++;
    } else {
      if (currentCluster > 0) clusters.push(currentCluster + 1);
      currentCluster = 0;
      lastWasSwap = isSwap;
    }
  }
  if (currentCluster > 0) clusters.push(currentCluster + 1);

  const maxCluster = Math.max(...clusters, 0);
  console.log(`Longest streak of same result: ${maxCluster} rounds`);

  if (gameplayOver05 === 0) {
    console.log("🚨 CRITICAL: No swaps would occur in 10 minutes of gameplay!");
  } else if (gameplayOver05 / totalRounds < 0.3) {
    console.log("⚠️  WARNING: Low swap rate - players might notice pattern");
  } else if (maxCluster > 5) {
    console.log("⚠️  WARNING: Long streaks detected - might feel non-random");
  } else {
    console.log("✅ GOOD: Reasonable distribution for gameplay");
  }
}

testLCG();

testLCG();
