// Dynamic sound loader for EarwaxAudio.jet
import { SoundEffect, GamePrompt } from "@/types/game";
import { processPromptText } from "@/utils/gameUtils";

// Configuration for sound file locations
const SOUND_BASE_URL = process.env.NEXT_PUBLIC_SOUND_BASE_URL || "/sounds";

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
export function cleanSoundName(name: string): string {
  // Decode Unicode first
  let cleaned = decodeUnicode(name);

  // Remove extra quotes and normalize - DISABLED to preserve capitalization cues
  // cleaned = cleaned.replace(/^["']+|["']+$/g, "").trim();
  cleaned = cleaned.trim();

  // Convert common contractions with underscores to proper apostrophes
  // This handles cases like "It_s" -> "It's", "I_m" -> "I'm", etc.
  const contractionPatterns = [
    // Common contractions - order matters for some cases
    { pattern: /\bI_m\b/gi, replacement: "I'm" },
    { pattern: /\bI_ll\b/gi, replacement: "I'll" },
    { pattern: /\bI_ve\b/gi, replacement: "I've" },
    { pattern: /\bI_d\b/gi, replacement: "I'd" },
    { pattern: /\bit_s\b/gi, replacement: "it's" },
    { pattern: /\bthat_s\b/gi, replacement: "that's" },
    { pattern: /\bwhat_s\b/gi, replacement: "what's" },
    { pattern: /\bwhere_s\b/gi, replacement: "where's" },
    { pattern: /\bwhen_s\b/gi, replacement: "when's" },
    { pattern: /\bwho_s\b/gi, replacement: "who's" },
    { pattern: /\bhow_s\b/gi, replacement: "how's" },
    { pattern: /\bhere_s\b/gi, replacement: "here's" },
    { pattern: /\bthere_s\b/gi, replacement: "there's" },
    { pattern: /\bhe_s\b/gi, replacement: "he's" },
    { pattern: /\bshe_s\b/gi, replacement: "she's" },
    { pattern: /\bwe_re\b/gi, replacement: "we're" },
    { pattern: /\bthey_re\b/gi, replacement: "they're" },
    { pattern: /\byou_re\b/gi, replacement: "you're" },
    { pattern: /\bwe_ll\b/gi, replacement: "we'll" },
    { pattern: /\bthey_ll\b/gi, replacement: "they'll" },
    { pattern: /\byou_ll\b/gi, replacement: "you'll" },
    { pattern: /\bhe_ll\b/gi, replacement: "he'll" },
    { pattern: /\bshe_ll\b/gi, replacement: "she'll" },
    { pattern: /\bwe_ve\b/gi, replacement: "we've" },
    { pattern: /\bthey_ve\b/gi, replacement: "they've" },
    { pattern: /\byou_ve\b/gi, replacement: "you've" },
    { pattern: /\bhe_d\b/gi, replacement: "he'd" },
    { pattern: /\bshe_d\b/gi, replacement: "she'd" },
    { pattern: /\bwe_d\b/gi, replacement: "we'd" },
    { pattern: /\bthey_d\b/gi, replacement: "they'd" },
    { pattern: /\byou_d\b/gi, replacement: "you'd" },
    { pattern: /\bcan_t\b/gi, replacement: "can't" },
    { pattern: /\bwon_t\b/gi, replacement: "won't" },
    { pattern: /\bdon_t\b/gi, replacement: "don't" },
    { pattern: /\bdoesn_t\b/gi, replacement: "doesn't" },
    { pattern: /\bdidn_t\b/gi, replacement: "didn't" },
    { pattern: /\bwouldn_t\b/gi, replacement: "wouldn't" },
    { pattern: /\bcouldn_t\b/gi, replacement: "couldn't" },
    { pattern: /\bshouldn_t\b/gi, replacement: "shouldn't" },
    { pattern: /\bhasn_t\b/gi, replacement: "hasn't" },
    { pattern: /\bhaven_t\b/gi, replacement: "haven't" },
    { pattern: /\bhadn_t\b/gi, replacement: "hadn't" },
    { pattern: /\bisn_t\b/gi, replacement: "isn't" },
    { pattern: /\baren_t\b/gi, replacement: "aren't" },
    { pattern: /\bwasn_t\b/gi, replacement: "wasn't" },
    { pattern: /\bweren_t\b/gi, replacement: "weren't" },
  ];

  // Apply all contraction patterns
  contractionPatterns.forEach(({ pattern, replacement }) => {
    cleaned = cleaned.replace(pattern, replacement);
  });

  // Articles and other words that should not be capitalized (unless first word or after quote)
  const articles = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "for",
    "nor",
    "so",
    "yet",
    "at",
    "by",
    "in",
    "of",
    "on",
    "to",
    "up",
    "as",
    "is",
    "it",
    "who",
    "what",
    "when",
    "where",
    "why",
    "how",
    "that",
    "with",
    "from",
    "into",
    "onto",
    "upon",
    "over",
    "under",
    "above",
    "below",
    "across",
    "through",
    "during",
    "before",
    "after",
    "until",
    "while",
    "within",
  ]);

  // Capitalize words appropriately, considering articles and quotes
  const words = cleaned.split(" ");

  cleaned = words
    .map((word, index) => {
      if (word.length === 0) return word;

      // Check if this word starts after a quote mark (including ALL quote variants)
      const startsAfterQuote =
        index > 0 &&
        /[\u0022\u0027\u00AB\u00BB\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2039\u203A\u2E42\u301D\u301E\u301F\uFF02\uFF07]$/.test(
          words[index - 1]
        );

      // Check if this word itself starts with a quote mark (first word inside quotes)
      // Using a more comprehensive approach to catch any quote-like character
      const startsWithQuote =
        /^[\u0022\u0027\u00AB\u00BB\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2039\u203A\u2E42\u301D\u301E\u301F\uFF02\uFF07]/.test(
          word
        );

      // Check if this word is entirely enclosed in quotes (like "hi")
      const isEnclosedInQuotes =
        /^[\u0022\u0027\u00AB\u00BB\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2039\u203A\u2E42\u301D\u301E\u301F\uFF02\uFF07].*[\u0022\u0027\u00AB\u00BB\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2039\u203A\u2E42\u301D\u301E\u301F\uFF02\uFF07]$/.test(
          word
        ) && word.length > 2;

      // Strip quotes when checking against articles list
      const wordWithoutQuotes = word
        .replace(
          /^[\u0022\u0027\u00AB\u00BB\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2039\u203A\u2E42\u301D\u301E\u301F\uFF02\uFF07]+|[\u0022\u0027\u00AB\u00BB\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F\u2039\u203A\u2E42\u301D\u301E\u301F\uFF02\uFF07]+$/g,
          ""
        )
        .toLowerCase();

      // // Debug logging for specific problematic words
      // if (word.includes('"') || startsWithQuote) {
      //   console.log(`🔍 DEBUG: word="${word}", index=${index}`);
      //   console.log(`   - startsAfterQuote: ${startsAfterQuote}`);
      //   console.log(`   - startsWithQuote: ${startsWithQuote}`);
      //   console.log(`   - isEnclosedInQuotes: ${isEnclosedInQuotes}`);
      //   console.log(`   - wordWithoutQuotes: "${wordWithoutQuotes}"`);
      //   console.log(`   - is in articles: ${articles.has(wordWithoutQuotes)}`);
      //   console.log(`   - first char code: ${word.charCodeAt(0)}`);
      // }

      // Capitalization rules:
      // 1. Always capitalize first word of entire string
      // 2. Always capitalize word immediately after a quote (like: He said "hello")
      // 3. Always capitalize first word inside quotes (like: "hello world")
      // 4. Always capitalize words entirely enclosed in quotes (like: "hi")
      // 5. Don't capitalize articles unless they fall into rules 1-4
      const shouldCapitalize =
        index === 0 || // First word of string
        startsAfterQuote || // Word after quote (He said "hello")
        startsWithQuote || // First word inside quotes ("hello world")
        isEnclosedInQuotes || // Entirely enclosed in quotes ("hi")
        !articles.has(wordWithoutQuotes); // Not an article

      // if (
      //   word.toLowerCase().includes("bye") ||
      //   word.includes('"') ||
      //   startsWithQuote
      // ) {
      //   console.log(`   - shouldCapitalize: ${shouldCapitalize}`);
      //   console.log(
      //     `   - final result: "${
      //       shouldCapitalize
      //         ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      //         : word.toLowerCase()
      //     }"`
      //   );
      // }

      if (shouldCapitalize) {
        // Find the first alphabetic character to capitalize, preserving any leading quotes
        let firstAlphaIndex = 0;
        for (let i = 0; i < word.length; i++) {
          if (/[a-zA-Z]/.test(word[i])) {
            firstAlphaIndex = i;
            break;
          }
        }

        if (firstAlphaIndex > 0) {
          // Word starts with non-alphabetic characters (like quotes)
          return (
            word.slice(0, firstAlphaIndex) +
            word.charAt(firstAlphaIndex).toUpperCase() +
            word.slice(firstAlphaIndex + 1).toLowerCase()
          );
        } else {
          // Word starts with alphabetic character
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
      } else {
        return word.toLowerCase();
      }
    })
    .join(" ");

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

export async function loadEarwaxSounds(
  allowExplicitContent: boolean = false
): Promise<SoundEffect[]> {
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
      const response = await fetch(`${SOUND_BASE_URL}/Earwax/EarwaxAudio.jet`);
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

    console.log(`Processing ${earwaxData.content.length} sound entries...`);

    // Debug counters
    let explicitCount = 0;
    let filteredByExplicit = 0;
    let validAfterBasicFiltering = 0;

    // Filter out empty objects and objects without id or name
    const validSounds = earwaxData.content.filter(
      (
        sound
      ): sound is Required<Pick<EarwaxSound, "id" | "name">> & EarwaxSound => {
        if (sound.id === undefined || sound.name === undefined) return false;
        if (typeof sound.name !== "string" || sound.name.trim() === "")
          return false;

        validAfterBasicFiltering++;

        // Count explicit content
        if (sound.x) {
          explicitCount++;
          if (!allowExplicitContent) {
            filteredByExplicit++;
            return false; // Filter out explicit content based on setting
          }
        }

        // Check if ID is valid (either number > 0 or non-empty string)
        if (typeof sound.id === "number") {
          return sound.id > 0;
        } else if (typeof sound.id === "string") {
          return sound.id.trim() !== "";
        }

        return false;
      }
    );

    console.log(`📊 Filtering stats:`);
    console.log(`  - Total entries: ${earwaxData.content.length}`);
    console.log(`  - Valid after basic filtering: ${validAfterBasicFiltering}`);
    console.log(`  - Explicit content found: ${explicitCount}`);
    console.log(`  - Filtered by explicit setting: ${filteredByExplicit}`);
    console.log(`  - Final valid sounds: ${validSounds.length}`);
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
    let duplicatesRemoved = 0;
    const uniqueSoundEffects = soundEffects.filter((sound) => {
      if (seenNames.has(sound.name)) {
        console.log(`🗑️ Removing duplicate: "${sound.name}" (ID: ${sound.id})`);
        duplicatesRemoved++;
        return false;
      }
      seenNames.add(sound.name);
      return true;
    });

    console.log(
      `🔄 Removed ${duplicatesRemoved} duplicate sound names (${soundEffects.length} -> ${uniqueSoundEffects.length})`
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
  category: string,
  allowExplicitContent: boolean = false
): Promise<SoundEffect[]> {
  const allSounds = await loadEarwaxSounds(allowExplicitContent);
  return allSounds.filter((sound) => sound.category === category);
}

// Get random sounds
export async function getRandomSounds(
  count: number,
  category?: string,
  allowExplicitContent: boolean = false
): Promise<SoundEffect[]> {
  const allSounds = await loadEarwaxSounds(allowExplicitContent);
  const sourceSounds = category
    ? allSounds.filter((sound) => sound.category === category)
    : allSounds;

  if (sourceSounds.length === 0) {
    console.warn(
      `[RANDOM_SOUNDS] No sounds available! allSounds: ${allSounds.length}, category: ${category}`
    );
    return [];
  }

  const requestedCount = Math.min(count, sourceSounds.length);
  const uniqueIndices = new Set<number>();
  const maxIndex = sourceSounds.length - 1;

  console.log(
    `[RANDOM_SOUNDS] Requesting ${count} sounds, source has ${sourceSounds.length} sounds, will generate ${requestedCount}`
  );

  // Keep adding random indices until we have the desired count
  while (uniqueIndices.size < requestedCount) {
    const randomIndex = Math.floor(Math.random() * (maxIndex + 1));
    uniqueIndices.add(randomIndex);
  }

  // Map the unique indices back to the source sounds array
  const result = Array.from(uniqueIndices)
    .map((index) => sourceSounds[index])
    .filter((sound) => sound !== undefined);

  console.log(
    `[RANDOM_SOUNDS] Generated ${result.length} sounds (expected: ${requestedCount})`
  );

  if (result.length !== requestedCount) {
    console.error(
      `[RANDOM_SOUNDS] ❌ Mismatch! Expected ${requestedCount}, got ${result.length}`
    );
    console.error(
      `[RANDOM_SOUNDS] Indices: [${Array.from(uniqueIndices)
        .sort()
        .join(", ")}]`
    );
    console.error(
      `[RANDOM_SOUNDS] sourceSounds.length: ${sourceSounds.length}, maxIndex: ${maxIndex}`
    );

    // Check for any undefined mappings
    const mappedResults = Array.from(uniqueIndices).map((index) => {
      const sound = sourceSounds[index];
      if (!sound) {
        console.error(
          `[RANDOM_SOUNDS] Index ${index} mapped to undefined sound!`
        );
      }
      return sound;
    });
    console.error(
      `[RANDOM_SOUNDS] Mapped results count: ${mappedResults.length}, filtered count: ${result.length}`
    );
  }

  return result;
}

// Clear cache (useful for development or when we know the file has changed)
export function clearSoundCache(): void {
  soundCache = null;
  cacheTimestamp = 0;
}

// Get all available categories
export async function getSoundCategories(
  allowExplicitContent: boolean = false
): Promise<string[]> {
  const allSounds = await loadEarwaxSounds(allowExplicitContent);
  return [...new Set(allSounds.map((s) => s.category))].sort();
}

// ========================================
// PROMPT LOADING FUNCTIONS
// ========================================

// Cache for loaded prompts to avoid re-parsing
let promptCache: GamePrompt[] | null = null;
let promptCacheTimestamp: number = 0;

export async function loadEarwaxPrompts(
  allowExplicitContent: boolean = false
): Promise<GamePrompt[]> {
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
      const response = await fetch(
        `${SOUND_BASE_URL}/Earwax/EarwaxPrompts.jet`
      );
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
      if (!allowExplicitContent && prompt.x) return false; // Filter out explicit content based on setting
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

// Get random prompts
export async function getRandomPrompts(
  count: number = 6,
  excludePromptIds: string[] = [],
  playerNames: string[] = [],
  allowExplicitContent: boolean = false
): Promise<GamePrompt[]> {
  const allPrompts = await loadEarwaxPrompts(allowExplicitContent);

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
