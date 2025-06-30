import fs from "fs";
import path from "path";

/**
 * Script to scan the Music folders and generate the knownFiles object for useBackgroundMusic.ts
 * Run this script whenever you add new music files to update the hook automatically.
 *
 * Usage: npm run ts-node scripts/scan-music-files.ts
 */

const MUSIC_BASE_PATH = path.join(process.cwd(), "public", "sounds", "Music");
const HOOK_FILE_PATH = path.join(
  process.cwd(),
  "src",
  "hooks",
  "useBackgroundMusic.ts"
);

interface MusicFiles {
  [folderName: string]: string[];
}

function scanMusicFolders(): MusicFiles {
  const musicFiles: MusicFiles = {};

  try {
    if (!fs.existsSync(MUSIC_BASE_PATH)) {
      console.error(`Music base path does not exist: ${MUSIC_BASE_PATH}`);
      return musicFiles;
    }

    const folders = fs
      .readdirSync(MUSIC_BASE_PATH, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    console.log("Found music folders:", folders);

    folders.forEach((folder) => {
      const folderPath = path.join(MUSIC_BASE_PATH, folder);
      const files = fs.readdirSync(folderPath).filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return [".mp3", ".wav", ".ogg", ".m4a"].includes(ext);
      });

      musicFiles[folder] = files;
      console.log(`${folder}: ${files.length} files`);
      files.forEach((file) => console.log(`  - ${file}`));
    });
  } catch (error) {
    console.error("Error scanning music folders:", error);
  }

  return musicFiles;
}

function generateKnownFilesObject(musicFiles: MusicFiles): string {
  const entries = Object.entries(musicFiles)
    .map(([folder, files]) => {
      const fileList = files.map((file) => `'${file}'`).join(", ");
      return `      '${folder}': [${fileList}]`;
    })
    .join(",\n");

  return `    const knownFiles: Record<string, string[]> = {
${entries}
    };`;
}

function updateHookFile(musicFiles: MusicFiles): void {
  try {
    const hookContent = fs.readFileSync(HOOK_FILE_PATH, "utf8");
    const newKnownFiles = generateKnownFilesObject(musicFiles);

    // Find and replace the knownFiles object
    const knownFilesPattern =
      /const knownFiles: Record<string, string\[\]> = \{[\s\S]*?\};/;

    if (!knownFilesPattern.test(hookContent)) {
      console.error("Could not find knownFiles object in hook file");
      console.log("Please manually update the knownFiles object with:");
      console.log("\n" + newKnownFiles + "\n");
      return;
    }

    const updatedContent = hookContent.replace(
      knownFilesPattern,
      newKnownFiles
    );
    fs.writeFileSync(HOOK_FILE_PATH, updatedContent, "utf8");

    console.log(
      "\n✅ Successfully updated useBackgroundMusic.ts with new music files!"
    );
  } catch (error) {
    console.error("Error updating hook file:", error);
    console.log("Please manually update the knownFiles object with:");
    console.log("\n" + generateKnownFilesObject(musicFiles) + "\n");
  }
}

function main() {
  console.log("🎵 Scanning music folders...\n");

  const musicFiles = scanMusicFolders();
  const totalFiles = Object.values(musicFiles).reduce(
    (sum, files) => sum + files.length,
    0
  );

  console.log(
    `\n📊 Found ${totalFiles} music files across ${
      Object.keys(musicFiles).length
    } folders\n`
  );

  if (totalFiles > 0) {
    console.log("🔧 Updating useBackgroundMusic.ts...");
    updateHookFile(musicFiles);
  } else {
    console.log(
      "⚠️  No music files found. Please add some .mp3, .wav, .ogg, or .m4a files to the Music folders."
    );
  }
}

if (require.main === module) {
  main();
}

export { scanMusicFolders, generateKnownFilesObject };
