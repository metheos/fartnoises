// Dynamic sound loader for EarwaxAudio.jet
import { SoundEffect, GamePrompt } from "@/types/game";

interface EarwaxSound {
  id?: number | string;
  name?: string;
  short?: string;
  x?: boolean;
  categories?: string[];
}

interface EarwaxPrompt {
  id: number;
  x: boolean;
  PromptAudio: string;
  name: string;
}

interface EarwaxData {
  content: EarwaxSound[];
}

interface EarwaxPromptData {
  content: EarwaxPrompt[];
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

  // Remove extra quotes and normalize
  cleaned = cleaned.replace(/^["']+|["']+$/g, "").trim();

  // Capitalize first letter of each word for consistency
  cleaned = cleaned.replace(/\b\w/g, (match) => match.toUpperCase());

  return cleaned;
}

// Function to determine category from name and existing categories
function determineCategory(sound: EarwaxSound): string {
  const name = sound.name?.toLowerCase() || "";
  const existingCategories = sound.categories || [];

  // Use existing category if available and not empty
  if (existingCategories.length > 0 && existingCategories[0].trim() !== "") {
    return existingCategories[0].toLowerCase();
  }

  // Categorize based on keywords in the name
  if (
    name.includes("fart") ||
    name.includes("burp") ||
    name.includes("puke") ||
    name.includes("sneeze") ||
    name.includes("urinating") ||
    name.includes("belch") ||
    name.includes("vomit") ||
    name.includes("toilet")
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
    name.includes("sea lion") ||
    name.includes("bark") ||
    name.includes("meow") ||
    name.includes("moo") ||
    name.includes("oink") ||
    name.includes("baa")
  ) {
    return "animal";
  }

  if (
    name.includes("car") ||
    name.includes("truck") ||
    name.includes("jet") ||
    name.includes("train") ||
    name.includes("siren") ||
    name.includes("horn") ||
    name.includes("engine") ||
    name.includes("vehicle") ||
    name.includes("motorcycle")
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
    name.includes("xylophone") ||
    name.includes("trombone") ||
    name.includes("harmonica")
  ) {
    return "music";
  }

  if (
    name.includes("water") ||
    name.includes("liquid") ||
    name.includes("splash") ||
    name.includes("bubble") ||
    name.includes("pour") ||
    name.includes("drip") ||
    name.includes("rain") ||
    name.includes("ocean")
  ) {
    return "liquid";
  }

  if (
    name.includes("punch") ||
    name.includes("fight") ||
    name.includes("battle") ||
    name.includes("sword") ||
    name.includes("impact") ||
    name.includes("crash") ||
    name.includes("explosion") ||
    name.includes("hit")
  ) {
    return "violence";
  }

  if (
    name.includes("cartoon") ||
    name.includes("slide whistle") ||
    name.includes("boing") ||
    name.includes("rubber") ||
    name.includes("squeaky") ||
    name.includes("pop") ||
    name.includes("bounce")
  ) {
    return "cartoon";
  }

  if (
    name.includes("scream") ||
    name.includes("laugh") ||
    name.includes("grunt") ||
    name.includes("gasp") ||
    name.includes('"') ||
    name.includes("voice") ||
    name.includes("hello") ||
    name.includes("yes") ||
    name.includes("no") ||
    name.includes("baby") ||
    name.includes("crowd") ||
    name.includes("cheer")
  ) {
    return "voice";
  }

  if (
    name.includes("computer") ||
    name.includes("robot") ||
    name.includes("electronic") ||
    name.includes("modem") ||
    name.includes("phone") ||
    name.includes("beep") ||
    name.includes("dial") ||
    name.includes("sci-fi") ||
    name.includes("laser")
  ) {
    return "electronic";
  }

  if (
    name.includes("tool") ||
    name.includes("hammer") ||
    name.includes("saw") ||
    name.includes("drill") ||
    name.includes("wrench") ||
    name.includes("scrape") ||
    name.includes("jackhammer") ||
    name.includes("metal")
  ) {
    return "tools";
  }

  if (
    name.includes("door") ||
    name.includes("toilet") ||
    name.includes("vacuum") ||
    name.includes("zipper") ||
    name.includes("scissors") ||
    name.includes("household") ||
    name.includes("kitchen") ||
    name.includes("paper") ||
    name.includes("glass")
  ) {
    return "household";
  }

  return "misc";
}

// Cache for loaded sounds to avoid re-parsing
let soundCache: SoundEffect[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export async function loadEarwaxSounds(): Promise<SoundEffect[]> {
  // Check if we have a valid cache
  const now = Date.now();
  if (soundCache && now - cacheTimestamp < CACHE_DURATION) {
    return soundCache;
  }

  try {
    console.log("Loading EarwaxAudio.jet file...");

    let jetContent: string;

    // Check if we're in a browser or server environment
    if (typeof window !== "undefined") {
      // Browser environment - use fetch
      const response = await fetch("/sounds/Earwax/EarwaxAudio.jet");
      if (!response.ok) {
        throw new Error(
          `Failed to load EarwaxAudio.jet: ${response.statusText}`
        );
      }
      jetContent = await response.text();
    } else {
      // Server environment - use fs
      const fs = await import("fs");
      const path = await import("path");
      const jetFilePath = path.join(
        process.cwd(),
        "public",
        "sounds",
        "Earwax",
        "EarwaxAudio.jet"
      );
      jetContent = fs.readFileSync(jetFilePath, "utf8");
    }
    const earwaxData: EarwaxData = JSON.parse(jetContent);

    console.log(`Processing ${earwaxData.content.length} sound entries...`); // Filter out empty objects and objects without id or name
    const validSounds = earwaxData.content.filter(
      (
        sound
      ): sound is Required<Pick<EarwaxSound, "id" | "name">> & EarwaxSound => {
        if (sound.id === undefined || sound.name === undefined) return false;
        if (typeof sound.name !== "string" || sound.name.trim() === "")
          return false;
        //   if (sound.x) return false; // Filter out explicit content

        // Check if ID is valid (either number > 0 or non-empty string)
        if (typeof sound.id === "number") {
          return sound.id > 0;
        } else if (typeof sound.id === "string") {
          return sound.id.trim() !== "";
        }

        return false;
      }
    );

    console.log(`Found ${validSounds.length} valid, safe sound entries`); // Convert to our SoundEffect format
    const soundEffects: SoundEffect[] = validSounds.map((sound) => {
      const cleanName = cleanSoundName(sound.name);
      const category = determineCategory(sound);
      const soundId = sound.id.toString(); // Convert both numbers and strings to string

      return {
        id: soundId,
        name: cleanName,
        fileName: `${soundId}.ogg`, // Files are in .ogg format in the EarwaxAudio/Audio folder
        category: category,
      };
    });

    // Remove duplicates by name (keep first occurrence)
    const seenNames = new Set<string>();
    const uniqueSoundEffects = soundEffects.filter((sound) => {
      if (seenNames.has(sound.name)) {
        console.log(`Removing duplicate: "${sound.name}" (ID: ${sound.id})`);
        return false;
      }
      seenNames.add(sound.name);
      return true;
    });

    console.log(
      `Removed ${
        soundEffects.length - uniqueSoundEffects.length
      } duplicate sound names`
    );

    // Sort by name for easier browsing
    uniqueSoundEffects.sort((a, b) => a.name.localeCompare(b.name));
    console.log(`✅ Loaded ${uniqueSoundEffects.length} unique sound effects`);
    const categories = [
      ...new Set(uniqueSoundEffects.map((s) => s.category)),
    ].sort();
    console.log(`Categories: ${categories.join(", ")}`);

    // Update cache
    soundCache = uniqueSoundEffects;
    cacheTimestamp = now;

    return uniqueSoundEffects;
  } catch (error) {
    console.error("❌ Error loading sounds:", error);

    // Return empty array on error to prevent app crash
    return [];
  }
}

// Get sounds by category
export async function getSoundsByCategory(
  category: string
): Promise<SoundEffect[]> {
  const allSounds = await loadEarwaxSounds();
  return allSounds.filter((sound) => sound.category === category);
}

// Get random sounds
export async function getRandomSounds(
  count: number,
  category?: string
): Promise<SoundEffect[]> {
  const allSounds = await loadEarwaxSounds();
  const sourceSounds = category
    ? allSounds.filter((sound) => sound.category === category)
    : allSounds;

  if (sourceSounds.length === 0) {
    return [];
  }

  const requestedCount = Math.min(count, sourceSounds.length);
  const uniqueIndices = new Set<number>();
  const maxIndex = sourceSounds.length - 1;

  // Keep adding random indices until we have the desired count
  while (uniqueIndices.size < requestedCount) {
    const randomIndex = Math.floor(Math.random() * (maxIndex + 1));
    uniqueIndices.add(randomIndex);
  }

  // Map the unique indices back to the source sounds array
  return Array.from(uniqueIndices).map((index) => sourceSounds[index]);
}

// Clear cache (useful for development or when we know the file has changed)
export function clearSoundCache(): void {
  soundCache = null;
  cacheTimestamp = 0;
}

// Get all available categories
export async function getSoundCategories(): Promise<string[]> {
  const allSounds = await loadEarwaxSounds();
  return [...new Set(allSounds.map((s) => s.category))].sort();
}

// ========================================
// PROMPT LOADING FUNCTIONS
// ========================================

// Cache for loaded prompts to avoid re-parsing
let promptCache: GamePrompt[] | null = null;
let promptCacheTimestamp: number = 0;

export async function loadEarwaxPrompts(): Promise<GamePrompt[]> {
  // Check if we have a valid cache
  const now = Date.now();
  if (promptCache && now - promptCacheTimestamp < CACHE_DURATION) {
    return promptCache;
  }

  try {
    console.log("Loading EarwaxPrompts.jet file...");

    let jetContent: string;

    // Check if we're in a browser or server environment
    if (typeof window !== "undefined") {
      // Browser environment - use fetch
      const response = await fetch("/sounds/Earwax/EarwaxPrompts.jet");
      if (!response.ok) {
        throw new Error(
          `Failed to load EarwaxPrompts.jet: ${response.statusText}`
        );
      }
      jetContent = await response.text();
    } else {
      // Server environment - use fs
      const fs = await import("fs");
      const path = await import("path");
      const jetFilePath = path.join(
        process.cwd(),
        "public",
        "sounds",
        "Earwax",
        "EarwaxPrompts.jet"
      );
      jetContent = fs.readFileSync(jetFilePath, "utf8");
    }

    const earwaxPromptData: EarwaxPromptData = JSON.parse(jetContent);

    console.log(
      `Processing ${earwaxPromptData.content.length} prompt entries...`
    );

    // Filter out explicit content and invalid entries
    const validPrompts = earwaxPromptData.content.filter((prompt) => {
      if (!prompt.id || !prompt.name || !prompt.PromptAudio) return false;
      if (typeof prompt.name !== "string" || prompt.name.trim() === "")
        return false;
      // if (prompt.x) return false; // Filter out explicit content
      return true;
    });

    console.log(`Found ${validPrompts.length} valid, safe prompt entries`);

    // Convert to our GamePrompt format
    const gamePrompts: GamePrompt[] = validPrompts.map((prompt) => {
      const cleanName = decodeUnicode(prompt.name);

      return {
        id: prompt.id.toString(),
        text: cleanName,
        category: "general", // We could categorize prompts in the future
        audioFile: `${prompt.PromptAudio}.ogg`, // Add audio file reference
      };
    });

    // Sort by name for easier browsing
    gamePrompts.sort((a, b) => a.text.localeCompare(b.text));

    console.log(`✅ Loaded ${gamePrompts.length} game prompts`);

    // Update cache
    promptCache = gamePrompts;
    promptCacheTimestamp = now;

    return gamePrompts;
  } catch (error) {
    console.error("❌ Error loading prompts:", error);

    // Return empty array on error to prevent app crash
    return [];
  }
}

// Function to process prompt text for special tags
function processPromptText(text: string, playerNames: string[] = []): string {
  let processedText = text;

  // Replace <ANY> tags with random player names
  if (playerNames.length > 0) {
    processedText = processedText.replace(/<ANY>/g, () => {
      const randomIndex = Math.floor(Math.random() * playerNames.length);
      return playerNames[randomIndex];
    });
  }

  // Keep <i></i> tags as HTML for React rendering
  // No need to convert them - React can handle HTML tags directly

  return processedText;
}

// Get random prompts
export async function getRandomPrompts(
  count: number = 6,
  excludePromptIds: string[] = [],
  playerNames: string[] = []
): Promise<GamePrompt[]> {
  const allPrompts = await loadEarwaxPrompts();

  // Filter out already used prompts
  const availablePrompts = allPrompts.filter(
    (prompt) => !excludePromptIds.includes(prompt.id)
  );

  // If we don't have enough unused prompts, include all prompts as fallback
  const promptsToSelectFrom =
    availablePrompts.length >= count ? availablePrompts : allPrompts;

  // Generate unique random indices
  const maxIndex = promptsToSelectFrom.length - 1;
  const requestedCount = Math.min(count, promptsToSelectFrom.length);
  const uniqueIndices = new Set<number>();

  while (uniqueIndices.size < requestedCount) {
    const randomIndex = Math.floor(Math.random() * (maxIndex + 1));
    uniqueIndices.add(randomIndex);
  }

  // Select prompts using the unique indices and process their text
  return Array.from(uniqueIndices).map((index) => {
    const prompt = promptsToSelectFrom[index];
    return {
      ...prompt,
      text: processPromptText(prompt.text, playerNames),
    };
  });
}

// Clear prompt cache (useful for development)
export function clearPromptCache(): void {
  promptCache = null;
  promptCacheTimestamp = 0;
}
