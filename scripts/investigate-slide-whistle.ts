/**
 * Investigate why "Slide Whistle Down" is biased
 */

import { getSoundEffects } from "../src/data/gameData";
import path from "path";

// Ensure we're using the correct working directory
process.chdir(path.join(__dirname, ".."));

async function investigateSlideWhistleBias() {
  console.log("🔍 Investigating 'Slide Whistle Down' bias...");

  const sounds = await getSoundEffects(true); // Include explicit content for investigation

  // Find the problematic sound
  const slideWhistleIndex = sounds.findIndex(
    (s) => s.name === "Slide Whistle Down"
  );
  const slideWhistle = sounds[slideWhistleIndex];

  console.log(`\n📊 Slide Whistle Down details:`);
  console.log(`Index: ${slideWhistleIndex}`);
  console.log(`Name: "${slideWhistle.name}"`);
  console.log(`ID: "${slideWhistle.id}"`);
  console.log(`Category: "${slideWhistle.category}"`);
  console.log(`Filename: "${slideWhistle.fileName}"`);

  // Check sounds around it
  console.log(`\n📍 Sounds around index ${slideWhistleIndex}:`);
  for (
    let i = Math.max(0, slideWhistleIndex - 5);
    i <= Math.min(sounds.length - 1, slideWhistleIndex + 5);
    i++
  ) {
    const marker = i === slideWhistleIndex ? " >>> " : "     ";
    console.log(`${marker}${i}: ${sounds[i].name}`);
  }

  // Test if the bias is specific to this index
  console.log(`\n🎲 Testing specific index ${slideWhistleIndex} frequency:`);
  const indexTestCount = 100000;
  let targetIndexCount = 0;

  for (let i = 0; i < indexTestCount; i++) {
    const randomIndex = Math.floor(Math.random() * sounds.length);
    if (randomIndex === slideWhistleIndex) {
      targetIndexCount++;
    }
  }

  const expectedCount = indexTestCount / sounds.length;
  console.log(
    `Index ${slideWhistleIndex} selected ${targetIndexCount} times out of ${indexTestCount}`
  );
  console.log(
    `Expected: ~${expectedCount.toFixed(1)}, Actual: ${targetIndexCount}`
  );
  console.log(
    `Deviation: ${(
      ((targetIndexCount - expectedCount) / expectedCount) *
      100
    ).toFixed(1)}%`
  );

  // Test if there are duplicate entries in the sounds array
  console.log(`\n🔍 Checking for duplicate entries of "Slide Whistle Down":`);
  const duplicates = sounds.filter((s) => s.name === "Slide Whistle Down");
  console.log(`Found ${duplicates.length} entries with this name:`);
  duplicates.forEach((sound, index) => {
    const actualIndex = sounds.indexOf(sound);
    console.log(
      `  ${index + 1}. Index ${actualIndex}: ID "${sound.id}", Category "${
        sound.category
      }"`
    );
  });

  // Check for similar sounding names that might be getting confused
  console.log(`\n🔍 Checking for similar names:`);
  const similarNames = sounds.filter(
    (s) =>
      s.name.toLowerCase().includes("slide") ||
      s.name.toLowerCase().includes("whistle")
  );
  console.log(`Found ${similarNames.length} sounds with "slide" or "whistle":`);
  similarNames.forEach((sound) => {
    const actualIndex = sounds.indexOf(sound);
    console.log(`  Index ${actualIndex}: "${sound.name}" (ID: ${sound.id})`);
  });

  // Test Math.random() seed bias - check if there's a pattern in the generated numbers
  console.log(`\n🎲 Testing for patterns in Math.random() output:`);
  const randomValues: number[] = [];
  for (let i = 0; i < 1000; i++) {
    randomValues.push(Math.random());
  }

  // Check if there's a bias toward certain decimal ranges
  const ranges = [
    { name: "0.0-0.1", count: 0 },
    { name: "0.1-0.2", count: 0 },
    { name: "0.2-0.3", count: 0 },
    { name: "0.3-0.4", count: 0 },
    { name: "0.4-0.5", count: 0 },
    { name: "0.5-0.6", count: 0 },
    { name: "0.6-0.7", count: 0 },
    { name: "0.7-0.8", count: 0 },
    { name: "0.8-0.9", count: 0 },
    { name: "0.9-1.0", count: 0 },
  ];

  randomValues.forEach((val) => {
    const rangeIndex = Math.floor(val * 10);
    if (rangeIndex < ranges.length) {
      ranges[rangeIndex].count++;
    }
  });

  console.log("Math.random() decimal range distribution:");
  ranges.forEach((range) => {
    console.log(
      `  ${range.name}: ${range.count} (${((range.count / 1000) * 100).toFixed(
        1
      )}%)`
    );
  });
}

investigateSlideWhistleBias().catch(console.error);
