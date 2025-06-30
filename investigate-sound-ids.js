// Investigate sounds around ID 22626
const { getSoundEffects } = require("./src/data/gameData.ts");

async function investigateSoundIds() {
  try {
    console.log("🔍 Investigating sound IDs around 22626...\n");

    const sounds = await getSoundEffects(true);

    // Find sounds with IDs near 22626
    const targetId = 22626;
    const nearbyIds = sounds
      .filter((s) => {
        const numId = parseInt(s.id.toString());
        return !isNaN(numId) && Math.abs(numId - targetId) <= 10;
      })
      .sort((a, b) => parseInt(a.id.toString()) - parseInt(b.id.toString()));

    console.log(`Found ${nearbyIds.length} sounds with IDs near ${targetId}:`);
    nearbyIds.forEach((sound) => {
      console.log(
        `  ID: ${sound.id} - "${sound.name}" (Category: ${sound.category})`
      );
    });

    // Check if any sounds have "22626" as a string
    const stringMatch = sounds.filter((s) => s.id.toString().includes("22626"));
    console.log(`\nSounds with "22626" in ID: ${stringMatch.length}`);
    stringMatch.forEach((sound) => {
      console.log(`  ID: ${sound.id} - "${sound.name}"`);
    });

    // Sample some random IDs to see the format
    console.log("\nSample of sound ID formats:");
    sounds.slice(0, 10).forEach((sound) => {
      console.log(
        `  ID: ${sound.id} (type: ${typeof sound.id}) - "${sound.name}"`
      );
    });

    // Check if there are any explicit sounds at all
    console.log(`\nTotal sounds loaded: ${sounds.length}`);
  } catch (error) {
    console.error("❌ Error during investigation:", error);
  }
}

investigateSoundIds();
