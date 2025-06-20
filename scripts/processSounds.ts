// Script to process EarwaxAudio.jet and generate sound effects data
import fs from "fs";
import path from "path";

interface EarwaxSound {
  id?: number;
  name?: string;
  short?: string;
  x?: boolean;
  categories?: string[];
}

interface EarwaxData {
  content: EarwaxSound[];
}

// Function to decode Unicode escape sequences
function decodeUnicode(str: string): string {
  return str.replace(/\\u[\dA-F]{4}/gi, (match) => {
    return String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16));
  });
}

// Function to clean and format sound names
function cleanSoundName(name: string): string {
  // Decode Unicode first
  let cleaned = decodeUnicode(name);

  // Remove quotes around certain phrases
  cleaned = cleaned.replace(/["'"]/g, '"');

  // Capitalize first letter of each word for consistency
  cleaned = cleaned.replace(/\b\w/g, (match) => match.toUpperCase());

  return cleaned;
}

// Function to determine category from name and existing categories
function determineCategory(sound: EarwaxSound): string {
  const name = sound.name?.toLowerCase() || "";
  const existingCategories = sound.categories || [];

  // Use existing category if available
  if (existingCategories.length > 0) {
    return existingCategories[0].toLowerCase();
  }

  // Categorize based on keywords in the name
  if (
    name.includes("fart") ||
    name.includes("burp") ||
    name.includes("puke") ||
    name.includes("sneeze") ||
    name.includes("urinating") ||
    name.includes("belch")
  ) {
    return "bodily functions";
  }

  if (
    name.includes("animal") ||
    name.includes("dog") ||
    name.includes("cat") ||
    name.includes("pig") ||
    name.includes("cow") ||
    name.includes("rooster") ||
    name.includes("turkey") ||
    name.includes("lamb") ||
    name.includes("squirrel") ||
    name.includes("owl") ||
    name.includes("parrot") ||
    name.includes("sea lion")
  ) {
    return "animal";
  }

  if (
    name.includes("car") ||
    name.includes("truck") ||
    name.includes("jet") ||
    name.includes("train") ||
    name.includes("siren") ||
    name.includes("horn")
  ) {
    return "vehicle";
  }

  if (
    name.includes("music") ||
    name.includes("piano") ||
    name.includes("trumpet") ||
    name.includes("violin") ||
    name.includes("organ") ||
    name.includes("whistle") ||
    name.includes("kazoo") ||
    name.includes("xylophone")
  ) {
    return "music";
  }

  if (
    name.includes("water") ||
    name.includes("liquid") ||
    name.includes("splash") ||
    name.includes("bubble") ||
    name.includes("pour") ||
    name.includes("drip")
  ) {
    return "liquid";
  }

  if (
    name.includes("punch") ||
    name.includes("fight") ||
    name.includes("battle") ||
    name.includes("sword") ||
    name.includes("impact") ||
    name.includes("crash")
  ) {
    return "violence";
  }

  if (
    name.includes("cartoon") ||
    name.includes("slide whistle") ||
    name.includes("boing") ||
    name.includes("rubber") ||
    name.includes("squeaky")
  ) {
    return "cartoon";
  }

  if (
    name.includes("voice") ||
    name.includes("scream") ||
    name.includes("laugh") ||
    name.includes("grunt") ||
    name.includes("gasp") ||
    name.includes('"')
  ) {
    return "voice";
  }

  if (
    name.includes("computer") ||
    name.includes("robot") ||
    name.includes("electronic") ||
    name.includes("modem") ||
    name.includes("phone") ||
    name.includes("beep")
  ) {
    return "electronic";
  }

  if (
    name.includes("tool") ||
    name.includes("hammer") ||
    name.includes("saw") ||
    name.includes("drill") ||
    name.includes("wrench") ||
    name.includes("scrape")
  ) {
    return "tools";
  }

  if (
    name.includes("household") ||
    name.includes("door") ||
    name.includes("toilet") ||
    name.includes("vacuum") ||
    name.includes("zipper") ||
    name.includes("scissors")
  ) {
    return "household";
  }

  return "misc";
}

async function processSounds() {
  try {
    console.log("Reading EarwaxAudio.jet file...");

    const jetFilePath = path.join(
      process.cwd(),
      "public",
      "sounds",
      "Earwax",
      "EarwaxAudio.jet"
    );
    const jetContent = fs.readFileSync(jetFilePath, "utf8");

    console.log("Parsing JSON data...");
    const earwaxData: EarwaxData = JSON.parse(jetContent);

    console.log(`Found ${earwaxData.content.length} total entries`);
    // Filter out empty objects and objects without id or name
    const validSounds = earwaxData.content.filter(
      (
        sound
      ): sound is Required<Pick<EarwaxSound, "id" | "name">> & EarwaxSound =>
        sound.id !== undefined &&
        sound.name !== undefined &&
        typeof sound.id === "number" &&
        sound.id > 0 &&
        typeof sound.name === "string" &&
        sound.name.trim() !== ""
    );

    console.log(`Found ${validSounds.length} valid sound entries`);

    // Convert to our SoundEffect format
    const soundEffects = validSounds.map((sound) => {
      const cleanName = cleanSoundName(sound.name);
      const category = determineCategory(sound);

      return {
        id: sound.id.toString(),
        name: cleanName,
        fileName: `${sound.id}.ogg`, // Files are in .ogg format in the EarwaxAudio/Audio folder
        category: category,
        isExplicit: sound.x || false, // Track explicit content
      };
    });

    // Sort by name for easier browsing
    soundEffects.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Generated ${soundEffects.length} sound effects`);
    console.log(
      `Categories found: ${[...new Set(soundEffects.map((s) => s.category))]
        .sort()
        .join(", ")}`
    );

    // Write the processed data to a TypeScript file
    const outputPath = path.join(
      process.cwd(),
      "src",
      "data",
      "processedSounds.ts"
    );

    const tsContent = `// Auto-generated from EarwaxAudio.jet
// This file contains all the sound effects from the Earwax audio library

import { SoundEffect } from "@/types/game";

export const EARWAX_SOUND_EFFECTS: SoundEffect[] = [
${soundEffects
  .map(
    (sound) => `  {
    id: "${sound.id}",
    name: "${sound.name}",
    fileName: "${sound.fileName}",
    category: "${sound.category}",${
      sound.isExplicit ? "\n    isExplicit: true," : ""
    }
  }`
  )
  .join(",\n")}
];

// Category breakdown:
${[...new Set(soundEffects.map((s) => s.category))]
  .sort()
  .map(
    (cat) =>
      `// ${cat}: ${
        soundEffects.filter((s) => s.category === cat).length
      } sounds`
  )
  .join("\n")}

export const SOUND_CATEGORIES = [
${[...new Set(soundEffects.map((s) => s.category))]
  .sort()
  .map((cat) => `  "${cat}"`)
  .join(",\n")}
];
`;

    fs.writeFileSync(outputPath, tsContent);
    console.log(`✅ Generated ${outputPath}`);

    // Also create a sample of sounds for easier review
    const sampleSounds = soundEffects.slice(0, 20);
    console.log("\n📋 Sample of generated sounds:");
    sampleSounds.forEach((sound) => {
      console.log(`  ${sound.id}: "${sound.name}" (${sound.category})`);
    });

    return soundEffects;
  } catch (error) {
    console.error("❌ Error processing sounds:", error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  processSounds().catch(console.error);
}

export { processSounds };
