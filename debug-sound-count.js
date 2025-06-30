// Simple test to check sound generation
const { getRandomSounds } = require("./src/utils/soundLoader.ts");

async function testSoundCount() {
  try {
    console.log("Testing getRandomSounds(10)...");

    for (let i = 0; i < 10; i++) {
      const sounds = await getRandomSounds(10, undefined, false);
      console.log(`Test ${i + 1}: Got ${sounds.length} sounds`);

      if (sounds.length !== 10) {
        console.log(`❌ Expected 10 sounds, got ${sounds.length}`);
        console.log(
          "Sound IDs:",
          sounds.map((s) => s.id)
        );
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testSoundCount();
