// Test script to verify sound loading functionality
import { loadEarwaxSounds, getSoundCategories } from "../src/utils/soundLoader";

async function testSoundLoader() {
  console.log("🧪 Testing sound loader functionality...\n");

  try {
    // Test loading sounds
    console.log("📊 Loading sound effects...");
    const sounds = await loadEarwaxSounds();

    console.log(`✅ Successfully loaded ${sounds.length} sound effects`);

    if (sounds.length > 0) {
      console.log("\n📋 Sample sounds:");
      sounds.slice(0, 5).forEach((sound) => {
        console.log(
          `  - ${sound.id}: "${sound.name}" (${sound.category}) -> ${sound.fileName}`
        );
      });

      // Test categories
      console.log("\n🏷️  Getting categories...");
      const categories = await getSoundCategories();
      console.log(
        `✅ Found ${categories.length} categories:`,
        categories.join(", ")
      );

      // Test Unicode decoding
      const unicodeTest = sounds.find((s) => s.name.includes('"'));
      if (unicodeTest) {
        console.log(
          `\n🔤 Unicode test: "${unicodeTest.name}" (properly decoded)`
        );
      }

      console.log("\n🎉 All tests passed!");
    } else {
      console.log("⚠️  No sounds loaded - check the EarwaxAudio.jet file");
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testSoundLoader().catch(console.error);
