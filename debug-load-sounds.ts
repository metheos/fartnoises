// Debug script to test sound loading with detailed stats
import { loadEarwaxSounds } from "./src/utils/soundLoader";

async function debugSoundLoading() {
  try {
    console.log("📋 Loading sounds WITHOUT explicit content...");
    const soundsNoExplicit = await loadEarwaxSounds(false);
    console.log(`✅ Loaded ${soundsNoExplicit.length} sounds (no explicit)`);

    console.log("\n📋 Loading sounds WITH explicit content...");
    const soundsWithExplicit = await loadEarwaxSounds(true);
    console.log(
      `✅ Loaded ${soundsWithExplicit.length} sounds (including explicit)`
    );

    console.log("\n📊 SUMMARY:");
    console.log(`Without explicit: ${soundsNoExplicit.length} sounds`);
    console.log(`With explicit: ${soundsWithExplicit.length} sounds`);
    console.log(
      `Difference: ${
        soundsWithExplicit.length - soundsNoExplicit.length
      } sounds`
    );

    if (soundsWithExplicit.length < soundsNoExplicit.length) {
      console.log(
        "❌ ERROR: Including explicit content resulted in FEWER sounds!"
      );
    } else if (soundsWithExplicit.length === soundsNoExplicit.length) {
      console.log(
        "⚠️ WARNING: No explicit content found, or all explicit content was duplicates"
      );
    } else {
      console.log(
        "✅ GOOD: Including explicit content increased the sound count as expected"
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

debugSoundLoading();
