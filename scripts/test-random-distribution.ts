// Test script to analyze the distribution of getRandomSounds(12) over 100 iterations
import { getRandomSounds, loadEarwaxSounds } from "../src/utils/soundLoader";

interface SoundCount {
  id: string;
  name: string;
  category: string;
  count: number;
}

async function testRandomDistribution() {
  console.log(
    "🎲 Testing getRandomSounds(12) distribution over 100 iterations...\n"
  );

  // Load all sounds first to get the total count
  const allSounds = await loadEarwaxSounds();
  console.log(`📊 Total available sounds: ${allSounds.length}\n`);

  // Track count for each sound
  const soundCounts = new Map<string, SoundCount>();

  // Initialize counts for all sounds
  allSounds.forEach((sound) => {
    soundCounts.set(sound.id, {
      id: sound.id,
      name: sound.name,
      category: sound.category,
      count: 0,
    });
  });

  const iterations = 50000;
  const soundsPerIteration = 1;

  console.log("🔄 Running iterations...");

  // Run getRandomSounds 100 times
  for (let i = 1; i <= iterations; i++) {
    const randomSounds = await getRandomSounds(soundsPerIteration);

    // Count each selected sound
    randomSounds.forEach((sound) => {
      const soundCount = soundCounts.get(sound.id);
      if (soundCount) {
        soundCount.count++;
      }
    });

    // Progress indicator
    if (i % 10 === 0) {
      process.stdout.write(`${i}... `);
    }
  }

  console.log("\n✅ Completed all iterations!\n");

  // Convert to array and sort by count (descending)
  const results = Array.from(soundCounts.values()).sort(
    (a, b) => b.count - a.count
  );

  // Calculate statistics
  const totalSelections = results.reduce((sum, item) => sum + item.count, 0);
  const expectedSelections = iterations * soundsPerIteration;
  const soundsSelected = results.filter((item) => item.count > 0).length;
  const soundsNeverSelected = results.filter((item) => item.count === 0).length;

  console.log("📈 DISTRIBUTION ANALYSIS");
  console.log("========================");
  console.log(`Total iterations: ${iterations}`);
  console.log(`Sounds per iteration: ${soundsPerIteration}`);
  console.log(`Expected total selections: ${expectedSelections}`);
  console.log(`Actual total selections: ${totalSelections}`);
  console.log(`Sounds selected at least once: ${soundsSelected}`);
  console.log(`Sounds never selected: ${soundsNeverSelected}`);
  console.log(
    `Average selections per sound: ${(
      totalSelections / allSounds.length
    ).toFixed(2)}`
  );
  console.log();

  // Show top 20 most selected sounds
  console.log("🔥 TOP 20 MOST SELECTED SOUNDS");
  console.log("===============================");
  console.log("Rank | Count | ID      | Category           | Name");
  console.log(
    "-----|-------|---------|-------------------|------------------------"
  );

  results.slice(0, 20).forEach((item, index) => {
    const rank = (index + 1).toString().padStart(4);
    const count = item.count.toString().padStart(5);
    const id = item.id.padEnd(7);
    const category = item.category.padEnd(17);
    const name =
      item.name.length > 24 ? item.name.substring(0, 21) + "..." : item.name;
    console.log(`${rank} | ${count} | ${id} | ${category} | ${name}`);
  });

  console.log();

  // Show bottom 10 least selected sounds (that were selected at least once)
  const selectedSounds = results.filter((item) => item.count > 0);
  console.log("❄️  BOTTOM 10 LEAST SELECTED SOUNDS");
  console.log("===================================");
  console.log("Rank | Count | ID      | Category           | Name");
  console.log(
    "-----|-------|---------|-------------------|------------------------"
  );

  selectedSounds
    .slice(-10)
    .reverse()
    .forEach((item, index) => {
      const rank = (selectedSounds.length - 9 + index).toString().padStart(4);
      const count = item.count.toString().padStart(5);
      const id = item.id.padEnd(7);
      const category = item.category.padEnd(17);
      const name =
        item.name.length > 24 ? item.name.substring(0, 21) + "..." : item.name;
      console.log(`${rank} | ${count} | ${id} | ${category} | ${name}`);
    });

  console.log();

  // Category distribution
  const categoryStats = new Map<string, { count: number; sounds: number }>();
  results.forEach((item) => {
    if (!categoryStats.has(item.category)) {
      categoryStats.set(item.category, { count: 0, sounds: 0 });
    }
    const stats = categoryStats.get(item.category)!;
    stats.count += item.count;
    if (item.count > 0) {
      stats.sounds++;
    }
  });

  console.log("📊 CATEGORY DISTRIBUTION");
  console.log("=========================");
  console.log("Category           | Selections | Sounds Used | Avg per Sound");
  console.log("-------------------|------------|-------------|---------------");

  Array.from(categoryStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([category, stats]) => {
      const categoryName = category.padEnd(17);
      const selections = stats.count.toString().padStart(10);
      const soundsUsed = stats.sounds.toString().padStart(11);
      const avgPerSound =
        stats.sounds > 0
          ? (stats.count / stats.sounds).toFixed(1).padStart(13)
          : "0.0".padStart(13);
      console.log(
        `${categoryName} | ${selections} | ${soundsUsed} | ${avgPerSound}`
      );
    });

  console.log();

  // Distribution quality check
  const maxCount = Math.max(...results.map((r) => r.count));
  const minCount = Math.min(
    ...results.filter((r) => r.count > 0).map((r) => r.count)
  );
  const range = maxCount - minCount;
  const idealCount = totalSelections / allSounds.length;
  const variance =
    results.reduce(
      (sum, item) => sum + Math.pow(item.count - idealCount, 2),
      0
    ) / allSounds.length;
  const standardDeviation = Math.sqrt(variance);

  console.log("🎯 RANDOMNESS QUALITY METRICS");
  console.log("==============================");
  console.log(`Highest count: ${maxCount}`);
  console.log(`Lowest count (excluding 0): ${minCount}`);
  console.log(`Range: ${range}`);
  console.log(`Ideal count per sound: ${idealCount.toFixed(2)}`);
  console.log(`Standard deviation: ${standardDeviation.toFixed(2)}`);
  console.log(
    `Coefficient of variation: ${(
      (standardDeviation / idealCount) *
      100
    ).toFixed(1)}%`
  );

  // Quality assessment
  const cv = standardDeviation / idealCount;
  let quality = "EXCELLENT";
  if (cv > 0.5) quality = "POOR";
  else if (cv > 0.3) quality = "FAIR";
  else if (cv > 0.2) quality = "GOOD";

  console.log(`Randomness quality: ${quality}`);
  console.log();

  // Create a simple ASCII histogram for top sounds
  console.log("📊 HISTOGRAM (Top 30 sounds)");
  console.log("=============================");
  const maxBarLength = 50;
  const maxCountForChart = Math.max(
    ...results.slice(0, 30).map((r) => r.count)
  );

  results.slice(0, 30).forEach((item, index) => {
    const barLength = Math.round(
      (item.count / maxCountForChart) * maxBarLength
    );
    const bar = "█".repeat(barLength);
    const count = item.count.toString().padStart(3);
    const name =
      item.name.length > 20
        ? item.name.substring(0, 17) + "..."
        : item.name.padEnd(20);
    console.log(`${count} |${bar} ${name}`);
  });

  console.log("\n🏁 Analysis complete!");
}

// Run the test
testRandomDistribution().catch(console.error);
