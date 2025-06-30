import fs from "fs";
import path from "path";

/**
 * Script to scan the GameEffects folders and generate the effectFiles object for useGameplayEffects.ts
 * Run this script whenever you add new sound effect files to update the hook automatically.
 *
 * Usage: npm run ts-node scripts/scan-game-effects.ts
 */

const EFFECTS_BASE_PATH = path.join(
  process.cwd(),
  "public",
  "sounds",
  "GameEffects"
);
const HOOK_FILE_PATH = path.join(
  process.cwd(),
  "src",
  "hooks",
  "useGameplayEffects.ts"
);

interface EffectFiles {
  [folderName: string]: string[];
}

function scanEffectFolders(): EffectFiles {
  const effectFiles: EffectFiles = {};

  try {
    if (!fs.existsSync(EFFECTS_BASE_PATH)) {
      console.error(
        `GameEffects base path does not exist: ${EFFECTS_BASE_PATH}`
      );
      return effectFiles;
    }

    const folders = fs
      .readdirSync(EFFECTS_BASE_PATH, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    console.log("Found effect folders:", folders);

    folders.forEach((folder) => {
      const folderPath = path.join(EFFECTS_BASE_PATH, folder);
      const files = fs.readdirSync(folderPath).filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [".mp3", ".wav", ".ogg", ".m4a"].includes(ext);
      });

      effectFiles[folder] = files;
      console.log(`${folder}: ${files.length} files`);
      files.forEach((file) => console.log(`  - ${file}`));
    });
  } catch (error) {
    console.error("Error scanning effect folders:", error);
  }

  return effectFiles;
}

function generateEffectFilesObject(effectFiles: EffectFiles): string {
  const entries = Object.entries(effectFiles)
    .map(([folder, files]) => {
      if (files.length === 0) {
        return `  ${folder}: [], // Add files as they're discovered`;
      }
      const fileList = files.map((file) => `'${file}'`).join(", ");
      return `  ${folder}: [${fileList}]`;
    })
    .join(",\n");

  return `const effectFiles: Record<string, string[]> = {
${entries}
};`;
}

function updateHookFile(effectFiles: EffectFiles): void {
  try {
    const hookContent = fs.readFileSync(HOOK_FILE_PATH, "utf8");
    const newEffectFiles = generateEffectFilesObject(effectFiles);

    // Find and replace the effectFiles object
    const effectFilesPattern =
      /const effectFiles: Record<string, string\[\]> = \{[\s\S]*?\};/;

    if (!effectFilesPattern.test(hookContent)) {
      console.error("Could not find effectFiles object in hook file");
      console.log("Please manually update the effectFiles object with:");
      console.log("\n" + newEffectFiles + "\n");
      return;
    }

    const updatedContent = hookContent.replace(
      effectFilesPattern,
      newEffectFiles
    );
    fs.writeFileSync(HOOK_FILE_PATH, updatedContent, "utf8");

    console.log(
      "\n✅ Successfully updated useGameplayEffects.ts with new effect files!"
    );
  } catch (error) {
    console.error("Error updating hook file:", error);
    console.log("Please manually update the effectFiles object with:");
    console.log("\n" + generateEffectFilesObject(effectFiles) + "\n");
  }
}

function main() {
  console.log("🎮 Scanning GameEffects folders...\n");

  const effectFiles = scanEffectFolders();
  const totalFiles = Object.values(effectFiles).reduce(
    (sum, files) => sum + files.length,
    0
  );

  console.log(
    `\n📊 Found ${totalFiles} effect files across ${
      Object.keys(effectFiles).length
    } folders\n`
  );

  if (totalFiles > 0) {
    console.log("🔧 Updating useGameplayEffects.ts...");
    updateHookFile(effectFiles);
  } else {
    console.log(
      "⚠️  No effect files found. Please add some .mp3, .wav, .ogg, or .m4a files to the GameEffects folders."
    );
  }
}

if (require.main === module) {
  main();
}

export { scanEffectFolders, generateEffectFilesObject };
