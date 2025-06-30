// Test script to verify explicit content loading
const { getSoundEffects } = require("./src/data/gameData.ts");

async function testExplicitContentLoading() {
  try {
    console.log(
      "🧪 Testing sound loading with different explicit content settings...\n"
    );

    // Test loading without explicit content
    console.log("📋 Loading sounds WITHOUT explicit content...");
    const soundsNonExplicit = await getSoundEffects(false);
    console.log(`✅ Loaded ${soundsNonExplicit.length} non-explicit sounds`);

    // Test loading with explicit content
    console.log("\n📋 Loading sounds WITH explicit content...");
    const soundsWithExplicit = await getSoundEffects(true);
    console.log(
      `✅ Loaded ${soundsWithExplicit.length} sounds (including explicit)`
    );

    // Compare the counts
    const explicitSoundsCount =
      soundsWithExplicit.length - soundsNonExplicit.length;
    console.log(`\n📊 Analysis:`);
    console.log(`   Non-explicit sounds: ${soundsNonExplicit.length}`);
    console.log(`   Total sounds: ${soundsWithExplicit.length}`);
    console.log(`   Explicit sounds: ${explicitSoundsCount}`);

    // Test specific sound ID that was missing (22626)
    const problematicSound = soundsWithExplicit.find((s) => s.id === "22626");
    if (problematicSound) {
      console.log(
        `\n🎯 Found problematic sound ID "22626": "${problematicSound.name}"`
      );
      console.log(`   Category: ${problematicSound.category}`);
      console.log(
        `   Is this sound missing from non-explicit set? ${!soundsNonExplicit.find(
          (s) => s.id === "22626"
        )}`
      );
    } else {
      console.log(`\n❌ Sound ID "22626" not found in either set`);
    }
  } catch (error) {
    console.error("❌ Error during testing:", error);
  }
}

testExplicitContentLoading();
